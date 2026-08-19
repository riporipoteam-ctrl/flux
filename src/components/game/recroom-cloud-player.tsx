"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Camera,
  Cloud,
  Cpu,
  Gamepad2,
  HardDrive,
  Loader2,
  RefreshCw,
  Send,
  Server,
  ShieldCheck,
  TriangleAlert,
  Volume2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/auth-context";
import { StreamPlayer } from "@/components/game/stream-player";
import { RecRoomDirectStream } from "@/components/game/recroom-direct-stream";
import { createPost } from "@/services/posts";
import { tagGamePost } from "@/services/game-posts";
import {
  createRecRoomSession,
  downloadRecRoomCapture,
  getRecRoomBrokerStatus,
  getRecRoomCapture,
  getRecRoomSession,
  releaseRecRoomSession,
  releaseRecRoomSessionOnPageExit,
  requestRecRoomCapture,
  type RecRoomBrokerStatus,
  type RecRoomPlayResponse,
} from "@/services/recroom-browser";

type CapturedImage = {
  captureId: string;
  url: string;
  file: File;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const PHASES = [
  { key: "requesting", label: "Requesting private game session" },
  { key: "creating-sandbox", label: "Creating private sandbox" },
  { key: "creating-overlay", label: "Creating private game disk" },
  { key: "preparing-audio", label: "Starting game audio" },
  { key: "preparing-windows-runtime", label: "Starting compatibility runtime" },
  { key: "creating-session-media", label: "Loading your Flux identity" },
  { key: "linking-game-image", label: "Mounting Rec Room" },
  { key: "connecting-flux-account", label: "Signing in with Flux" },
  { key: "booting-windows", label: "Starting Windows runtime" },
  { key: "waiting-for-windows-agent", label: "Connecting game runtime" },
  { key: "starting-browser-stream", label: "Opening browser player" },
  { key: "starting-game-platform", label: "Starting game platform in background" },
  { key: "launching-game", label: "Launching Rec Room directly" },
  { key: "ready", label: "Connecting video, sound & controls" },
] as const;

function phaseIndex(phase: string) {
  // Older server revisions reported an internal launcher phase. Keep those
  // sessions understandable without exposing the launcher to players.
  const normalized = phase.startsWith("steam-") ? "launching-game" : phase || "requesting";
  const index = PHASES.findIndex((item) => item.key === normalized);
  return index >= 0 ? index : 0;
}

function isSteamAuthenticationError(error: string | undefined) {
  return Boolean(error && /steamapi|steam platform|official steam client|steam authentication/i.test(error));
}

export function RecRoomCloudPlayer() {
  const { user, loading: authLoading, refreshProfile } = useAuth();
  const [starting, setStarting] = useState(false);
  const [play, setPlay] = useState<RecRoomPlayResponse | null>(null);
  const [gateway, setGateway] = useState<RecRoomBrokerStatus | null>(null);
  const [gatewayLoading, setGatewayLoading] = useState(true);
  const [capturing, setCapturing] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [capture, setCapture] = useState<CapturedImage | null>(null);
  const [shareText, setShareText] = useState("Captured in Rec Room 🎮 #RecRoom #FluxGames");

  const streamUrl = play?.streamUrl || "";
  const waitingForGame = Boolean(
    play?.sessionId &&
    play?.sessionAccessToken &&
    play?.gameReady !== true &&
    play?.ok !== false &&
    play?.state !== "failed",
  );
  const provisioning = Boolean(starting || waitingForGame);
  const steamAuthenticationError = isSteamAuthenticationError(play?.error);

  const clearCapture = () => {
    setCapture((current) => {
      if (current?.url) URL.revokeObjectURL(current.url);
      return null;
    });
  };

  useEffect(() => () => {
    if (capture?.url) URL.revokeObjectURL(capture.url);
  }, [capture?.url]);

  const refreshGateway = async () => {
    setGatewayLoading(true);
    try {
      setGateway(await getRecRoomBrokerStatus());
    } catch (error) {
      setGateway({
        ok: false,
        configured: false,
        error: error instanceof Error ? error.message : "Rec Room service is unavailable.",
      });
    } finally {
      setGatewayLoading(false);
    }
  };

  useEffect(() => {
    void refreshGateway();
  }, []);

  // RipoTeamServer can use either a real KVM guest on capable infrastructure or
  // an isolated Wine sandbox on managed Linux. Flux polls one provider-neutral
  // session contract until the authenticated video/audio/control stream is ready.
  useEffect(() => {
    const sessionId = play?.sessionId;
    const accessToken = play?.sessionAccessToken;
    const pending = Boolean(
      sessionId &&
      accessToken &&
      play?.gameReady !== true &&
      play?.ok !== false &&
      play?.state !== "failed",
    );
    if (!pending) return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const startedAt = Date.now();

    const poll = async () => {
      if (cancelled || !sessionId || !accessToken) return;
      try {
        const next = await getRecRoomSession(sessionId, accessToken);
        if (cancelled) return;
        setPlay((current) => ({
          ...current,
          ...next,
          sessionAccessToken: current?.sessionAccessToken || accessToken,
        }));
        if (next.gameReady === true || next.state === "failed" || next.ok === false) return;
      } catch (error) {
        if (!cancelled && Date.now() - startedAt > 90_000) {
          setPlay((current) => ({
            ...current,
            ok: false,
            error: error instanceof Error ? error.message : "RipoTeamServer game status check failed.",
          }));
          return;
        }
      }

      if (!cancelled && Date.now() - startedAt < 1_200_000) {
        timer = setTimeout(() => void poll(), 1200);
      } else if (!cancelled) {
        setPlay((current) => ({
          ...current,
          ok: false,
          error: "The server-side Rec Room session did not become game-ready within twenty minutes.",
        }));
      }
    };

    void poll();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [play?.sessionId, play?.sessionAccessToken, play?.state, play?.ok, play?.gameReady]);

  // The browser page is the lifetime boundary for the disposable runtime. A
  // backend idle reaper is the final safety net if pagehide never reaches us.
  useEffect(() => {
    const sessionId = play?.sessionId;
    const accessToken = play?.sessionAccessToken;
    if (!sessionId || !accessToken) return;

    const release = () => releaseRecRoomSessionOnPageExit(sessionId, accessToken);
    window.addEventListener("pagehide", release);
    return () => window.removeEventListener("pagehide", release);
  }, [play?.sessionId, play?.sessionAccessToken]);

  const releaseSession = async () => {
    const sessionId = play?.sessionId;
    const accessToken = play?.sessionAccessToken;
    clearCapture();
    if (sessionId && accessToken) {
      try {
        await releaseRecRoomSession(sessionId, accessToken);
      } catch {
        // Expiration remains the safety net if teardown is interrupted.
      }
    }
    setStarting(false);
    setPlay(null);
    void refreshGateway();
  };

  const startGame = async () => {
    if (!user || starting || provisioning) return;
    setStarting(true);
    setPlay(null);
    clearCapture();
    try {
      const firebaseIdToken = await user.getIdToken(true);
      const payload = await createRecRoomSession(firebaseIdToken);
      setPlay(payload);
      void refreshGateway();
    } catch (error) {
      setPlay({
        ok: false,
        error: error instanceof Error ? error.message : "Could not create your RipoTeamServer game session.",
      });
    } finally {
      setStarting(false);
    }
  };

  const captureScreenshot = async () => {
    const sessionId = play?.sessionId;
    const accessToken = play?.sessionAccessToken;
    if (!sessionId || !accessToken || capturing) return;

    setCapturing(true);
    try {
      const begin = await requestRecRoomCapture(sessionId, accessToken);
      if (!begin.captureId) throw new Error(begin.error || begin.detail || "Could not request a Rec Room screenshot.");

      const captureId = begin.captureId;
      let ready = false;
      let contentType = begin.contentType || "image/png";
      for (let attempt = 0; attempt < 30; attempt += 1) {
        await sleep(650);
        const latest = await getRecRoomCapture(sessionId, accessToken, captureId);
        if (latest.state === "failed" || latest.ok === false) {
          throw new Error(latest.error || latest.detail || "The server runtime could not capture Rec Room.");
        }
        contentType = latest.contentType || contentType;
        if (latest.ready || latest.state === "ready") {
          ready = true;
          break;
        }
      }
      if (!ready) throw new Error("The screenshot worker did not return an image in time.");

      const blob = await downloadRecRoomCapture(sessionId, accessToken, captureId);
      contentType = blob.type || contentType || "image/png";
      const extension = contentType === "image/jpeg" ? "jpg" : "png";
      const file = new File([blob], `recroom-${Date.now()}.${extension}`, { type: contentType });
      const objectUrl = URL.createObjectURL(blob);
      setCapture((current) => {
        if (current?.url) URL.revokeObjectURL(current.url);
        return { captureId, url: objectUrl, file };
      });
      toast.success("Rec Room screenshot captured");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not capture Rec Room.");
    } finally {
      setCapturing(false);
    }
  };

  const shareCapture = async () => {
    if (!user || !capture || sharing) return;
    setSharing(true);
    try {
      const postId = await createPost({
        authorId: user.uid,
        text: shareText.trim() || "Captured in Rec Room 🎮 #RecRoom #FluxGames",
        files: [capture.file],
        type: "post",
      });
      await tagGamePost(postId, user.uid, {
        gameId: "recroom",
        gameName: "Rec Room",
        buildId: "recroom-2021-08-25",
        captureId: capture.captureId,
      });
      await refreshProfile();
      toast.success("Screenshot posted to Flux");
      clearCapture();
      setShareText("Captured in Rec Room 🎮 #RecRoom #FluxGames");
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "Could not post the screenshot to Flux.");
    } finally {
      setSharing(false);
    }
  };

  if (streamUrl && play?.gameReady === true && play?.ok !== false) {
    return (
      <StreamPlayer
        url={streamUrl}
        title="Rec Room · RipoTeamServer"
        onClose={() => void releaseSession()}
        stage={(source, markReady) => (
          <RecRoomDirectStream url={source} onReady={markReady} />
        )}
        toolbarActions={
          <>
            {play?.gameReady ? (
              <span className="hidden rounded-md bg-emerald-400/15 px-2.5 py-1 text-xs font-bold text-emerald-100 sm:inline">Rec Room ready</span>
            ) : null}
          <button
            type="button"
            disabled={capturing}
            onClick={() => void captureScreenshot()}
            className="inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs font-bold text-white/85 transition hover:bg-white/10 disabled:cursor-wait disabled:opacity-55"
            title="Capture the Rec Room game window"
          >
            {capturing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
            <span className="hidden sm:inline">{capturing ? "Capturing…" : "Capture"}</span>
          </button>
          </>
        }
        overlay={capture ? (
          <div className="flex h-full w-full items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
            <div className="w-full max-w-3xl overflow-hidden rounded-[26px] border border-white/12 bg-[#0b1018] shadow-2xl">
              <div className="flex items-center justify-between border-b border-white/10 px-4 py-3 sm:px-5">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[.14em] text-white/35">Rec Room capture</p>
                  <h2 className="text-base font-black text-white">Share this moment to Flux?</h2>
                </div>
                <button type="button" onClick={clearCapture} className="grid h-9 w-9 place-items-center rounded-full bg-white/7 text-white/70 hover:bg-white/12 hover:text-white" aria-label="Close screenshot preview">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="grid max-h-[calc(100dvh-120px)] overflow-auto lg:grid-cols-[1.35fr_.65fr]">
                <div className="bg-black p-2 sm:p-3">
                  <img src={capture.url} alt="Captured Rec Room game window" className="max-h-[68dvh] w-full rounded-xl object-contain" />
                </div>
                <div className="flex flex-col gap-4 p-4 sm:p-5">
                  <div>
                    <label htmlFor="recroom-share-caption" className="text-xs font-black text-white/70">Caption</label>
                    <textarea id="recroom-share-caption" value={shareText} onChange={(event) => setShareText(event.target.value.slice(0, 500))} rows={6} className="mt-2 w-full resize-none rounded-2xl border border-white/10 bg-white/5 p-3 text-sm leading-6 text-white outline-none placeholder:text-white/25 focus:border-white/25" placeholder="Say something about this Rec Room moment…" />
                  </div>
                  <p className="text-[11px] leading-5 text-white/38">Posting is optional. The screenshot is uploaded only after you press Post to Flux.</p>
                  <button type="button" disabled={sharing} onClick={() => void shareCapture()} className="mt-auto inline-flex h-11 items-center justify-center gap-2 rounded-full bg-white px-5 text-sm font-black text-black transition enabled:hover:scale-[1.01] disabled:cursor-wait disabled:opacity-60">
                    {sharing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    {sharing ? "Posting…" : "Post to Flux"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      />
    );
  }

  if (provisioning) {
    return <GameProvisioningScreen play={play} onCancel={() => void releaseSession()} />;
  }

  const serviceOnline = Boolean(gateway?.ok);
  const runtime = gateway?.serverRuntime || gateway?.vmRuntime;
  const runtimeSupported = Boolean(runtime?.supported);
  const runtimeGameReady = Boolean(runtime?.readyForGame || gateway?.runtimeReadyForGame);
  const runningSessions = Number(runtime?.runningSandboxes || runtime?.runningVms || gateway?.sessions || 0);
  const maxSessions = Number(runtime?.maxSandboxes || runtime?.maxVms || 0);
  const providerLabel = runtime?.provider === "wine" ? "Wine sandbox" : runtime?.provider === "kvm" ? "Windows VM" : "Server runtime";
  const runtimeDetail = gatewayLoading
    ? "Checking RipoTeamServer…"
    : runtime?.reason || runtime?.warning || "RipoTeamServer browser runtime is available.";

  return (
    <main className="min-h-dvh bg-[#05080d] text-white">
      <div className="mx-auto w-full max-w-6xl px-4 pb-16 pt-[max(1rem,env(safe-area-inset-top))] sm:px-6">
        <header className="flex items-center gap-3">
          <Link href="/games" className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-white/10 bg-white/5 hover:bg-white/10" aria-label="Back to games">
            <ArrowLeft className="h-4.5 w-4.5" />
          </Link>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-black uppercase tracking-[.16em] text-white/40">RipoTeamServer streamed game</p>
            <h1 className="truncate text-xl font-black tracking-[-.04em]">Rec Room · Aug 2021</h1>
          </div>
          <button type="button" onClick={() => void refreshGateway()} className="grid h-10 w-10 place-items-center rounded-full border border-white/10 bg-white/5 hover:bg-white/10" aria-label="Refresh backend status">
            <RefreshCw className={`h-4 w-4 ${gatewayLoading ? "animate-spin" : ""}`} />
          </button>
        </header>

        <section className="mt-6 overflow-hidden rounded-[30px] border border-white/10 bg-[#0a1019] shadow-2xl">
          <div className="relative min-h-[330px] overflow-hidden p-6 sm:p-9" style={{ background: "radial-gradient(circle at 18% 18%,rgba(34,197,94,.23),transparent 30%),radial-gradient(circle at 82% 15%,rgba(59,130,246,.22),transparent 35%),linear-gradient(135deg,#08111c,#101827 58%,#071019)" }}>
            <div className="relative z-10 max-w-3xl">
              <div className="flex flex-wrap gap-2">
                <Badge icon={Gamepad2}>Build 7225744</Badge>
                <Badge icon={Cloud}>Browser only · no download</Badge>
                <Badge icon={HardDrive}>Disposable sandbox</Badge>
                <Badge icon={Volume2}>Sound + controls</Badge>
                <Badge icon={ShieldCheck}>Flux identity</Badge>
              </div>
              <h2 className="mt-7 text-[clamp(3rem,9vw,6.5rem)] font-black leading-[.82] tracking-[-.075em]">Press Play. Flux starts the game.</h2>
              <p className="mt-6 max-w-2xl text-sm leading-6 text-white/58 sm:text-base">
                RipoTeamServer creates a private server-side game session, launches the Aug 25, 2021 Windows client through the best runtime available on the server, signs it into your Flux-backed Rec Room identity, then replaces the loading screen with the live game. Players install nothing. When you exit, the temporary sandbox is deleted while supported account and save state stay in Flux.
              </p>
            </div>
          </div>

          <div className="grid gap-4 border-t border-white/8 p-5 sm:p-7 lg:grid-cols-[1fr_auto] lg:items-center">
            <div className="grid gap-2 sm:grid-cols-2">
              <StatusCard icon={Server} title="Compatibility service" value={gatewayLoading ? "Checking…" : serviceOnline ? "Online" : "Unavailable"} detail={gateway?.error || "Flux identity + Aug 2021 compatibility service"} good={serviceOnline} />
              <StatusCard icon={Cpu} title="RipoTeamServer game runtime" value={gatewayLoading ? "Checking…" : runtimeGameReady ? `${providerLabel} ready` : runtimeSupported ? "Runtime preparing" : "Unavailable"} detail={runtimeDetail} good={runtimeGameReady} />
            </div>

            <div className="min-w-[230px]">
              {authLoading ? (
                <button disabled className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-white/10 px-6 text-sm font-black text-white/60"><Loader2 className="h-4 w-4 animate-spin" /> Checking Flux account…</button>
              ) : !user ? (
                <Link href="/login" className="flex h-12 w-full items-center justify-center rounded-full bg-white px-6 text-sm font-black text-black">Sign in to play</Link>
              ) : (
                <button type="button" disabled={starting || !serviceOnline} onClick={() => void startGame()} className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-white px-6 text-sm font-black text-black transition enabled:hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-45">
                  {starting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Gamepad2 className="h-4 w-4" />}
                  {starting ? "Starting game…" : "Play Rec Room"}
                </button>
              )}
              <p className="mt-2 text-center text-[10px] text-white/32">{maxSessions ? `${runningSessions}/${maxSessions} server slots active` : `${runningSessions} active game session(s)`}</p>
            </div>
          </div>
        </section>

        {!gatewayLoading && serviceOnline && !runtimeGameReady ? (
          <section className="mt-4 flex gap-3 rounded-[22px] border border-amber-300/15 bg-amber-300/8 p-4 text-amber-50">
            <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" />
            <div>
              <p className="text-sm font-black">RipoTeamServer game runtime is still preparing</p>
              <p className="mt-1 text-xs leading-5 text-amber-50/65">{runtimeDetail}</p>
            </div>
          </section>
        ) : null}

        {play?.error ? (
          <section className="mt-4 flex gap-3 rounded-[22px] border border-amber-300/15 bg-amber-300/8 p-4 text-amber-50">
            <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" />
            <div>
              <p className="text-sm font-black">{steamAuthenticationError ? "Steam sign-in is required by this exact Rec Room build" : "RipoTeamServer could not start Rec Room"}</p>
              <p className="mt-1 text-xs leading-5 text-amber-50/65">{steamAuthenticationError ? "The Aug 25, 2021 Windows client calls SteamAPI_Init. Steam runs hidden on the server and is never sent to the browser, but this sandbox has no remembered authenticated Steam account, so the build cannot launch fully Steam-free." : play.error}</p>
            </div>
          </section>
        ) : null}

        <section className="mt-6 grid gap-3 md:grid-cols-3">
          <InfoCard title="Instant account" text="Your signed-in Flux Firebase identity is exchanged automatically. No separate Rec Room login screen is required by the compatibility backend." />
          <InfoCard title="Persistent saves" text="Supported profile, inventory, avatar and game state live outside the disposable sandbox and are restored from the Flux-backed compatibility service." />
          <InfoCard title="Disposable session" text="The server shares one base game image and creates a lightweight isolated runtime per player. Leaving destroys temporary runtime state instead of making players download the game." />
        </section>
      </div>
    </main>
  );
}

function GameProvisioningScreen({ play, onCancel }: { play: RecRoomPlayResponse | null; onCancel: () => void }) {
  const phase = play?.phase || (play?.sessionId ? "creating-sandbox" : "requesting");
  const visiblePhase = phase.startsWith("steam-") ? "launching-game" : phase;
  const current = phaseIndex(phase);
  const progress = Math.max(4, Math.min(99, Number(play?.progress || (current + 1) * 8)));
  const headline = PHASES[current]?.label || "Preparing Rec Room";
  const provider = play?.provider?.includes("wine") ? "Wine sandbox" : play?.provider?.includes("kvm") ? "Windows VM" : "server game session";

  return (
    <main className="fixed inset-0 z-[280] overflow-hidden bg-[#04070c] text-white">
      <div className="absolute inset-0 opacity-80" style={{ background: "radial-gradient(circle at 50% 15%,rgba(59,130,246,.24),transparent 38%),radial-gradient(circle at 20% 85%,rgba(34,197,94,.15),transparent 32%),linear-gradient(180deg,#050b14,#030508)" }} />
      <div className="relative mx-auto flex min-h-dvh w-full max-w-3xl flex-col items-center justify-center px-6 py-12 text-center">
        <div className="relative grid h-24 w-24 place-items-center rounded-[30px] border border-white/10 bg-white/[.055] shadow-2xl">
          <div className="absolute inset-3 animate-pulse rounded-[22px] bg-white/[.045]" />
          <Cpu className="relative h-10 w-10 text-white" />
          <Loader2 className="absolute -bottom-2 -right-2 h-8 w-8 animate-spin rounded-full bg-[#0b1420] p-1.5 text-emerald-300" />
        </div>

        <p className="mt-8 text-[10px] font-black uppercase tracking-[.2em] text-white/35">RipoTeamServer · private {provider}</p>
        <h1 className="mt-2 text-3xl font-black tracking-[-.05em] sm:text-5xl">{headline}</h1>
        <p className="mt-4 max-w-xl text-sm leading-6 text-white/48">Keep this page open. The server is launching Rec Room for you; nothing is downloaded to your device. Your Flux account and supported saves live separately and survive when this disposable session is destroyed.</p>

        <div className="mt-8 w-full max-w-xl">
          <div className="h-2 overflow-hidden rounded-full bg-white/8">
            <div className="h-full rounded-full bg-white transition-[width] duration-700" style={{ width: `${progress}%` }} />
          </div>
          <div className="mt-2 flex justify-between text-[10px] font-black uppercase tracking-[.12em] text-white/30"><span>{visiblePhase.replaceAll("-", " ")}</span><span>{progress}%</span></div>
        </div>

        <div className="mt-8 grid w-full max-w-xl gap-2 text-left sm:grid-cols-2">
          {PHASES.filter((item) => ["requesting", "creating-sandbox", "preparing-audio", "preparing-windows-runtime", "linking-game-image", "connecting-flux-account", "starting-browser-stream", "starting-game-platform", "launching-game"].includes(item.key)).map((item) => {
            const index = phaseIndex(item.key);
            const done = index < current;
            const active = item.key === visiblePhase;
            return (
              <div key={item.key} className={`flex items-center gap-3 rounded-2xl border px-4 py-3 ${active ? "border-white/18 bg-white/8" : "border-white/7 bg-white/[.025]"}`}>
                <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-[10px] font-black ${done ? "bg-emerald-400 text-black" : active ? "bg-white text-black" : "bg-white/7 text-white/25"}`}>{done ? "✓" : "·"}</span>
                <span className={`text-xs font-bold ${done || active ? "text-white/80" : "text-white/30"}`}>{item.label}</span>
              </div>
            );
          })}
        </div>

        {play?.sessionId ? <p className="mt-5 font-mono text-[9px] text-white/20">Session {play.sessionId}</p> : null}
        <button type="button" onClick={onCancel} className="mt-7 h-10 rounded-full border border-white/10 bg-white/5 px-5 text-xs font-black text-white/55 hover:bg-white/10 hover:text-white">Cancel & destroy session</button>
      </div>
    </main>
  );
}

function Badge({ icon: Icon, children }: { icon: typeof Gamepad2; children: string }) {
  return <span className="inline-flex items-center gap-1.5 rounded-full border border-white/12 bg-black/20 px-3 py-1.5 text-[10px] font-black uppercase tracking-[.12em] text-white/75"><Icon className="h-3.5 w-3.5" /> {children}</span>;
}

function StatusCard({ icon: Icon, title, value, detail, good }: { icon: typeof Server; title: string; value: string; detail: string; good: boolean }) {
  return (
    <div className="rounded-2xl border border-white/8 bg-white/[.035] p-4">
      <div className="flex items-center gap-2"><Icon className="h-4 w-4 text-white/42" /><p className="text-[10px] font-black uppercase tracking-[.13em] text-white/40">{title}</p></div>
      <div className="mt-2 flex items-center gap-2"><span className={`h-2 w-2 rounded-full ${good ? "bg-emerald-400" : "bg-white/20"}`} /><p className="text-sm font-black">{value}</p></div>
      <p className="mt-1 line-clamp-2 text-[10px] leading-4 text-white/35">{detail}</p>
    </div>
  );
}

function InfoCard({ title, text }: { title: string; text: string }) {
  return <div className="rounded-[22px] border border-white/8 bg-white/[.025] p-5"><p className="text-sm font-black">{title}</p><p className="mt-2 text-xs leading-5 text-white/42">{text}</p></div>;
}
