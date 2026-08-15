import { NextResponse } from "next/server";
import {
  startInstantPlay,
  hostCapabilities,
  canHostOnThisMachine,
} from "@/lib/flux-instant-host";
import { isMoonlightWebRunning } from "@/lib/flux-stream";
import { getGameInstallInfo } from "@/lib/game-paths";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function brokerBaseUrl() {
  return (process.env.FLUX_RECROOM_BROKER_URL || "").trim().replace(/\/+$/, "");
}

export async function GET() {
  const caps = hostCapabilities();
  const ml = await isMoonlightWebRunning();
  const broker = brokerBaseUrl();
  return NextResponse.json({
    ...caps,
    moonlightWebRunning: ml,
    remoteBrokerConfigured: Boolean(broker),
    build: getGameInstallInfo(),
    free: true,
    note: broker
      ? "Flux will request an authenticated Rec Room 2022 stream session from the RipoTeam host broker."
      : "No remote broker configured; a local Windows host can still serve development sessions.",
  });
}

type PlayBody = {
  firebaseIdToken?: string;
  uid?: string;
  username?: string;
  displayName?: string;
  launchGame?: boolean;
  publicTunnel?: boolean;
};

async function requestRemoteSession(body: PlayBody) {
  const broker = brokerBaseUrl();
  if (!broker) return null;
  if (!body.firebaseIdToken) {
    return NextResponse.json(
      { ok: false, mode: "remote", error: "Sign in to Flux before starting Rec Room." },
      { status: 401 },
    );
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetch(`${broker}/api/recroom/sessions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${body.firebaseIdToken}`,
        ...(process.env.FLUX_RECROOM_BROKER_KEY
          ? { "x-flux-broker-key": process.env.FLUX_RECROOM_BROKER_KEY }
          : {}),
      },
      body: JSON.stringify({
        buildId: "recroom-2022-05-19",
        username: body.username,
        displayName: body.displayName,
      }),
      cache: "no-store",
      signal: controller.signal,
    });

    const payload = await response.json().catch(() => ({
      ok: false,
      error: `Rec Room host broker returned HTTP ${response.status}`,
    }));

    return NextResponse.json(
      { ...payload, mode: payload.mode || "remote" },
      { status: response.status },
    );
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        mode: "remote",
        error:
          error instanceof Error && error.name === "AbortError"
            ? "Rec Room host broker timed out."
            : error instanceof Error
              ? error.message
              : "Could not reach the Rec Room host broker.",
      },
      { status: 503 },
    );
  } finally {
    clearTimeout(timeout);
  }
}

export async function POST(req: Request) {
  let body: PlayBody = {};
  try {
    body = await req.json();
  } catch {
    /* empty body */
  }

  const remote = await requestRemoteSession(body);
  if (remote) return remote;

  // Local developer fallback: only a Windows Node host can run/stream the
  // native Unity client. Production Flux should normally use the remote broker.
  if (!canHostOnThisMachine()) {
    return NextResponse.json(
      {
        ok: false,
        mode: "unavailable",
        error: "No Rec Room Windows stream host is configured for this Flux deployment yet.",
        canHost: false,
      },
      { status: 503 },
    );
  }

  try {
    const result = await startInstantPlay({
      uid: body.uid,
      username: body.username,
      displayName: body.displayName,
      launchGame: body.launchGame !== false,
      publicTunnel: body.publicTunnel !== false,
    });
    return NextResponse.json(result, { status: result.ok ? 200 : 503 });
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        mode: "failed",
        error: e instanceof Error ? e.message : "instant-play failed",
      },
      { status: 500 },
    );
  }
}
