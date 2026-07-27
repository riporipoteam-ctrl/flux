/**
 * Process helpers for Flux RecNet.
 * Script names are built at runtime so Next/webpack does NOT try to bundle server.mjs.
 */
import { spawn, execSync, type ChildProcess } from "child_process";
import fs from "fs";
import path from "path";
import http from "http";

function recnetDir() {
  return path.join(process.cwd(), "game", "flux-recnet");
}

/** Avoid static "server.mjs" / "patch-client.mjs" so bundler won't resolve them */
function scriptName(base: "server" | "patch-client") {
  return `${base}.${"mjs"}`;
}

export function getRecnetDir() {
  return recnetDir();
}

export function recnetHealthUrl() {
  return "http://127.0.0.1:2059/flux/health";
}

export function isRecnetUp(): Promise<boolean> {
  return new Promise((resolve) => {
    const req = http.get(recnetHealthUrl(), { timeout: 1500 }, (res) => {
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
  try {
    const dir = recnetDir();
    const profPath = path.join(dir, "data", "profile.json");
    const prof = fs.existsSync(profPath)
      ? JSON.parse(fs.readFileSync(profPath, "utf8"))
      : {};
    if (body.username) prof.username = String(body.username).slice(0, 32);
    if (body.displayName)
      prof.displayName = String(body.displayName).slice(0, 32);
    if (body.uid) {
      let h = 0;
      for (let i = 0; i < String(body.uid).length; i++)
        h = (h * 31 + String(body.uid).charCodeAt(i)) >>> 0;
      prof.playerId = 100000 + (h % 900000);
    }
    if (!prof.token) prof.token = "flux-local-token-recroom-2019";
    // Every Flux website account starts with the normal level-one outfit and
    // economy; never seed a level-50 / rich-looking profile on first launch.
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
  const dir = recnetDir();
  const serverScript = scriptName("server");
  const full = path.join(dir, serverScript);
  if (!fs.existsSync(full)) {
    throw new Error(`Flux RecNet missing: ${full}`);
  }

  if (process.platform === "win32") {
    // Durable independent window with auto-restart (cmd /k + loop).
    // Avoid static "server.mjs" string so webpack does not try to bundle it.
    const keepAlive = path.join(dir, "keep-alive.bat");
    if (fs.existsSync(keepAlive)) {
      spawn(
        "cmd.exe",
        ["/c", "start", "FluxRecNet-SERVER", "/MIN", "cmd", "/k", `cd /d "${dir}" && keep-alive.bat`],
        {
          detached: true,
          stdio: "ignore",
          windowsHide: true,
        }
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
}): Promise<{ ok: boolean; already?: boolean }> {
  if (await isRecnetUp()) return { ok: true, already: true };

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
  const pidPath = path.join(recnetDir(), "data", "server.pid");
  try {
    if (fs.existsSync(pidPath)) {
      const pid = Number(fs.readFileSync(pidPath, "utf8").trim());
      if (pid) {
        try {
          if (process.platform === "win32") {
            execSync(`taskkill /PID ${pid} /F`, { windowsHide: true });
          } else {
            process.kill(pid, "SIGTERM");
          }
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
      // Kill node processes that hold 2059 via PowerShell (more reliable than for /f)
      execSync(
        `powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort 2059 -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }"`,
        { windowsHide: true, stdio: "ignore" }
      );
    } catch {
      /* ignore */
    }
  }
}

/** Fix Unity player prefs that cause tiny/broken UI after Back */
function fixRecRoomDisplayPrefs() {
  if (process.platform !== "win32") return;
  const scriptPath = path.join(recnetDir(), "fix-display.ps1");
  try {
    // Write helper once (idempotent)
    if (!fs.existsSync(scriptPath)) {
      fs.writeFileSync(
        scriptPath,
        `
$p = 'HKCU:\\Software\\Against Gravity\\Rec Room'
if (-not (Test-Path $p)) { New-Item -Path $p -Force | Out-Null }
# Unity: 0 Exclusive, 1 FS Window, 2 Maximized, 3 Windowed
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
`
      );
    }
    execSync(
      `powershell -NoProfile -ExecutionPolicy Bypass -File "${scriptPath}"`,
      { windowsHide: true, stdio: "ignore" }
    );
  } catch (e) {
    console.warn("[FluxRecNet] display prefs", e);
  }
}

export function launchRecroomExe(
  exe: string,
  cwd: string,
  opts: { fullscreen?: boolean; uid?: string; username?: string }
): ChildProcess {
  // Always normalize display prefs first — fixes "UI becomes a tiny black dot"
  fixRecRoomDisplayPrefs();

  // Do NOT use -popupwindow (borderless) — it + FullscreenWindow mode collapses UI scale.
  // True windowed: fullscreen 0, fixed size. Watcher re-applies prefs as game overwrites them.
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

  // Background: keep forcing windowed for ~20s while game boots / login UI loads
  try {
    const watch = path.join(recnetDir(), "watch-display.ps1");
    if (fs.existsSync(watch)) {
      spawn(
        "powershell",
        ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", watch],
        { detached: true, stdio: "ignore", windowsHide: true }
      ).unref();
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
      FLUX_RECNET: "http://127.0.0.1:2059",
    },
  });
  child.unref();
  return child;
}
