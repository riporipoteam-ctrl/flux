"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { loadBabylonRuntime } from "@/lib/babylon-runtime";
import type { EngineCameraView, EngineNode, EngineVector3, FluxEngineProject, TransformMode } from "@/types/flux-engine";

export interface EngineViewportHandle {
  focusSelection: () => void;
  setCameraView: (view: EngineCameraView) => void;
  capture: () => string | null;
  jumpPlayer: () => void;
}

type RuntimeState = "edit" | "playing" | "paused";
type LogLevel = "info" | "success" | "warning" | "error";

interface Props {
  project: FluxEngineProject;
  selectedId: string | null;
  transformMode: TransformMode;
  runtimeState: RuntimeState;
  onSelect: (id: string | null) => void;
  onTransform: (id: string, patch: Pick<EngineNode, "position" | "rotation" | "scale">) => void;
  onRuntimeTransform?: (id: string, patch: Pick<EngineNode, "position" | "rotation" | "scale">) => void;
  onLog: (level: LogLevel, message: string) => void;
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
  project: FluxEngineProject;
  selectedId: string | null;
  transformMode: TransformMode;
  runtimeState: RuntimeState;
  onSelect: Props["onSelect"];
  onTransform: Props["onTransform"];
  onRuntimeTransform?: Props["onRuntimeTransform"];
  onLog: Props["onLog"];
  disposed: boolean;
  cleanup?: () => void;
  keyboardCleanup?: () => void;
}

export const EngineViewportV2 = forwardRef<EngineViewportHandle, Props>(function EngineViewportV2(props, ref) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const contextRef = useRef<RuntimeContext | null>(null);
  const propsRef = useRef(props);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  propsRef.current = props;

  useImperativeHandle(ref, () => ({
    focusSelection: () => focusSelection(contextRef.current),
    setCameraView: (view) => setCameraView(contextRef.current, view),
    capture: () => {
      try {
        return canvasRef.current?.toDataURL("image/webp", 0.84) || null;
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

    const boot = async () => {
      try {
        const B = await loadBabylonRuntime();
        if (cancelled) return;
        const current = propsRef.current;
        const engine = new B.Engine(canvas, true, { antialias: true, preserveDrawingBuffer: true, stencil: true, adaptToDeviceRatio: true });
        engine.setHardwareScalingLevel(window.devicePixelRatio > 1.6 ? 1.35 : 1);
        const scene = new B.Scene(engine);
        scene.clearColor = B.Color4.FromHexString(`${current.project.settings.background}ff`);
        const camera = new B.ArcRotateCamera("flux-editor-camera", -Math.PI / 2, Math.PI / 3, 18, new B.Vector3(0, 1, 0), scene);
        camera.attachControl(canvas, true);
        camera.lowerRadiusLimit = 1.5;
        camera.upperRadiusLimit = 250;
        camera.wheelPrecision = 26;
        camera.panningSensibility = 70;
        camera.inertia = 0.72;
        const ambient = new B.HemisphericLight("flux-ambient", new B.Vector3(0, 1, 0), scene);
        const gizmos = new B.GizmoManager(scene);
        gizmos.usePointerToAttachGizmos = false;
        gizmos.clearGizmoOnEmptyPointerEvent = false;
        const highlight = new B.HighlightLayer("flux-selection", scene);
        const context: RuntimeContext = {
          B, engine, scene, camera, ambient, gizmos, highlight,
          objects: new Map(), lights: new Map(), grid: [], scriptBaseY: new Map(), scriptBaseScale: new Map(),
          keys: {}, player: null, project: current.project, selectedId: current.selectedId,
          transformMode: current.transformMode, runtimeState: current.runtimeState,
          onSelect: current.onSelect, onTransform: current.onTransform, onRuntimeTransform: current.onRuntimeTransform,
          onLog: current.onLog, disposed: false,
        };
        contextRef.current = context;
        enablePhysics(context);
        bindPointer(context);
        bindKeyboard(context);
        await syncScene(context);
        applyWorld(context);
        syncGrid(context);
        syncSelection(context);
        scene.onBeforeRenderObservable.add(() => {
          if (context.runtimeState === "playing") runFrame(context);
        });
        engine.runRenderLoop(() => { if (!context.disposed) scene.render(); });
        const resize = () => engine.resize();
        window.addEventListener("resize", resize);
        const observer = new ResizeObserver(resize);
        observer.observe(canvas);
        context.cleanup = () => { window.removeEventListener("resize", resize); observer.disconnect(); context.keyboardCleanup?.(); };
        setLoading(false);
        current.onLog("success", "Flux Engine WebGL viewport is ready.");
        current.onReady?.();
      } catch (nextError) {
        const message = nextError instanceof Error ? nextError.message : "The 3D engine could not load.";
        setError(message);
        setLoading(false);
        propsRef.current.onLog("error", message);
      }
    };

    void boot();
    return () => {
      cancelled = true;
      const context = contextRef.current;
      if (!context) return;
      context.disposed = true;
      context.cleanup?.();
      context.gizmos?.dispose?.();
      context.highlight?.dispose?.();
      context.scene?.dispose?.();
      context.engine?.dispose?.();
      contextRef.current = null;
    };
  }, []);

  useEffect(() => {
    const context = contextRef.current;
    if (!context) return;
    const previousRuntime = context.runtimeState;
    context.project = props.project;
    context.selectedId = props.selectedId;
    context.transformMode = props.transformMode;
    context.runtimeState = props.runtimeState;
    context.onSelect = props.onSelect;
    context.onTransform = props.onTransform;
    context.onRuntimeTransform = props.onRuntimeTransform;
    context.onLog = props.onLog;
    void syncScene(context).then(() => {
      applyWorld(context);
      syncGrid(context);
      if (previousRuntime !== context.runtimeState) syncRuntime(context, previousRuntime);
      syncSelection(context);
    });
  }, [props.onLog, props.onRuntimeTransform, props.onSelect, props.onTransform, props.project, props.runtimeState, props.selectedId, props.transformMode]);

  return (
    <div className="flux-engine-viewport">
      <canvas ref={canvasRef} className="h-full w-full touch-none outline-none" aria-label="Flux Engine 3D viewport" />
      {loading ? <div className="flux-engine-loading"><span className="flux-engine-spinner" /><strong>Starting 3D engine</strong><small>Loading WebGL, model loaders and physics…</small></div> : null}
      {error ? <div className="flux-engine-loading flux-engine-error"><strong>3D engine failed to load</strong><small>{error}</small><button type="button" onClick={() => window.location.reload()}>Reload Studio</button></div> : null}
      <div className="flux-engine-axis" aria-hidden><span className="x">X</span><span className="y">Y</span><span className="z">Z</span></div>
    </div>
  );
});

function enablePhysics(context: RuntimeContext): void {
  try {
    if (window.CANNON) context.scene.enablePhysics(new context.B.Vector3(0, context.project.settings.gravity, 0), new context.B.CannonJSPlugin(true, 10, window.CANNON));
  } catch (error) {
    context.onLog("warning", `Physics could not start: ${error instanceof Error ? error.message : "unknown error"}`);
  }
}

function bindPointer(context: RuntimeContext): void {
  const { B, scene } = context;
  scene.onPointerObservable.add((pointerInfo: any) => {
    if (pointerInfo.type !== B.PointerEventTypes.POINTERDOWN) return;
    const id = pointerInfo.pickInfo?.pickedMesh?.metadata?.fluxId || null;
    context.onSelect(id ? String(id) : null);
  });
  scene.onPointerUp = () => syncSelectedTransform(context);
}

function bindKeyboard(context: RuntimeContext): void {
  const down = (event: KeyboardEvent) => {
    context.keys[event.key] = true;
    context.keys[event.key.toLowerCase()] = true;
    if (event.code === "Space") { context.keys[" "] = true; if (context.runtimeState === "playing") jumpPlayer(context); }
  };
  const up = (event: KeyboardEvent) => {
    context.keys[event.key] = false;
    context.keys[event.key.toLowerCase()] = false;
    if (event.code === "Space") context.keys[" "] = false;
  };
  window.addEventListener("keydown", down);
  window.addEventListener("keyup", up);
  context.keyboardCleanup = () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); };
}

async function syncScene(context: RuntimeContext): Promise<void> {
  const wanted = new Set(context.project.nodes.map((node) => node.id));
  for (const [id, object] of context.objects) {
    if (wanted.has(id)) continue;
    context.lights.get(id)?.dispose?.();
    context.lights.delete(id);
    object.dispose?.(false, true);
    context.objects.delete(id);
  }
  for (const node of context.project.nodes) {
    let object = context.objects.get(node.id);
    if (!object) object = await createRuntimeObject(context, node);
    if (object) applyNode(context, object, node);
  }
  for (const node of context.project.nodes) {
    const object = context.objects.get(node.id);
    if (!object) continue;
    object.parent = node.parentId ? context.objects.get(node.parentId) || null : null;
  }
}

async function createRuntimeObject(context: RuntimeContext, node: EngineNode): Promise<any | null> {
  const { B, scene } = context;
  let object: any = null;
  if (node.kind === "box") object = B.MeshBuilder.CreateBox(node.id, { size: 2 }, scene);
  else if (node.kind === "sphere") object = B.MeshBuilder.CreateSphere(node.id, { diameter: 2, segments: 28 }, scene);
  else if (node.kind === "cylinder") object = B.MeshBuilder.CreateCylinder(node.id, { height: 2, diameter: 2, tessellation: 32 }, scene);
  else if (node.kind === "cone") object = B.MeshBuilder.CreateCylinder(node.id, { height: 2, diameterTop: 0, diameterBottom: 2, tessellation: 32 }, scene);
  else if (node.kind === "plane") object = B.MeshBuilder.CreatePlane(node.id, { size: 2, sideOrientation: B.Mesh.DOUBLESIDE }, scene);
  else if (node.kind === "ground") object = B.MeshBuilder.CreateGround(node.id, { width: 2, height: 2, subdivisions: 2 }, scene);
  else if (node.kind === "terrain") {
    object = B.MeshBuilder.CreateGround(node.id, { width: 2, height: 2, subdivisions: clampNumber(node.metadata?.subdivisions, 8, 96, 48), updatable: true }, scene);
    sculptTerrain(context, object, node);
  } else if (node.kind === "spawn") object = B.MeshBuilder.CreateCylinder(node.id, { height: 0.12, diameter: 2, tessellation: 40 }, scene);
  else if (node.kind === "model" && node.sourceUrl) {
    try {
      const result = await B.SceneLoader.ImportMeshAsync(null, "", node.sourceUrl, scene, undefined, node.sourceName?.toLowerCase().endsWith(".gltf") ? ".gltf" : ".glb");
      object = new B.TransformNode(node.id, scene);
      for (const mesh of result.meshes || []) if (!mesh.parent) mesh.parent = object;
      context.onLog("success", `Imported ${node.sourceName || node.name}.`);
    } catch (error) {
      context.onLog("error", `Model import failed: ${error instanceof Error ? error.message : "unknown error"}`);
      object = B.MeshBuilder.CreateBox(node.id, { size: 2 }, scene);
    }
  } else if (node.kind.includes("light")) {
    object = B.MeshBuilder.CreateSphere(`${node.id}-proxy`, { diameter: 0.45, segments: 12 }, scene);
    let light: any;
    if (node.kind === "point-light") light = new B.PointLight(node.id, B.Vector3.Zero(), scene);
    else if (node.kind === "spot-light") light = new B.SpotLight(node.id, B.Vector3.Zero(), new B.Vector3(0, -1, 0), Math.PI / 3, 2, scene);
    else light = new B.DirectionalLight(node.id, new B.Vector3(-0.5, -1, 0.5), scene);
    context.lights.set(node.id, light);
  } else object = new B.TransformNode(node.id, scene);
  if (!object) return null;
  object.metadata = { ...(object.metadata || {}), fluxId: node.id };
  context.objects.set(node.id, object);
  return object;
}

function applyNode(context: RuntimeContext, object: any, node: EngineNode): void {
  const { B, scene } = context;
  object.name = node.name;
  object.metadata = { ...(object.metadata || {}), fluxId: node.id, script: node.script, tags: node.tags };
  object.position?.copyFrom?.(vec(B, node.position));
  object.rotation?.copyFrom?.(vec(B, node.rotation));
  object.scaling?.copyFrom?.(vec(B, node.scale));
  if ("isVisible" in object) object.isVisible = node.visible;
  if ("isPickable" in object) object.isPickable = !node.locked || node.kind.includes("light");
  if ("receiveShadows" in object) object.receiveShadows = node.receiveShadow;
  if (node.kind === "model" && object.getChildMeshes) {
    for (const child of object.getChildMeshes()) { child.metadata = { ...(child.metadata || {}), fluxId: node.id }; child.isPickable = !node.locked; }
  }
  if (object.material !== undefined && node.kind !== "model") {
    let material = object.material;
    if (!material || material.metadata?.fluxMaterial !== node.id) {
      material = new B.StandardMaterial(`flux-material-${node.id}`, scene);
      material.metadata = { fluxMaterial: node.id };
      object.material = material;
    }
    material.diffuseColor = B.Color3.FromHexString(node.material.color || "#7c8cff");
    material.emissiveColor = B.Color3.FromHexString(node.kind === "spawn" ? "#14532d" : node.material.emissive || "#000000");
    material.alpha = node.material.opacity;
    material.wireframe = node.material.wireframe;
    material.specularPower = Math.max(2, 128 * (1 - node.material.roughness));
  }
  const light = context.lights.get(node.id);
  if (light) {
    light.position?.copyFrom?.(vec(B, node.position));
    light.diffuse = B.Color3.FromHexString(node.material.color || "#ffffff");
    light.intensity = Number(node.metadata?.intensity ?? 1);
    if (node.kind === "directional-light" || node.kind === "spot-light") light.direction = directionFromRotation(B, node.rotation);
    if (node.kind === "spot-light") light.angle = Number(node.metadata?.angle ?? Math.PI / 3);
  }
}

function applyWorld(context: RuntimeContext): void {
  const { B, scene, ambient, project } = context;
  scene.clearColor = B.Color4.FromHexString(`${project.settings.background}ff`);
  ambient.intensity = project.settings.ambientIntensity;
  ambient.diffuse = B.Color3.FromHexString(project.settings.ambientColor);
  if (project.settings.fogEnabled) {
    scene.fogMode = B.Scene.FOGMODE_EXP2;
    scene.fogColor = B.Color3.FromHexString(project.settings.fogColor);
    scene.fogDensity = project.settings.fogDensity;
  } else scene.fogMode = B.Scene.FOGMODE_NONE;
  scene.getPhysicsEngine?.()?.setGravity?.(new B.Vector3(0, project.settings.gravity, 0));
}

function syncGrid(context: RuntimeContext): void {
  for (const mesh of context.grid) mesh.dispose?.();
  context.grid = [];
  if (!context.project.settings.gridVisible) return;
  const { B, scene } = context;
  const extent = 50;
  const step = Math.max(0.25, context.project.settings.gridSize || 1);
  const lines: any[] = [];
  for (let value = -extent; value <= extent; value += step) {
    lines.push([new B.Vector3(-extent, 0.006, value), new B.Vector3(extent, 0.006, value)]);
    lines.push([new B.Vector3(value, 0.006, -extent), new B.Vector3(value, 0.006, extent)]);
  }
  const grid = B.MeshBuilder.CreateLineSystem("flux-grid", { lines }, scene);
  grid.color = new B.Color3(0.22, 0.25, 0.3);
  grid.alpha = 0.42;
  grid.isPickable = false;
  context.grid.push(grid);
}

function syncSelection(context: RuntimeContext): void {
  const { B, gizmos, highlight, project } = context;
  highlight.removeAllMeshes();
  gizmos.positionGizmoEnabled = false;
  gizmos.rotationGizmoEnabled = false;
  gizmos.scaleGizmoEnabled = false;
  const node = context.selectedId ? project.nodes.find((item) => item.id === context.selectedId) : null;
  const object = context.selectedId ? context.objects.get(context.selectedId) : null;
  if (!node || !object || node.locked || context.runtimeState !== "edit") { gizmos.attachToMesh(null); return; }
  if (context.transformMode === "move") gizmos.positionGizmoEnabled = true;
  else if (context.transformMode === "rotate") gizmos.rotationGizmoEnabled = true;
  else if (context.transformMode === "scale") gizmos.scaleGizmoEnabled = true;
  else { gizmos.attachToMesh(null); addHighlight(context, object, B); return; }
  gizmos.attachToMesh(object);
  if (project.settings.snapEnabled) {
    if (gizmos.gizmos.positionGizmo) gizmos.gizmos.positionGizmo.snapDistance = project.settings.snapPosition;
    if (gizmos.gizmos.rotationGizmo) gizmos.gizmos.rotationGizmo.snapDistance = project.settings.snapRotation * Math.PI / 180;
    if (gizmos.gizmos.scaleGizmo) gizmos.gizmos.scaleGizmo.snapDistance = project.settings.snapScale;
  }
  addHighlight(context, object, B);
}

function addHighlight(context: RuntimeContext, object: any, B: any): void {
  const meshes = object.getChildMeshes ? [object, ...object.getChildMeshes()] : [object];
  for (const mesh of meshes) if (mesh instanceof B.AbstractMesh) context.highlight.addMesh(mesh, new B.Color3(0.24, 0.66, 1));
}

function syncSelectedTransform(context: RuntimeContext): void {
  if (!context.selectedId || context.runtimeState !== "edit") return;
  const object = context.objects.get(context.selectedId);
  if (!object) return;
  context.onTransform(context.selectedId, { position: plain(object.position), rotation: plain(object.rotation), scale: plain(object.scaling) });
}

function syncRuntime(context: RuntimeContext, previous: RuntimeState): void {
  if (context.runtimeState === "playing") {
    attachPhysics(context);
    context.gizmos.attachToMesh(null);
    context.highlight.removeAllMeshes();
    context.player = context.project.settings.playerNodeId ? context.objects.get(context.project.settings.playerNodeId) || null : null;
    if (context.player) context.camera.lockedTarget = context.player;
    context.onLog("info", previous === "paused" ? "Play mode resumed." : "Play mode started. WASD moves the player; Space jumps.");
  } else if (context.runtimeState === "paused") context.onLog("info", "Play mode paused.");
  else {
    context.camera.lockedTarget = null;
    context.player = null;
    disposePhysics(context);
    context.scriptBaseY.clear();
    context.scriptBaseScale.clear();
  }
}

function attachPhysics(context: RuntimeContext): void {
  const { B, scene } = context;
  for (const node of context.project.nodes) {
    const object = context.objects.get(node.id);
    if (!object || !(object instanceof B.AbstractMesh) || !node.physics.enabled || object.physicsImpostor) continue;
    const impostor = node.kind === "sphere" ? B.PhysicsImpostor.SphereImpostor : node.kind === "cylinder" || node.kind === "cone" ? B.PhysicsImpostor.CylinderImpostor : B.PhysicsImpostor.BoxImpostor;
    try {
      object.physicsImpostor = new B.PhysicsImpostor(object, impostor, { mass: node.physics.static ? 0 : node.physics.mass, friction: node.physics.friction, restitution: node.physics.restitution }, scene);
    } catch (error) {
      context.onLog("warning", `Physics skipped for ${node.name}: ${error instanceof Error ? error.message : "unknown error"}`);
    }
  }
}

function disposePhysics(context: RuntimeContext): void {
  for (const object of context.objects.values()) { object.physicsImpostor?.dispose?.(); object.physicsImpostor = null; }
}

function runFrame(context: RuntimeContext): void {
  const dt = Math.min(0.05, context.engine.getDeltaTime() / 1000);
  const time = performance.now() / 1000;
  for (const node of context.project.nodes) {
    if (!node.script.trim()) continue;
    const object = context.objects.get(node.id);
    if (!object) continue;
    for (const line of node.script.split(/\n|;/)) {
      const parts = line.trim().toLowerCase().split(/\s+/);
      if (parts[0] === "spin") object.rotation[axis(parts[1])] += Number(parts[2] || 1) * dt;
      else if (parts[0] === "bob") {
        if (!context.scriptBaseY.has(node.id)) context.scriptBaseY.set(node.id, object.position.y);
        object.position.y = (context.scriptBaseY.get(node.id) || 0) + Math.sin(time * Number(parts[2] || 2)) * Number(parts[1] || 0.5);
      } else if (parts[0] === "pulse") {
        if (!context.scriptBaseScale.has(node.id)) context.scriptBaseScale.set(node.id, plain(object.scaling));
        const base = context.scriptBaseScale.get(node.id) || { x: 1, y: 1, z: 1 };
        const min = Number(parts[1] || 0.8), max = Number(parts[2] || 1.2), factor = min + (Math.sin(time * Number(parts[3] || 2)) + 1) / 2 * (max - min);
        object.scaling.set(base.x * factor, base.y * factor, base.z * factor);
      }
    }
  }
  movePlayer(context, dt);
}

function movePlayer(context: RuntimeContext, dt: number): void {
  const player = context.player;
  if (!player) return;
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
    if (player.physicsImpostor) {
      const velocity = player.physicsImpostor.getLinearVelocity?.() || context.B.Vector3.Zero();
      player.physicsImpostor.setLinearVelocity?.(new context.B.Vector3(movement.x / dt, velocity.y, movement.z / dt));
    } else if (player.moveWithCollisions) player.moveWithCollisions(movement);
    else player.position.addInPlace(movement);
  }
  const id = String(player.metadata?.fluxId || context.project.settings.playerNodeId || "");
  if (id) context.onRuntimeTransform?.(id, { position: plain(player.position), rotation: plain(player.rotation), scale: plain(player.scaling) });
}

function jumpPlayer(context: RuntimeContext | null): void {
  const player = context?.player;
  if (!context || !player) return;
  if (player.physicsImpostor) player.physicsImpostor.applyImpulse(new context.B.Vector3(0, 5, 0), player.getAbsolutePosition());
  else player.position.y += 0.8;
}

function focusSelection(context: RuntimeContext | null): void {
  if (!context?.selectedId) return;
  const object = context.objects.get(context.selectedId);
  if (!object) return;
  const target = object.getBoundingInfo?.().boundingSphere?.centerWorld || object.getAbsolutePosition?.() || object.position;
  context.camera.setTarget(target);
  context.camera.radius = Math.max(3, (object.getBoundingInfo?.().boundingSphere?.radiusWorld || 2) * 4.5);
}

function setCameraView(context: RuntimeContext | null, view: EngineCameraView): void {
  if (!context) return;
  if (view === "top") { context.camera.alpha = -Math.PI / 2; context.camera.beta = 0.01; }
  else if (view === "front") { context.camera.alpha = -Math.PI / 2; context.camera.beta = Math.PI / 2; }
  else if (view === "right") { context.camera.alpha = 0; context.camera.beta = Math.PI / 2; }
  else { context.camera.alpha = -Math.PI / 2; context.camera.beta = Math.PI / 3; }
}

function sculptTerrain(context: RuntimeContext, mesh: any, node: EngineNode): void {
  const positions = mesh.getVerticesData(context.B.VertexBuffer.PositionKind);
  if (!positions) return;
  const amplitude = clampNumber(node.metadata?.amplitude, 0, 10, 1.5);
  const frequency = clampNumber(node.metadata?.frequency, 0.02, 2, 0.22);
  for (let index = 0; index < positions.length; index += 3) positions[index + 1] = (Math.sin(positions[index] * frequency * 4) + Math.cos(positions[index + 2] * frequency * 3)) * amplitude * 0.16;
  mesh.updateVerticesData(context.B.VertexBuffer.PositionKind, positions);
  mesh.refreshBoundingInfo?.();
}

function vec(B: any, value: EngineVector3): any { return new B.Vector3(value.x, value.y, value.z); }
function plain(value: any): EngineVector3 { return { x: Number(value?.x || 0), y: Number(value?.y || 0), z: Number(value?.z || 0) }; }
function directionFromRotation(B: any, rotation: EngineVector3): any { return B.Vector3.TransformNormal(new B.Vector3(0, -1, 0), B.Matrix.RotationYawPitchRoll(rotation.y, rotation.x, rotation.z)).normalize(); }
function axis(value?: string): "x" | "y" | "z" { return value === "x" || value === "z" ? value : "y"; }
function clampNumber(value: unknown, min: number, max: number, fallback: number): number { const number = Number(value); return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback; }
