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

const INSTANT_MODEL = "Qwen2.5-0.5B-Instruct-q4f16_1-MLC";
const WEB_LLM_URL = "https://esm.run/@mlc-ai/web-llm@0.2.84";
const STATUS_EVENT = "flux-local-askai-status";
const MODEL_CACHE_KEY = "flux-askai-instant-model-v1";
// Remembers that the browser runtime could not start here. The engine is
// fetched from a CDN and weighs hundreds of megabytes, so a device that failed
// once will fail again — retrying on every message just spends the user's data
// and surfaces a raw "Load failed" from the fetch layer.
const UNSUPPORTED_KEY = "flux-askai-instant-unavailable-v1";

function markUnsupported(): void {
  try {
    window.localStorage.setItem(UNSUPPORTED_KEY, String(Date.now()));
  } catch {
    /* private mode; the in-memory guard still holds for this session */
  }
}

function knownUnsupported(): boolean {
  if (sessionUnsupported) return true;
  try {
    return Boolean(window.localStorage.getItem(UNSUPPORTED_KEY));
  } catch {
    return false;
  }
}

let sessionUnsupported = false;

let enginePromise: Promise<LocalEngine> | null = null;
let activeEngine: LocalEngine | null = null;
let currentStatus: LocalAskAIStatus = {
  phase: "idle",
  label: "AskAI 1.0 Instant has not started yet.",
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
  const handle = (event: Event) => listener((event as CustomEvent<LocalAskAIStatus>).detail);
  window.addEventListener(STATUS_EVENT, handle);
  listener(currentStatus);
  return () => window.removeEventListener(STATUS_EVENT, handle);
}

export function localAskAISupported(): boolean {
  if (typeof window === "undefined") return false;
  if (knownUnsupported()) return false;
  return !!(navigator as NavigatorWithAIHints).gpu;
}

export function shouldWarmLocalAskAI(): boolean {
  if (!localAskAISupported() || typeof navigator === "undefined") return false;
  const connection = (navigator as NavigatorWithAIHints).connection;
  if (connection?.saveData) return false;
  if (connection?.effectiveType === "slow-2g" || connection?.effectiveType === "2g") return false;
  return navigator.onLine !== false;
}

async function loadWebLLM(): Promise<WebLLMModule> {
  // Keep GitHub Pages static while loading the browser runtime only on capable devices.
  // eslint-disable-next-line no-new-func
  const importRemote = new Function("url", "return import(url)") as (url: string) => Promise<WebLLMModule>;
  return importRemote(WEB_LLM_URL);
}

async function getEngine(onProgress: (label: string, progress?: number) => void): Promise<LocalEngine> {
  if (activeEngine) {
    onProgress("AskAI 1.0 Instant is ready.", 100);
    return activeEngine;
  }
  if (enginePromise) return enginePromise;

  enginePromise = (async () => {
    publishStatus({ phase: "checking", label: "Checking this device for AskAI 1.0 Instant…", progress: null, error: null });
    const webllm = await loadWebLLM();
    publishStatus({ phase: "downloading", label: "Preparing AskAI 1.0 Instant…", progress: 0, modelId: INSTANT_MODEL, error: null });
    const engine = await webllm.CreateMLCEngine(INSTANT_MODEL, {
      initProgressCallback: (progress) => {
        const percent = typeof progress.progress === "number" ? Math.round(progress.progress * 100) : undefined;
        const label = progress.text || "Preparing AskAI 1.0 Instant…";
        publishStatus({ phase: "downloading", label, progress: percent ?? null, modelId: INSTANT_MODEL, error: null });
        onProgress(label, percent);
      },
    });
    activeEngine = engine;
    localStorage.setItem(MODEL_CACHE_KEY, INSTANT_MODEL);
    publishStatus({ phase: "ready", label: "AskAI 1.0 Instant is ready on this device.", progress: 100, modelId: INSTANT_MODEL, error: null });
    return engine;
  })().catch((error) => {
    enginePromise = null;
    activeEngine = null;
    // WebGPU can be advertised and still be unusable, and the CDN import fails
    // outright on locked-down networks. Record it so Instant stops trying and
    // quietly uses the built-in tools instead.
    sessionUnsupported = true;
    markUnsupported();
    publishStatus({
      phase: "error",
      label: "On-device model unavailable here — using Flux's instant tools.",
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
    return publishStatus({ phase: "error", label: "WebGPU is unavailable, so AskAI will use its instant text tools.", progress: null, modelId: null, error: "WebGPU unavailable" });
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
    throw new Error("AskAI 1.0 Instant needs WebGPU for model chat. Flux will use its instant local tools instead.");
  }

  const engine = await getEngine(input.onProgress);
  if (input.signal?.aborted) throw new DOMException("Aborted", "AbortError");

  const messages: LocalMessage[] = [
    {
      role: "system",
      content: input.systemPrompt || "You are AskAI 1.0 Instant inside Flux. Give fast, direct, natural answers. Never claim live web access or tool results unless they are supplied. Do not reveal hidden reasoning.",
    },
    ...input.messages
      .filter((message) => message.role === "user" || message.role === "assistant")
      .slice(-12)
      .map((message) => ({ role: message.role as "user" | "assistant", content: String(message.content || "").slice(0, 4500) })),
  ];

  const abort = () => engine.interruptGenerate?.();
  input.signal?.addEventListener("abort", abort, { once: true });

  try {
    publishStatus({ phase: "generating", label: "AskAI 1.0 Instant is responding…", progress: null, modelId: INSTANT_MODEL, error: null });
    input.onProgress("AskAI 1.0 Instant is responding…");
    const stream = await engine.chat.completions.create({ messages, temperature: 0.68, max_tokens: 850, stream: true });
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
    publishStatus({ phase: "ready", label: "AskAI 1.0 Instant is ready on this device.", progress: 100, modelId: INSTANT_MODEL, error: null });
  }
}
