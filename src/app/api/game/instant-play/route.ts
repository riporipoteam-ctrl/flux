import { NextResponse } from "next/server";
import {
  startInstantPlay,
  hostCapabilities,
  canHostOnThisMachine,
} from "@/lib/flux-instant-host";
import { isMoonlightWebRunning } from "@/lib/flux-stream";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET() {
  const caps = hostCapabilities();
  const ml = await isMoonlightWebRunning();
  return NextResponse.json({
    ...caps,
    moonlightWebRunning: ml,
    free: true,
    note:
      "Press Play on /game — starts free stack (RecNet + Moonlight Web + Sunshine + optional Cloudflare tunnel) and opens fullscreen in Flux.",
  });
}

export async function POST(req: Request) {
  // Netlify / non-Windows cannot host GPU stream
  if (!canHostOnThisMachine()) {
    return NextResponse.json(
      {
        ok: false,
        mode: "remote",
        error:
          "This server cannot host the Windows game (e.g. Netlify). On Netlify, Play uses a live free stream if someone is hosting, otherwise Flux Hangout.",
        canHost: false,
      },
      { status: 200 }
    );
  }

  let body: {
    uid?: string;
    username?: string;
    displayName?: string;
    launchGame?: boolean;
    publicTunnel?: boolean;
  } = {};
  try {
    body = await req.json();
  } catch {
    /* empty */
  }

  try {
    const result = await startInstantPlay({
      uid: body.uid,
      username: body.username,
      displayName: body.displayName,
      launchGame: body.launchGame !== false,
      publicTunnel: body.publicTunnel !== false,
    });
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        mode: "failed",
        error: e instanceof Error ? e.message : "instant-play failed",
      },
      { status: 500 }
    );
  }
}
