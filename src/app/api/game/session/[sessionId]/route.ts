import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function brokerBaseUrl() {
  return (process.env.FLUX_RECROOM_BROKER_URL || "").trim().replace(/\/+$/, "");
}

function brokerHeaders() {
  return {
    ...(process.env.FLUX_RECROOM_BROKER_KEY
      ? { "x-flux-broker-key": process.env.FLUX_RECROOM_BROKER_KEY }
      : {}),
  };
}

async function proxySession(
  method: "GET" | "DELETE",
  request: Request,
  context: { params: Promise<{ sessionId: string }> },
) {
  const broker = brokerBaseUrl();
  if (!broker) {
    return NextResponse.json(
      { ok: false, error: "Rec Room host broker is not configured." },
      { status: 503 },
    );
  }

  const { sessionId } = await context.params;
  const accessToken = new URL(request.url).searchParams.get("accessToken") || "";
  if (!sessionId || !accessToken) {
    return NextResponse.json(
      { ok: false, error: "Session ID and access token are required." },
      { status: 400 },
    );
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const url = `${broker}/api/recroom/sessions/${encodeURIComponent(sessionId)}?accessToken=${encodeURIComponent(accessToken)}`;
    const response = await fetch(url, {
      method,
      headers: brokerHeaders(),
      cache: "no-store",
      signal: controller.signal,
    });
    const payload = await response.json().catch(() => ({
      ok: false,
      error: `Rec Room broker returned HTTP ${response.status}`,
    }));
    return NextResponse.json(payload, { status: response.status });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error && error.name === "AbortError"
            ? "Rec Room broker status request timed out."
            : error instanceof Error
              ? error.message
              : "Could not reach Rec Room broker.",
      },
      { status: 503 },
    );
  } finally {
    clearTimeout(timeout);
  }
}

export async function GET(
  request: Request,
  context: { params: Promise<{ sessionId: string }> },
) {
  return proxySession("GET", request, context);
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ sessionId: string }> },
) {
  return proxySession("DELETE", request, context);
}
