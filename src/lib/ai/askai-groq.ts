import { auth } from "@/lib/firebase";

export type AskAIGroqMode = "instant" | "pro";

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

const DEFAULT_ENDPOINT = "https://europe-west1-flux-544a6.cloudfunctions.net/askaiGroq";

export function getAskAIGroqEndpoint(): string {
  return process.env.NEXT_PUBLIC_ASKAI_GROQ_ENDPOINT?.trim() || DEFAULT_ENDPOINT;
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
    const data = await response.json().catch(() => ({})) as Partial<AskAIGroqResult> & { error?: string };
    if (!response.ok) {
      if (response.status === 401) await user.getIdToken(true).catch(() => undefined);
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
    throw error;
  } finally {
    globalThis.clearTimeout(timeout);
    input.signal?.removeEventListener("abort", abort);
  }
}
