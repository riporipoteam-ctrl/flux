"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Camera,
  Cloud,
  Gamepad2,
  Loader2,
  Radio,
  RefreshCw,
  Send,
  Server,
  ShieldCheck,
  TriangleAlert,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/auth-context";
import { StreamPlayer } from "@/components/game/stream-player";
import { createPost } from "@/services/posts";
import { tagGamePost } from "@/services/game-posts";
import {
  createRecRoomSession,
  downloadRecRoomCapture,
  getRecRoomBrokerStatus,
  getRecRoomCapture,
  getRecRoomSession,
  releaseRecRoomSession,
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

  // A Windows host can need several seconds to launch Unity + the streamer.
  // The browser receives only a private per-session access token and polls the
  // authenticated control plane until that host reports its HTTPS stream URL.
  useEffect(() => {
    const sessionId = play?.sessionId;
    const accessToken = play?.sessionAccessToken;
    const pending = Boolean(
      sessionId &&
      accessToken &&
      !streamUrl &&
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
        if (next.streamUrl || next.state === "failed" || next.ok === false) return;
      } catch (error) {
        if (!cancelled && Date.now() - startedAt > 45_000) {
          setPlay((current) => ({
            ...current,
            ok: false,
            error: error instanceof Error ? error.message : "Game host status check failed.",
          }));
          return;
        }
      }

      if (!cancelled && Date.now() - startedAt < 120_000) {
        timer = setTimeout(() => void poll(), 1500);
      } else if (!cancelled) {
        setPlay((current) => ({
          ...current,
          ok: false,
          error: "The Windows game host did not become ready within two minutes.",
        }));
      }
    };

    void poll();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [play?.sessionId, play?.sessionAccessToken, play?.state, play?.ok, streamUrl]);

  const releaseSession = async () => {
    const sessionId = play?.sessionId;
    const accessToken = play?.sessionAccessToken;
    clearCapture();
    if (sessionId && accessToken) {
      try {
        await releaseRecRoomSession(sessionId, accessToken);
      } catch {
        // The broker also expires abandoned sessions automatically.
      }
    }
    setPlay(null);
    void refreshGateway();
  };

  const startGame = async () => {
    if (!user) return;
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
        error: error instanceof Error ? error.message : "Could not start Rec Room.",
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
          throw new Error(latest.error || latest.detail || "The Windows game host could not capture Rec Room.");
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
        buildId: "recroom-2022-05-19",
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

  if (streamUrl && play?.ok !== false) {
    return (
      <StreamPlayer
        url={streamUrl}
        title="Rec Room · May 19, 2022"
        onClose={() => void releaseSession()}
        toolbarActions={
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
        }
        overlay={capture ? (
          <div className="flex h-full w-full items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
            <div className="w-full max-w-3xl overflow-hidden rounded-[26px] border border-white/12 bg-[#0b1018] shadow-2xl">
              <div className="flex items-center justify-between border-b border-white/10 px-4 py-3 sm:px-5">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[.14em] text-white/35">Rec Room capture</p>
                  <h2 className="text-base font-black text-white">Share this moment to Flux?</h2>
                </div>
                <button
                  type="button"
                  onClick={clearCapture}
                  className="grid h-9 w-9 place-items-center rounded-full bg-white/7 text-white/70 hover:bg-white/12 hover:text-white"
                  aria-label="Close screenshot preview"
                >
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
                    <textarea
                      id="recroom-share-caption"
                      value={shareText}
                      onChange={(event) => setShareText(event.target.value.slice(0, 500))}
                      rows={6}
                      className="mt-2 w-full resize-none rounded-2xl border border-white/10 bg-white/5 p-3 text-sm leading-6 text-white outline-none placeholder:text-white/25 focus:border-white/25"
                      placeholder="Say something about this Rec Room moment…"
                    />
                  </div>
                  <p className="text-[11px] leading-5 text-white/38">
                    Posting is optional. The screenshot is only uploaded to Firebase Storage after you press Post to Flux.
                  </p>
                  <button
                    type="button"
                    disabled={sharing}
                    onClick={() => void shareCapture()}
                    className="mt-auto inline-flex h-11 items-center justify-center gap-2 rounded-full bg-white px-5 text-sm font-black text-black transition enabled:hover:scale-[1.01] disabled:cursor-wait disabled:opacity-60"
                  >
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

  const gatewayOnline = Boolean(gateway?.ok && gateway?.configured);
  const hostState = play?.state === "starting"
    ? "Starting game…"
    : play?.hostId
      ? "Assigned"
      : `${gateway?.onlineHosts ?? 0} online`;

  return (
    <main className="min-h-dvh bg-[#05080d] text-white">
      <div className="mx-auto w-full max-w-6xl px-4 pb-16 pt-[max(1rem,env(safe-area-inset-top))] sm:px-6">
        <header className="flex items-center gap-3">
          <Link
            href="/games"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-white/10 bg-white/5 hover:bg-white/10"
            aria-label="Back to games"
          >
            <ArrowLeft className="h-4.5 w-4.5" />
          </Link>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-black uppercase tracking-[.16em] text-white/40">Flux streamed game</p>
            <h1 className="truncate text-xl font-black tracking-[-.04em]">Rec Room · May 2022</h1>
          </div>
          <button
            type="button"
            onClick={() => void refreshGateway()}
            className="grid h-10 w-10 place-items-center rounded-full border border-white/10 bg-white/5 hover:bg-white/10"
            aria-label="Refresh backend status"
          >
            <RefreshCw className={`h-4 w-4 ${gatewayLoading ? "animate-spin" : ""}`} />
          </button>
        </header>

        <section className="mt-6 overflow-hidden rounded-[30px] border border-white/10 bg-[#0a1019] shadow-2xl">
          <div
            className="relative min-h-[330px] overflow-hidden p-6 sm:p-9"
            style={{
              background:
                "radial-gradient(circle at 18% 18%,rgba(34,197,94,.23),transparent 30%),radial-gradient(circle at 82% 15%,rgba(59,130,246,.22),transparent 35%),linear-gradient(135deg,#08111c,#101827 58%,#071019)",
            }}
          >
            <div className="relative z-10 max-w-3xl">
              <div className="flex flex-wrap gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-white/12 bg-black/20 px-3 py-1.5 text-[10px] font-black uppercase tracking-[.12em] text-white/75">
                  <Gamepad2 className="h-3.5 w-3.5" /> Build 8751857
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-white/12 bg-black/20 px-3 py-1.5 text-[10px] font-black uppercase tracking-[.12em] text-white/75">
                  <Cloud className="h-3.5 w-3.5" /> Browser stream
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-white/12 bg-black/20 px-3 py-1.5 text-[10px] font-black uppercase tracking-[.12em] text-white/75">
                  <ShieldCheck className="h-3.5 w-3.5" /> Flux identity
                </span>
              </div>

              <h2 className="mt-7 text-[clamp(3rem,9vw,6.5rem)] font-black leading-[.82] tracking-[-.075em]">
                Play inside Flux.
              </h2>
              <p className="mt-6 max-w-2xl text-sm leading-6 text-white/58 sm:text-base">
                The May 19, 2022 Windows client runs on a compatible game host. Flux requests a private session, links it to your signed-in account, and streams the game back into this page.
              </p>
            </div>
          </div>

          <div className="grid gap-4 border-t border-white/8 p-5 sm:p-7 lg:grid-cols-[1fr_auto] lg:items-center">
            <div className="grid gap-2 sm:grid-cols-2">
              <StatusCard
                icon={Server}
                title="Compatibility service"
                value={gatewayLoading ? "Checking…" : gatewayOnline ? "Online" : "Unavailable"}
                detail={gateway?.error || `${gateway?.onlineHosts ?? 0} Windows host(s) online`}
                good={gatewayOnline}
              />
              <StatusCard
                icon={Radio}
                title="Game host"
                value={hostState}
                detail={play?.hostId ? `Host ${play.hostId}` : "A Windows host is allocated when you press Play."}
                good={Boolean(play?.hostId) || Boolean(gateway?.onlineHosts)}
              />
            </div>

            <div className="min-w-[230px]">
              {authLoading ? (
                <button disabled className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-white/10 px-6 text-sm font-black text-white/60">
                  <Loader2 className="h-4 w-4 animate-spin" /> Checking account…
                </button>
              ) : !user ? (
                <Link
                  href="/login"
                  className="flex h-12 w-full items-center justify-center rounded-full bg-white px-6 text-sm font-black text-black"
                >
                  Sign in to play
                </Link>
              ) : play?.state === "starting" && play.ok !== false ? (
                <button disabled className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-white/10 px-6 text-sm font-black text-white/70">
                  <Loader2 className="h-4 w-4 animate-spin" /> Starting Windows host…
                </button>
              ) : (
                <button
                  type="button"
                  disabled={starting || !gatewayOnline}
                  onClick={() => void startGame()}
                  className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-white px-6 text-sm font-black text-black transition enabled:hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-45"
                >
                  {starting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Gamepad2 className="h-4 w-4" />}
                  {starting ? "Requesting host…" : gatewayOnline ? "Play Rec Room" : "Service unavailable"}
                </button>
              )}
            </div>
          </div>
        </section>

        {play?.error ? (
          <section className="mt-4 flex gap-3 rounded-[22px] border border-amber-300/15 bg-amber-300/8 p-4 text-amber-50">
            <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" />
            <div>
              <p className="text-sm font-black">Rec Room session did not start</p>
              <p className="mt-1 text-xs leading-5 text-amber-50/65">{play.error}</p>
              {play.mode ? <p className="mt-2 text-[10px] font-black uppercase tracking-[.12em] text-amber-200/45">Mode: {play.mode}</p> : null}
            </div>
          </section>
        ) : null}

        <section className="mt-6 grid gap-3 md:grid-cols-3">
          <InfoCard title="Account" text="Uses your signed-in Flux Firebase account rather than trusting a typed player ID." />
          <InfoCard title="Saves" text="The compatibility backend stores supported profile and game state against the same Flux identity." />
          <InfoCard title="Multiplayer" text="Photon configuration is supplied by the compatibility service once the Windows client reaches room networking." />
        </section>
      </div>
    </main>
  );
}

function StatusCard({
  icon: Icon,
  title,
  value,
  detail,
  good,
}: {
  icon: typeof Server;
  title: string;
  value: string;
  detail: string;
  good: boolean;
}) {
  return (
    <div className="rounded-2xl border border-white/8 bg-white/[.035] p-4">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-white/42" />
        <p className="text-[10px] font-black uppercase tracking-[.13em] text-white/40">{title}</p>
      </div>
      <div className="mt-2 flex items-center gap-2">
        <span className={`h-2 w-2 rounded-full ${good ? "bg-emerald-400" : "bg-white/20"}`} />
        <p className="text-sm font-black">{value}</p>
      </div>
      <p className="mt-1 truncate text-[10px] text-white/35">{detail}</p>
    </div>
  );
}

function InfoCard({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-[22px] border border-white/8 bg-white/[.025] p-5">
      <p className="text-sm font-black">{title}</p>
      <p className="mt-2 text-xs leading-5 text-white/42">{text}</p>
    </div>
  );
}
