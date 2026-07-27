import { NextResponse } from "next/server";
import {
  getStreamStatus,
  isMoonlightWebRunning,
  startMoonlightWeb,
  startSunshine,
} from "@/lib/flux-stream";
import { ensureRecnetRunning } from "@/lib/flux-recnet-process";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const base = getStreamStatus();
  const mlUp = await isMoonlightWebRunning();
  return NextResponse.json({
    ...base,
    moonlightWebRunning: mlUp,
    ready: base.sunshineInstalled && mlUp,
    mode: "sunshine-moonlight-web",
    note:
      "Real Rec Room cannot be converted to WebGL. Flux streams the native client into the browser via Sunshine + Moonlight Web (WebRTC).",
  });
}

export async function POST(req: Request) {
  let body: { action?: string; username?: string; displayName?: string; uid?: string } =
    {};
  try {
    body = await req.json();
  } catch {
    /* empty */
  }
  const action = body.action || "start";

  if (action === "status") {
    const base = getStreamStatus();
    return NextResponse.json({
      ...base,
      moonlightWebRunning: await isMoonlightWebRunning(),
    });
  }

  if (action === "start") {
    // RecNet first (game needs it)
    await ensureRecnetRunning({
      uid: body.uid,
      username: body.username,
      displayName: body.displayName,
    });

    const sun = startSunshine();
    const ml = startMoonlightWeb();

    // wait briefly for web-server
    let mlUp = false;
    for (let i = 0; i < 15; i++) {
      mlUp = await isMoonlightWebRunning();
      if (mlUp) break;
      await new Promise((r) => setTimeout(r, 400));
    }

    return NextResponse.json({
      ok: ml.ok && (sun.ok || !sun.error?.includes("not installed")),
      sunshine: sun,
      moonlightWeb: ml,
      moonlightWebRunning: mlUp,
      moonlightWebUrl: getStreamStatus().moonlightWebUrl,
      sunshineInstalled: getStreamStatus().sunshineInstalled,
      message: !getStreamStatus().sunshineInstalled
        ? "Moonlight Web started. Install Sunshine (winget install LizardByte.Sunshine) then pair — see /game."
        : mlUp
          ? "Stream stack up. Open player, add host localhost, pair Sunshine PIN, launch Flux Rec Room."
          : "Started processes; wait a few seconds and refresh.",
    });
  }

  return NextResponse.json({ ok: false, error: "Unknown action" }, { status: 400 });
}
