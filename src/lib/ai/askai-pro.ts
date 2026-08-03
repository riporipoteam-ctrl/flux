/**
 * AskAI 1.0 Pro — the connected, high-reasoning half of AskAI.
 *
 * Flux ships as a static export on GitHub Pages, where there is no server to
 * hold an API key and no build-time secret worth trusting. So Pro resolves its
 * connection in this order:
 *
 *   1. Whatever the person configured in the browser (endpoint + key + model).
 *   2. A build-time endpoint, for deployments that set one.
 *   3. Flux's own `/api/askai-pro` proxy, which exists only where API routes do
 *      (Netlify, `next start`) and keeps the key server-side.
 *
 * Anything OpenAI-compatible works, which is what Moonshot's Kimi API and every
 * gateway in front of it speak.
 */

export interface AskAIProMessage {
  role: string;
  content: string;
}

export interface AskAIResearchSource {
  title: string;
  url: string;
  snippet: string;
  publishedAt?: string | null;
}

export type ReasoningEffort = "low" | "medium" | "high" | "max";

export interface AskAIProConnection {
  endpoint: string;
  /** Empty when a same-origin proxy holds the key instead. */
  apiKey: string;
  model: string;
  reasoningEffort: ReasoningEffort;
}

export interface AskAIProPreset {
  id: string;
  label: string;
  endpoint: string;
  model: string;
  note: string;
  needsKey: boolean;
}

const CONNECTION_KEY = "flux-askai-pro-connection-v1";

/** The static export has no API routes, so the proxy only exists off Pages. */
export function proxyEndpoint(): string | null {
  return process.env.NEXT_PUBLIC_BASE_PATH ? null : "/api/askai-pro";
}

export function proPresets(): AskAIProPreset[] {
  const presets: AskAIProPreset[] = [];
  const proxy = proxyEndpoint();
  if (proxy) {
    presets.push({
      id: "flux",
      label: "Flux server",
      endpoint: proxy,
      model: "kimi-k3-max",
      note: "Uses the key held by this Flux deployment. Nothing is stored in your browser.",
      needsKey: false,
    });
  }
  presets.push(
    {
      id: "moonshot",
      label: "Moonshot (Kimi)",
      endpoint: "https://api.moonshot.ai/v1/chat/completions",
      model: "kimi-k3-max",
      note: "Kimi straight from Moonshot. Your key is stored in this browser only.",
      needsKey: true,
    },
    {
      id: "openrouter",
      label: "OpenRouter",
      endpoint: "https://openrouter.ai/api/v1/chat/completions",
      model: "moonshotai/kimi-k2",
      note: "A gateway that fronts Kimi and allows browser requests.",
      needsKey: true,
    },
    {
      id: "custom",
      label: "Custom endpoint",
      endpoint: "",
      model: "kimi-k3-max",
      note: "Any OpenAI-compatible /chat/completions URL, including your own proxy.",
      needsKey: false,
    }
  );
  return presets;
}

function envEndpoint(): string {
  return (
    process.env.NEXT_PUBLIC_KIMI_K3_ENDPOINT ||
    process.env.NEXT_PUBLIC_ASKAI_PRO_ENDPOINT ||
    process.env.NEXT_PUBLIC_ASKAI_ENDPOINT ||
    ""
  ).trim();
}

/** Kept for callers that only need to know whether Pro can run at all. */
export function getAskAIProEndpoint(): string | null {
  return resolveProConnection()?.endpoint ?? null;
}

export function getAskAIResearchEndpoint(): string | null {
  const value = process.env.NEXT_PUBLIC_ASKAI_SEARCH_ENDPOINT || "";
  return value.trim() || null;
}

export function loadProConnection(): AskAIProConnection | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(CONNECTION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<AskAIProConnection>;
    const endpoint = String(parsed.endpoint || "").trim();
    if (!endpoint) return null;
    return {
      endpoint,
      apiKey: String(parsed.apiKey || ""),
      model: String(parsed.model || "kimi-k3-max").trim() || "kimi-k3-max",
      reasoningEffort: isEffort(parsed.reasoningEffort) ? parsed.reasoningEffort : "max",
    };
  } catch {
    return null;
  }
}

export function saveProConnection(connection: AskAIProConnection | null): void {
  if (typeof window === "undefined") return;
  if (!connection || !connection.endpoint.trim()) {
    window.localStorage.removeItem(CONNECTION_KEY);
    return;
  }
  window.localStorage.setItem(
    CONNECTION_KEY,
    JSON.stringify({
      endpoint: connection.endpoint.trim(),
      apiKey: connection.apiKey,
      model: connection.model.trim() || "kimi-k3-max",
      reasoningEffort: connection.reasoningEffort,
    })
  );
}

/** The connection Pro will actually use, or null when it has nothing to call. */
export function resolveProConnection(): AskAIProConnection | null {
  const saved = loadProConnection();
  if (saved) return saved;

  const fromEnv = envEndpoint();
  if (fromEnv) {
    return { endpoint: fromEnv, apiKey: "", model: "kimi-k3-max", reasoningEffort: "max" };
  }

  const proxy = proxyEndpoint();
  if (proxy) return { endpoint: proxy, apiKey: "", model: "kimi-k3-max", reasoningEffort: "max" };

  return null;
}

function isEffort(value: unknown): value is ReasoningEffort {
  return value === "low" || value === "medium" || value === "high" || value === "max";
}

const SYSTEM_PROMPT = `You are AskAI 1.0 Pro inside Flux, built by Ripo Team.
Think hard before answering, then give the answer directly — no preamble, no narration of your process.
Be complete and concrete. Preserve uncertainty instead of smoothing it over.
Never claim you searched, browsed or performed an action unless tool output supplied below proves it.
Do not reveal hidden reasoning or use <think> tags in your reply.
Never name the underlying model vendor; if asked what you are, say "I'm AskAI 1.0 Pro by Ripo Team."`;

function buildMessages(
  workspaceContext: string,
  sources: AskAIResearchSource[] | undefined,
  messages: AskAIProMessage[]
) {
  const sourceContext = sources?.length
    ? `\n\nCONNECTED RESEARCH SOURCES:\n${sources
        .map((source, index) => `[${index + 1}] ${source.title}\n${source.url}\n${source.snippet}`)
        .join("\n\n")}\n\nCite inline with source numbers such as [1] and finish with a Sources section. Never invent a source.`
    : "";

  return [
    { role: "system", content: `${SYSTEM_PROMPT}\n\n${workspaceContext}${sourceContext}` },
    ...messages
      .filter((message) => message.role === "user" || message.role === "assistant")
      .slice(-24)
      .map((message) => ({ role: message.role, content: message.content.slice(0, 24000) })),
  ];
}

/** Turns provider failures into something a person can act on. */
async function describeFailure(response: Response, connection: AskAIProConnection): Promise<string> {
  const detail = (await response.text().catch(() => "")).slice(0, 400);
  const host = safeHost(connection.endpoint);

  if (response.status === 401 || response.status === 403) {
    return `${host} rejected the API key (${response.status}). Check the key in AskAI → Connect Pro.`;
  }
  if (response.status === 404) {
    return `${host} has no model called "${connection.model}" at that path (404). Correct the model or the endpoint URL in Connect Pro.${detail ? `\n\n${detail}` : ""}`;
  }
  if (response.status === 429) {
    return `${host} is rate limiting this key (429). Wait a moment and try again.`;
  }
  if (response.status >= 500) {
    return `${host} returned ${response.status}. That is the provider's side — try again shortly.`;
  }
  return `AskAI 1.0 Pro got ${response.status} from ${host}.${detail ? `\n\n${detail}` : ""}`;
}

function safeHost(endpoint: string): string {
  try {
    return endpoint.startsWith("/") ? "the Flux server" : new URL(endpoint).host;
  } catch {
    return "the configured endpoint";
  }
}

export interface RunProOptions {
  connection: AskAIProConnection;
  messages: AskAIProMessage[];
  workspaceContext: string;
  signal?: AbortSignal;
  sources?: AskAIResearchSource[];
  /** Fires per streamed token so the answer appears as it is written. */
  onToken?: (token: string) => void;
  /** Fires while the model is still reasoning, before any answer tokens. */
  onReasoning?: (charsSoFar: number) => void;
}

export async function runAskAIPro(options: RunProOptions): Promise<string> {
  const { connection, signal } = options;
  const body: Record<string, unknown> = {
    model: connection.model,
    reasoning_effort: connection.reasoningEffort,
    temperature: 1,
    top_p: 1,
    max_tokens: 4096,
    stream: true,
    messages: buildMessages(options.workspaceContext, options.sources, options.messages),
  };

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (connection.apiKey.trim()) headers.Authorization = `Bearer ${connection.apiKey.trim()}`;

  let response: Response;
  try {
    response = await fetch(connection.endpoint, {
      method: "POST",
      headers,
      signal,
      body: JSON.stringify(body),
    });
  } catch (error) {
    if ((error as DOMException)?.name === "AbortError") throw error;
    // A browser fetch that never reaches the server is almost always the
    // provider refusing cross-origin calls; saying so saves a long hunt.
    throw new Error(
      `Could not reach ${safeHost(connection.endpoint)}. If the endpoint is correct, it is probably refusing browser requests (CORS) — point Connect Pro at a gateway or your own proxy instead.`
    );
  }

  if (!response.ok) throw new Error(await describeFailure(response, connection));

  const contentType = response.headers.get("content-type") || "";
  if (response.body && contentType.includes("text/event-stream")) {
    return streamCompletion(response, options);
  }

  // Endpoints are allowed to ignore `stream`; fall back to a whole response.
  if (!contentType.includes("application/json")) {
    const text = (await response.text()).trim();
    if (!text) throw new Error("AskAI 1.0 Pro returned an empty response.");
    options.onToken?.(text);
    return text;
  }

  const data = (await response.json()) as Record<string, unknown>;
  const choices = Array.isArray(data.choices) ? data.choices : [];
  const first = choices[0] as Record<string, unknown> | undefined;
  const message = first?.message as Record<string, unknown> | undefined;
  const content = message?.content ?? data.answer ?? data.content ?? data.text;
  if (typeof content !== "string" || !content.trim()) {
    throw new Error("AskAI 1.0 Pro returned an empty response.");
  }
  options.onToken?.(content.trim());
  return content.trim();
}

async function streamCompletion(response: Response, options: RunProOptions): Promise<string> {
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let answer = "";
  let reasoningChars = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const payload = trimmed.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;

      try {
        const json = JSON.parse(payload) as {
          choices?: Array<{ delta?: { content?: string | null; reasoning_content?: string | null; reasoning?: string | null } }>;
          error?: { message?: string };
        };
        if (json.error?.message) throw new Error(json.error.message);

        const delta = json.choices?.[0]?.delta;
        // Reasoning models emit their private chain on a separate channel. It
        // never belongs in the answer — surface it only as progress.
        const reasoning = delta?.reasoning_content ?? delta?.reasoning;
        if (reasoning) {
          reasoningChars += reasoning.length;
          options.onReasoning?.(reasoningChars);
        }
        const token = delta?.content;
        if (token) {
          answer += token;
          options.onToken?.(token);
        }
      } catch (error) {
        if (error instanceof Error && error.message && !error.message.startsWith("Unexpected")) {
          throw error;
        }
        /* a partial or non-JSON frame; the next read completes it */
      }
    }
  }

  const finished = answer.trim();
  if (!finished) throw new Error("AskAI 1.0 Pro returned an empty response.");
  return finished;
}

export async function searchConnectedWeb(input: {
  endpoint: string;
  query: string;
  signal?: AbortSignal;
  limit?: number;
}): Promise<AskAIResearchSource[]> {
  const response = await fetch(input.endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal: input.signal,
    body: JSON.stringify({ query: input.query, limit: Math.max(1, Math.min(input.limit || 8, 12)), freshness: "auto" }),
  });
  if (!response.ok) throw new Error(`Connected search returned ${response.status}.`);
  const data = (await response.json()) as Record<string, unknown>;
  const raw = Array.isArray(data.results) ? data.results : Array.isArray(data.sources) ? data.sources : [];
  return raw
    .map((item) => item as Record<string, unknown>)
    .map((item) => ({
      title: String(item.title || item.name || "Source").slice(0, 240),
      url: String(item.url || item.link || "").trim(),
      snippet: String(item.snippet || item.description || item.content || "").slice(0, 1200),
      publishedAt: item.publishedAt ? String(item.publishedAt) : item.date ? String(item.date) : null,
    }))
    .filter((item) => item.url && item.snippet)
    .slice(0, Math.max(1, Math.min(input.limit || 8, 12)));
}
