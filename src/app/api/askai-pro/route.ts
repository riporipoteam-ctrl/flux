/**
 * AskAI 1.0 Pro proxy.
 *
 * Forwards an OpenAI-compatible chat completion to the Kimi endpoint this
 * deployment is configured for, so the key stays on the server and the browser
 * never has to hold one. Streams straight through — the client renders tokens
 * as they arrive.
 *
 * GitHub Pages strips `src/app/api` before building, so this exists only where
 * the app actually runs a server; the client falls back to a browser-configured
 * endpoint when it does not.
 */
import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";
export const revalidate = 0;

const DEFAULT_BASE = "https://api.moonshot.ai/v1/chat/completions";

function upstream(): { url: string; key: string; model: string } | null {
  const key = (process.env.KIMI_API_KEY || process.env.ASKAI_PRO_API_KEY || "").trim();
  if (!key) return null;
  const url = (process.env.KIMI_BASE_URL || process.env.ASKAI_PRO_ENDPOINT || DEFAULT_BASE).trim();
  const model = (process.env.KIMI_MODEL || "kimi-k3-max").trim();
  return { url, key, model };
}

function fail(status: number, message: string) {
  return new Response(JSON.stringify({ error: { message } }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function POST(req: NextRequest) {
  const target = upstream();
  if (!target) {
    return fail(
      503,
      "This Flux server has no Pro key configured. Open AskAI → Connect Pro and point it at your own endpoint, or set KIMI_API_KEY on the server."
    );
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return fail(400, "Expected a JSON body.");
  }

  // The client picks the model only when the server has not pinned one.
  const payload = {
    ...body,
    model: process.env.KIMI_MODEL ? target.model : body.model || target.model,
  };

  let response: Response;
  try {
    response = await fetch(target.url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${target.key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: req.signal,
    });
  } catch (error) {
    if ((error as Error)?.name === "AbortError") return new Response(null, { status: 499 });
    console.error("AskAI Pro upstream unreachable", error);
    return fail(502, "The Pro provider could not be reached from this server.");
  }

  if (!response.ok || !response.body) {
    const detail = (await response.text().catch(() => "")).slice(0, 400);
    console.error("AskAI Pro upstream error", response.status);
    return fail(response.status, detail || `The Pro provider returned ${response.status}.`);
  }

  return new Response(response.body, {
    status: 200,
    headers: {
      "Content-Type": response.headers.get("content-type") || "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
