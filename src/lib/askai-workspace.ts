export type AskAIWorkspaceView = "chat" | "agents" | "jobs" | "miniapps" | "files" | "memory";
export type AskAIToolId = "web" | "flux-search" | "code" | "studio" | "social" | "files" | "memory";

export interface AskAIWorkspaceAgent {
  id: string;
  name: string;
  description: string;
  instructions: string;
  tools: AskAIToolId[];
  color: string;
  icon: string;
  isDefault?: boolean;
  createdAt: number;
}

export interface AskAIWorkspaceJob {
  id: string;
  title: string;
  prompt: string;
  schedule: string;
  enabled: boolean;
  lastRunAt: number | null;
  lastResult: string;
  createdAt: number;
}

export type AskAIMiniappType = "checklist" | "poll" | "counter" | "notes" | "decision";

export interface AskAIMiniapp {
  id: string;
  title: string;
  description: string;
  type: AskAIMiniappType;
  data: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
}

export interface AskAIMemory {
  id: string;
  text: string;
  scope: "workspace" | "conversation";
  createdAt: number;
}

export interface AskAIWorkspaceFile {
  id: string;
  name: string;
  type: string;
  size: number;
  text: string;
  dataUrl: string | null;
  createdAt: number;
}

export interface AskAIWorkspaceSettings {
  confirmActions: boolean;
  speakReplies: boolean;
  engine: "auto" | "remote" | "local" | "instant";
}

const AGENTS_KEY = "flux-askai-agents-v2";
const JOBS_KEY = "flux-askai-jobs-v2";
const MINIAPPS_KEY = "flux-askai-miniapps-v2";
const MEMORY_KEY = "flux-askai-memory-v2";
const FILES_KEY = "flux-askai-files-v2";
const SETTINGS_KEY = "flux-askai-settings-v2";

const DEFAULT_AGENTS: AskAIWorkspaceAgent[] = [
  {
    id: "askai",
    name: "AskAI",
    description: "Routes requests, uses the right Flux tools and keeps the full thread context.",
    instructions: "Be useful, direct and honest. Coordinate the available tools instead of pretending an action happened.",
    tools: ["web", "flux-search", "code", "studio", "social", "files", "memory"],
    color: "#6d5dfc",
    icon: "✦",
    isDefault: true,
    createdAt: 0,
  },
  {
    id: "research",
    name: "Research",
    description: "Turns questions, files and Flux searches into clear findings.",
    instructions: "Research carefully, separate facts from guesses, summarize evidence and show uncertainty.",
    tools: ["web", "flux-search", "files", "memory"],
    color: "#2f7df6",
    icon: "⌕",
    isDefault: true,
    createdAt: 0,
  },
  {
    id: "builder",
    name: "Builder",
    description: "Plans games, websites, miniapps and Flux Engine projects.",
    instructions: "Think like a senior product engineer. Produce concrete build steps, code and editable project artifacts.",
    tools: ["code", "studio", "files", "memory"],
    color: "#10a37f",
    icon: "◇",
    isDefault: true,
    createdAt: 0,
  },
  {
    id: "social",
    name: "Social",
    description: "Creates posts, captions, content plans and community ideas.",
    instructions: "Write natural social content without corporate filler. Match the user's tone and platform.",
    tools: ["social", "flux-search", "files", "memory"],
    color: "#f04f88",
    icon: "◉",
    isDefault: true,
    createdAt: 0,
  },
  {
    id: "code",
    name: "Code",
    description: "Explains, debugs and improves HTML, CSS, JavaScript and TypeScript.",
    instructions: "Return safe, runnable code. Explain the actual bug and avoid inventing APIs or results.",
    tools: ["code", "studio", "files", "memory"],
    color: "#f59e0b",
    icon: "</>",
    isDefault: true,
    createdAt: 0,
  },
];

function storage(): Storage | null {
  return typeof window === "undefined" ? null : window.localStorage;
}

function read<T>(key: string, fallback: T): T {
  const target = storage();
  if (!target) return fallback;
  try {
    const parsed = JSON.parse(target.getItem(key) || "null") as T | null;
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

function write<T>(key: string, value: T): T {
  storage()?.setItem(key, JSON.stringify(value));
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("flux-askai-workspace-updated"));
  return value;
}

function createId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function listAskAIAgents(): AskAIWorkspaceAgent[] {
  const custom = read<AskAIWorkspaceAgent[]>(AGENTS_KEY, []);
  return [...DEFAULT_AGENTS, ...custom.filter((agent) => !DEFAULT_AGENTS.some((item) => item.id === agent.id))];
}

export function saveAskAIAgent(input: Omit<AskAIWorkspaceAgent, "id" | "createdAt"> & { id?: string }): AskAIWorkspaceAgent {
  const agent: AskAIWorkspaceAgent = {
    ...input,
    id: input.id || createId("agent"),
    name: input.name.trim().slice(0, 48) || "New agent",
    description: input.description.trim().slice(0, 180),
    instructions: input.instructions.trim().slice(0, 4000),
    tools: [...new Set(input.tools)].slice(0, 12),
    createdAt: Date.now(),
  };
  const custom = read<AskAIWorkspaceAgent[]>(AGENTS_KEY, []);
  const index = custom.findIndex((item) => item.id === agent.id);
  if (index >= 0) custom[index] = agent;
  else custom.unshift(agent);
  write(AGENTS_KEY, custom.slice(0, 40));
  return agent;
}

export function deleteAskAIAgent(id: string): void {
  write(AGENTS_KEY, read<AskAIWorkspaceAgent[]>(AGENTS_KEY, []).filter((agent) => agent.id !== id));
}

export function listAskAIJobs(): AskAIWorkspaceJob[] {
  return read<AskAIWorkspaceJob[]>(JOBS_KEY, []).sort((a, b) => b.createdAt - a.createdAt);
}

export function saveAskAIJob(input: Partial<AskAIWorkspaceJob> & Pick<AskAIWorkspaceJob, "title" | "prompt">): AskAIWorkspaceJob {
  const current = listAskAIJobs();
  const job: AskAIWorkspaceJob = {
    id: input.id || createId("job"),
    title: input.title.trim().slice(0, 70) || "Untitled job",
    prompt: input.prompt.trim().slice(0, 3000),
    schedule: (input.schedule || "Manual").trim().slice(0, 90),
    enabled: input.enabled ?? true,
    lastRunAt: input.lastRunAt ?? null,
    lastResult: input.lastResult || "",
    createdAt: input.createdAt || Date.now(),
  };
  const index = current.findIndex((item) => item.id === job.id);
  if (index >= 0) current[index] = job;
  else current.unshift(job);
  write(JOBS_KEY, current.slice(0, 60));
  return job;
}

export function runAskAIJob(id: string): AskAIWorkspaceJob | null {
  const job = listAskAIJobs().find((item) => item.id === id);
  if (!job) return null;
  return saveAskAIJob({
    ...job,
    lastRunAt: Date.now(),
    lastResult: `Queued locally: ${job.prompt}. Open its thread to run it with AskAI.`,
  });
}

export function deleteAskAIJob(id: string): void {
  write(JOBS_KEY, listAskAIJobs().filter((job) => job.id !== id));
}

export function listAskAIMiniapps(): AskAIMiniapp[] {
  return read<AskAIMiniapp[]>(MINIAPPS_KEY, []).sort((a, b) => b.updatedAt - a.updatedAt);
}

export function createAskAIMiniapp(prompt: string, requestedTitle?: string): AskAIMiniapp {
  const lower = prompt.toLowerCase();
  const type: AskAIMiniappType = lower.includes("poll") || lower.includes("vote")
    ? "poll"
    : lower.includes("counter") || lower.includes("score")
      ? "counter"
      : lower.includes("decision") || lower.includes("compare")
        ? "decision"
        : lower.includes("note") || lower.includes("journal")
          ? "notes"
          : "checklist";
  const now = Date.now();
  const title = (requestedTitle || titleFromPrompt(prompt, type)).slice(0, 70);
  const data: Record<string, unknown> = type === "poll"
    ? { options: ["Option one", "Option two", "Option three"], votes: [0, 0, 0] }
    : type === "counter"
      ? { value: 0, step: 1 }
      : type === "decision"
        ? { options: ["Choice A", "Choice B"], criteria: ["Quality", "Cost", "Time"], scores: [[3, 3, 3], [3, 3, 3]] }
        : type === "notes"
          ? { text: "" }
          : { items: [{ id: createId("task"), text: "First step", done: false }, { id: createId("task"), text: "Second step", done: false }] };
  const miniapp: AskAIMiniapp = {
    id: createId("miniapp"),
    title,
    description: prompt.trim().slice(0, 180),
    type,
    data,
    createdAt: now,
    updatedAt: now,
  };
  write(MINIAPPS_KEY, [miniapp, ...listAskAIMiniapps()].slice(0, 40));
  return miniapp;
}

export function updateAskAIMiniapp(id: string, data: Record<string, unknown>): AskAIMiniapp | null {
  const apps = listAskAIMiniapps();
  const index = apps.findIndex((item) => item.id === id);
  if (index < 0) return null;
  apps[index] = { ...apps[index], data, updatedAt: Date.now() };
  write(MINIAPPS_KEY, apps);
  return apps[index];
}

export function deleteAskAIMiniapp(id: string): void {
  write(MINIAPPS_KEY, listAskAIMiniapps().filter((app) => app.id !== id));
}

export function listAskAIMemory(): AskAIMemory[] {
  return read<AskAIMemory[]>(MEMORY_KEY, []).sort((a, b) => b.createdAt - a.createdAt);
}

export function saveAskAIMemory(text: string, scope: AskAIMemory["scope"] = "workspace"): AskAIMemory {
  const memory: AskAIMemory = { id: createId("memory"), text: text.trim().slice(0, 1000), scope, createdAt: Date.now() };
  write(MEMORY_KEY, [memory, ...listAskAIMemory()].slice(0, 100));
  return memory;
}

export function deleteAskAIMemory(id: string): void {
  write(MEMORY_KEY, listAskAIMemory().filter((memory) => memory.id !== id));
}

export function listAskAIFiles(): AskAIWorkspaceFile[] {
  return read<AskAIWorkspaceFile[]>(FILES_KEY, []).sort((a, b) => b.createdAt - a.createdAt);
}

export function saveAskAIFile(file: AskAIWorkspaceFile): AskAIWorkspaceFile {
  const files = listAskAIFiles().filter((item) => item.id !== file.id);
  try {
    write(FILES_KEY, [file, ...files].slice(0, 24));
  } catch {
    const compact = { ...file, dataUrl: null, text: file.text.slice(0, 80_000) };
    write(FILES_KEY, [compact, ...files.map((item) => ({ ...item, dataUrl: null }))].slice(0, 24));
    return compact;
  }
  return file;
}

export function deleteAskAIFile(id: string): void {
  write(FILES_KEY, listAskAIFiles().filter((file) => file.id !== id));
}

export function getAskAISettings(): AskAIWorkspaceSettings {
  return read<AskAIWorkspaceSettings>(SETTINGS_KEY, {
    confirmActions: true,
    speakReplies: false,
    engine: "auto",
  });
}

export function saveAskAISettings(settings: AskAIWorkspaceSettings): AskAIWorkspaceSettings {
  return write(SETTINGS_KEY, settings);
}

export function buildAskAIWorkspaceContext(agent: AskAIWorkspaceAgent, files: AskAIWorkspaceFile[]): string {
  const memories = listAskAIMemory().slice(0, 20);
  const memoryText = memories.length ? memories.map((item) => `- ${item.text}`).join("\n") : "- No saved workspace memory.";
  const fileText = files.length
    ? files.map((file) => `FILE: ${file.name}\n${file.text ? file.text.slice(0, 12_000) : `[${file.type || "file"}, ${file.size} bytes]`}`).join("\n\n")
    : "No files are attached.";
  return [
    `ACTIVE AGENT: ${agent.name}`,
    `AGENT INSTRUCTIONS: ${agent.instructions}`,
    `AVAILABLE TOOLS: ${agent.tools.join(", ")}`,
    "WORKSPACE MEMORY:",
    memoryText,
    "ATTACHED FILES:",
    fileText,
  ].join("\n");
}

function titleFromPrompt(prompt: string, type: AskAIMiniappType): string {
  const cleaned = prompt
    .replace(/^(build|create|make|generate)\s+(me\s+)?(a\s+|an\s+)?/i, "")
    .replace(/\b(miniapp|app|tool)\b/gi, "")
    .trim();
  return cleaned || `${type.charAt(0).toUpperCase()}${type.slice(1)} miniapp`;
}
