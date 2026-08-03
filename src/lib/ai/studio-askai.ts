import { runAskAIGroq, type AskAIGroqMode } from "@/lib/ai/askai-groq";
import {
  createDefaultEngineProject,
  createEngineNode,
  normalizeEngineProject,
} from "@/services/flux-engine-projects";
import type {
  EngineNode,
  EngineNodeKind,
  EngineWorldSettings,
  FluxEngineProject,
} from "@/types/flux-engine";

const NODE_KINDS: EngineNodeKind[] = [
  "box",
  "sphere",
  "cylinder",
  "cone",
  "plane",
  "ground",
  "terrain",
  "point-light",
  "spot-light",
  "directional-light",
  "camera",
  "spawn",
  "group",
];

interface StudioNodeBlueprint {
  kind?: EngineNodeKind;
  name?: string;
  position?: Partial<EngineNode["position"]>;
  rotation?: Partial<EngineNode["rotation"]>;
  scale?: Partial<EngineNode["scale"]>;
  color?: string;
  emissive?: string;
  opacity?: number;
  metallic?: number;
  roughness?: number;
  physics?: Partial<EngineNode["physics"]>;
  script?: string;
  tags?: string[];
}

interface StudioBlueprint {
  name?: string;
  description?: string;
  tags?: string[];
  world?: Partial<EngineWorldSettings>;
  nodes?: StudioNodeBlueprint[];
  summary?: string;
}

export interface StudioGenerationResult {
  project: FluxEngineProject;
  summary: string;
  model: string;
  objectsCreated: number;
}

export async function generateStudioProjectWithAskAI(input: {
  prompt: string;
  currentProject: FluxEngineProject;
  mode: AskAIGroqMode;
  replaceWorld: boolean;
  signal?: AbortSignal;
}): Promise<StudioGenerationResult> {
  const prompt = input.prompt.trim();
  if (!prompt) throw new Error("Describe the world or game you want AskAI to build.");

  const currentSummary = {
    name: input.currentProject.name,
    description: input.currentProject.description,
    settings: input.currentProject.settings,
    nodes: input.currentProject.nodes.slice(0, 80).map((node) => ({
      kind: node.kind,
      name: node.name,
      position: node.position,
      rotation: node.rotation,
      scale: node.scale,
      color: node.material.color,
      script: node.script,
    })),
  };

  const request = `You are the structured world builder inside Flux Studio. Build a practical browser 3D game scene from the user's request.

Return ONLY valid JSON. Do not use markdown fences, commentary, trailing commas, or JavaScript.

JSON shape:
{
  "name": "short project name",
  "description": "one sentence",
  "tags": ["tag"],
  "summary": "what was built",
  "world": {
    "background": "#RRGGBB",
    "ambientColor": "#RRGGBB",
    "ambientIntensity": 0.7,
    "gravity": -9.81,
    "fogEnabled": false,
    "fogColor": "#RRGGBB",
    "fogDensity": 0.01,
    "shadowsEnabled": true,
    "gridVisible": true,
    "skybox": "studio"
  },
  "nodes": [
    {
      "kind": "box",
      "name": "Platform",
      "position": {"x": 0, "y": 1, "z": 0},
      "rotation": {"x": 0, "y": 0, "z": 0},
      "scale": {"x": 4, "y": 1, "z": 4},
      "color": "#4f7cff",
      "emissive": "#000000",
      "opacity": 1,
      "metallic": 0.05,
      "roughness": 0.7,
      "physics": {"enabled": true, "mass": 0, "static": true, "friction": 0.6, "restitution": 0.1},
      "script": "",
      "tags": ["platform"]
    }
  ]
}

Allowed node kinds: ${NODE_KINDS.join(", ")}.
Use radians for rotation. Use compact, playable layouts. Maximum 80 nodes. Include a ground, spawn, and directional light when replacing a world. Scripts may use simple Flux Engine commands such as "spin y 0.35", "bounce 1.2", "move x 3 1.5", or "rotate y 1". Never include model URLs or unsupported node kinds.

Current project:
${JSON.stringify(currentSummary)}

Mode: ${input.replaceWorld ? "replace the current scene" : "add objects to the current scene"}
User request: ${prompt}`;

  const response = await runAskAIGroq({
    mode: input.mode,
    messages: [{ role: "user", content: request }],
    workspaceContext: "Flux Studio requires strict JSON matching the schema in the user message.",
    research: false,
    codeExecution: false,
    signal: input.signal,
  });

  const blueprint = parseBlueprint(response.answer);
  const generatedNodes = (blueprint.nodes || []).slice(0, 80).map(buildNode).filter(Boolean) as EngineNode[];
  if (!generatedNodes.length) throw new Error("AskAI did not return any usable Studio objects. Try a more specific prompt.");

  const next = input.replaceWorld
    ? buildReplacementProject(input.currentProject, blueprint, generatedNodes)
    : buildAdditiveProject(input.currentProject, blueprint, generatedNodes);

  return {
    project: normalizeEngineProject(next),
    summary: String(blueprint.summary || `Created ${generatedNodes.length} objects.`).slice(0, 400),
    model: response.model,
    objectsCreated: generatedNodes.length,
  };
}

function parseBlueprint(answer: string): StudioBlueprint {
  const clean = answer.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  const start = clean.indexOf("{");
  const end = clean.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("AskAI returned text instead of a Studio blueprint. Try again.");
  try {
    const value = JSON.parse(clean.slice(start, end + 1)) as StudioBlueprint;
    if (!value || typeof value !== "object") throw new Error("Invalid blueprint");
    return value;
  } catch {
    throw new Error("AskAI returned an invalid Studio blueprint. Try the prompt again.");
  }
}

function buildNode(source: StudioNodeBlueprint): EngineNode | null {
  const kind = NODE_KINDS.includes(source.kind as EngineNodeKind) ? source.kind as EngineNodeKind : null;
  if (!kind) return null;
  const node = createEngineNode(kind, String(source.name || "").slice(0, 80) || undefined);
  node.position = vector(source.position, node.position, -500, 500);
  node.rotation = vector(source.rotation, node.rotation, -Math.PI * 8, Math.PI * 8);
  node.scale = vector(source.scale, node.scale, 0.05, 100);
  node.material = {
    ...node.material,
    color: color(source.color, node.material.color),
    emissive: color(source.emissive, node.material.emissive),
    opacity: clamp(source.opacity, 0.05, 1, node.material.opacity),
    metallic: clamp(source.metallic, 0, 1, node.material.metallic),
    roughness: clamp(source.roughness, 0, 1, node.material.roughness),
  };
  node.physics = {
    ...node.physics,
    ...(source.physics || {}),
    mass: clamp(source.physics?.mass, 0, 10_000, node.physics.mass),
    friction: clamp(source.physics?.friction, 0, 1, node.physics.friction),
    restitution: clamp(source.physics?.restitution, 0, 1, node.physics.restitution),
  };
  node.script = String(source.script || "").slice(0, 2_000);
  node.tags = Array.isArray(source.tags) ? source.tags.map(String).slice(0, 12) : [];
  return node;
}

function buildReplacementProject(
  current: FluxEngineProject,
  blueprint: StudioBlueprint,
  nodes: EngineNode[]
): FluxEngineProject {
  const defaults = createDefaultEngineProject(current.ownerId);
  const ensured = [...nodes];
  for (const required of ["ground", "spawn", "directional-light"] as EngineNodeKind[]) {
    if (!ensured.some((node) => node.kind === required)) {
      const fallback = defaults.nodes.find((node) => node.kind === required);
      if (fallback) ensured.push(fallback);
    }
  }
  const spawn = ensured.find((node) => node.kind === "spawn");
  return {
    ...current,
    name: String(blueprint.name || current.name).slice(0, 80),
    description: String(blueprint.description || current.description).slice(0, 600),
    tags: Array.isArray(blueprint.tags) ? blueprint.tags.map(String).slice(0, 20) : current.tags,
    nodes: ensured,
    settings: sanitizeWorld({ ...current.settings, ...(blueprint.world || {}), playerNodeId: spawn?.id || null }),
    publishedId: null,
    updatedAt: Date.now(),
  };
}

function buildAdditiveProject(
  current: FluxEngineProject,
  blueprint: StudioBlueprint,
  nodes: EngineNode[]
): FluxEngineProject {
  return {
    ...current,
    description: blueprint.description ? String(blueprint.description).slice(0, 600) : current.description,
    tags: blueprint.tags?.length ? [...new Set([...current.tags, ...blueprint.tags.map(String)])].slice(0, 20) : current.tags,
    nodes: [...current.nodes, ...nodes].slice(0, 500),
    settings: sanitizeWorld({ ...current.settings, ...(blueprint.world || {}) }),
    publishedId: null,
    updatedAt: Date.now(),
  };
}

function sanitizeWorld(settings: EngineWorldSettings): EngineWorldSettings {
  const skyboxes: EngineWorldSettings["skybox"][] = ["none", "studio", "sunset", "night"];
  return {
    ...settings,
    background: color(settings.background, "#11151c"),
    ambientColor: color(settings.ambientColor, "#dbeafe"),
    ambientIntensity: clamp(settings.ambientIntensity, 0, 3, 0.68),
    gravity: clamp(settings.gravity, -100, 100, -9.81),
    fogColor: color(settings.fogColor, "#11151c"),
    fogDensity: clamp(settings.fogDensity, 0, 1, 0.012),
    gridSize: clamp(settings.gridSize, 0.1, 100, 1),
    snapPosition: clamp(settings.snapPosition, 0.01, 100, 0.5),
    snapRotation: clamp(settings.snapRotation, 1, 180, 15),
    snapScale: clamp(settings.snapScale, 0.01, 10, 0.1),
    skybox: skyboxes.includes(settings.skybox) ? settings.skybox : "studio",
  };
}

function vector(
  value: Partial<EngineNode["position"]> | undefined,
  fallback: EngineNode["position"],
  min: number,
  max: number
): EngineNode["position"] {
  return {
    x: clamp(value?.x, min, max, fallback.x),
    y: clamp(value?.y, min, max, fallback.y),
    z: clamp(value?.z, min, max, fallback.z),
  };
}

function clamp(value: unknown, min: number, max: number, fallback: number): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.min(max, Math.max(min, numeric)) : fallback;
}

function color(value: unknown, fallback: string): string {
  const clean = String(value || "").trim();
  return /^#[0-9a-f]{6}$/i.test(clean) ? clean : fallback;
}
