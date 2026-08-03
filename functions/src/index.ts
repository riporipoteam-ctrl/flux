import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { defineSecret } from "firebase-functions/params";
import { onRequest } from "firebase-functions/v2/https";

initializeApp();

const groqApiKey = defineSecret("GROQ_API_KEY");
const GROQ_RESPONSES_URL = "https://api.groq.com/openai/v1/responses";
const INSTANT_MODEL = "openai/gpt-oss-20b";
const PRO_MODEL = "openai/gpt-oss-120b";

type Mode = "instant" | "pro";

type ClientMessage = {
  role: "user" | "assistant";
  content: string;
};

type RequestBody = {
  mode?: Mode;
  messages?: ClientMessage[];
  workspaceContext?: string;
  research?: boolean;
  codeExecution?: boolean;
};

function readBearer(value: string | undefined): string | null {
  if (!value?.startsWith("Bearer ")) return null;
  return value.slice(7).trim() || null;
}

function cleanMessages(value: unknown): ClientMessage[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object"))
    .map((item) => ({
      role: item.role === "assistant" ? "assistant" as const : "user" as const,
      content: String(item.content || "").trim().slice(0, 16_000),
    }))
    .filter((item) => item.content)
    .slice(-28);
}

function extractAnswer(data: Record<string, unknown>): string {
  if (typeof data.output_text === "string" && data.output_text.trim()) return data.output_text.trim();
  const output = Array.isArray(data.output) ? data.output : [];
  const chunks: string[] = [];
  for (const item of output) {
    if (!item || typeof item !== "object") continue;
    const content = Array.isArray((item as Record<string, unknown>).content)
      ? (item as Record<string, unknown>).content as unknown[]
      : [];
    for (const part of content) {
      if (!part || typeof part !== "object") continue;
      const text = (part as Record<string, unknown>).text;
      if (typeof text === "string" && text.trim()) chunks.push(text.trim());
    }
  }
  return chunks.join("\n\n").trim();
}

function extractSources(data: Record<string, unknown>): Array<{ title: string; url: string }> {
  const output = Array.isArray(data.output) ? data.output : [];
  const seen = new Set<string>();
  const sources: Array<{ title: string; url: string }> = [];
  for (const item of output) {
    if (!item || typeof item !== "object") continue;
    const content = Array.isArray((item as Record<string, unknown>).content)
      ? (item as Record<string, unknown>).content as unknown[]
      : [];
    for (const part of content) {
      if (!part || typeof part !== "object") continue;
      const annotations = Array.isArray((part as Record<string, unknown>).annotations)
        ? (part as Record<string, unknown>).annotations as unknown[]
        : [];
      for (const annotation of annotations) {
        if (!annotation || typeof annotation !== "object") continue;
        const record = annotation as Record<string, unknown>;
        const url = String(record.url || "").trim();
        if (!url || seen.has(url)) continue;
        seen.add(url);
        sources.push({ title: String(record.title || url).slice(0, 240), url });
      }
    }
  }
  return sources.slice(0, 12);
}

async function enforceRateLimit(uid: string, mode: Mode): Promise<void> {
  const db = getFirestore();
  const ref = db.collection("askaiRateLimits").doc(uid);
  const maxPerMinute = mode === "pro" ? 10 : 30;
  await db.runTransaction(async (transaction) => {
    const snap = await transaction.get(ref);
    const now = Date.now();
    const data = snap.data() || {};
    const windowStartedAt = data.windowStartedAt instanceof Timestamp
      ? data.windowStartedAt.toMillis()
      : Number(data.windowStartedAt || 0);
    const withinWindow = now - windowStartedAt < 60_000;
    const count = withinWindow ? Number(data.count || 0) : 0;
    if (count >= maxPerMinute) throw new Error("RATE_LIMITED");
    transaction.set(ref, {
      windowStartedAt: withinWindow ? data.windowStartedAt : Timestamp.fromMillis(now),
      count: count + 1,
      updatedAt: Timestamp.fromMillis(now),
      lastMode: mode,
    }, { merge: true });
  });
}

export const askaiGroq = onRequest({
  region: "europe-west1",
  cors: true,
  secrets: [groqApiKey],
  timeoutSeconds: 120,
  memory: "512MiB",
  maxInstances: 10,
}, async (request, response) => {
  response.set("Cache-Control", "no-store");
  if (request.method !== "POST") {
    response.status(405).json({ error: "Method not allowed" });
    return;
  }

  const token = readBearer(request.headers.authorization);
  if (!token) {
    response.status(401).json({ error: "Sign in to use AskAI." });
    return;
  }

  let uid: string;
  try {
    uid = (await getAuth().verifyIdToken(token)).uid;
  } catch {
    response.status(401).json({ error: "Your Flux session expired. Sign in again." });
    return;
  }

  const body = (request.body || {}) as RequestBody;
  const mode: Mode = body.mode === "pro" ? "pro" : "instant";
  const messages = cleanMessages(body.messages);
  if (!messages.length) {
    response.status(400).json({ error: "Add a message first." });
    return;
  }

  try {
    await enforceRateLimit(uid, mode);
  } catch (error) {
    if (error instanceof Error && error.message === "RATE_LIMITED") {
      response.status(429).json({ error: "Too many AskAI requests. Wait a minute and try again." });
      return;
    }
    response.status(500).json({ error: "Could not check AskAI limits." });
    return;
  }

  const model = mode === "pro" ? PRO_MODEL : INSTANT_MODEL;
  const research = body.research === true;
  const codeExecution = body.codeExecution === true;
  const tools: Array<Record<string, unknown>> = [];
  if (research) tools.push({ type: "browser_search" });
  if (codeExecution) tools.push({ type: "code_interpreter", container: { type: "auto" } });

  const instructions = [
    `You are ${mode === "pro" ? "AskAI 1.0 Pro" : "AskAI 1.0 Instant"} inside Flux social network.`,
    mode === "pro"
      ? "Use high reasoning effort, be thorough, and clearly separate verified facts from uncertainty."
      : "Respond quickly, naturally, and directly. Prefer concise useful answers.",
    "Never claim an action, search, upload, or message happened unless tool output or supplied context proves it.",
    "Do not reveal private hidden reasoning.",
    String(body.workspaceContext || "").slice(0, 30_000),
  ].filter(Boolean).join("\n\n");

  const groqResponse = await fetch(GROQ_RESPONSES_URL, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${groqApiKey.value()}`,
      "Content-Type": "application/json",
      "Groq-Beta": "inference-metrics",
    },
    body: JSON.stringify({
      model,
      instructions,
      input: messages,
      reasoning: { effort: mode === "pro" ? "high" : "low" },
      max_output_tokens: mode === "pro" ? 8_192 : 4_096,
      ...(tools.length ? { tools, tool_choice: "auto" } : {}),
    }),
  });

  const raw = await groqResponse.text();
  let data: Record<string, unknown> = {};
  try {
    data = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    // Keep empty data so the normalized error below is returned.
  }

  if (!groqResponse.ok) {
    const groqError = data.error && typeof data.error === "object"
      ? String((data.error as Record<string, unknown>).message || "")
      : "";
    response.status(groqResponse.status).json({
      error: groqError.slice(0, 300) || `Groq returned ${groqResponse.status}.`,
    });
    return;
  }

  const answer = extractAnswer(data);
  if (!answer) {
    response.status(502).json({ error: "Groq returned an empty answer." });
    return;
  }

  response.json({
    answer,
    model,
    mode,
    sources: extractSources(data),
    usage: data.usage || null,
    metrics: data.metadata || null,
  });
});
