import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import {
  ensureRecnetRunning,
  getRecnetDir,
  isRecnetUp,
  stopRecnetProcess,
} from "@/lib/flux-recnet-process";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const up = await isRecnetUp();
  let pid: number | null = null;
  try {
    const pidFile = path.join(getRecnetDir(), "data", "server.pid");
    if (fs.existsSync(pidFile)) {
      pid = Number(fs.readFileSync(pidFile, "utf8").trim()) || null;
    }
  } catch {
    /* ignore */
  }
  return NextResponse.json({
    running: up,
    pid,
    url: "http://127.0.0.1:2059",
    nameServer: "http://127.0.0.1:2059/2",
    dir: getRecnetDir(),
  });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const action = body.action || "start";

  if (action === "status") {
    return GET();
  }

  if (action === "stop") {
    try {
      stopRecnetProcess();
    } catch (e) {
      return NextResponse.json({
        ok: false,
        error: e instanceof Error ? e.message : "stop failed",
      });
    }
    return NextResponse.json({ ok: true, running: false });
  }

  // start
  try {
    const result = await ensureRecnetRunning({
      uid: body.uid,
      username: body.username,
      displayName: body.displayName,
    });
    return NextResponse.json({
      ok: result.ok,
      running: result.ok,
      already: result.already ?? false,
      url: "http://127.0.0.1:2059",
      nameServer: "http://127.0.0.1:2059/2",
    });
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        running: false,
        error: e instanceof Error ? e.message : "Could not start Flux RecNet",
      },
      { status: 500 }
    );
  }
}
