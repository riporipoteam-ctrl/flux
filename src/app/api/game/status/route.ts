import { NextResponse } from "next/server";
import { execSync } from "child_process";
import { getGameInstallInfo, GAME_EXE_NAME } from "@/lib/game-paths";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isProcessRunning(exeName: string): boolean {
  try {
    if (process.platform === "win32") {
      const out = execSync(
        `tasklist /FI "IMAGENAME eq ${exeName}" /NH`,
        { encoding: "utf8", windowsHide: true }
      );
      return out.toLowerCase().includes(exeName.toLowerCase());
    }
    const out = execSync(`pgrep -f "${exeName}" || true`, {
      encoding: "utf8",
    });
    return out.trim().length > 0;
  } catch {
    return false;
  }
}

export async function GET() {
  const info = getGameInstallInfo();
  const running = info.installed ? isProcessRunning(GAME_EXE_NAME) : false;
  return NextResponse.json({
    ...info,
    running,
    platform: process.platform,
    ready: info.installed,
  });
}
