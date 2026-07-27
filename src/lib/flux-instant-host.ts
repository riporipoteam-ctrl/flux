/**
 * FREE instant host stack for Flux:
 * RecNet + Moonlight Web + Sunshine + Rec Room + Cloudflare free tunnel
 * All $0 software. Your PC is the server.
 */
import fs from "fs";
import path from "path";
import http from "http";
import https from "https";
import { spawn, execSync, type ChildProcess } from "child_process";
import {
  startMoonlightWeb,
  startSunshine,
  isMoonlightWebInstalled,
  isMoonlightWebRunning,
  isSunshineInstalled,
  moonlightWebUrl,
  getStreamStatus,
} from "@/lib/flux-stream";
import {
  ensureRecnetRunning,
  launchRecroomExe,
} from "@/lib/flux-recnet-process";
import {
  getGameExePath,
  getGameRoot,
  isGameInstalled,
} from "@/lib/game-paths";

const CF_NAME = "cloudflared.exe";
const CF_URL =
  "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe";

let tunnelChild: ChildProcess | null = null;
let lastPublicUrl: string | null = null;

function streamDir() {
  return path.join(process.cwd(), "game", "flux-stream");
}

function cloudflaredPath() {
  return path.join(streamDir(), CF_NAME);
}

function downloadFile(url: string, dest: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    const lib = url.startsWith("https") ? https : http;
    const go = (u: string) => {
      lib
        .get(u, { headers: { "User-Agent": "FluxHost" } }, (res) => {
          if (
            res.statusCode &&
            res.statusCode >= 300 &&
            res.statusCode < 400 &&
            res.headers.location
          ) {
            res.resume();
            go(res.headers.location);
            return;
          }
          if (res.statusCode !== 200) {
            reject(new Error(`Download failed ${res.statusCode}`));
            return;
          }
          res.pipe(file);
          file.on("finish", () => file.close(() => resolve()));
        })
        .on("error", reject);
    };
    go(url);
  });
}

export async function ensureCloudflared(): Promise<{
  ok: boolean;
  path?: string;
  error?: string;
}> {
  const p = cloudflaredPath();
  if (fs.existsSync(p) && fs.statSync(p).size > 1_000_000) {
    return { ok: true, path: p };
  }
  try {
    if (!fs.existsSync(streamDir())) fs.mkdirSync(streamDir(), { recursive: true });
    await downloadFile(CF_URL, p);
    return { ok: true, path: p };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "cloudflared download failed",
    };
  }
}

/**
 * Start Cloudflare free quick tunnel → public https://*.trycloudflare.com
 * pointing at Moonlight Web :8080
 */
export function startCloudflareQuickTunnel(): Promise<{
  ok: boolean;
  url?: string;
  error?: string;
}> {
  return new Promise(async (resolve) => {
    if (lastPublicUrl && tunnelChild && !tunnelChild.killed) {
      resolve({ ok: true, url: lastPublicUrl });
      return;
    }

    const cf = await ensureCloudflared();
    if (!cf.ok || !cf.path) {
      resolve({ ok: false, error: cf.error || "cloudflared missing" });
      return;
    }

    // Kill old tunnel if any
    try {
      if (process.platform === "win32") {
        execSync('taskkill /IM cloudflared.exe /F', {
          windowsHide: true,
          stdio: "ignore",
        });
      }
    } catch {
      /* ignore */
    }

    let settled = false;
    const finish = (r: { ok: boolean; url?: string; error?: string }) => {
      if (settled) return;
      settled = true;
      resolve(r);
    };

    const child = spawn(
      cf.path,
      ["tunnel", "--url", "http://127.0.0.1:8080"],
      {
        cwd: streamDir(),
        windowsHide: true,
        stdio: ["ignore", "pipe", "pipe"],
      }
    );
    tunnelChild = child;

    const onData = (buf: Buffer) => {
      const text = buf.toString("utf8");
      // https://random-words.trycloudflare.com
      const m = text.match(
        /https:\/\/[a-z0-9-]+\.trycloudflare\.com/i
      );
      if (m) {
        lastPublicUrl = m[0];
        try {
          fs.writeFileSync(
            path.join(streamDir(), "last-tunnel-url.txt"),
            lastPublicUrl,
            "utf8"
          );
        } catch {
          /* ignore */
        }
        finish({ ok: true, url: lastPublicUrl });
      }
    };

    child.stdout?.on("data", onData);
    child.stderr?.on("data", onData);
    child.on("error", (e) => finish({ ok: false, error: e.message }));
    child.on("exit", (code) => {
      tunnelChild = null;
      if (!settled) {
        finish({ ok: false, error: `cloudflared exited ${code}` });
      }
    });

    // Timeout — still OK to use localhost without public URL
    setTimeout(() => {
      if (!settled) {
        finish({
          ok: true,
          url: lastPublicUrl || undefined,
          error: lastPublicUrl
            ? undefined
            : "Tunnel slow — use local URL for now",
        });
      }
    }, 25000);
  });
}

export function getLastPublicUrl(): string | null {
  if (lastPublicUrl) return lastPublicUrl;
  try {
    const p = path.join(streamDir(), "last-tunnel-url.txt");
    if (fs.existsSync(p)) {
      const u = fs.readFileSync(p, "utf8").trim();
      if (u.startsWith("http")) {
        lastPublicUrl = u;
        return u;
      }
    }
  } catch {
    /* ignore */
  }
  return null;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * One shot: everything free for in-browser play.
 */
export async function startInstantPlay(opts?: {
  uid?: string;
  username?: string;
  displayName?: string;
  launchGame?: boolean;
  publicTunnel?: boolean;
}): Promise<{
  ok: boolean;
  mode: "stream" | "local-only" | "failed";
  localUrl: string;
  publicUrl: string | null;
  gameLaunched: boolean;
  sunshineInstalled: boolean;
  moonlightReady: boolean;
  recnetOk: boolean;
  steps: string[];
  error?: string;
  tip?: string;
}> {
  const steps: string[] = [];
  const launchGame = opts?.launchGame !== false;
  const wantTunnel = opts?.publicTunnel !== false;

  // 1 RecNet
  const recnet = await ensureRecnetRunning({
    uid: opts?.uid,
    username: opts?.username,
    displayName: opts?.displayName,
  });
  steps.push(recnet.ok ? "RecNet online" : "RecNet failed");
  if (!recnet.ok) {
    return {
      ok: false,
      mode: "failed",
      localUrl: moonlightWebUrl(),
      publicUrl: null,
      gameLaunched: false,
      sunshineInstalled: isSunshineInstalled(),
      moonlightReady: false,
      recnetOk: false,
      steps,
      error: "Could not start Flux RecNet on :2059",
    };
  }

  // 2 Moonlight Web
  if (!isMoonlightWebInstalled()) {
    return {
      ok: false,
      mode: "failed",
      localUrl: moonlightWebUrl(),
      publicUrl: null,
      gameLaunched: false,
      sunshineInstalled: isSunshineInstalled(),
      moonlightReady: false,
      recnetOk: true,
      steps,
      error: "Moonlight Web missing under game/flux-stream/",
    };
  }
  const ml = startMoonlightWeb();
  steps.push(ml.ok ? "Moonlight Web started" : `Moonlight: ${ml.error}`);

  let mlReady = false;
  for (let i = 0; i < 20; i++) {
    mlReady = await isMoonlightWebRunning();
    if (mlReady) break;
    await sleep(300);
  }
  steps.push(mlReady ? "Player UI ready :8080" : "Player UI not responding");

  // 3 Sunshine
  const sun = startSunshine();
  const sunshineInstalled = isSunshineInstalled();
  steps.push(
    sunshineInstalled
      ? sun.ok
        ? "Sunshine host running"
        : `Sunshine: ${sun.error}`
      : "Sunshine NOT installed (install free: winget install LizardByte.Sunshine)"
  );

  // 4 Launch game
  let gameLaunched = false;
  if (launchGame && isGameInstalled()) {
    try {
      launchRecroomExe(getGameExePath(), getGameRoot(), {
        fullscreen: false,
        uid: opts?.uid,
        username: opts?.username,
      });
      gameLaunched = true;
      steps.push("Rec Room client launched");
    } catch (e) {
      steps.push(
        `Game launch: ${e instanceof Error ? e.message : "failed"}`
      );
    }
  } else if (launchGame) {
    steps.push("Rec Room client not found on this PC");
  }

  // 5 Free Cloudflare tunnel (public HTTPS)
  let publicUrl: string | null = getLastPublicUrl();
  if (wantTunnel) {
    const tunnel = await startCloudflareQuickTunnel();
    if (tunnel.url) {
      publicUrl = tunnel.url;
      steps.push(`Public free tunnel: ${tunnel.url}`);
    } else {
      steps.push(
        tunnel.error || "Public tunnel not ready — local play still works"
      );
    }
  }

  const localUrl = moonlightWebUrl();
  const ok = mlReady;

  return {
    ok,
    mode: ok ? (publicUrl ? "stream" : "local-only") : "failed",
    localUrl,
    publicUrl,
    gameLaunched,
    sunshineInstalled,
    moonlightReady: mlReady,
    recnetOk: true,
    steps,
    tip: !sunshineInstalled
      ? "ONE-TIME FREE: open PowerShell and run: winget install LizardByte.Sunshine — then pair PIN once at https://localhost:47990 and re-click Play."
      : "In the player: add host localhost (or use Desktop app), enter Sunshine PIN if asked, launch Flux Rec Room / Desktop. Then fullscreen feels like the game is inside Flux.",
  };
}

export function canHostOnThisMachine(): boolean {
  // Only works on Windows Node (local next dev / self-host), not Netlify
  return process.platform === "win32" && isMoonlightWebInstalled();
}

export function hostCapabilities() {
  return {
    ...getStreamStatus(),
    canHost: canHostOnThisMachine(),
    lastPublicUrl: getLastPublicUrl(),
    cloudflaredPresent: fs.existsSync(cloudflaredPath()),
    gameInstalled: isGameInstalled(),
  };
}
