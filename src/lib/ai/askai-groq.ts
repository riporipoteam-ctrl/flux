import { auth } from "@/lib/firebase";

export type AskAIGroqMode = "instant" | "pro";
export type AskAIHealthState = "checking" | "connected" | "missing-secret" | "not-deployed" | "offline";

export interface AskAIGroqMessage {
  role: "user" | "assistant";
  content: string;
}

export interface AskAIGroqSource {
  title: string;
  url: string;
}

export interface AskAIGroqResult {
  answer: string;
  model: string;
  mode: AskAIGroqMode;
  provider?: string;
  sources: AskAIGroqSource[];
  usage: unknown;
  metrics: unknown;
}

export interface AskAIGroqHealth {
  state: Exclude<AskAIHealthState, "checking">;
  ok: boolean;
  configured: boolean;
  service: string;
  version: string;
  endpoint: string;
  message: string;
  primary?: string;
  models: { instant: string; pro: string };
}

const RIPO_ASKAI_BASE = "https://echoxr-ripoteam-cloud-pc.hf.space";
const DEFAULT_ENDPOINT = `${RIPO_ASKAI_BASE}/api/flux/askai/chat`;
// Optional legacy/cloud-tools gateway. Keeping the predictable askaiGroq URL makes
// it possible to opt back into connected research/compute tools through an env var.
const LEGACY_FIREBASE_GATEWAY = "https://europe-west1-flux-544a6.cloudfunctions.net/askaiGroq";

export function getAskAIGroqEndpoint(): string {
  return process.env.NEXT_PUBLIC_ASKAI_GROQ_ENDPOINT?.trim() || DEFAULT_ENDPOINT;
}

function healthEndpoint(endpoint: string): string {
  if (endpoint.includes("/api/flux/askai/chat")) {
    return endpoint.replace("/api/flux/askai/chat", "/api/flux/askai/health");
  }
  return `${endpoint}${endpoint.includes("?") ? "&" : "?"}health=1`;
}

function isDirectRipoEndpoint(endpoint: string): boolean {
  return endpoint.includes("/api/flux/askai/chat");
}

export async function checkAskAIGroqHealth(signal?: AbortSignal): Promise<AskAIGroqHealth> {
  const endpoint = getAskAIGroqEndpoint();
  const controller = new AbortController();
  const timeout = globalThis.setTimeout(() => controller.abort(), 9_000);
  const abort = () => controller.abort();
  signal?.addEventListener("abort", abort, { once: true });

  try {
    const response = await fetch(healthEndpoint(endpoint), {
      method: "GET",
      cache: "no-store",
      headers: { "Accept": "application/json" },
      signal: controller.signal,
    });
    const data = await response.json().catch(() => ({})) as {
      ok?: boolean;
      configured?: boolean;
      service?: string;
      version?: string;
      primary?: string;
      provider?: string;
      model?: string;
      error?: string | null;
      detail?: string | null;
      models?: { instant?: string; pro?: string };
    };

    const configured = data.configured !== false;
    const direct = isDirectRipoEndpoint(endpoint);
    const primary = String(data.primary || (direct ? "ripo-local" : data.provider || ""));
    const model = String(data.model || "qwen3:4b-instruct");
    const healthy = response.ok && data.ok !== false && configured;
    return {
      state: healthy ? "connected" : response.status === 503 && !configured ? "missing-secret" : "offline",
      ok: healthy,
      configured,
      service: String(data.service || (direct ? "Ripo Team Flux AskAI" : "Flux AskAI gateway")),
      version: String(data.version || "unknown"),
      endpoint,
      primary,
      message: healthy
        ? direct
          ? "AskAI is connected directly to the Ripo Team self-hosted Qwen model."
          : "AskAI is connected through the authenticated Firebase gateway."
        : String(data.error || data.detail || `AskAI health check returned ${response.status}.`),
      models: {
        instant: String(data.models?.instant || model),
        pro: String(data.models?.pro || model),
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Network request failed";
    return {
      state: /404|not found/i.test(message) ? "not-deployed" : "offline",
      ok: false,
      configured: false,
      service: "Ripo Team Flux AskAI",
      version: "unreachable",
      endpoint,
      message: (error as DOMException)?.name === "AbortError"
        ? "The Ripo Team AskAI server did not answer in time. It may be redeploying or offline."
        : "AskAI could not reach the Ripo Team AI server.",
      models: { instant: "qwen3:4b-instruct", pro: "qwen3:4b-instruct" },
    };
  } finally {
    globalThis.clearTimeout(timeout);
    signal?.removeEventListener("abort", abort);
  }
}

export async function runAskAIGroq(input: {
  mode: AskAIGroqMode;
  messages: AskAIGroqMessage[];
  workspaceContext?: string;
  research?: boolean;
  codeExecution?: boolean;
  signal?: AbortSignal;
}): Promise<AskAIGroqResult> {
  const user = auth.currentUser;
  if (!user) throw new Error("Sign in to use AskAI.");
  const token = await user.getIdToken();
  const endpoint = getAskAIGroqEndpoint();
  const direct = isDirectRipoEndpoint(endpoint);
  const controller = new AbortController();
  const timeout = globalThis.setTimeout(() => controller.abort(), input.mode === "pro" ? 115_000 : 85_000);
  const abort = () => controller.abort();
  input.signal?.addEventListener("abort", abort, { once: true });

  try {
    if (direct && (input.research === true || input.codeExecution === true)) {
      throw new Error("Connected web research and cloud compute need the optional Firebase gateway. Turn those tools off to use the local Ripo model.");
    }

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      signal: controller.signal,
      body: JSON.stringify({
        mode: input.mode,
        messages: input.messages.slice(-28),
        workspaceContext: input.workspaceContext || "",
        research: input.research === true,
        codeExecution: input.codeExecution === true,
      }),
    });
    const data = await response.json().catch(() => ({})) as Partial<AskAIGroqResult> & { error?: string; detail?: string; code?: string; details?: string[] };
    if (!response.ok) {
      if (response.status === 401) await user.getIdToken(true).catch(() => undefined);
      if (data.code === "ASKAI_PROVIDER_MISSING") {
        throw new Error("AskAI is deployed, but no AI provider is configured yet.");
      }
      if (data.code === "ASKAI_UPSTREAM_FAILED") {
        throw new Error(data.error || "The AskAI provider is currently unavailable.");
      }
      if (response.status === 404) throw new Error("The AskAI endpoint is not deployed at the configured address.");
      throw new Error(data.error || data.detail || `AskAI returned ${response.status}.`);
    }
    if (!data.answer?.trim()) throw new Error("AskAI returned an empty answer.");
    return {
      answer: data.answer.trim(),
      model: String(data.model || "qwen3:4b-instruct"),
      mode: input.mode,
      provider: String(data.provider || (direct ? "ripo-local" : "unknown")),
      sources: Array.isArray(data.sources) ? data.sources : [],
      usage: data.usage || null,
      metrics: data.metrics || null,
    };
  } catch (error) {
    if ((error as DOMException)?.name === "AbortError") {
      throw new Error(input.signal?.aborted ? "AskAI response stopped." : "AskAI took too long. Try again.");
    }
    if (error instanceof TypeError && /fetch/i.test(error.message)) {
      throw new Error("AskAI could not reach the Ripo Team AI server.");
    }
    throw error;
  } finally {
    globalThis.clearTimeout(timeout);
    input.signal?.removeEventListener("abort", abort);
  }
}

void LEGACY_FIREBASE_GATEWAY;
