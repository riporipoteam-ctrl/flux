type ChatRole = "system" | "user" | "assistant";

type LocalMessage = {
  role: ChatRole;
  content: string;
};

type CompletionChunk = {
  choices?: Array<{ delta?: { content?: string | null } }>;
};

type LocalEngine = {
  chat: {
    completions: {
      create: (input: {
        messages: LocalMessage[];
        temperature: number;
        max_tokens: number;
        stream: true;
      }) => Promise<AsyncIterable<CompletionChunk>>;
    };
  };
  interruptGenerate?: () => void;
};

type WebLLMModule = {
  CreateMLCEngine: (
    model: string,
    options: { initProgressCallback?: (progress: { text?: string; progress?: number }) => void }
  ) => Promise<LocalEngine>;
};

type NavigatorWithAIHints = Navigator & {
  gpu?: unknown;
  deviceMemory?: number;
  connection?: {
    saveData?: boolean;
    effectiveType?: string;
  };
};

export type LocalAskAIPhase =
  | "idle"
  | "checking"
  | "downloading"
  | "ready"
  | "generating"
  | "error";

export interface LocalAskAIStatus {
  phase: LocalAskAIPhase;
  label: string;
  progress: number | null;
  modelId: string | null;
  error: string | null;
}

const BALANCED_MODEL = "Qwen2.5-1.5B-Instruct-q4f16_1-MLC";
const LITE_MODEL = "Qwen2.5-0.5B-Instruct-q4f16_1-MLC";
const WEB_LLM_URL = "https://esm.run/@mlc-ai/web-llm@0.2.84";
const STATUS_EVENT = "flux-local-askai-status";
const MODEL_CACHE_KEY = "flux-local-askai-model-v3";

let enginePromise: Promise<LocalEngine> | null = null;
let activeEngine: LocalEngine | null = null;
let activeModelId: string | null = null;
let currentStatus: LocalAskAIStatus = {
  phase: "idle",
  label: "Local model has not started yet.",
  progress: null,
  modelId: null,
  error: null,
};

function publishStatus(patch: Partial<LocalAskAIStatus>): LocalAskAIStatus {
  currentStatus = { ...currentStatus, ...patch };
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent<LocalAskAIStatus>(STATUS_EVENT, { detail: currentStatus }));
  }
  return currentStatus;
}

export function getLocalAskAIStatus(): LocalAskAIStatus {
  return currentStatus;
}

export function subscribeLocalAskAIStatus(listener: (status: LocalAskAIStatus) => void): () => void {
  if (typeof window === "undefined") return () => undefined;
  const handle = (event: Event) => {
    const custom = event as CustomEvent<LocalAskAIStatus>;
    listener(custom.detail);
  };
  window.addEventListener(STATUS_EVENT, handle);
  listener(currentStatus);
  return () => window.removeEventListener(STATUS_EVENT, handle);
}

export function localAskAISupported(): boolean {
  if (typeof window === "undefined") return false;
  return !!(navigator as NavigatorWithAIHints).gpu;
}

export function shouldWarmLocalAskAI(): boolean {
  if (!localAskAISupported() || typeof navigator === "undefined") return false;
  const connection = (navigator as NavigatorWithAIHints).connection;
  if (connection?.saveData) return false;
  if (connection?.effectiveType === "slow-2g" || connection?.effectiveType === "2g") return false;
  return navigator.onLine !== false;
}

function preferredModels(): string[] {
  if (typeof navigator === "undefined") return [BALANCED_MODEL, LITE_MODEL];
  const hints = navigator as NavigatorWithAIHints;
  const remembered = typeof localStorage !== "undefined" ? localStorage.getItem(MODEL_CACHE_KEY) : null;
  const constrained = (typeof hints.deviceMemory === "number" && hints.deviceMemory < 4) || navigator.hardwareConcurrency <= 4;
  const ordered = constrained ? [LITE_MODEL, BALANCED_MODEL] : [BALANCED_MODEL, LITE_MODEL];
  if (remembered && ordered.includes(remembered)) {
    return [remembered, ...ordered.filter((model) => model !== remembered)];
  }
  return ordered;
}

async function loadWebLLM(): Promise<WebLLMModule> {
  // Keep GitHub Pages static while loading the browser runtime only on capable devices.
  // eslint-disable-next-line no-new-func
  const importRemote = new Function("url", "return import(url)") as (url: string) => Promise<WebLLMModule>;
  return importRemote(WEB_LLM_URL);
}

async function createEngine(
  modelId: string,
  onProgress: (label: string, progress?: number) => void
): Promise<LocalEngine> {
  const webllm = await loadWebLLM();
  publishStatus({
    phase: "downloading",
    label: `Preparing ${friendlyModelName(modelId)}…`,
    modelId,
    progress: 0,
    error: null,
  });
  return webllm.CreateMLCEngine(modelId, {
    initProgressCallback: (progress) => {
      const percent = typeof progress.progress === "number" ? Math.round(progress.progress * 100) : undefined;
      const label = progress.text || `Preparing ${friendlyModelName(modelId)}…`;
      publishStatus({ phase: "downloading", label, modelId, progress: percent ?? null, error: null });
      onProgress(label, percent);
    },
  });
}

async function getEngine(onProgress: (label: string, progress?: number) => void): Promise<LocalEngine> {
  if (activeEngine) {
    onProgress(`${friendlyModelName(activeModelId || LITE_MODEL)} is ready.`, 100);
    return activeEngine;
  }
  if (enginePromise) return enginePromise;

  enginePromise = (async () => {
    publishStatus({ phase: "checking", label: "Checking this device for private local AI…", progress: null, error: null });
    let lastError: unknown = null;
    for (const modelId of preferredModels()) {
      try {
        const engine = await createEngine(modelId, onProgress);
        activeEngine = engine;
        activeModelId = modelId;
        if (typeof localStorage !== "undefined") localStorage.setItem(MODEL_CACHE_KEY, modelId);
        publishStatus({
          phase: "ready",
          label: `${friendlyModelName(modelId)} is ready on this device.`,
          progress: 100,
          modelId,
          error: null,
        });
        return engine;
      } catch (error) {
        lastError = error;
        publishStatus({
          phase: "checking",
          label: `${friendlyModelName(modelId)} could not start. Trying a lighter model…`,
          progress: null,
          modelId,
          error: error instanceof Error ? error.message : "Model loading failed.",
        });
      }
    }
    throw lastError instanceof Error ? lastError : new Error("No local model could start on this device.");
  })().catch((error) => {
    enginePromise = null;
    activeEngine = null;
    activeModelId = null;
    publishStatus({
      phase: "error",
      label: "Private local AI could not start.",
      progress: null,
      modelId: null,
      error: error instanceof Error ? error.message : "Model loading failed.",
    });
    throw error;
  });

  return enginePromise;
}

export async function warmLocalAskAI(
  onProgress: (label: string, progress?: number) => void = () => undefined
): Promise<LocalAskAIStatus> {
  if (!localAskAISupported()) {
    return publishStatus({
      phase: "error",
      label: "This browser does not expose WebGPU, so Flux will use Instant Local.",
      progress: null,
      modelId: null,
      error: "WebGPU unavailable",
    });
  }
  try {
    await navigator.storage?.persist?.().catch(() => false);
    await getEngine(onProgress);
    return currentStatus;
  } catch {
    return currentStatus;
  }
}

export async function streamLocalAskAI(input: {
  messages: Array<{ role: string; content: string }>;
  signal?: AbortSignal;
  systemPrompt?: string;
  onProgress: (label: string, progress?: number) => void;
  onToken: (token: string) => void;
}): Promise<string> {
  if (!localAskAISupported()) {
    throw new Error("Local AskAI needs a browser with WebGPU. Flux will use Instant Local instead.");
  }

  const engine = await getEngine(input.onProgress);
  if (input.signal?.aborted) throw new DOMException("Aborted", "AbortError");

  const system: LocalMessage = {
    role: "system",
    content: input.systemPrompt ||
      "You are AskAI by Ripo Team inside Flux. Act like a capable workspace coordinator, not a canned chatbot. Give direct, natural answers. Use the supplied thread, agent instructions, workspace memory and files. Never claim a tool ran unless the application actually reports that it ran. Do not reveal hidden reasoning. Do not pretend to have current web access unless a web-search result was supplied.",
  };
  const messages: LocalMessage[] = [
    system,
    ...input.messages
      .filter((message) => message.role === "user" || message.role === "assistant")
      .slice(-14)
      .map((message) => ({
        role: message.role as "user" | "assistant",
        content: String(message.content || "").slice(0, 5000),
      })),
  ];

  const abort = () => engine.interruptGenerate?.();
  input.signal?.addEventListener("abort", abort, { once: true });

  try {
    const modelId = activeModelId || LITE_MODEL;
    publishStatus({
      phase: "generating",
      label: `${friendlyModelName(modelId)} is responding…`,
      progress: null,
      modelId,
      error: null,
    });
    input.onProgress(`${friendlyModelName(modelId)} is responding…`);
    const stream = await engine.chat.completions.create({
      messages,
      temperature: 0.72,
      max_tokens: 1100,
      stream: true,
    });

    let full = "";
    for await (const chunk of stream) {
      if (input.signal?.aborted) throw new DOMException("Aborted", "AbortError");
      const token = chunk.choices?.[0]?.delta?.content || "";
      if (!token) continue;
      full += token;
      input.onToken(token);
    }
    return full.trim();
  } finally {
    input.signal?.removeEventListener("abort", abort);
    if (activeModelId) {
      publishStatus({
        phase: "ready",
        label: `${friendlyModelName(activeModelId)} is ready on this device.`,
        progress: 100,
        modelId: activeModelId,
        error: null,
      });
    }
  }
}

function friendlyModelName(modelId: string): string {
  if (modelId.includes("1.5B")) return "AskAI Local 1.5B";
  return "AskAI Local Lite";
}
