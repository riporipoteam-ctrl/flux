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

export function getAskAIProEndpoint(): string | null {
  const value =
    process.env.NEXT_PUBLIC_KIMI_K3_ENDPOINT ||
    process.env.NEXT_PUBLIC_ASKAI_PRO_ENDPOINT ||
    process.env.NEXT_PUBLIC_ASKAI_ENDPOINT ||
    "";
  return value.trim() || null;
}

export function getAskAIResearchEndpoint(): string | null {
  const value = process.env.NEXT_PUBLIC_ASKAI_SEARCH_ENDPOINT || "";
  return value.trim() || null;
}

export async function runAskAIPro(input: {
  endpoint: string;
  messages: AskAIProMessage[];
  workspaceContext: string;
  signal?: AbortSignal;
  sources?: AskAIResearchSource[];
}): Promise<string> {
  const sourceContext = input.sources?.length
    ? `\n\nCONNECTED RESEARCH SOURCES:\n${input.sources.map((source, index) => `[${index + 1}] ${source.title}\n${source.url}\n${source.snippet}`).join("\n\n")}\n\nUse inline source numbers such as [1] and finish with a Sources section. Never invent a source.`
    : "";

  const response = await fetch(input.endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal: input.signal,
    body: JSON.stringify({
      model: "kimi-k3",
      reasoning_effort: "max",
      temperature: 1,
      top_p: 1,
      stream: false,
      messages: [
        {
          role: "system",
          content:
            "You are AskAI 1.0 Pro inside Flux. You are powered through a configured Kimi K3-compatible endpoint. Use maximum reasoning effort, give direct complete answers, preserve uncertainty, and never claim a search or action happened unless supplied tool output proves it. Do not reveal private hidden reasoning.\n\n" +
            input.workspaceContext +
            sourceContext,
        },
        ...input.messages
          .filter((message) => message.role === "user" || message.role === "assistant")
          .slice(-24)
          .map((message) => ({ role: message.role, content: message.content.slice(0, 24000) })),
      ],
    }),
  });

  if (!response.ok) {
    const detail = (await response.text().catch(() => "")).slice(0, 260);
    throw new Error(`AskAI 1.0 Pro returned ${response.status}${detail ? `: ${detail}` : ""}`);
  }

  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    const text = (await response.text()).trim();
    if (!text) throw new Error("AskAI 1.0 Pro returned an empty response.");
    return text;
  }

  const data = await response.json() as Record<string, unknown>;
  const choices = Array.isArray(data.choices) ? data.choices : [];
  const first = choices[0] as Record<string, unknown> | undefined;
  const message = first?.message as Record<string, unknown> | undefined;
  const content = message?.content ?? data.answer ?? data.content ?? data.text;
  if (typeof content !== "string" || !content.trim()) {
    throw new Error("AskAI 1.0 Pro returned an empty response.");
  }
  return content.trim();
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
  const data = await response.json() as Record<string, unknown>;
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
