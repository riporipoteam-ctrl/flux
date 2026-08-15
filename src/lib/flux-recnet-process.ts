/**
 * Process helpers for Flux RecNet / Rec Room compatibility gateway.
 *
 * May-2022 uses the standalone `recroomfluxgame` gateway by default when
 * FLUX_RECNET_URL is configured. The old local game/flux-recnet process remains
 * available as a fallback for the 2019 development build.
 */
import { spawn, execSync, type ChildProcess } from "child_process";
import fs from "fs";
import path from "path";
import http from "http";
import https from "https";

function recnetDir() {
  return path.join(process.cwd(), "game", "flux-recnet");
}

function scriptName(base: "server" | "patch-client") {
  return `${base}.${"mjs"}`;
}

export function getRecnetDir() {
  return recnetDir();
}

export function getRecnetBaseUrl() {
  return (process.env.FLUX_RECNET_URL || process.env.FLUX_RECNET || "http://127.0.0.1:2059").replace(/\/+$/, "");
}

export function recnetHealthUrl() {
  return `${getRecnetBaseUrl()}/flux/health`;
}

export function isLocalRecnetTarget() {
  try {
    const target = new URL(getRecnetBaseUrl());
    return target.hostname === "127.0.0.1" || target.hostname === "localhost" || target.hostname === "::1";
  } catch {
    return false;
  }
}

export function isRecnetUp(): Promise<boolean> {
  return new Promise((resolve) => {
    let target: URL;
    try {
      target = new URL(recnetHealthUrl());
    } catch {
      resolve(false);
      return;
    }
    const transport = target.protocol === "https:" ? https : http;
    const req = transport.get(target, { timeout: 2500 }, (res) => {
      res.resume();
      resolve(res.statusCode === 200);
    });
    req.on("error", () => resolve(false));
    req.on("timeout", () => {
      req.destroy();
      resolve(false);
    });
  });
}

export function patchClientIfNeeded() {
  // Client patching belongs to the Windows game host. Keep this legacy helper
  // only for a localhost development install that contains patch-client.mjs.
  if (!isLocalRecnetTarget()) return;
  const dir = recnetDir();
  const patch = path.join(dir, scriptName("patch-client"));
  if (!fs.existsSync(patch)) return;
  try {
    execSync(`node "${patch}"`, {
      cwd: dir,
      windowsHide: true,
      stdio: "pipe",
    });
  } catch (e) {
    console.warn("[FluxRecNet] patch-client", e);
  }
}

export function syncRecnetProfile(body: {
  uid?: string;
  username?: string;
  displayName?: string;
}) {
  // The 2022 gateway stores profile/save state in Firebase. profile.json is
  // only retained for the old local 2019 compatibility server.
  if (!isLocalRecnetTarget()) return;
  try {
    const dir = recnetDir();
    const profPath = path.join(dir, "data", "profile.json");
    const prof = fs.existsSync(profPath)
      ? JSON.parse(fs.readFileSync(profPath, "utf8"))
      : {};
    if (body.username) prof.username = String(body.username).slice(0, 32);
    if (body.displayName) prof.displayName = String(body.displayName).slice(0, 32);
    if (body.uid) {
      let h = 0;
      for (let i = 0; i < String(body.uid).length; i++)
        h = (h * 31 + String(body.uid).charCodeAt(i)) >>> 0;
      prof.playerId = 100000 + (h % 900000);
    }
    if (!prof.token) prof.token = "flux-local-token-recroom-2019";
    if (prof.level == null) prof.level = 1;
    if (prof.xp == null) prof.xp = 0;
    if (prof.tokens == null) prof.tokens = 500;
    fs.mkdirSync(path.dirname(profPath), { recursive: true });
    fs.writeFileSync(profPath, JSON.stringify(prof, null, 2));
  } catch (e) {
    console.warn("[FluxRecNet] profile sync", e);
  }
}

export function startRecnetProcess(): void {
  if (!isLocalRecnetTarget()) {
    throw new Error(`Flux Rec Room gateway is remote (${getRecnetBaseUrl()}); it must be started by its deployment/host.`);
  }

  const dir = recnetDir();
  const serverScript = scriptName("server");
  const full = path.join(dir, serverScript);
  if (!fs.existsSync(full)) {
    throw new Error(`Local Flux RecNet missing: ${full}. Configure FLUX_RECNET_URL for the 2022 gateway.`);
  }

  if (process.platform === "win32") {
    const keepAlive = path.join(dir, "keep-alive.bat");
    if (fs.existsSync(keepAlive)) {
      spawn(
        "cmd.exe",
        ["/c", "start", "FluxRecNet-SERVER", "/MIN", "cmd", "/k", `cd /d "${dir}" && keep-alive.bat`],
        { detached: true, stdio: "ignore", windowsHide: true },
      ).unref();
    } else {
      const cmdLine = `cd /d "${dir}" && title FluxRecNet SERVER && node ${serverScript}`;
      spawn("cmd.exe", ["/c", "start", "FluxRecNet-SERVER", "/MIN", "cmd", "/k", cmdLine], {
        detached: true,
        stdio: "ignore",
        windowsHide: true,
      }).unref();
    }
  } else {
    spawn("node", [full], {
      cwd: dir,
      detached: true,
      stdio: "ignore",
    }).unref();
  }
}

export async function ensureRecnetRunning(body?: {
  uid?: string;
  username?: string;
  displayName?: string;
}): Promise<{ ok: boolean; already?: boolean; remote?: boolean }> {
  if (await isRecnetUp()) return { ok: true, already: true, remote: !isLocalRecnetTarget() };

  // A website/serverless Flux deployment must never try to spawn a remote game
  // gateway. Its health status is simply reported to the caller.
  if (!isLocalRecnetTarget()) return { ok: false, remote: true };

  patchClientIfNeeded();
  if (body) syncRecnetProfile(body);
  startRecnetProcess();

  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 200));
    if (await isRecnetUp()) return { ok: true };
  }
  return { ok: await isRecnetUp() };
}

export function stopRecnetProcess() {
  if (!isLocalRecnetTarget()) return;

  const pidPath = path.join(recnetDir(), "data", "server.pid");
  try {
    if (fs.existsSync(pidPath)) {
      const pid = Number(fs.readFileSync(pidPath, "utf8").trim());
      if (pid) {
        try {
          if (process.platform === "win32") execSync(`taskkill /PID ${pid} /F`, { windowsHide: true });
          else process.kill(pid, "SIGTERM");
        } catch {
          /* ignore */
        }
      }
      try {
        fs.unlinkSync(pidPath);
      } catch {
        /* ignore */
      }
    }
  } catch {
    /* ignore */
  }

  if (process.platform === "win32") {
    try {
      execSync(
        `powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort 2059 -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }"`,
        { windowsHide: true, stdio: "ignore" },
      );
    } catch {
      /* ignore */
    }
  }
}

/** Fix Unity player prefs that cause tiny/broken UI after navigation/restart. */
function fixRecRoomDisplayPrefs() {
  if (process.platform !== "win32") return;
  const scriptPath = path.join(recnetDir(), "fix-display.ps1");
  try {
    if (!fs.existsSync(scriptPath)) {
      fs.mkdirSync(path.dirname(scriptPath), { recursive: true });
      fs.writeFileSync(
        scriptPath,
        `
$p = 'HKCU:\\Software\\Against Gravity\\Rec Room'
if (-not (Test-Path $p)) { New-Item -Path $p -Force | Out-Null }
$props = (Get-Item $p).Property
foreach ($name in $props) {
  if ($name -like 'Screenmanager Fullscreen mode*') { Set-ItemProperty $p -Name $name -Value 3 -Type DWord }
  if ($name -like 'Screenmanager Resolution Width*') { Set-ItemProperty $p -Name $name -Value 1920 -Type DWord }
  if ($name -like 'Screenmanager Resolution Height*') { Set-ItemProperty $p -Name $name -Value 1080 -Type DWord }
  if ($name -like 'Screenmanager Resolution Use Native*') { Set-ItemProperty $p -Name $name -Value 0 -Type DWord }
  if ($name -like 'Screenmanager Stereo 3D*') { Set-ItemProperty $p -Name $name -Value 0 -Type DWord }
  if ($name -like 'Screenmanager Window Position X*') { Set-ItemProperty $p -Name $name -Value 80 -Type DWord }
  if ($name -like 'Screenmanager Window Position Y*') { Set-ItemProperty $p -Name $name -Value 40 -Type DWord }
}
`,
      );
    }
    execSync(`powershell -NoProfile -ExecutionPolicy Bypass -File "${scriptPath}"`, {
      windowsHide: true,
      stdio: "ignore",
    });
  } catch (e) {
    console.warn("[FluxRecNet] display prefs", e);
  }
}

export function launchRecroomExe(
  exe: string,
  cwd: string,
  opts: { fullscreen?: boolean; uid?: string; username?: string },
): ChildProcess {
  fixRecRoomDisplayPrefs();

  const args = [
    "-screen-fullscreen",
    "0",
    "-screen-width",
    "1920",
    "-screen-height",
    "1080",
    "-force-d3d11",
  ];
  void opts.fullscreen;

  try {
    const watch = path.join(recnetDir(), "watch-display.ps1");
    if (fs.existsSync(watch)) {
      spawn("powershell", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", watch], {
        detached: true,
        stdio: "ignore",
        windowsHide: true,
      }).unref();
    }
  } catch {
    /* ignore */
  }

  const child = spawn(exe, args, {
    cwd,
    detached: true,
    stdio: "ignore",
    windowsHide: false,
    env: {
      ...process.env,
      FLUX_PLAYER_UID: opts.uid || "",
      FLUX_PLAYER_USERNAME: opts.username || "",
      FLUX_RECNET: getRecnetBaseUrl(),
      FLUX_RECNET_URL: getRecnetBaseUrl(),
      FLUX_RECROOM_BUILD: process.env.FLUX_RECROOM_BUILD || "recroom-2022-05-19",
    },
  });
  child.unref();
  return child;
}
