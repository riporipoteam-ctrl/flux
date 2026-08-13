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

const DEFAULT_ENDPOINT = "https://europe-west1-flux-544a6.cloudfunctions.net/askaiGroq";

export function getAskAIGroqEndpoint(): string {
  return process.env.NEXT_PUBLIC_ASKAI_GROQ_ENDPOINT?.trim() || DEFAULT_ENDPOINT;
}

export async function checkAskAIGroqHealth(signal?: AbortSignal): Promise<AskAIGroqHealth> {
  const endpoint = getAskAIGroqEndpoint();
  const controller = new AbortController();
  const timeout = globalThis.setTimeout(() => controller.abort(), 9_000);
  const abort = () => controller.abort();
  signal?.addEventListener("abort", abort, { once: true });

  try {
    const response = await fetch(`${endpoint}${endpoint.includes("?") ? "&" : "?"}health=1&t=${Date.now()}`, {
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
      error?: string | null;
      models?: { instant?: string; pro?: string };
    };

    const configured = data.configured === true;
    const primary = String(data.primary || "");
    return {
      state: response.ok && configured ? "connected" : response.status === 503 && !configured ? "missing-secret" : "offline",
      ok: response.ok && configured,
      configured,
      service: String(data.service || "Flux AskAI gateway"),
      version: String(data.version || "unknown"),
      endpoint,
      primary,
      message: response.ok && configured
        ? primary === "ripo-local"
          ? "AskAI is connected to the Ripo Team self-hosted Qwen model."
          : "AskAI is connected through the authenticated Firebase gateway."
        : String(data.error || `AskAI health check returned ${response.status}.`),
      models: {
        instant: String(data.models?.instant || "qwen3:4b-instruct"),
        pro: String(data.models?.pro || "qwen3:4b-instruct"),
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Network request failed";
    return {
      state: /404|not found/i.test(message) ? "not-deployed" : "offline",
      ok: false,
      configured: false,
      service: "Flux AskAI gateway",
      version: "unreachable",
      endpoint,
      message: (error as DOMException)?.name === "AbortError"
        ? "The AskAI gateway did not answer in time. It may be redeploying or offline."
        : "The AskAI gateway is unreachable. Check the Firebase Function and Ripo Team AI server.",
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
  const controller = new AbortController();
  const timeout = globalThis.setTimeout(() => controller.abort(), input.mode === "pro" ? 115_000 : 85_000);
  const abort = () => controller.abort();
  input.signal?.addEventListener("abort", abort, { once: true });

  try {
    const response = await fetch(getAskAIGroqEndpoint(), {
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
    const data = await response.json().catch(() => ({})) as Partial<AskAIGroqResult> & { error?: string; code?: string; details?: string[] };
    if (!response.ok) {
      if (response.status === 401) await user.getIdToken(true).catch(() => undefined);
      if (data.code === "ASKAI_PROVIDER_MISSING") {
        throw new Error("AskAI is deployed, but no AI provider is configured yet. Configure the Ripo Team local AI token or the cloud fallback secret.");
      }
      if (data.code === "ASKAI_UPSTREAM_FAILED") {
        throw new Error(data.error || "Both the Ripo Team local model and fallback provider are currently unavailable.");
      }
      if (response.status === 404) throw new Error("The AskAI Firebase Function is not deployed at the configured endpoint.");
      throw new Error(data.error || `AskAI returned ${response.status}.`);
    }
    if (!data.answer?.trim()) throw new Error("AskAI returned an empty answer.");
    return {
      answer: data.answer.trim(),
      model: String(data.model || "qwen3:4b-instruct"),
      mode: input.mode,
      provider: String(data.provider || "unknown"),
      sources: Array.isArray(data.sources) ? data.sources : [],
      usage: data.usage || null,
      metrics: data.metrics || null,
    };
  } catch (error) {
    if ((error as DOMException)?.name === "AbortError") {
      throw new Error(input.signal?.aborted ? "AskAI response stopped." : "AskAI took too long. Try again.");
    }
    if (error instanceof TypeError && /fetch/i.test(error.message)) {
      throw new Error("AskAI could not reach its backend. The Firebase gateway or Ripo Team AI server may be offline.");
    }
    throw error;
  } finally {
    globalThis.clearTimeout(timeout);
    input.signal?.removeEventListener("abort", abort);
  }
}
