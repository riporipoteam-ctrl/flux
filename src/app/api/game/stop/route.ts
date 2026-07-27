import { NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";
import { GAME_EXE_NAME } from "@/lib/game-paths";

const execAsync = promisify(exec);

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  try {
    if (process.platform === "win32") {
      await execAsync(`taskkill /IM "${GAME_EXE_NAME}" /F`, {
        windowsHide: true,
      }).catch(() => null);
    } else {
      await execAsync(`pkill -f "${GAME_EXE_NAME}" || true`);
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        error: e instanceof Error ? e.message : "Could not stop game",
      },
      { status: 500 }
    );
  }
}
