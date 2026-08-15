import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import {
  ensureRecnetRunning,
  getRecnetBaseUrl,
  getRecnetDir,
  isLocalRecnetTarget,
  isRecnetUp,
  stopRecnetProcess,
} from "@/lib/flux-recnet-process";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function endpointInfo() {
  const url = getRecnetBaseUrl();
  const local = isLocalRecnetTarget();
  return {
    url,
    local,
    mode: local ? "local-compat" : "remote-2022-gateway",
    // /2 is the old local 2019 name-server route; the standalone 2022 gateway
    // exposes modern compatibility endpoints directly under its base URL.
    nameServer: local ? `${url}/2` : null,
  } as const;
}

export async function GET() {
  const up = await isRecnetUp();
  const endpoint = endpointInfo();
  let pid: number | null = null;

  if (endpoint.local) {
    try {
      const pidFile = path.join(getRecnetDir(), "data", "server.pid");
      if (fs.existsSync(pidFile)) pid = Number(fs.readFileSync(pidFile, "utf8").trim()) || null;
    } catch {
      /* status should still respond if a stale pid file cannot be read */
    }
  }

  return NextResponse.json({
    running: up,
    pid,
    ...endpoint,
    dir: endpoint.local ? getRecnetDir() : null,
  });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const action = body.action || "start";

  if (action === "status") return GET();

  if (action === "stop") {
    const endpoint = endpointInfo();
    if (!endpoint.local) {
      return NextResponse.json({
        ok: false,
        running: await isRecnetUp(),
        ...endpoint,
        error: "A remote Rec Room gateway is controlled by its host/deployment, not by the Flux web server.",
      }, { status: 409 });
    }
    try {
      stopRecnetProcess();
    } catch (e) {
      return NextResponse.json({
        ok: false,
        error: e instanceof Error ? e.message : "stop failed",
      });
    }
    return NextResponse.json({ ok: true, running: false, ...endpoint });
  }

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
      remote: result.remote ?? false,
      ...endpointInfo(),
    }, { status: result.ok ? 200 : 503 });
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        running: false,
        ...endpointInfo(),
        error: e instanceof Error ? e.message : "Could not start Flux Rec Room compatibility service",
      },
      { status: 500 },
    );
  }
}
