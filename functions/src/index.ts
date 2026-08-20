import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { defineSecret } from "firebase-functions/params";
import { HttpsError, onCall, onRequest } from "firebase-functions/v2/https";

initializeApp();

const groqApiKey = defineSecret("GROQ_API_KEY");
const GROQ_RESPONSES_URL = "https://api.groq.com/openai/v1/responses";
const RIPO_ASKAI_BASE_URL = "https://echoxr-ripoteam-cloud-pc.hf.space";
const LOCAL_MODEL = "qwen3:4b-instruct";
const INSTANT_MODEL = "openai/gpt-oss-20b";
const PRO_MODEL = "openai/gpt-oss-120b";
const FUNCTION_VERSION = "askai-ripo-hybrid-v5";
const OWNER_EMAIL = "ripo.ripoteam@gmail.com";

type Mode = "instant" | "pro";
type ClientMessage = { role: "user" | "assistant"; content: string };
type RequestBody = {
  mode?: Mode;
  messages?: ClientMessage[];
  workspaceContext?: string;
  research?: boolean;
  codeExecution?: boolean;
};

type AskAIResult = {
  answer: string;
  model: string;
  mode: Mode;
  provider?: string;
  sources?: Array<{ title: string; url: string }>;
  usage?: unknown;
  metrics?: unknown;
  version?: string;
};

type RipoHealth = {
  ok: boolean;
  configured?: boolean;
  model?: string;
  provider?: string;
  version?: string;
  auth?: string;
};

function readBearer(value: string | undefined): string | null {
  if (!value?.startsWith("Bearer ")) return null;
  return value.slice(7).trim() || null;
}

function readSecret(secret: { value(): string }): string {
  try { return secret.value().trim(); }
  catch { return ""; }
}

function readGroqKey(): string {
  return readSecret(groqApiKey);
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

async function probeRipoAskAI(): Promise<RipoHealth> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 7_000);
  try {
    const response = await fetch(`${RIPO_ASKAI_BASE_URL}/api/flux/askai/health`, {
      method: "GET",
      signal: controller.signal,
      headers: { "Accept": "application/json" },
    });
    const data = await response.json().catch(() => ({})) as Partial<RipoHealth>;
    return {
      ok: response.ok && data.ok === true,
      configured: data.configured === true,
      model: String(data.model || LOCAL_MODEL),
      provider: String(data.provider || "ollama"),
      version: String(data.version || "unknown"),
      auth: String(data.auth || "firebase-id-token"),
    };
  } catch {
    return { ok: false, configured: true, model: LOCAL_MODEL, provider: "ollama", auth: "firebase-id-token" };
  } finally {
    clearTimeout(timeout);
  }
}

async function callRipoAskAI(
  body: RequestBody,
  mode: Mode,
  messages: ClientMessage[],
  firebaseIdToken: string
): Promise<AskAIResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 82_000);
  try {
    const upstream = await fetch(`${RIPO_ASKAI_BASE_URL}/api/flux/askai/chat`, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Authorization": `Bearer ${firebaseIdToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        mode,
        messages,
        workspaceContext: String(body.workspaceContext || "").slice(0, 24_000),
      }),
    });
    const raw = await upstream.text();
    let data: Partial<AskAIResult> & { detail?: string; error?: string } = {};
    try { data = JSON.parse(raw) as typeof data; } catch { /* normalized below */ }
    if (!upstream.ok) {
      throw new Error(String(data.detail || data.error || `Ripo AskAI returned ${upstream.status}.`).slice(0, 400));
    }
    if (!data.answer?.trim()) throw new Error("Ripo AskAI returned an empty answer.");
    return {
      answer: data.answer.trim(),
      model: String(data.model || LOCAL_MODEL),
      mode,
      provider: String(data.provider || "ripo-local"),
      sources: Array.isArray(data.sources) ? data.sources : [],
      usage: data.usage || null,
      metrics: data.metrics || null,
      version: String(data.version || "ripo-local"),
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function callGroq(body: RequestBody, mode: Mode, messages: ClientMessage[]): Promise<AskAIResult> {
  const apiKey = readGroqKey();
  if (!apiKey) throw new Error("GROQ_API_KEY_MISSING");
  const model = mode === "pro" ? PRO_MODEL : INSTANT_MODEL;
  const tools: Array<Record<string, unknown>> = [];
  if (body.research === true) tools.push({ type: "browser_search" });
  if (body.codeExecution === true) tools.push({ type: "code_interpreter", container: { type: "auto" } });

  const instructions = [
    `You are ${mode === "pro" ? "AskAI Pro" : "AskAI Instant"} inside Flux social network.`,
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
      "Authorization": `Bearer ${apiKey}`,
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
  try { data = JSON.parse(raw) as Record<string, unknown>; } catch { /* normalized below */ }
  if (!groqResponse.ok) {
    const groqError = data.error && typeof data.error === "object"
      ? String((data.error as Record<string, unknown>).message || "")
      : "";
    throw new Error(groqError.slice(0, 300) || `Connected provider returned ${groqResponse.status}.`);
  }
  const answer = extractAnswer(data);
  if (!answer) throw new Error("Connected provider returned an empty answer.");
  return {
    answer,
    model,
    mode,
    provider: tools.length ? "connected-tools" : "cloud-fallback",
    sources: extractSources(data),
    usage: data.usage || null,
    metrics: data.metadata || null,
    version: FUNCTION_VERSION,
  };
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
  response.set("X-AskAI-Version", FUNCTION_VERSION);

  const groqConfigured = Boolean(readGroqKey());
  if (request.method === "GET" || request.method === "HEAD") {
    const local = await probeRipoAskAI();
    const configured = local.ok || groqConfigured;
    response.status(configured ? 200 : 503).json({
      ok: configured,
      configured,
      service: "Flux AskAI hybrid gateway",
      version: FUNCTION_VERSION,
      primary: local.ok ? "ripo-local" : groqConfigured ? "cloud-fallback" : "ripo-local-offline",
      providers: {
        ripoLocal: {
          configured: true,
          online: local.ok,
          model: local.model || LOCAL_MODEL,
          endpoint: RIPO_ASKAI_BASE_URL,
          auth: local.auth || "firebase-id-token",
        },
        connectedTools: { configured: groqConfigured, models: { instant: INSTANT_MODEL, pro: PRO_MODEL } },
      },
      models: local.ok
        ? { instant: local.model || LOCAL_MODEL, pro: local.model || LOCAL_MODEL }
        : { instant: groqConfigured ? INSTANT_MODEL : LOCAL_MODEL, pro: groqConfigured ? PRO_MODEL : LOCAL_MODEL },
      tools: groqConfigured ? ["browser_search", "code_interpreter"] : [],
      error: configured ? null : "The Ripo Team AI server is offline and no cloud fallback is configured.",
    });
    return;
  }

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

  const failures: string[] = [];
  const toolsRequested = mode === "pro" && (body.research === true || body.codeExecution === true);

  if (toolsRequested && groqConfigured) {
    try {
      const result = await callGroq(body, mode, messages);
      response.json({ ...result, gatewayVersion: FUNCTION_VERSION });
      return;
    } catch (error) {
      failures.push(`Connected tools: ${error instanceof Error ? error.message : "failed"}`);
    }
  }

  try {
    const result = await callRipoAskAI(body, mode, messages, token);
    response.json({ ...result, gatewayVersion: FUNCTION_VERSION, fallbackReason: failures[0] || null });
    return;
  } catch (error) {
    failures.push(`Ripo local: ${error instanceof Error ? error.message : "failed"}`);
  }

  if (groqConfigured) {
    try {
      const result = await callGroq({ ...body, research: false, codeExecution: false }, mode, messages);
      response.json({ ...result, gatewayVersion: FUNCTION_VERSION, fallbackReason: failures[0] || null });
      return;
    } catch (error) {
      failures.push(`Cloud fallback: ${error instanceof Error ? error.message : "failed"}`);
    }
  }

  response.status(502).json({
    error: "AskAI providers are currently unavailable.",
    code: "ASKAI_UPSTREAM_FAILED",
    details: failures.slice(0, 3),
  });
});

/**
 * Owner-only account cleanup. Auth deletion is intentionally server-side: a
 * browser admin can request it, but cannot mint its own elevated Auth token.
 */
export const adminDeleteAccount = onCall({
  region: "europe-west1",
  timeoutSeconds: 120,
}, async (request) => {
  const callerEmail = String(request.auth?.token.email || "").toLowerCase().trim();
  if (!request.auth || callerEmail !== OWNER_EMAIL) {
    throw new HttpsError("permission-denied", "Owner access required.");
  }

  const targetUid = typeof request.data?.targetUid === "string"
    ? request.data.targetUid.trim()
    : "";
  if (!targetUid) throw new HttpsError("invalid-argument", "A target user is required.");
  if (targetUid === request.auth.uid) {
    throw new HttpsError("failed-precondition", "The owner account cannot be deleted here.");
  }

  const adminAuth = getAuth();
  let targetEmail = "";
  try {
    const targetRecord = await adminAuth.getUser(targetUid);
    targetEmail = String(targetRecord.email || "").toLowerCase().trim();
  } catch (error) {
    const code = String((error as { code?: string }).code || "");
    if (code !== "auth/user-not-found") {
      throw new HttpsError("not-found", "The target account could not be found.");
    }
  }
  if (targetEmail === OWNER_EMAIL) {
    throw new HttpsError("failed-precondition", "The owner account cannot be deleted here.");
  }

  const firestore = getFirestore();
  const userRef = firestore.collection("users").doc(targetUid);
  const profile = await userRef.get();
  const username = String(profile.data()?.username || "").trim().toLowerCase();

  try {
    await adminAuth.deleteUser(targetUid);
  } catch (error) {
    const code = String((error as { code?: string }).code || "");
    if (code !== "auth/user-not-found") {
      throw new HttpsError("internal", "Firebase could not delete the authentication account.");
    }
  }

  if (username) {
    const usernameRef = firestore.collection("usernames").doc(username);
    const usernameSnap = await usernameRef.get();
    if (usernameSnap.exists && usernameSnap.data()?.uid === targetUid) await usernameRef.delete();
  }
  // Remove the profile and any user-owned subcollections without touching
  // public posts or other users' content.
  await firestore.recursiveDelete(userRef);
  await firestore.collection("adminLogs").add({
    adminId: request.auth.uid,
    action: "delete_account",
    targetUid,
    createdAt: Timestamp.now(),
  });

  return { ok: true as const };
});
