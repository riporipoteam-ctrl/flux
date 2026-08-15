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

function inputs(request: Request) {
  const url = new URL(request.url);
  return {
    accessToken: url.searchParams.get("accessToken") || "",
    captureId: url.searchParams.get("captureId") || "",
    image: url.searchParams.get("image") === "1",
  };
}

async function proxyJson(url: string, method: "GET" | "POST") {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);
  try {
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
            ? "Rec Room screenshot request timed out."
            : error instanceof Error
              ? error.message
              : "Could not reach Rec Room screenshot service.",
      },
      { status: 503 },
    );
  } finally {
    clearTimeout(timeout);
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ sessionId: string }> },
) {
  const broker = brokerBaseUrl();
  if (!broker) return NextResponse.json({ ok: false, error: "Rec Room host broker is not configured." }, { status: 503 });

  const { sessionId } = await context.params;
  const { accessToken } = inputs(request);
  if (!sessionId || !accessToken) {
    return NextResponse.json({ ok: false, error: "Session ID and access token are required." }, { status: 400 });
  }

  return proxyJson(
    `${broker}/api/recroom/sessions/${encodeURIComponent(sessionId)}/captures?accessToken=${encodeURIComponent(accessToken)}`,
    "POST",
  );
}

export async function GET(
  request: Request,
  context: { params: Promise<{ sessionId: string }> },
) {
  const broker = brokerBaseUrl();
  if (!broker) return NextResponse.json({ ok: false, error: "Rec Room host broker is not configured." }, { status: 503 });

  const { sessionId } = await context.params;
  const { accessToken, captureId, image } = inputs(request);
  if (!sessionId || !accessToken || !captureId) {
    return NextResponse.json({ ok: false, error: "Session ID, access token and capture ID are required." }, { status: 400 });
  }

  const suffix = image ? "/image" : "";
  const url = `${broker}/api/recroom/sessions/${encodeURIComponent(sessionId)}/captures/${encodeURIComponent(captureId)}${suffix}?accessToken=${encodeURIComponent(accessToken)}`;
  if (!image) return proxyJson(url, "GET");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetch(url, {
      method: "GET",
      headers: brokerHeaders(),
      cache: "no-store",
      signal: controller.signal,
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({ ok: false, error: `Rec Room screenshot returned HTTP ${response.status}` }));
      return NextResponse.json(payload, { status: response.status });
    }
    const body = await response.arrayBuffer();
    return new NextResponse(body, {
      status: 200,
      headers: {
        "content-type": response.headers.get("content-type") || "image/png",
        "cache-control": "private, no-store",
        "content-disposition": "inline; filename=flux-recroom-capture.png",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Could not fetch Rec Room screenshot." },
      { status: 503 },
    );
  } finally {
    clearTimeout(timeout);
  }
}
