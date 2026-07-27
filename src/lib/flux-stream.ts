/**
 * Flux browser-stream helpers (Sunshine + Moonlight Web).
 * Real Rec Room cannot become WebGL; we stream the native client into the site.
 */
import fs from "fs";
import path from "path";
import http from "http";
import { spawn, execSync, type ChildProcess } from "child_process";

const ML_PORT = 8080;

function streamDir() {
  return path.join(process.cwd(), "game", "flux-stream");
}

export function moonlightWebExe() {
  return path.join(
    streamDir(),
    "moonlight-web",
    "package",
    "web-server.exe"
  );
}

export function moonlightWebUrl() {
  return `http://127.0.0.1:${ML_PORT}`;
}

export function isMoonlightWebInstalled() {
  return fs.existsSync(moonlightWebExe());
}

function findSunshine(): string | null {
  const candidates = [
    path.join(process.env["ProgramFiles"] || "C:\\Program Files", "Sunshine", "sunshine.exe"),
    path.join(
      process.env["LOCALAPPDATA"] || "",
      "Programs",
      "Sunshine",
      "sunshine.exe"
    ),
  ];
  for (const c of candidates) {
    if (c && fs.existsSync(c)) return c;
  }
  return null;
}

export function isSunshineInstalled() {
  return !!findSunshine();
}

function httpOk(url: string, timeoutMs = 1500): Promise<boolean> {
  return new Promise((resolve) => {
    const req = http.get(url, { timeout: timeoutMs }, (res) => {
      res.resume();
      resolve((res.statusCode || 0) >= 200 && (res.statusCode || 0) < 500);
    });
    req.on("error", () => resolve(false));
    req.on("timeout", () => {
      req.destroy();
      resolve(false);
    });
  });
}

export function isMoonlightWebRunning() {
  return httpOk(moonlightWebUrl());
}

export function isSunshineUiUp() {
  // Sunshine web UI is usually HTTPS on 47990 — may fail cert check in http.get
  // Check process list instead on Windows
  try {
    const out = execSync('tasklist /FI "IMAGENAME eq sunshine.exe" /NH', {
      windowsHide: true,
      encoding: "utf8",
    });
    return /sunshine\.exe/i.test(out);
  } catch {
    return false;
  }
}

let mlChild: ChildProcess | null = null;

export function startMoonlightWeb(): { ok: boolean; error?: string } {
  if (!isMoonlightWebInstalled()) {
    return {
      ok: false,
      error: "Moonlight Web not found under game/flux-stream/moonlight-web/",
    };
  }
  try {
    const already = execSync('tasklist /FI "IMAGENAME eq web-server.exe" /NH', {
      windowsHide: true,
      encoding: "utf8",
    });
    if (/web-server\.exe/i.test(already)) {
      return { ok: true };
    }
  } catch {
    /* ignore */
  }

  const exe = moonlightWebExe();
  const cwd = path.dirname(exe);
  try {
    mlChild = spawn(exe, [], {
      cwd,
      detached: true,
      stdio: "ignore",
      windowsHide: true,
    });
    mlChild.unref();
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Failed to start Moonlight Web",
    };
  }
}

export function startSunshine(): { ok: boolean; error?: string } {
  const exe = findSunshine();
  if (!exe) {
    return {
      ok: false,
      error:
        "Sunshine not installed. Run game/flux-stream/setup-sunshine.ps1 or: winget install LizardByte.Sunshine",
    };
  }
  if (isSunshineUiUp()) return { ok: true };
  try {
    const child = spawn(exe, [], {
      detached: true,
      stdio: "ignore",
      windowsHide: true,
    });
    child.unref();
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Failed to start Sunshine",
    };
  }
}

export function getStreamStatus() {
  return {
    moonlightWebInstalled: isMoonlightWebInstalled(),
    moonlightWebRunning: false as boolean, // filled async by route
    moonlightWebUrl: moonlightWebUrl(),
    sunshineInstalled: isSunshineInstalled(),
    sunshineRunning: isSunshineUiUp(),
    sunshineUiUrl: "https://localhost:47990",
    research: "game/flux-stream/RESEARCH.md",
  };
}
