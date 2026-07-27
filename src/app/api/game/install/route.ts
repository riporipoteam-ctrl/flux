import { NextResponse } from "next/server";
import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import { isGameInstalled, getGameExePath } from "@/lib/game-paths";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function findInstaller(): { kind: string; path: string } | null {
  const home = process.env.USERPROFILE || process.env.HOME || "";
  const cwd = process.cwd();
  const candidates: { kind: string; path: string }[] = [
    { kind: "ps1", path: path.join(cwd, "game", "Install-Flux2019-Full.ps1") },
    { kind: "bat", path: path.join(cwd, "game", "INSTALL-2019.bat") },
    { kind: "bat", path: path.join(cwd, "game", "dist-installer", "INSTALL.bat") },
    { kind: "exe", path: path.join(home, "Desktop", "FluxRec-Setup.exe") },
    { kind: "bat", path: path.join(home, "Desktop", "FluxRec-Setup.bat") },
    {
      kind: "bat",
      path: path.join(cwd, "public", "downloads", "Install-Flux-PC.bat"),
    },
  ];
  for (const c of candidates) {
    if (fs.existsSync(c.path)) return c;
  }
  return null;
}

/** GET: status for install UI */
export async function GET() {
  const installer = findInstaller();
  return NextResponse.json({
    platform: process.platform,
    localPc: process.platform === "win32",
    gameInstalled: isGameInstalled(),
    gameExe: getGameExePath(),
    installer: installer
      ? { kind: installer.kind, name: path.basename(installer.path) }
      : null,
    downloads: {
      setupBat: "/downloads/Install-Flux-PC.bat",
      setupDesktop: "/downloads/FluxRec-Setup.bat",
      ipa: "/downloads/Flux.ipa",
      sideloadlyGuide: "/downloads/SIDELOADLY-IOS.txt",
    },
  });
}

/**
 * POST: start PC installer (Windows + local Next only).
 * Spawns GUI installer; does not wait for completion.
 */
export async function POST() {
  if (process.platform !== "win32") {
    return NextResponse.json(
      {
        ok: false,
        error:
          "PC install only runs on Windows. On this host, download FluxRec-Setup or use Sideloadly IPA on iPhone.",
        downloads: {
          ipa: "/downloads/Flux.ipa",
          setup: "/downloads/FluxRec-Setup.bat",
        },
      },
      { status: 400 }
    );
  }

  if (isGameInstalled()) {
    return NextResponse.json({
      ok: true,
      alreadyInstalled: true,
      message: "Game already present — use Play to launch.",
      path: getGameExePath(),
    });
  }

  const installer = findInstaller();
  if (!installer) {
    return NextResponse.json(
      {
        ok: false,
        error: "No installer found. Place FluxRec-Setup.exe on Desktop or keep game pack in project.",
      },
      { status: 404 }
    );
  }

  try {
    if (installer.kind === "ps1") {
      spawn(
        "powershell.exe",
        [
          "-NoProfile",
          "-ExecutionPolicy",
          "Bypass",
          "-File",
          installer.path,
        ],
        { detached: true, stdio: "ignore", windowsHide: false }
      ).unref();
    } else if (installer.kind === "exe") {
      spawn(installer.path, [], {
        detached: true,
        stdio: "ignore",
        windowsHide: false,
      }).unref();
    } else {
      spawn("cmd.exe", ["/c", "start", "", installer.path], {
        detached: true,
        stdio: "ignore",
        windowsHide: true,
      }).unref();
    }

    return NextResponse.json({
      ok: true,
      started: true,
      installer: path.basename(installer.path),
      message: "Installer launched on this PC. Follow the window that opened.",
    });
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        error: e instanceof Error ? e.message : "Failed to start installer",
      },
      { status: 500 }
    );
  }
}
