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

const MODEL_ID = "Qwen2.5-0.5B-Instruct-q4f16_1-MLC";
let enginePromise: Promise<LocalEngine> | null = null;

export function localAskAISupported(): boolean {
  if (typeof window === "undefined") return false;
  return !!(navigator as Navigator & { gpu?: unknown }).gpu;
}

async function getEngine(onProgress: (label: string, progress?: number) => void): Promise<LocalEngine> {
  if (!enginePromise) {
    // CDN loading keeps GitHub Pages builds static and avoids bundling a ~large runtime.
    // eslint-disable-next-line no-new-func
    const importRemote = new Function("url", "return import(url)") as (url: string) => Promise<WebLLMModule>;
    enginePromise = importRemote("https://esm.run/@mlc-ai/web-llm@0.2.84").then((webllm) =>
      webllm.CreateMLCEngine(MODEL_ID, {
        initProgressCallback: (progress) => {
          const percent = typeof progress.progress === "number" ? Math.round(progress.progress * 100) : undefined;
          onProgress(progress.text || "Preparing local AskAI…", percent);
        },
      })
    );
  }
  return enginePromise;
}

export async function streamLocalAskAI(input: {
  messages: Array<{ role: string; content: string }>;
  signal?: AbortSignal;
  onProgress: (label: string, progress?: number) => void;
  onToken: (token: string) => void;
}): Promise<string> {
  if (!localAskAISupported()) {
    throw new Error("Local AskAI needs a browser with WebGPU. Open Flux in a current Safari, Chrome, or Edge browser.");
  }

  const engine = await getEngine(input.onProgress);
  if (input.signal?.aborted) throw new DOMException("Aborted", "AbortError");

  const system: LocalMessage = {
    role: "system",
    content:
      "You are AskAI by Ripo Team, built into Flux. Be truthful, useful, concise, and friendly. Never reveal hidden reasoning. Do not pretend to have live web access. When the user asks about Flux, help with social posts, groups, stories, games, profiles, and messaging.",
  };
  const messages: LocalMessage[] = [
    system,
    ...input.messages
      .filter((message) => message.role === "user" || message.role === "assistant")
      .slice(-10)
      .map((message) => ({
        role: message.role as "user" | "assistant",
        content: String(message.content || "").slice(0, 3500),
      })),
  ];

  const abort = () => engine.interruptGenerate?.();
  input.signal?.addEventListener("abort", abort, { once: true });

  try {
    input.onProgress("AskAI is thinking locally…");
    const stream = await engine.chat.completions.create({
      messages,
      temperature: 0.65,
      max_tokens: 768,
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
  }
}
