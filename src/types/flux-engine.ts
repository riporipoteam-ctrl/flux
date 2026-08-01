export type EngineNodeKind =
  | "box"
  | "sphere"
  | "cylinder"
  | "cone"
  | "plane"
  | "ground"
  | "terrain"
  | "model"
  | "point-light"
  | "spot-light"
  | "directional-light"
  | "camera"
  | "spawn"
  | "group";

export type TransformMode = "select" | "move" | "rotate" | "scale";
export type EngineCameraView = "perspective" | "top" | "front" | "right" | "free";
export type EnginePanel = "console" | "scripts" | "assets" | "versions" | "settings";

export interface EngineVector3 {
  x: number;
  y: number;
  z: number;
}

export interface EngineMaterial {
  color: string;
  emissive: string;
  opacity: number;
  metallic: number;
  roughness: number;
  wireframe: boolean;
}

export interface EnginePhysics {
  enabled: boolean;
  mass: number;
  friction: number;
  restitution: number;
  static: boolean;
}

export interface EngineNode {
  id: string;
  name: string;
  kind: EngineNodeKind;
  parentId: string | null;
  position: EngineVector3;
  rotation: EngineVector3;
  scale: EngineVector3;
  material: EngineMaterial;
  physics: EnginePhysics;
  visible: boolean;
  locked: boolean;
  castShadow: boolean;
  receiveShadow: boolean;
  script: string;
  tags: string[];
  sourceUrl?: string | null;
  sourceName?: string | null;
  metadata?: Record<string, string | number | boolean | null>;
}

export interface EngineWorldSettings {
  background: string;
  ambientColor: string;
  ambientIntensity: number;
  gravity: number;
  fogEnabled: boolean;
  fogColor: string;
  fogDensity: number;
  shadowsEnabled: boolean;
  gridVisible: boolean;
  gridSize: number;
  snapEnabled: boolean;
  snapPosition: number;
  snapRotation: number;
  snapScale: number;
  skybox: "none" | "studio" | "sunset" | "night";
  playerNodeId: string | null;
  backgroundAudioUrl: string;
}

export interface EngineVersion {
  id: string;
  label: string;
  createdAt: number;
  project: Omit<FluxEngineProject, "versions">;
}

export interface FluxEngineProject {
  id: string;
  ownerId: string;
  name: string;
  description: string;
  thumbnail: string;
  tags: string[];
  nodes: EngineNode[];
  settings: EngineWorldSettings;
  versions: EngineVersion[];
  createdAt: number;
  updatedAt: number;
  publishedId: string | null;
}

export interface EnginePrefab {
  id: string;
  ownerId: string;
  name: string;
  node: EngineNode;
  createdAt: number;
}

export interface EngineConsoleEntry {
  id: string;
  level: "info" | "success" | "warning" | "error";
  message: string;
  createdAt: number;
}

export interface EngineSelectionSnapshot {
  selectedId: string | null;
  project: FluxEngineProject;
}
