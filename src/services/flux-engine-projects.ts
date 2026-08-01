import {
  publishCommunityGame,
  type GeneratedProject,
  type StudioSceneObject,
} from "@/services/studio-projects";
import type {
  EngineNode,
  EngineNodeKind,
  EnginePrefab,
  EngineVersion,
  FluxEngineProject,
} from "@/types/flux-engine";

const PROJECTS_KEY = "flux-engine-projects-v1";
const PREFABS_KEY = "flux-engine-prefabs-v1";
const ACTIVE_KEY = "flux-engine-active-project-v1";

function storage(): Storage | null {
  return typeof window === "undefined" ? null : window.localStorage;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function id(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createEngineNode(kind: EngineNodeKind, name?: string): EngineNode {
  const elevated = kind !== "ground"
    && kind !== "terrain"
    && !kind.includes("light")
    && kind !== "camera"
    && kind !== "group";

  return {
    id: id(kind),
    name: name || defaultNodeName(kind),
    kind,
    parentId: null,
    position: { x: 0, y: elevated ? 1 : 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0 },
    scale: { x: 1, y: 1, z: 1 },
    material: {
      color: kind === "spawn" ? "#22c55e" : kind.includes("light") ? "#fef3c7" : "#7c8cff",
      emissive: "#000000",
      opacity: kind === "spawn" ? 0.62 : 1,
      metallic: 0.05,
      roughness: 0.72,
      wireframe: false,
    },
    physics: {
      enabled: false,
      mass: elevated ? 1 : 0,
      friction: 0.55,
      restitution: 0.12,
      static: !elevated,
    },
    visible: true,
    locked: kind === "ground",
    castShadow: elevated,
    receiveShadow: kind === "ground" || kind === "terrain",
    script: "",
    tags: [],
    sourceUrl: null,
    sourceName: null,
    metadata: kind === "terrain"
      ? { subdivisions: 48, amplitude: 1.5, frequency: 0.22 }
      : {},
  };
}

export function createDefaultEngineProject(ownerId: string): FluxEngineProject {
  const ground = createEngineNode("ground", "Baseplate");
  ground.scale = { x: 12, y: 1, z: 12 };
  ground.material.color = "#2c3340";
  ground.locked = true;
  ground.physics.enabled = true;
  ground.physics.static = true;
  ground.physics.mass = 0;

  const spawn = createEngineNode("spawn", "Player Spawn");
  spawn.position = { x: 0, y: 1, z: 4 };

  const cube = createEngineNode("box", "Welcome Block");
  cube.position = { x: 0, y: 1, z: 0 };
  cube.script = "spin y 0.35";

  const sun = createEngineNode("directional-light", "Sun");
  sun.position = { x: -8, y: 12, z: -6 };
  sun.rotation = { x: -0.8, y: 0.5, z: 0 };

  const now = Date.now();
  return {
    id: id("world"),
    ownerId,
    name: "Untitled 3D World",
    description: "A world made with Flux Engine.",
    thumbnail: "",
    tags: ["3d", "flux-engine"],
    nodes: [ground, spawn, cube, sun],
    settings: {
      background: "#11151c",
      ambientColor: "#dbeafe",
      ambientIntensity: 0.68,
      gravity: -9.81,
      fogEnabled: false,
      fogColor: "#11151c",
      fogDensity: 0.012,
      shadowsEnabled: true,
      gridVisible: true,
      gridSize: 1,
      snapEnabled: true,
      snapPosition: 0.5,
      snapRotation: 15,
      snapScale: 0.1,
      skybox: "studio",
      playerNodeId: spawn.id,
      backgroundAudioUrl: "",
    },
    versions: [],
    createdAt: now,
    updatedAt: now,
    publishedId: null,
  };
}

export function normalizeEngineProject(project: FluxEngineProject): FluxEngineProject {
  const fallback = createDefaultEngineProject(project.ownerId || "local");
  return {
    ...fallback,
    ...project,
    name: String(project.name || fallback.name).slice(0, 80),
    description: String(project.description || "").slice(0, 600),
    tags: Array.isArray(project.tags) ? project.tags.map(String).slice(0, 20) : [],
    nodes: Array.isArray(project.nodes)
      ? project.nodes.map(normalizeNode).slice(0, 500)
      : fallback.nodes,
    settings: { ...fallback.settings, ...(project.settings || {}) },
    versions: Array.isArray(project.versions) ? project.versions.slice(-30) : [],
    createdAt: Number(project.createdAt || Date.now()),
    updatedAt: Number(project.updatedAt || Date.now()),
    publishedId: project.publishedId || null,
  };
}

function normalizeNode(node: EngineNode): EngineNode {
  const fallback = createEngineNode(node.kind || "box");
  return {
    ...fallback,
    ...node,
    id: String(node.id || id("node")),
    name: String(node.name || fallback.name).slice(0, 80),
    parentId: node.parentId || null,
    position: vector(node.position, fallback.position),
    rotation: vector(node.rotation, fallback.rotation),
    scale: vector(node.scale, fallback.scale, 0.01),
    material: { ...fallback.material, ...(node.material || {}) },
    physics: { ...fallback.physics, ...(node.physics || {}) },
    script: String(node.script || "").slice(0, 8000),
    tags: Array.isArray(node.tags) ? node.tags.map(String).slice(0, 30) : [],
    metadata: node.metadata && typeof node.metadata === "object" ? node.metadata : {},
  };
}

function vector(
  value: EngineNode["position"] | undefined,
  fallback: EngineNode["position"],
  min = -10000
): EngineNode["position"] {
  return {
    x: Math.max(min, Number(value?.x ?? fallback.x) || 0),
    y: Math.max(min, Number(value?.y ?? fallback.y) || 0),
    z: Math.max(min, Number(value?.z ?? fallback.z) || 0),
  };
}

export function listEngineProjects(): FluxEngineProject[] {
  const target = storage();
  if (!target) return [];
  try {
    const parsed = JSON.parse(target.getItem(PROJECTS_KEY) || "[]") as FluxEngineProject[];
    return Array.isArray(parsed)
      ? parsed.map(normalizeEngineProject).sort((a, b) => b.updatedAt - a.updatedAt)
      : [];
  } catch {
    return [];
  }
}

export function saveEngineProject(project: FluxEngineProject): FluxEngineProject {
  const next = normalizeEngineProject({ ...project, updatedAt: Date.now() });
  const target = storage();
  if (!target) return next;
  const projects = listEngineProjects();
  const index = projects.findIndex((item) => item.id === next.id);
  if (index >= 0) projects[index] = next;
  else projects.unshift(next);
  target.setItem(PROJECTS_KEY, JSON.stringify(projects.slice(0, 30)));
  target.setItem(ACTIVE_KEY, next.id);
  window.dispatchEvent(new CustomEvent("flux-engine-projects-updated"));
  return next;
}

export function getEngineProject(projectId: string): FluxEngineProject | null {
  return listEngineProjects().find((project) => project.id === projectId) || null;
}

export function getActiveEngineProject(ownerId: string): FluxEngineProject {
  const target = storage();
  const activeId = target?.getItem(ACTIVE_KEY);
  const projects = listEngineProjects();
  return projects.find((project) => project.id === activeId)
    || projects[0]
    || saveEngineProject(createDefaultEngineProject(ownerId));
}

export function deleteEngineProject(projectId: string): void {
  const target = storage();
  if (!target) return;
  target.setItem(
    PROJECTS_KEY,
    JSON.stringify(listEngineProjects().filter((project) => project.id !== projectId))
  );
  if (target.getItem(ACTIVE_KEY) === projectId) target.removeItem(ACTIVE_KEY);
  window.dispatchEvent(new CustomEvent("flux-engine-projects-updated"));
}

export function duplicateEngineProject(project: FluxEngineProject): FluxEngineProject {
  const now = Date.now();
  return saveEngineProject({
    ...clone(project),
    id: id("world"),
    name: `${project.name} Copy`.slice(0, 80),
    publishedId: null,
    versions: [],
    createdAt: now,
    updatedAt: now,
  });
}

export function createEngineVersion(
  project: FluxEngineProject,
  label: string
): FluxEngineProject {
  const snapshot = clone(project);
  snapshot.versions = [];
  const version: EngineVersion = {
    id: id("version"),
    label: label.trim().slice(0, 80) || `Version ${project.versions.length + 1}`,
    createdAt: Date.now(),
    project: snapshot,
  };
  return saveEngineProject({
    ...project,
    versions: [...project.versions, version].slice(-30),
  });
}

export function restoreEngineVersion(
  project: FluxEngineProject,
  versionId: string
): FluxEngineProject {
  const version = project.versions.find((item) => item.id === versionId);
  if (!version) return project;
  return saveEngineProject({
    ...clone(version.project),
    id: project.id,
    ownerId: project.ownerId,
    versions: project.versions,
    publishedId: project.publishedId,
    createdAt: project.createdAt,
    updatedAt: Date.now(),
  });
}

export function listEnginePrefabs(): EnginePrefab[] {
  const target = storage();
  if (!target) return [];
  try {
    const parsed = JSON.parse(target.getItem(PREFABS_KEY) || "[]") as EnginePrefab[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveEnginePrefab(
  ownerId: string,
  node: EngineNode,
  name?: string
): EnginePrefab {
  const prefab: EnginePrefab = {
    id: id("prefab"),
    ownerId,
    name: (name || node.name || "Prefab").slice(0, 80),
    node: clone(node),
    createdAt: Date.now(),
  };
  const target = storage();
  if (target) {
    target.setItem(
      PREFABS_KEY,
      JSON.stringify([prefab, ...listEnginePrefabs()].slice(0, 50))
    );
  }
  return prefab;
}

export function instantiateEnginePrefab(prefab: EnginePrefab): EngineNode {
  const node = clone(prefab.node);
  node.id = id(node.kind);
  node.name = `${prefab.name} Instance`.slice(0, 80);
  node.parentId = null;
  node.position.x += 1;
  node.position.z += 1;
  return node;
}

export function serializeEngineProject(project: FluxEngineProject): string {
  return JSON.stringify(normalizeEngineProject(project), null, 2);
}

export function parseEngineProject(
  source: string,
  ownerId: string
): FluxEngineProject {
  const parsed = JSON.parse(source) as FluxEngineProject;
  const now = Date.now();
  return normalizeEngineProject({
    ...parsed,
    id: id("world"),
    ownerId,
    publishedId: null,
    versions: [],
    createdAt: now,
    updatedAt: now,
  });
}

export function generateEngineGameHtml(project: FluxEngineProject): string {
  const normalized = normalizeEngineProject({ ...project, versions: [] });
  const safeProject = JSON.stringify(normalized).replace(/</g, "\\u003c");
  const safeTitle = escapeHtml(project.name);

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${safeTitle}</title>
<style>
html,body,#game{width:100%;height:100%;margin:0;overflow:hidden;background:#090b10;font-family:Inter,system-ui,sans-serif}
canvas{display:block;width:100%;height:100%;touch-action:none}.hud{position:fixed;inset:0;pointer-events:none;color:#fff}
.brand,.help{position:absolute;top:14px;border:1px solid #ffffff20;border-radius:9px;background:#080a0ecc;padding:8px 11px;font-size:10px;font-weight:800;backdrop-filter:blur(12px)}
.brand{left:14px}.help{right:14px;color:#ffffff99}.mobile{display:none;position:absolute;inset:0}
.pad{position:absolute;left:18px;bottom:22px;display:grid;grid-template-columns:48px 48px 48px;gap:5px;pointer-events:auto}
.pad button,.jump{height:48px;border:1px solid #ffffff25;border-radius:13px;background:#080a0ebf;color:#fff;font-weight:900}
.pad .up{grid-column:2}.pad .left{grid-column:1}.pad .down{grid-column:2}.pad .right{grid-column:3}
.jump{position:absolute;right:22px;bottom:28px;width:64px;height:64px;border-radius:50%;pointer-events:auto}
@media(max-width:800px),(pointer:coarse){.mobile{display:block}.help{display:none}}
</style>
</head>
<body>
<canvas id="game"></canvas>
<div class="hud"><div class="brand">${safeTitle} · Flux Engine</div><div class="help">WASD move · Space jump · Drag to look</div><div class="mobile"><div class="pad"><button class="up" data-key="w">▲</button><button class="left" data-key="a">◀</button><button class="down" data-key="s">▼</button><button class="right" data-key="d">▶</button></div><button class="jump" data-key=" ">JUMP</button></div></div>
<script src="https://cdn.babylonjs.com/babylon.js"></script>
<script src="https://cdn.babylonjs.com/loaders/babylonjs.loaders.min.js"></script>
<script src="https://cdn.babylonjs.com/cannon.js"></script>
<script>
const project=${safeProject};const B=BABYLON;const canvas=document.getElementById('game');
const engine=new B.Engine(canvas,true,{preserveDrawingBuffer:true,stencil:true,antialias:true});
const scene=new B.Scene(engine);scene.clearColor=B.Color4.FromHexString(project.settings.background+'ff');
const camera=new B.ArcRotateCamera('camera',-Math.PI/2,Math.PI/3,18,new B.Vector3(0,1,0),scene);
camera.attachControl(canvas,true);camera.lowerRadiusLimit=2;camera.upperRadiusLimit=180;camera.wheelPrecision=30;
const ambient=new B.HemisphericLight('ambient',new B.Vector3(0,1,0),scene);ambient.intensity=project.settings.ambientIntensity||.7;ambient.diffuse=B.Color3.FromHexString(project.settings.ambientColor||'#ffffff');
if(project.settings.fogEnabled){scene.fogMode=B.Scene.FOGMODE_EXP2;scene.fogColor=B.Color3.FromHexString(project.settings.fogColor);scene.fogDensity=project.settings.fogDensity}
try{scene.enablePhysics(new B.Vector3(0,project.settings.gravity??-9.81,0),new B.CannonJSPlugin())}catch(error){console.warn('Physics unavailable',error)}
const objects=new Map(),keys={},scriptBase=new Map();let player=null;
const vector=value=>new B.Vector3(value?.x||0,value?.y||0,value?.z||0);
function material(node){const value=new B.StandardMaterial('mat-'+node.id,scene);value.diffuseColor=B.Color3.FromHexString(node.material.color||'#7c8cff');value.emissiveColor=B.Color3.FromHexString(node.material.emissive||'#000000');value.alpha=node.material.opacity??1;value.wireframe=!!node.material.wireframe;return value}
async function create(node){let object=null;
if(node.kind==='box')object=B.MeshBuilder.CreateBox(node.id,{size:2},scene);
else if(node.kind==='sphere')object=B.MeshBuilder.CreateSphere(node.id,{diameter:2,segments:24},scene);
else if(node.kind==='cylinder')object=B.MeshBuilder.CreateCylinder(node.id,{height:2,diameter:2,tessellation:24},scene);
else if(node.kind==='cone')object=B.MeshBuilder.CreateCylinder(node.id,{height:2,diameterTop:0,diameterBottom:2,tessellation:24},scene);
else if(node.kind==='plane')object=B.MeshBuilder.CreatePlane(node.id,{size:2,sideOrientation:B.Mesh.DOUBLESIDE},scene);
else if(node.kind==='ground'||node.kind==='terrain')object=B.MeshBuilder.CreateGround(node.id,{width:2,height:2,subdivisions:node.kind==='terrain'?32:2},scene);
else if(node.kind==='spawn')object=B.MeshBuilder.CreateCylinder(node.id,{height:.15,diameter:2,tessellation:32},scene);
else if(node.kind==='model'&&node.sourceUrl){try{const result=await B.SceneLoader.ImportMeshAsync(null,'',node.sourceUrl,scene);object=new B.TransformNode(node.id,scene);for(const mesh of result.meshes)if(!mesh.parent)mesh.parent=object}catch(error){console.warn('Model failed',error)}}
else if(node.kind.includes('light')){if(node.kind==='point-light')object=new B.PointLight(node.id,vector(node.position),scene);else if(node.kind==='spot-light')object=new B.SpotLight(node.id,vector(node.position),new B.Vector3(0,-1,0),Math.PI/3,2,scene);else object=new B.DirectionalLight(node.id,new B.Vector3(-.5,-1,.5),scene);object.intensity=Number(node.metadata?.intensity||1);objects.set(node.id,object);return object}
else object=new B.TransformNode(node.id,scene);if(!object)return null;object.position=vector(node.position);object.rotation=vector(node.rotation);object.scaling=vector(node.scale);object.isVisible=node.visible!==false;if(object.material!==undefined)object.material=material(node);object.metadata={fluxId:node.id,script:node.script,tags:node.tags};objects.set(node.id,object);
if(node.physics?.enabled&&object instanceof B.AbstractMesh){const type=node.kind==='sphere'?B.PhysicsImpostor.SphereImpostor:node.kind==='cylinder'||node.kind==='cone'?B.PhysicsImpostor.CylinderImpostor:B.PhysicsImpostor.BoxImpostor;object.physicsImpostor=new B.PhysicsImpostor(object,type,{mass:node.physics.static?0:node.physics.mass||1,friction:node.physics.friction??.55,restitution:node.physics.restitution??.1},scene)}return object}
(async()=>{for(const node of project.nodes){const object=await create(node);if(object&&node.id===project.settings.playerNodeId)player=object}for(const node of project.nodes){if(node.parentId&&objects.get(node.id)&&objects.get(node.parentId))objects.get(node.id).parent=objects.get(node.parentId)}
scene.onBeforeRenderObservable.add(()=>{const dt=Math.min(.05,engine.getDeltaTime()/1000),time=performance.now()/1000;for(const node of project.nodes){const object=objects.get(node.id);if(!object||!node.script)continue;for(const source of node.script.split(/\\n|;/)){const parts=source.trim().toLowerCase().split(/\\s+/);if(parts[0]==='spin'){const axis=parts[1]==='x'||parts[1]==='z'?parts[1]:'y';object.rotation[axis]+=Number(parts[2]||1)*dt}else if(parts[0]==='bob'){if(!scriptBase.has(node.id))scriptBase.set(node.id,object.position.y);object.position.y=scriptBase.get(node.id)+Math.sin(time*Number(parts[2]||2))*Number(parts[1]||.5)}else if(parts[0]==='pulse'){const min=Number(parts[1]||.8),max=Number(parts[2]||1.2),factor=min+(Math.sin(time*Number(parts[3]||2))+1)/2*(max-min);object.scaling.set(factor,factor,factor)}}}if(player){const forward=camera.getForwardRay().direction;forward.y=0;forward.normalize();const right=B.Vector3.Cross(forward,B.Axis.Y).normalize();const movement=B.Vector3.Zero();if(keys.w||keys.ArrowUp)movement.addInPlace(forward);if(keys.s||keys.ArrowDown)movement.subtractInPlace(forward);if(keys.a||keys.ArrowLeft)movement.addInPlace(right);if(keys.d||keys.ArrowRight)movement.subtractInPlace(right);if(movement.lengthSquared()>0){movement.normalize().scaleInPlace(5*dt);if(player.moveWithCollisions)player.moveWithCollisions(movement);else player.position.addInPlace(movement)}camera.target=B.Vector3.Lerp(camera.target,player.position,.12)}});engine.runRenderLoop(()=>scene.render())})();
addEventListener('keydown',event=>{keys[event.key]=true;if(event.key===' '&&player?.physicsImpostor)player.physicsImpostor.applyImpulse(new B.Vector3(0,5,0),player.getAbsolutePosition())});addEventListener('keyup',event=>keys[event.key]=false);document.querySelectorAll('[data-key]').forEach(button=>{const key=button.dataset.key;button.addEventListener('pointerdown',event=>{event.preventDefault();keys[key]=true;if(key===' '&&player?.physicsImpostor)player.physicsImpostor.applyImpulse(new B.Vector3(0,5,0),player.getAbsolutePosition())});for(const type of ['pointerup','pointercancel'])button.addEventListener(type,event=>{event.preventDefault();keys[key]=false})});addEventListener('resize',()=>engine.resize());
</script>
</body>
</html>`;
}

function enginePreviewObjects(project: FluxEngineProject): StudioSceneObject[] {
  return project.nodes
    .filter((node) => !node.kind.includes("light") && node.kind !== "camera" && node.kind !== "group")
    .map((node, index) => {
      const type: StudioSceneObject["type"] = node.kind === "sphere"
        ? "circle"
        : node.kind === "model" && node.sourceUrl
          ? "image"
          : "rectangle";
      const horizontalScale = Math.max(0.2, Math.abs(node.scale.x));
      const verticalScale = Math.max(0.2, Math.abs(node.scale.z || node.scale.y));
      return {
        id: node.id,
        type,
        name: node.name,
        x: 480 + node.position.x * 34 - horizontalScale * 20,
        y: 270 + node.position.z * 34 - verticalScale * 20,
        width: Math.max(18, horizontalScale * 42),
        height: Math.max(18, verticalScale * 42),
        rotation: node.rotation.y * (180 / Math.PI),
        fill: node.material.color,
        text: node.kind === "spawn" ? "Spawn" : "",
        textColor: "#ffffff",
        fontSize: 14,
        borderRadius: node.kind === "sphere" || node.kind === "spawn" ? 999 : 4,
        opacity: node.visible ? node.material.opacity : 0,
        imageUrl: type === "image" ? node.sourceUrl || undefined : undefined,
        locked: true,
        hidden: !node.visible,
      };
    })
    .slice(0, 180);
}

export async function publishEngineProject(project: FluxEngineProject): Promise<string> {
  const code = generateEngineGameHtml(project);
  const now = Date.now();
  const generated: GeneratedProject = {
    id: `engine-${project.id}`,
    ownerId: project.ownerId,
    kind: "game",
    title: project.name,
    description: project.description,
    hashtags: [...new Set(["3d", "flux-engine", ...project.tags])].slice(0, 12),
    code,
    thumbnail: project.thumbnail,
    thumbnailFileName: null,
    multiplayer: false,
    maxPlayers: 1,
    selectedAssetIds: [],
    assistantHistory: [],
    revisions: [],
    scene: {
      background: project.settings.background,
      width: 960,
      height: 540,
      objects: enginePreviewObjects(project),
    },
    createdAt: project.createdAt || now,
    updatedAt: now,
    publishedId: project.publishedId,
  };
  return publishCommunityGame(generated);
}

function defaultNodeName(kind: EngineNodeKind): string {
  return kind
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (character) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    })[character] || character
  );
}
