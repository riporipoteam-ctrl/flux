"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Cloud,
  Gamepad2,
  Loader2,
  Radio,
  RefreshCw,
  Server,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { StreamPlayer } from "@/components/game/stream-player";

interface PlayResponse {
  ok?: boolean;
  mode?: string;
  state?: string;
  error?: string;
  sessionId?: string;
  sessionAccessToken?: string;
  streamUrl?: string;
  publicUrl?: string;
  localUrl?: string;
  expiresAtMs?: number;
  hostId?: string;
  steps?: string[];
}

interface GatewayStatus {
  running?: boolean;
  mode?: string;
  url?: string;
  remote?: boolean;
}

export function RecRoomCloudPlayer() {
  const { user, profile, loading: authLoading } = useAuth();
  const [starting, setStarting] = useState(false);
  const [play, setPlay] = useState<PlayResponse | null>(null);
  const [gateway, setGateway] = useState<GatewayStatus | null>(null);
  const [gatewayLoading, setGatewayLoading] = useState(true);

  const streamUrl = useMemo(
    () => play?.streamUrl || play?.publicUrl || play?.localUrl || "",
    [play],
  );

  const refreshGateway = async () => {
    setGatewayLoading(true);
    try {
      const response = await fetch("/api/game/recnet", { cache: "no-store" });
      setGateway((await response.json()) as GatewayStatus);
    } catch {
      setGateway({ running: false });
    } finally {
      setGatewayLoading(false);
    }
  };

  useEffect(() => {
    void refreshGateway();
  }, []);

  // Remote Windows hosts can need several seconds to launch Unity + streamer.
  // The broker returns a private session token immediately, then this page polls
  // the server-side proxy until the host reports its HTTPS stream URL.
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
        const response = await fetch(
          `/api/game/session/${encodeURIComponent(sessionId)}?accessToken=${encodeURIComponent(accessToken)}`,
          { cache: "no-store" },
        );
        const next = (await response.json()) as PlayResponse;
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
    if (sessionId && accessToken) {
      try {
        await fetch(
          `/api/game/session/${encodeURIComponent(sessionId)}?accessToken=${encodeURIComponent(accessToken)}`,
          { method: "DELETE", keepalive: true },
        );
      } catch {
        /* the broker will also expire abandoned sessions */
      }
    }
    setPlay(null);
  };

  const startGame = async () => {
    if (!user) return;
    setStarting(true);
    setPlay(null);
    try {
      const firebaseIdToken = await user.getIdToken();
      const response = await fetch("/api/game/instant-play", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          firebaseIdToken,
          username: profile?.username || undefined,
          displayName: profile?.displayName || user.displayName || undefined,
          launchGame: true,
          publicTunnel: true,
        }),
      });
      const payload = (await response.json()) as PlayResponse;
      setPlay(payload);
    } catch (error) {
      setPlay({
        ok: false,
        error: error instanceof Error ? error.message : "Could not start Rec Room.",
      });
    } finally {
      setStarting(false);
    }
  };

  if (streamUrl && play?.ok !== false) {
    return (
      <StreamPlayer
        url={streamUrl}
        title="Rec Room · May 19, 2022"
        onClose={() => void releaseSession()}
      />
    );
  }

  const hostState = play?.state === "starting"
    ? "Starting game…"
    : play?.hostId
      ? "Assigned"
      : "On demand";

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
                title="Compatibility gateway"
                value={gatewayLoading ? "Checking…" : gateway?.running ? "Online" : "Unavailable"}
                detail={gateway?.url || "Waiting for backend configuration"}
                good={Boolean(gateway?.running)}
              />
              <StatusCard
                icon={Radio}
                title="Game host"
                value={hostState}
                detail={play?.hostId ? `Host ${play.hostId}` : "A Windows host is allocated when you press Play."}
                good={Boolean(play?.hostId)}
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
                  disabled={starting}
                  onClick={() => void startGame()}
                  className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-white px-6 text-sm font-black text-black transition enabled:hover:scale-[1.02] disabled:cursor-wait disabled:opacity-60"
                >
                  {starting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Gamepad2 className="h-4 w-4" />}
                  {starting ? "Requesting host…" : "Play Rec Room"}
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
