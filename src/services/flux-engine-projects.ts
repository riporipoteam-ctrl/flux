import { publishCommunityGame, type GeneratedProject } from "@/services/studio-projects";
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
  const elevated = kind !== "ground" && kind !== "terrain" && !kind.includes("light") && kind !== "camera" && kind !== "group";
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
    metadata: kind === "terrain" ? { subdivisions: 48, amplitude: 1.5, frequency: 0.22 } : {},
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
    nodes: Array.isArray(project.nodes) ? project.nodes.map(normalizeNode).slice(0, 500) : fallback.nodes,
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

function vector(value: EngineNode["position"] | undefined, fallback: EngineNode["position"], min = -10000): EngineNode["position"] {
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
    return Array.isArray(parsed) ? parsed.map(normalizeEngineProject).sort((a, b) => b.updatedAt - a.updatedAt) : [];
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
  return projects.find((project) => project.id === activeId) || projects[0] || saveEngineProject(createDefaultEngineProject(ownerId));
}

export function deleteEngineProject(projectId: string): void {
  const target = storage();
  if (!target) return;
  target.setItem(PROJECTS_KEY, JSON.stringify(listEngineProjects().filter((project) => project.id !== projectId)));
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

export function createEngineVersion(project: FluxEngineProject, label: string): FluxEngineProject {
  const snapshot = clone(project);
  snapshot.versions = [];
  const version: EngineVersion = {
    id: id("version"),
    label: label.trim().slice(0, 80) || `Version ${project.versions.length + 1}`,
    createdAt: Date.now(),
    project: snapshot,
  };
  return saveEngineProject({ ...project, versions: [...project.versions, version].slice(-30) });
}

export function restoreEngineVersion(project: FluxEngineProject, versionId: string): FluxEngineProject {
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

export function saveEnginePrefab(ownerId: string, node: EngineNode, name?: string): EnginePrefab {
  const prefab: EnginePrefab = {
    id: id("prefab"),
    ownerId,
    name: (name || node.name || "Prefab").slice(0, 80),
    node: clone(node),
    createdAt: Date.now(),
  };
  const target = storage();
  if (target) target.setItem(PREFABS_KEY, JSON.stringify([prefab, ...listEnginePrefabs()].slice(0, 50)));
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

export function parseEngineProject(source: string, ownerId: string): FluxEngineProject {
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
  const safeProject = JSON.stringify(normalizeEngineProject({ ...project, versions: [] })).replace(/</g, "\\u003c");
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>${escapeHtml(project.name)}</title><style>
html,body,#game{width:100%;height:100%;margin:0;overflow:hidden;background:#090b10;font-family:Inter,system-ui,sans-serif}canvas{width:100%;height:100%;touch-action:none}.hud{position:fixed;inset:0;pointer-events:none;color:#fff}.brand{position:absolute;left:14px;top:14px;padding:8px 11px;border:1px solid #ffffff20;border-radius:10px;background:#080a0ecc;font-size:11px;font-weight:800;backdrop-filter:blur(12px)}.help{position:absolute;right:14px;top:14px;padding:8px 11px;border-radius:10px;background:#080a0ecc;font-size:10px;color:#ffffff99}.mobile{display:none;position:absolute;inset:0}.pad{position:absolute;left:18px;bottom:22px;display:grid;grid-template-columns:48px 48px 48px;gap:5px;pointer-events:auto}.pad button,.jump{height:48px;border:1px solid #ffffff25;border-radius:14px;background:#080a0ebf;color:#fff;font-weight:900}.pad .up{grid-column:2}.pad .left{grid-column:1}.pad .down{grid-column:2}.pad .right{grid-column:3}.jump{position:absolute;right:22px;bottom:28px;width:64px;height:64px;border-radius:50%;pointer-events:auto}@media(max-width:800px),(pointer:coarse){.mobile{display:block}.help{display:none}}
</style></head><body><canvas id="game"></canvas><div class="hud"><div class="brand">${escapeHtml(project.name)} · Flux Engine</div><div class="help">WASD move · Space jump · Drag to look</div><div class="mobile"><div class="pad"><button class="up" data-key="w">▲</button><button class="left" data-key="a">◀</button><button class="down" data-key="s">▼</button><button class="right" data-key="d">▶</button></div><button class="jump" data-key=" ">JUMP</button></div></div>
<script src="https://cdn.babylonjs.com/babylon.js"></script><script src="https://cdn.babylonjs.com/loaders/babylonjs.loaders.min.js"></script><script src="https://cdn.babylonjs.com/cannon.js"></script><script>
const project=${safeProject};const B=BABYLON;const canvas=document.getElementById('game');const engine=new B.Engine(canvas,true,{preserveDrawingBuffer:true,stencil:true});const scene=new B.Scene(engine);scene.clearColor=B.Color4.FromHexString(project.settings.background+'ff');
const camera=new B.ArcRotateCamera('camera',-Math.PI/2,Math.PI/3,18,new B.Vector3(0,1,0),scene);camera.attachControl(canvas,true);camera.lowerRadiusLimit=2;camera.upperRadiusLimit=120;camera.wheelPrecision=32;
const ambient=new B.HemisphericLight('ambient',new B.Vector3(0,1,0),scene);ambient.intensity=project.settings.ambientIntensity||.7;ambient.diffuse=B.Color3.FromHexString(project.settings.ambientColor||'#ffffff');
try{scene.enablePhysics(new B.Vector3(0,project.settings.gravity||-9.81,0),new B.CannonJSPlugin())}catch(e){console.warn('Physics unavailable',e)}
const objects=new Map();const keys={};let player=null;function v(x){return new B.Vector3(x.x||0,x.y||0,x.z||0)}function mat(n){const m=new B.StandardMaterial('mat-'+n.id,scene);m.diffuseColor=B.Color3.FromHexString(n.material.color||'#7c8cff');m.emissiveColor=B.Color3.FromHexString(n.material.emissive||'#000000');m.alpha=n.material.opacity??1;m.wireframe=!!n.material.wireframe;return m}
function make(n){let o=null;const opts={size:2};if(n.kind==='box')o=B.MeshBuilder.CreateBox(n.id,opts,scene);else if(n.kind==='sphere')o=B.MeshBuilder.CreateSphere(n.id,{diameter:2,segments:24},scene);else if(n.kind==='cylinder')o=B.MeshBuilder.CreateCylinder(n.id,{height:2,diameter:2,tessellation:24},scene);else if(n.kind==='cone')o=B.MeshBuilder.CreateCylinder(n.id,{height:2,diameterTop:0,diameterBottom:2,tessellation:24},scene);else if(n.kind==='plane')o=B.MeshBuilder.CreatePlane(n.id,{size:2,sideOrientation:B.Mesh.DOUBLESIDE},scene);else if(n.kind==='ground'||n.kind==='terrain')o=B.MeshBuilder.CreateGround(n.id,{width:2,height:2,subdivisions:n.kind==='terrain'?32:2},scene);else if(n.kind==='spawn')o=B.MeshBuilder.CreateCylinder(n.id,{height:.15,diameter:2,tessellation:32},scene);else if(n.kind.includes('light')){if(n.kind==='point-light')o=new B.PointLight(n.id,v(n.position),scene);else if(n.kind==='spot-light')o=new B.SpotLight(n.id,v(n.position),new B.Vector3(0,-1,0),Math.PI/3,2,scene);else o=new B.DirectionalLight(n.id,new B.Vector3(-.5,-1,.5),scene);o.intensity=Number(n.metadata?.intensity||1);objects.set(n.id,o);return o}else if(n.kind==='camera'||n.kind==='group')o=new B.TransformNode(n.id,scene);if(!o)return null;o.position=v(n.position);o.rotation=v(n.rotation);o.scaling=v(n.scale);o.isVisible=n.visible!==false;if(o.material!==undefined)o.material=mat(n);o.metadata={...n.metadata,fluxId:n.id,script:n.script,tags:n.tags};objects.set(n.id,o);if(n.physics?.enabled&&o instanceof B.AbstractMesh){const type=n.kind==='sphere'?B.PhysicsImpostor.SphereImpostor:n.kind==='ground'||n.kind==='terrain'?B.PhysicsImpostor.BoxImpostor:B.PhysicsImpostor.BoxImpostor;o.physicsImpostor=new B.PhysicsImpostor(o,type,{mass:n.physics.static?0:n.physics.mass||1,friction:n.physics.friction??.55,restitution:n.physics.restitution??.1},scene)}return o}
for(const n of project.nodes){const o=make(n);if(o&&n.id===project.settings.playerNodeId)player=o}for(const n of project.nodes){if(n.parentId&&objects.get(n.id)&&objects.get(n.parentId))objects.get(n.id).parent=objects.get(n.parentId)}
const scriptState=new Map();scene.onBeforeRenderObservable.add(()=>{const dt=engine.getDeltaTime()/1000;for(const n of project.nodes){const o=objects.get(n.id);if(!o||!n.script)continue;for(const raw of n.script.split(/\n|;/)){const p=raw.trim().split(/\s+/);if(!p[0])continue;if(p[0]==='spin'){const axis=p[1]||'y';o.rotation[axis]+=Number(p[2]||1)*dt}else if(p[0]==='bob'){const amp=Number(p[1]||.5),speed=Number(p[2]||2),base=scriptState.get(n.id)??o.position.y;scriptState.set(n.id,base);o.position.y=base+Math.sin(performance.now()/1000*speed)*amp}else if(p[0]==='pulse'){const min=Number(p[1]||.8),max=Number(p[2]||1.2),speed=Number(p[3]||2),s=min+(Math.sin(performance.now()/1000*speed)+1)/2*(max-min);o.scaling.set(s,s,s)}}}if(player){const speed=5*dt;const forward=camera.getForwardRay().direction;forward.y=0;forward.normalize();const right=B.Vector3.Cross(forward,B.Axis.Y).normalize();let move=B.Vector3.Zero();if(keys.w||keys.ArrowUp)move.addInPlace(forward);if(keys.s||keys.ArrowDown)move.subtractInPlace(forward);if(keys.a||keys.ArrowLeft)move.addInPlace(right);if(keys.d||keys.ArrowRight)move.subtractInPlace(right);if(move.lengthSquared()>0){move.normalize().scaleInPlace(speed);player.moveWithCollisions?.(move)||player.position.addInPlace(move)}camera.target=B.Vector3.Lerp(camera.target,player.position,.12)}});
addEventListener('keydown',e=>{keys[e.key]=true;if(e.key===' '&&player?.physicsImpostor)player.physicsImpostor.applyImpulse(new B.Vector3(0,5,0),player.getAbsolutePosition())});addEventListener('keyup',e=>keys[e.key]=false);document.querySelectorAll('[data-key]').forEach(b=>{const k=b.dataset.key;for(const evt of ['pointerdown','touchstart'])b.addEventListener(evt,e=>{e.preventDefault();keys[k]=true;if(k===' '&&player?.physicsImpostor)player.physicsImpostor.applyImpulse(new B.Vector3(0,5,0),player.getAbsolutePosition())});for(const evt of ['pointerup','pointercancel','touchend'])b.addEventListener(evt,e=>{e.preventDefault();keys[k]=false})});engine.runRenderLoop(()=>scene.render());addEventListener('resize',()=>engine.resize());
</script></body></html>`;
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
    scene: project.nodes.map((node) => ({
      id: node.id,
      type: node.kind === "sphere" ? "circle" : node.kind === "box" ? "rectangle" : "text",
      name: node.name,
      x: node.position.x,
      y: node.position.z,
      width: node.scale.x,
      height: node.scale.z,
      rotation: node.rotation.y,
      color: node.material.color,
      text: node.name,
      opacity: node.material.opacity,
      radius: 0,
      visible: node.visible,
      locked: node.locked,
      source: node.sourceUrl || null,
    })),
    createdAt: project.createdAt || now,
    updatedAt: now,
    publishedId: project.publishedId,
  };
  return publishCommunityGame(generated);
}

function defaultNodeName(kind: EngineNodeKind): string {
  return kind.split("-").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[character] || character));
}
