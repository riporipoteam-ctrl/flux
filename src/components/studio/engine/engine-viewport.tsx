"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { loadBabylonRuntime } from "@/lib/babylon-runtime";
import type {
  EngineCameraView,
  EngineNode,
  EngineVector3,
  FluxEngineProject,
  TransformMode,
} from "@/types/flux-engine";

export interface EngineViewportHandle {
  focusSelection: () => void;
  setCameraView: (view: EngineCameraView) => void;
  capture: () => string | null;
  jumpPlayer: () => void;
}

interface Props {
  project: FluxEngineProject;
  selectedId: string | null;
  transformMode: TransformMode;
  runtimeState: "edit" | "playing" | "paused";
  onSelect: (id: string | null) => void;
  onTransform: (id: string, patch: Pick<EngineNode, "position" | "rotation" | "scale">) => void;
  onRuntimeTransform?: (id: string, patch: Pick<EngineNode, "position" | "rotation" | "scale">) => void;
  onLog: (level: "info" | "success" | "warning" | "error", message: string) => void;
  onReady?: () => void;
}

interface RuntimeContext {
  B: any;
  engine: any;
  scene: any;
  camera: any;
  ambient: any;
  gizmos: any;
  highlight: any;
  objects: Map<string, any>;
  lights: Map<string, any>;
  grid: any[];
  scriptBaseY: Map<string, number>;
  scriptBaseScale: Map<string, EngineVector3>;
  keys: Record<string, boolean>;
  player: any | null;
  disposed: boolean;
}

export const EngineViewport = forwardRef<EngineViewportHandle, Props>(function EngineViewport({
  project,
  selectedId,
  transformMode,
  runtimeState,
  onSelect,
  onTransform,
  onRuntimeTransform,
  onLog,
  onReady,
}, ref) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const contextRef = useRef<RuntimeContext | null>(null);
  const projectRef = useRef(project);
  const selectedRef = useRef(selectedId);
  const runtimeRef = useRef(runtimeState);
  const transformCallbackRef = useRef(onTransform);
  const runtimeTransformCallbackRef = useRef(onRuntimeTransform);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  projectRef.current = project;
  selectedRef.current = selectedId;
  runtimeRef.current = runtimeState;
  transformCallbackRef.current = onTransform;
  runtimeTransformCallbackRef.current = onRuntimeTransform;

  useImperativeHandle(ref, () => ({
    focusSelection: () => focusSelection(contextRef.current, selectedRef.current),
    setCameraView: (view) => setCameraView(contextRef.current, view),
    capture: () => {
      const canvas = canvasRef.current;
      if (!canvas) return null;
      try {
        return canvas.toDataURL("image/webp", 0.82);
      } catch {
        return null;
      }
    },
    jumpPlayer: () => jumpPlayer(contextRef.current),
  }), []);

  useEffect(() => {
    let cancelled = false;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const start = async () => {
      try {
        const B = await loadBabylonRuntime();
        if (cancelled) return;
        const engine = new B.Engine(canvas, true, {
          preserveDrawingBuffer: true,
          stencil: true,
          antialias: true,
          adaptToDeviceRatio: true,
        });
        engine.setHardwareScalingLevel(Math.max(1, window.devicePixelRatio > 1.5 ? 1.35 : 1));
        const scene = new B.Scene(engine);
        scene.useRightHandedSystem = false;
        scene.clearColor = B.Color4.FromHexString(`${projectRef.current.settings.background}ff`);

        const camera = new B.ArcRotateCamera(
          "flux-editor-camera",
          -Math.PI / 2,
          Math.PI / 3,
          18,
          new B.Vector3(0, 1, 0),
          scene
        );
        camera.attachControl(canvas, true);
        camera.lowerRadiusLimit = 1.5;
        camera.upperRadiusLimit = 250;
        camera.wheelPrecision = 26;
        camera.panningSensibility = 70;
        camera.inertia = 0.72;

        const ambient = new B.HemisphericLight("flux-ambient", new B.Vector3(0, 1, 0), scene);
        ambient.intensity = projectRef.current.settings.ambientIntensity;
        ambient.diffuse = B.Color3.FromHexString(projectRef.current.settings.ambientColor);
        ambient.specular = new B.Color3(0.22, 0.22, 0.24);

        const gizmos = new B.GizmoManager(scene);
        gizmos.usePointerToAttachGizmos = false;
        gizmos.clearGizmoOnEmptyPointerEvent = false;
        gizmos.boundingBoxGizmoEnabled = false;

        const highlight = new B.HighlightLayer("flux-selection", scene);
        highlight.blurHorizontalSize = 0.7;
        highlight.blurVerticalSize = 0.7;

        const context: RuntimeContext = {
          B,
          engine,
          scene,
          camera,
          ambient,
          gizmos,
          highlight,
          objects: new Map(),
          lights: new Map(),
          grid: [],
          scriptBaseY: new Map(),
          scriptBaseScale: new Map(),
          keys: {},
          player: null,
          disposed: false,
        };
        contextRef.current = context;

        try {
          if (window.CANNON) {
            scene.enablePhysics(
              new B.Vector3(0, projectRef.current.settings.gravity, 0),
              new B.CannonJSPlugin(true, 10, window.CANNON)
            );
          }
        } catch (physicsError) {
          onLog("warning", `Physics could not start: ${physicsError instanceof Error ? physicsError.message : "unknown error"}`);
        }

        scene.onPointerObservable.add((pointerInfo: any) => {
          if (pointerInfo.type !== B.PointerEventTypes.POINTERDOWN) return;
          const pick = pointerInfo.pickInfo;
          const id = pick?.pickedMesh?.metadata?.fluxId || null;
          if (id) onSelect(String(id));
          else if (!gizmos.attachedMesh) onSelect(null);
        });

        scene.onPointerUp = () => syncSelectedTransform(context);
        bindKeyboard(context, onLog);
        await syncSceneObjects(context, projectRef.current, onLog);
        applyWorldSettings(context, projectRef.current);
        updateGrid(context, projectRef.current);
        updateSelection(context, selectedRef.current, transformMode, projectRef.current);

        scene.onBeforeRenderObservable.add(() => {
          if (runtimeRef.current === "playing") runPlayFrame(context, projectRef.current, runtimeTransformCallbackRef.current);
        });

        engine.runRenderLoop(() => {
          if (!context.disposed) scene.render();
        });

        const resize = () => engine.resize();
        window.addEventListener("resize", resize);
        const observer = new ResizeObserver(resize);
        observer.observe(canvas);
        (context as RuntimeContext & { cleanup?: () => void }).cleanup = () => {
          window.removeEventListener("resize", resize);
          observer.disconnect();
          unbindKeyboard(context);
        };

        setLoading(false);
        onLog("success", "Flux Engine WebGL viewport is ready.");
        onReady?.();
      } catch (nextError) {
        const message = nextError instanceof Error ? nextError.message : "The 3D engine could not load.";
        setError(message);
        setLoading(false);
        onLog("error", message);
      }
    };

    void start();
    return () => {
      cancelled = true;
      const context = contextRef.current as (RuntimeContext & { cleanup?: () => void }) | null;
      if (!context) return;
      context.disposed = true;
      context.cleanup?.();
      context.gizmos?.dispose?.();
      context.highlight?.dispose?.();
      context.scene?.dispose?.();
      context.engine?.dispose?.();
      contextRef.current = null;
    };
  }, [onLog, onReady, onSelect]);

  useEffect(() => {
    const context = contextRef.current;
    if (!context) return;
    void syncSceneObjects(context, project, onLog).then(() => {
      applyWorldSettings(context, project);
      updateGrid(context, project);
      updateSelection(context, selectedId, transformMode, project);
    });
  }, [onLog, project]);

  useEffect(() => {
    const context = contextRef.current;
    if (!context) return;
    updateSelection(context, selectedId, transformMode, project);
  }, [project, selectedId, transformMode]);

  useEffect(() => {
    const context = contextRef.current;
    if (!context) return;
    if (runtimeState === "playing") {
      attachPhysics(context, project, onLog);
      context.gizmos.attachToMesh(null);
      context.highlight.removeAllMeshes();
      context.player = project.settings.playerNodeId ? context.objects.get(project.settings.playerNodeId) || null : null;
      if (context.player) context.camera.lockedTarget = context.player;
      onLog("info", "Play mode started. WASD moves the configured player; Space jumps.");
    } else if (runtimeState === "paused") {
      onLog("info", "Play mode paused.");
    } else {
      context.camera.lockedTarget = null;
      context.player = null;
      disposePhysics(context);
      updateSelection(context, selectedId, transformMode, project);
    }
  }, [onLog, project, runtimeState, selectedId, transformMode]);

  return (
    <div className="flux-engine-viewport">
      <canvas ref={canvasRef} className="h-full w-full touch-none outline-none" aria-label="Flux Engine 3D viewport" />
      {loading ? (
        <div className="flux-engine-loading">
          <span className="flux-engine-spinner" />
          <strong>Starting 3D engine</strong>
          <small>Loading WebGL, model loaders and physics…</small>
        </div>
      ) : null}
      {error ? (
        <div className="flux-engine-loading flux-engine-error">
          <strong>3D engine failed to load</strong>
          <small>{error}</small>
          <button type="button" onClick={() => window.location.reload()}>Reload Studio</button>
        </div>
      ) : null}
      <div className="flux-engine-axis" aria-hidden>
        <span className="x">X</span><span className="y">Y</span><span className="z">Z</span>
      </div>
    </div>
  );
});

async function syncSceneObjects(context: RuntimeContext, project: FluxEngineProject, onLog: Props["onLog"]): Promise<void> {
  const wanted = new Set(project.nodes.map((node) => node.id));
  for (const [id, object] of context.objects) {
    if (wanted.has(id)) continue;
    context.highlight.removeMesh?.(object);
    context.lights.get(id)?.dispose?.();
    context.lights.delete(id);
    object.dispose?.(false, true);
    context.objects.delete(id);
  }

  for (const node of project.nodes) {
    let object = context.objects.get(node.id);
    if (!object) object = await createRuntimeObject(context, node, onLog);
    if (object) applyNode(context, object, node);
  }

  for (const node of project.nodes) {
    const object = context.objects.get(node.id);
    if (!object) continue;
    const parent = node.parentId ? context.objects.get(node.parentId) : null;
    if (object.parent !== parent) object.parent = parent || null;
  }
}

async function createRuntimeObject(context: RuntimeContext, node: EngineNode, onLog: Props["onLog"]): Promise<any | null> {
  const { B, scene } = context;
  let object: any = null;

  if (node.kind === "box") object = B.MeshBuilder.CreateBox(node.id, { size: 2 }, scene);
  else if (node.kind === "sphere") object = B.MeshBuilder.CreateSphere(node.id, { diameter: 2, segments: 28 }, scene);
  else if (node.kind === "cylinder") object = B.MeshBuilder.CreateCylinder(node.id, { height: 2, diameter: 2, tessellation: 32 }, scene);
  else if (node.kind === "cone") object = B.MeshBuilder.CreateCylinder(node.id, { height: 2, diameterTop: 0, diameterBottom: 2, tessellation: 32 }, scene);
  else if (node.kind === "plane") object = B.MeshBuilder.CreatePlane(node.id, { size: 2, sideOrientation: B.Mesh.DOUBLESIDE }, scene);
  else if (node.kind === "ground") object = B.MeshBuilder.CreateGround(node.id, { width: 2, height: 2, subdivisions: 2 }, scene);
  else if (node.kind === "terrain") {
    const subdivisions = clampNumber(node.metadata?.subdivisions, 8, 96, 48);
    object = B.MeshBuilder.CreateGround(node.id, { width: 2, height: 2, subdivisions, updatable: true }, scene);
    sculptTerrain(context, object, node);
  } else if (node.kind === "spawn") {
    object = B.MeshBuilder.CreateCylinder(node.id, { height: 0.12, diameter: 2, tessellation: 40 }, scene);
  } else if (node.kind === "model" && node.sourceUrl) {
    try {
      const result = await B.SceneLoader.ImportMeshAsync(null, "", node.sourceUrl, scene, undefined, node.sourceName?.toLowerCase().endsWith(".gltf") ? ".gltf" : ".glb");
      object = new B.TransformNode(node.id, scene);
      for (const mesh of result.meshes || []) {
        if (mesh === object || !mesh.parent) mesh.parent = object;
      }
      onLog("success", `Imported ${node.sourceName || node.name}.`);
    } catch (importError) {
      onLog("error", `Model import failed: ${importError instanceof Error ? importError.message : "unknown error"}`);
      object = B.MeshBuilder.CreateBox(node.id, { size: 2 }, scene);
    }
  } else if (node.kind.includes("light")) {
    object = B.MeshBuilder.CreateSphere(`${node.id}-proxy`, { diameter: 0.45, segments: 12 }, scene);
    object.isPickable = true;
    let light: any;
    if (node.kind === "point-light") light = new B.PointLight(node.id, B.Vector3.Zero(), scene);
    else if (node.kind === "spot-light") light = new B.SpotLight(node.id, B.Vector3.Zero(), new B.Vector3(0, -1, 0), Math.PI / 3, 2, scene);
    else light = new B.DirectionalLight(node.id, new B.Vector3(-0.5, -1, 0.5), scene);
    context.lights.set(node.id, light);
  } else {
    object = new B.TransformNode(node.id, scene);
  }

  if (!object) return null;
  object.metadata = { ...(object.metadata || {}), fluxId: node.id };
  object.name = node.name;
  context.objects.set(node.id, object);
  return object;
}

function applyNode(context: RuntimeContext, object: any, node: EngineNode): void {
  const { B, lights, scene } = context;
  object.name = node.name;
  object.metadata = { ...(object.metadata || {}), fluxId: node.id, script: node.script, tags: node.tags };
  object.position?.copyFrom?.(vector(B, node.position));
  object.rotation?.copyFrom?.(vector(B, node.rotation));
  object.scaling?.copyFrom?.(vector(B, node.scale));
  if ("isVisible" in object) object.isVisible = node.visible;
  if ("isPickable" in object) object.isPickable = !node.locked || node.kind.includes("light");
  if ("receiveShadows" in object) object.receiveShadows = node.receiveShadow;

  if (object.getChildMeshes && node.kind === "model") {
    for (const child of object.getChildMeshes()) {
      child.metadata = { ...(child.metadata || {}), fluxId: node.id };
      child.isPickable = !node.locked;
    }
  }

  if (object.material !== undefined && node.kind !== "model") {
    let material = object.material;
    if (!material || material.metadata?.fluxMaterial !== node.id) {
      material = new B.StandardMaterial(`flux-material-${node.id}`, scene);
      material.metadata = { fluxMaterial: node.id };
      object.material = material;
    }
    material.diffuseColor = B.Color3.FromHexString(node.material.color || "#7c8cff");
    material.emissiveColor = B.Color3.FromHexString(node.material.emissive || "#000000");
    material.alpha = node.material.opacity;
    material.wireframe = node.material.wireframe;
    material.specularPower = Math.max(2, 128 * (1 - node.material.roughness));
    if (node.kind === "spawn") material.emissiveColor = B.Color3.FromHexString("#14532d");
  }

  const light = lights.get(node.id);
  if (light) {
    light.position?.copyFrom?.(vector(B, node.position));
    light.diffuse = B.Color3.FromHexString(node.material.color || "#ffffff");
    light.intensity = Number(node.metadata?.intensity ?? 1);
    if (node.kind === "directional-light") {
      light.direction = directionFromRotation(B, node.rotation);
    } else if (node.kind === "spot-light") {
      light.direction = directionFromRotation(B, node.rotation);
      light.angle = Number(node.metadata?.angle ?? Math.PI / 3);
    }
  }
}

function applyWorldSettings(context: RuntimeContext, project: FluxEngineProject): void {
  const { B, scene, ambient } = context;
  scene.clearColor = B.Color4.FromHexString(`${project.settings.background}ff`);
  ambient.intensity = project.settings.ambientIntensity;
  ambient.diffuse = B.Color3.FromHexString(project.settings.ambientColor);
  if (project.settings.fogEnabled) {
    scene.fogMode = B.Scene.FOGMODE_EXP2;
    scene.fogColor = B.Color3.FromHexString(project.settings.fogColor);
    scene.fogDensity = project.settings.fogDensity;
  } else {
    scene.fogMode = B.Scene.FOGMODE_NONE;
  }
  scene.getPhysicsEngine?.()?.setGravity?.(new B.Vector3(0, project.settings.gravity, 0));
}

function updateGrid(context: RuntimeContext, project: FluxEngineProject): void {
  for (const item of context.grid) item.dispose?.();
  context.grid = [];
  if (!project.settings.gridVisible) return;
  const { B, scene } = context;
  const extent = 50;
  const step = Math.max(0.25, project.settings.gridSize || 1);
  const points: any[] = [];
  for (let value = -extent; value <= extent; value += step) {
    points.push([new B.Vector3(-extent, 0.006, value), new B.Vector3(extent, 0.006, value)]);
    points.push([new B.Vector3(value, 0.006, -extent), new B.Vector3(value, 0.006, extent)]);
  }
  const lines = B.MeshBuilder.CreateLineSystem("flux-grid", { lines: points, updatable: false }, scene);
  lines.color = new B.Color3(0.22, 0.25, 0.3);
  lines.alpha = 0.42;
  lines.isPickable = false;
  lines.renderingGroupId = 0;
  context.grid.push(lines);
}

function updateSelection(context: RuntimeContext, selectedId: string | null, mode: TransformMode, project: FluxEngineProject): void {
  const { B, gizmos, highlight } = context;
  highlight.removeAllMeshes();
  gizmos.positionGizmoEnabled = false;
  gizmos.rotationGizmoEnabled = false;
  gizmos.scaleGizmoEnabled = false;
  const object = selectedId ? context.objects.get(selectedId) : null;
  const node = selectedId ? project.nodes.find((item) => item.id === selectedId) : null;
  if (!object || !node || node.locked || runtimeRefValue(context) !== "edit") {
    gizmos.attachToMesh(null);
    return;
  }
  gizmos.attachToMesh(object);
  if (mode === "move") gizmos.positionGizmoEnabled = true;
  else if (mode === "rotate") gizmos.rotationGizmoEnabled = true;
  else if (mode === "scale") gizmos.scaleGizmoEnabled = true;
  else gizmos.attachToMesh(null);

  if (project.settings.snapEnabled) {
    if (gizmos.gizmos.positionGizmo) gizmos.gizmos.positionGizmo.snapDistance = project.settings.snapPosition;
    if (gizmos.gizmos.rotationGizmo) gizmos.gizmos.rotationGizmo.snapDistance = project.settings.snapRotation * Math.PI / 180;
    if (gizmos.gizmos.scaleGizmo) gizmos.gizmos.scaleGizmo.snapDistance = project.settings.snapScale;
  }

  const meshes = object.getChildMeshes ? [object, ...object.getChildMeshes()] : [object];
  for (const mesh of meshes) {
    if (mesh instanceof B.AbstractMesh) highlight.addMesh(mesh, new B.Color3(0.25, 0.65, 1));
  }
}

function runtimeRefValue(_context: RuntimeContext): "edit" | "playing" | "paused" {
  return runtimeRefGlobal.current;
}

const runtimeRefGlobal: { current: "edit" | "playing" | "paused" } = { current: "edit" };

function syncSelectedTransform(context: RuntimeContext): void {
  const id = selectedIdGlobal.current;
  if (!id || runtimeRefGlobal.current !== "edit") return;
  const object = context.objects.get(id);
  if (!object) return;
  transformCallbackGlobal.current?.(id, {
    position: plainVector(object.position),
    rotation: plainVector(object.rotation),
    scale: plainVector(object.scaling),
  });
}

const selectedIdGlobal: { current: string | null } = { current: null };
const transformCallbackGlobal: { current: Props["onTransform"] | null } = { current: null };

function bindKeyboard(context: RuntimeContext, onLog: Props["onLog"]): void {
  const down = (event: KeyboardEvent) => {
    context.keys[event.key] = true;
    context.keys[event.key.toLowerCase()] = true;
    if (event.code === "Space") {
      context.keys[" "] = true;
      if (runtimeRefGlobal.current === "playing") jumpPlayer(context);
    }
  };
  const up = (event: KeyboardEvent) => {
    context.keys[event.key] = false;
    context.keys[event.key.toLowerCase()] = false;
    if (event.code === "Space") context.keys[" "] = false;
  };
  window.addEventListener("keydown", down);
  window.addEventListener("keyup", up);
  (context as RuntimeContext & { keyboardCleanup?: () => void }).keyboardCleanup = () => {
    window.removeEventListener("keydown", down);
    window.removeEventListener("keyup", up);
  };
  onLog("info", "Keyboard input map connected.");
}

function unbindKeyboard(context: RuntimeContext): void {
  (context as RuntimeContext & { keyboardCleanup?: () => void }).keyboardCleanup?.();
}

function attachPhysics(context: RuntimeContext, project: FluxEngineProject, onLog: Props["onLog"]): void {
  const { B, scene } = context;
  for (const node of project.nodes) {
    const object = context.objects.get(node.id);
    if (!object || !(object instanceof B.AbstractMesh) || !node.physics.enabled || object.physicsImpostor) continue;
    const impostor = node.kind === "sphere"
      ? B.PhysicsImpostor.SphereImpostor
      : node.kind === "cylinder" || node.kind === "cone"
        ? B.PhysicsImpostor.CylinderImpostor
        : B.PhysicsImpostor.BoxImpostor;
    try {
      object.physicsImpostor = new B.PhysicsImpostor(object, impostor, {
        mass: node.physics.static ? 0 : node.physics.mass,
        friction: node.physics.friction,
        restitution: node.physics.restitution,
      }, scene);
    } catch (error) {
      onLog("warning", `Physics skipped for ${node.name}: ${error instanceof Error ? error.message : "unknown error"}`);
    }
  }
}

function disposePhysics(context: RuntimeContext): void {
  for (const object of context.objects.values()) {
    object.physicsImpostor?.dispose?.();
    object.physicsImpostor = null;
  }
}

function runPlayFrame(context: RuntimeContext, project: FluxEngineProject, runtimeTransform: Props["onRuntimeTransform"] | undefined): void {
  const dt = Math.min(0.05, context.engine.getDeltaTime() / 1000);
  const time = performance.now() / 1000;
  for (const node of project.nodes) {
    if (!node.script.trim()) continue;
    const object = context.objects.get(node.id);
    if (!object) continue;
    for (const line of node.script.split(/\n|;/)) {
      const parts = line.trim().toLowerCase().split(/\s+/);
      if (!parts[0]) continue;
      if (parts[0] === "spin") {
        const axis = axisName(parts[1]);
        object.rotation[axis] += Number(parts[2] || 1) * dt;
      } else if (parts[0] === "bob") {
        const amplitude = Number(parts[1] || 0.5);
        const speed = Number(parts[2] || 2);
        if (!context.scriptBaseY.has(node.id)) context.scriptBaseY.set(node.id, object.position.y);
        object.position.y = (context.scriptBaseY.get(node.id) || 0) + Math.sin(time * speed) * amplitude;
      } else if (parts[0] === "pulse") {
        const min = Number(parts[1] || 0.8);
        const max = Number(parts[2] || 1.2);
        const speed = Number(parts[3] || 2);
        if (!context.scriptBaseScale.has(node.id)) context.scriptBaseScale.set(node.id, plainVector(object.scaling));
        const base = context.scriptBaseScale.get(node.id) || { x: 1, y: 1, z: 1 };
        const factor = min + (Math.sin(time * speed) + 1) / 2 * (max - min);
        object.scaling.set(base.x * factor, base.y * factor, base.z * factor);
      }
    }
  }

  const player = context.player;
  if (player) {
    const forward = context.camera.getForwardRay().direction;
    forward.y = 0;
    forward.normalize();
    const right = context.B.Vector3.Cross(forward, context.B.Axis.Y).normalize();
    const movement = context.B.Vector3.Zero();
    if (context.keys.w || context.keys.ArrowUp) movement.addInPlace(forward);
    if (context.keys.s || context.keys.ArrowDown) movement.subtractInPlace(forward);
    if (context.keys.a || context.keys.ArrowLeft) movement.addInPlace(right);
    if (context.keys.d || context.keys.ArrowRight) movement.subtractInPlace(right);
    if (movement.lengthSquared() > 0) {
      movement.normalize().scaleInPlace(5 * dt);
      if (player.physicsImpostor) player.physicsImpostor.setLinearVelocity?.(new context.B.Vector3(movement.x / dt, player.physicsImpostor.getLinearVelocity?.()?.y || 0, movement.z / dt));
      else if (player.moveWithCollisions) player.moveWithCollisions(movement);
      else player.position.addInPlace(movement);
    }
    runtimeTransform?.(String(player.metadata?.fluxId || project.settings.playerNodeId), {
      position: plainVector(player.position), rotation: plainVector(player.rotation), scale: plainVector(player.scaling),
    });
  }
}

function jumpPlayer(context: RuntimeContext | null): void {
  const player = context?.player;
  if (!player) return;
  if (player.physicsImpostor) {
    player.physicsImpostor.applyImpulse(new context!.B.Vector3(0, 5, 0), player.getAbsolutePosition());
  } else {
    player.position.y += 0.8;
  }
}

function focusSelection(context: RuntimeContext | null, selectedId: string | null): void {
  if (!context || !selectedId) return;
  const object = context.objects.get(selectedId);
  if (!object) return;
  const target = object.getBoundingInfo?.().boundingSphere?.centerWorld || object.getAbsolutePosition?.() || object.position;
  context.camera.setTarget(target);
  const radius = object.getBoundingInfo?.().boundingSphere?.radiusWorld || 2;
  context.camera.radius = Math.max(3, radius * 4.5);
}

function setCameraView(context: RuntimeContext | null, view: EngineCameraView): void {
  if (!context) return;
  const { camera } = context;
  if (view === "top") { camera.alpha = -Math.PI / 2; camera.beta = 0.01; }
  else if (view === "front") { camera.alpha = -Math.PI / 2; camera.beta = Math.PI / 2; }
  else if (view === "right") { camera.alpha = 0; camera.beta = Math.PI / 2; }
  else { camera.alpha = -Math.PI / 2; camera.beta = Math.PI / 3; }
}

function sculptTerrain(context: RuntimeContext, mesh: any, node: EngineNode): void {
  const positions = mesh.getVerticesData(context.B.VertexBuffer.PositionKind);
  if (!positions) return;
  const amplitude = clampNumber(node.metadata?.amplitude, 0, 10, 1.5);
  const frequency = clampNumber(node.metadata?.frequency, 0.02, 2, 0.22);
  for (let index = 0; index < positions.length; index += 3) {
    const x = positions[index];
    const z = positions[index + 2];
    positions[index + 1] = (Math.sin(x * frequency * 4) + Math.cos(z * frequency * 3)) * amplitude * 0.16;
  }
  mesh.updateVerticesData(context.B.VertexBuffer.PositionKind, positions);
  mesh.convertToFlatShadedMesh?.();
  mesh.refreshBoundingInfo?.();
}

function vector(B: any, value: EngineVector3): any {
  return new B.Vector3(value.x, value.y, value.z);
}

function plainVector(value: any): EngineVector3 {
  return { x: Number(value?.x || 0), y: Number(value?.y || 0), z: Number(value?.z || 0) };
}

function directionFromRotation(B: any, rotation: EngineVector3): any {
  const matrix = B.Matrix.RotationYawPitchRoll(rotation.y, rotation.x, rotation.z);
  return B.Vector3.TransformNormal(new B.Vector3(0, -1, 0), matrix).normalize();
}

function axisName(value?: string): "x" | "y" | "z" {
  return value === "x" || value === "z" ? value : "y";
}

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
}
