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
      error?: string | null;
      models?: { instant?: string; pro?: string };
    };

    const configured = data.configured === true;
    return {
      state: response.ok && configured ? "connected" : response.status === 503 && !configured ? "missing-secret" : "offline",
      ok: response.ok && configured,
      configured,
      service: String(data.service || "Flux AskAI Groq proxy"),
      version: String(data.version || "unknown"),
      endpoint,
      message: response.ok && configured
        ? "Groq is connected through the authenticated Firebase proxy."
        : String(data.error || `AskAI health check returned ${response.status}.`),
      models: {
        instant: String(data.models?.instant || "openai/gpt-oss-20b"),
        pro: String(data.models?.pro || "openai/gpt-oss-120b"),
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Network request failed";
    return {
      state: /404|not found/i.test(message) ? "not-deployed" : "offline",
      ok: false,
      configured: false,
      service: "Flux AskAI Groq proxy",
      version: "unreachable",
      endpoint,
      message: (error as DOMException)?.name === "AbortError"
        ? "The Firebase AskAI function did not answer in time. It may not be deployed."
        : "The Firebase AskAI function is unreachable. Deploy the function and check its CORS/region configuration.",
      models: { instant: "openai/gpt-oss-20b", pro: "openai/gpt-oss-120b" },
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
  const timeout = globalThis.setTimeout(() => controller.abort(), input.mode === "pro" ? 115_000 : 55_000);
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
    const data = await response.json().catch(() => ({})) as Partial<AskAIGroqResult> & { error?: string; code?: string };
    if (!response.ok) {
      if (response.status === 401) await user.getIdToken(true).catch(() => undefined);
      if (data.code === "GROQ_SECRET_MISSING") {
        throw new Error("AskAI is deployed, but its Groq secret is missing. Add GROQ_API_KEY in Firebase Secret Manager and redeploy the function.");
      }
      if (data.code === "GROQ_KEY_REJECTED") {
        throw new Error("Groq rejected the backend key. Revoke the exposed key, create a fresh key, update the Firebase secret and redeploy AskAI.");
      }
      if (response.status === 404) throw new Error("The AskAI Firebase Function is not deployed at the configured endpoint.");
      throw new Error(data.error || `AskAI returned ${response.status}.`);
    }
    if (!data.answer?.trim()) throw new Error("AskAI returned an empty answer.");
    return {
      answer: data.answer.trim(),
      model: String(data.model || (input.mode === "pro" ? "openai/gpt-oss-120b" : "openai/gpt-oss-20b")),
      mode: input.mode,
      sources: Array.isArray(data.sources) ? data.sources : [],
      usage: data.usage || null,
      metrics: data.metrics || null,
    };
  } catch (error) {
    if ((error as DOMException)?.name === "AbortError") {
      throw new Error(input.signal?.aborted ? "AskAI response stopped." : "AskAI took too long. Try again.");
    }
    if (error instanceof TypeError && /fetch/i.test(error.message)) {
      throw new Error("AskAI could not reach its Firebase backend. The function may not be deployed yet.");
    }
    throw error;
  } finally {
    globalThis.clearTimeout(timeout);
    input.signal?.removeEventListener("abort", abort);
  }
}
