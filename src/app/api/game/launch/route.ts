import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import {
  getGameExePath,
  getGameRoot,
  isGameInstalled,
  GAME_DISPLAY_NAME,
  GAME_ID,
} from "@/lib/game-paths";
import {
  ensureRecnetRunning,
  launchRecroomExe,
} from "@/lib/flux-recnet-process";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    if (!isGameInstalled()) {
      return NextResponse.json(
        {
          ok: false,
          error: "Rec Room client not installed under game/March 19th,2019/",
          path: getGameExePath(),
        },
        { status: 404 }
      );
    }

    let body: {
      uid?: string;
      username?: string;
      displayName?: string;
      avatarUrl?: string | null;
      fullscreen?: boolean;
    } = {};
    try {
      body = await req.json();
    } catch {
      /* empty */
    }

    // 1) Start OUR private RecNet + patch client
    const recnet = await ensureRecnetRunning({
      uid: body.uid,
      username: body.username,
      displayName: body.displayName,
    });
    if (!recnet.ok) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Could not start Flux RecNet private server on port 2059. Is Node installed?",
        },
        { status: 500 }
      );
    }

    const root = getGameRoot();
    const exe = getGameExePath();

    // bridge file
    try {
      fs.writeFileSync(
        path.join(root, "flux-player.json"),
        JSON.stringify(
          {
            flux: true,
            recnet: "http://127.0.0.1:2059",
            gameId: GAME_ID,
            gameName: GAME_DISPLAY_NAME,
            launchedAt: new Date().toISOString(),
            player: {
              uid: body.uid || null,
              username: body.username || null,
              displayName: body.displayName || null,
              avatarUrl: body.avatarUrl || null,
            },
          },
          null,
          2
        )
      );
    } catch {
      /* ignore */
    }

    const steamAppId = path.join(root, "steam_appid.txt");
    if (!fs.existsSync(steamAppId)) {
      try {
        fs.writeFileSync(steamAppId, "471710\n");
      } catch {
        /* ignore */
      }
    }

    // Default: windowed 1600x900 — avoids exclusive fullscreen "tiny dot" UI bug
    // when pressing Back. Pass fullscreen: true only if user opts in.
    const child = launchRecroomExe(exe, root, {
      fullscreen: body.fullscreen === true,
      uid: body.uid,
      username: body.username,
    });

    return NextResponse.json({
      ok: true,
      pid: child.pid ?? null,
      gameId: GAME_ID,
      name: GAME_DISPLAY_NAME,
      exe,
      windowMode: body.fullscreen === true ? "fullscreen" : "windowed-1600x900",
      recnet: {
        url: "http://127.0.0.1:2059",
        nameServer: "http://127.0.0.1:2059/2",
        running: true,
      },
      player: {
        uid: body.uid || null,
        username: body.username || null,
        displayName: body.displayName || null,
      },
    });
  } catch (e) {
    console.error("game launch", e);
    return NextResponse.json(
      {
        ok: false,
        error: e instanceof Error ? e.message : "Failed to launch",
      },
      { status: 500 }
    );
  }
}
