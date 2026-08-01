export type AskAIWorkspaceView = "chat" | "agents" | "jobs" | "miniapps" | "files" | "memory";
export type AskAIToolId = "web" | "flux-search" | "code" | "studio" | "social" | "files" | "memory";
export type AskAIAgentAccess = "private" | "workspace";
export type AskAIAgentStatus = "available" | "working" | "paused";

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
  model: "auto" | "local-balanced" | "local-lite" | "connected";
  access: AskAIAgentAccess;
  device: "automatic" | "browser" | "connected";
  status: AskAIAgentStatus;
  goals: string[];
  skills: string[];
  triggers: string[];
  memoryEnabled: boolean;
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
  preloadLocalModel?: boolean;
}

export interface AskAIAgentRoute {
  agent: AskAIWorkspaceAgent;
  reason: string;
}

const AGENTS_KEY = "flux-askai-agents-v3";
const LEGACY_AGENTS_KEY = "flux-askai-agents-v2";
const JOBS_KEY = "flux-askai-jobs-v2";
const MINIAPPS_KEY = "flux-askai-miniapps-v2";
const MEMORY_KEY = "flux-askai-memory-v2";
const FILES_KEY = "flux-askai-files-v2";
const SETTINGS_KEY = "flux-askai-settings-v2";
const VALID_TOOLS = new Set<AskAIToolId>(["web", "flux-search", "code", "studio", "social", "files", "memory"]);

const DEFAULT_AGENTS: AskAIWorkspaceAgent[] = [
  {
    id: "askai",
    name: "AskAI",
    description: "Your workspace orchestrator. It routes work to specialists and keeps the final answer coherent.",
    instructions: "Coordinate the specialist roster. Decide which role fits the request, use the available context and tools, then return one clear answer. Never pretend a tool or background job ran when it did not.",
    tools: ["web", "flux-search", "code", "studio", "social", "files", "memory"],
    color: "#7468ff",
    icon: "✦",
    isDefault: true,
    createdAt: 0,
    model: "auto",
    access: "private",
    device: "automatic",
    status: "available",
    goals: ["Route each task to the best specialist", "Keep the whole thread and workspace context", "Ask before risky Flux changes"],
    skills: ["Delegation", "Task planning", "Answer synthesis", "Approval handling"],
    triggers: [],
    memoryEnabled: true,
  },
  {
    id: "research",
    name: "Research Analyst",
    description: "Finds, compares and explains information using supplied sources, files and Flux search.",
    instructions: "Separate evidence from inference. Cite supplied sources, surface uncertainty and finish with a practical conclusion.",
    tools: ["web", "flux-search", "files", "memory"],
    color: "#2f8cff",
    icon: "⌕",
    isDefault: true,
    createdAt: 0,
    model: "auto",
    access: "workspace",
    device: "automatic",
    status: "available",
    goals: ["Find reliable evidence", "Compare competing options", "Produce decision-ready briefs"],
    skills: ["Research", "Fact checking", "Source comparison", "Summaries"],
    triggers: ["Weekly research brief"],
    memoryEnabled: true,
  },
  {
    id: "builder",
    name: "Product Builder",
    description: "Plans and creates Flux Studio projects, browser games, miniapps and product specifications.",
    instructions: "Think like a senior product engineer. Break work into architecture, user flows, implementation and testing. Produce editable artifacts instead of fake completion claims.",
    tools: ["code", "studio", "files", "memory"],
    color: "#14b889",
    icon: "◇",
    isDefault: true,
    createdAt: 0,
    model: "local-balanced",
    access: "workspace",
    device: "browser",
    status: "available",
    goals: ["Turn ideas into buildable systems", "Keep projects editable", "Protect mobile performance"],
    skills: ["Product architecture", "Game systems", "Frontend engineering", "QA plans"],
    triggers: [],
    memoryEnabled: true,
  },
  {
    id: "social",
    name: "Social Lead",
    description: "Creates natural posts, campaigns, community plans and replies in the user's voice.",
    instructions: "Write human social content with a clear point. Avoid corporate filler, fake hype and generic AI phrasing. Match the user's tone.",
    tools: ["social", "flux-search", "files", "memory"],
    color: "#f05c98",
    icon: "◉",
    isDefault: true,
    createdAt: 0,
    model: "local-balanced",
    access: "workspace",
    device: "browser",
    status: "available",
    goals: ["Create posts people would actually read", "Plan consistent campaigns", "Support community conversations"],
    skills: ["Captions", "Campaigns", "Community replies", "Brand voice"],
    triggers: ["Content calendar"],
    memoryEnabled: true,
  },
  {
    id: "code",
    name: "Code Engineer",
    description: "Debugs and improves HTML, CSS, JavaScript, TypeScript and Flux project code.",
    instructions: "Explain the actual bug, return safe runnable code and verify assumptions. Do not invent APIs, logs or test results.",
    tools: ["code", "studio", "files", "memory"],
    color: "#f5a524",
    icon: "</>",
    isDefault: true,
    createdAt: 0,
    model: "local-balanced",
    access: "workspace",
    device: "browser",
    status: "available",
    goals: ["Find root causes", "Return maintainable fixes", "Preserve project behavior"],
    skills: ["Debugging", "Code review", "Refactoring", "Performance"],
    triggers: ["Project error review"],
    memoryEnabled: true,
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

function normalizeAgent(agent: Partial<AskAIWorkspaceAgent> & Pick<AskAIWorkspaceAgent, "id" | "name">): AskAIWorkspaceAgent {
  const tools = [...new Set((agent.tools || ["files", "memory"]).filter((tool): tool is AskAIToolId => VALID_TOOLS.has(tool as AskAIToolId)))].slice(0, 12);
  return {
    id: agent.id,
    name: agent.name.trim().slice(0, 48) || "New agent",
    description: String(agent.description || "Workspace specialist").trim().slice(0, 180),
    instructions: String(agent.instructions || "Help with the assigned workspace task.").trim().slice(0, 4000),
    tools: tools.length ? tools : ["files", "memory"],
    color: agent.color || "#7468ff",
    icon: agent.icon || "✦",
    isDefault: agent.isDefault,
    createdAt: agent.createdAt || Date.now(),
    model: agent.model || "auto",
    access: agent.access || "private",
    device: agent.device || "automatic",
    status: agent.status || "available",
    goals: (agent.goals || []).map(String).filter(Boolean).slice(0, 8),
    skills: (agent.skills || []).map(String).filter(Boolean).slice(0, 12),
    triggers: (agent.triggers || []).map(String).filter(Boolean).slice(0, 12),
    memoryEnabled: agent.memoryEnabled ?? true,
  };
}

export function listAskAIAgents(): AskAIWorkspaceAgent[] {
  const saved = read<Array<Partial<AskAIWorkspaceAgent> & Pick<AskAIWorkspaceAgent, "id" | "name">>>(AGENTS_KEY, []);
  const legacy = saved.length ? [] : read<Array<Partial<AskAIWorkspaceAgent> & Pick<AskAIWorkspaceAgent, "id" | "name">>>(LEGACY_AGENTS_KEY, []);
  const custom = [...saved, ...legacy].map(normalizeAgent);
  return [...DEFAULT_AGENTS, ...custom.filter((agent) => !DEFAULT_AGENTS.some((item) => item.id === agent.id))];
}

export function saveAskAIAgent(input: {
  id?: string;
  name: string;
  description: string;
  instructions: string;
  tools: AskAIToolId[];
  color: string;
  icon: string;
  isDefault?: boolean;
  model?: AskAIWorkspaceAgent["model"];
  access?: AskAIAgentAccess;
  device?: AskAIWorkspaceAgent["device"];
  status?: AskAIAgentStatus;
  goals?: string[];
  skills?: string[];
  triggers?: string[];
  memoryEnabled?: boolean;
}): AskAIWorkspaceAgent {
  const agent = normalizeAgent({
    ...input,
    id: input.id || createId("agent"),
    createdAt: Date.now(),
  });
  const custom = read<AskAIWorkspaceAgent[]>(AGENTS_KEY, []).map(normalizeAgent);
  const index = custom.findIndex((item) => item.id === agent.id);
  if (index >= 0) custom[index] = agent;
  else custom.unshift(agent);
  write(AGENTS_KEY, custom.slice(0, 40));
  return agent;
}

export function deleteAskAIAgent(id: string): void {
  write(AGENTS_KEY, read<AskAIWorkspaceAgent[]>(AGENTS_KEY, []).filter((agent) => agent.id !== id));
}

export function routeAskAIAgent(prompt: string, preferredId = "askai"): AskAIAgentRoute {
  const agents = listAskAIAgents();
  const preferred = agents.find((agent) => agent.id === preferredId);
  if (preferred && preferred.id !== "askai") return { agent: preferred, reason: "You selected this specialist." };
  const lower = prompt.toLowerCase();
  const route: [string, string] = /\b(code|bug|error|typescript|javascript|css|html|github|build failure|debug)\b/.test(lower)
    ? ["code", "The request is primarily code or debugging work."]
    : /\b(game|website|studio|engine|product|feature|prototype|architecture|build|create an app)\b/.test(lower)
      ? ["builder", "The request is product or creation work."]
      : /\b(post|caption|hashtag|campaign|followers|community|social|reply|content plan)\b/.test(lower)
        ? ["social", "The request is social or community work."]
        : /\b(research|compare|latest|source|evidence|find out|investigate|report)\b/.test(lower)
          ? ["research", "The request needs research or comparison."]
          : ["askai", "The orchestrator can answer directly and coordinate tools as needed."];
  return {
    agent: agents.find((agent) => agent.id === route[0]) || agents[0],
    reason: route[1],
  };
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
    preloadLocalModel: true,
  });
}

export function saveAskAISettings(settings: AskAIWorkspaceSettings): AskAIWorkspaceSettings {
  return write(SETTINGS_KEY, settings);
}

export function buildAskAIWorkspaceContext(agent: AskAIWorkspaceAgent, files: AskAIWorkspaceFile[]): string {
  const memories = agent.memoryEnabled ? listAskAIMemory().slice(0, 20) : [];
  const memoryText = memories.length ? memories.map((item) => `- ${item.text}`).join("\n") : "- No workspace memory is active for this agent.";
  const fileText = files.length
    ? files.map((file) => `FILE: ${file.name}\n${file.text ? file.text.slice(0, 12_000) : `[${file.type || "file"}, ${file.size} bytes]`}`).join("\n\n")
    : "No files are attached.";
  const roster = listAskAIAgents()
    .filter((item) => item.id !== "askai")
    .map((item) => `- ${item.name}: ${item.description} | skills: ${item.skills.join(", ")}`)
    .join("\n");
  return [
    `ACTIVE AGENT: ${agent.name}`,
    `AGENT ROLE: ${agent.description}`,
    `AGENT INSTRUCTIONS: ${agent.instructions}`,
    `MODEL PREFERENCE: ${agent.model}`,
    `ACCESS: ${agent.access}`,
    `DEVICE: ${agent.device}`,
    `AVAILABLE TOOLS: ${agent.tools.join(", ")}`,
    `GOALS: ${agent.goals.join(" | ") || "Complete the user's request accurately."}`,
    `SKILLS: ${agent.skills.join(", ") || "General assistance"}`,
    agent.id === "askai" ? "SPECIALIST ROSTER:\n" + roster : "",
    agent.id === "askai" ? "DELEGATION RULE: silently adopt the most relevant specialist's methods, but return one coherent answer as AskAI. State which specialist would own a long-running task when useful." : "",
    "WORKSPACE MEMORY:",
    memoryText,
    "ATTACHED FILES:",
    fileText,
  ].filter(Boolean).join("\n");
}

function titleFromPrompt(prompt: string, type: AskAIMiniappType): string {
  const cleaned = prompt
    .replace(/^(build|create|make|generate)\s+(me\s+)?(a\s+|an\s+)?/i, "")
    .replace(/\b(miniapp|app|tool)\b/gi, "")
    .trim();
  return cleaned || `${type.charAt(0).toUpperCase()}${type.slice(1)} miniapp`;
}
