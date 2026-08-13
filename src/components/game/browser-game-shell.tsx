"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Expand, Gamepad2, Heart, Info, RefreshCw, Trophy, X } from "lucide-react";
import { toast } from "sonner";
import type { BrowserGame } from "@/data/browser-games";
import { assetUrl } from "@/lib/asset-url";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/auth-context";
import {
  getGameLeaderboard,
  recordGamePlay,
  submitGameScore,
  type GameLeaderboardEntry,
  type GameLeaderboardMetric,
} from "@/services/game-leaderboards";

const FAVORITES_KEY = "flux-games-favorites";
const RECENT_KEY = "flux-games-recent";

export function BrowserGameShell({ game }: { game: BrowserGame }) {
  const { user, profile } = useAuth();
  const shellRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const reportedBestRef = useRef(0);
  const [started, setStarted] = useState(false);
  const [frameKey, setFrameKey] = useState(0);
  const [favorite, setFavorite] = useState(false);
  const [controlsOpen, setControlsOpen] = useState(false);
  const [leaderboardOpen, setLeaderboardOpen] = useState(false);
  const [leaderboardMetric, setLeaderboardMetric] = useState<GameLeaderboardMetric>("plays");
  const [leaderboard, setLeaderboard] = useState<GameLeaderboardEntry[]>([]);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);
  const [chromeVisible, setChromeVisible] = useState(true);
  const gameUrl = assetUrl(game.playUrl);

  const playerIdentity = user ? {
    gameId: game.slug,
    uid: user.uid,
    displayName: profile?.displayName || user.displayName || "Flux player",
    username: profile?.username || "player",
    avatarUrl: profile?.avatarUrl || user.photoURL || "",
  } : null;

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(FAVORITES_KEY) || "[]") as string[];
      setFavorite(saved.includes(game.slug));
    } catch { setFavorite(false); }
  }, [game.slug]);

  useEffect(() => {
    if (!started) return;
    const timer = window.setTimeout(() => setChromeVisible(false), 2_200);
    return () => window.clearTimeout(timer);
  }, [started, frameKey]);

  useEffect(() => {
    if (!leaderboardOpen) return;
    let cancelled = false;
    setLeaderboardLoading(true);
    void getGameLeaderboard(game.slug, 20, leaderboardMetric)
      .then((entries) => { if (!cancelled) setLeaderboard(entries); })
      .catch(() => { if (!cancelled) setLeaderboard([]); })
      .finally(() => { if (!cancelled) setLeaderboardLoading(false); });
    return () => { cancelled = true; };
  }, [game.slug, leaderboardMetric, leaderboardOpen]);

  useEffect(() => {
    if (!started || !playerIdentity) return;
    const onMessage = (event: MessageEvent) => {
      if (event.source !== iframeRef.current?.contentWindow) return;
      if (!event.data || typeof event.data !== "object") return;
      const data = event.data as { type?: unknown; gameId?: unknown; score?: unknown };
      if (data.type !== "flux-game-score") return;
      if (typeof data.gameId === "string" && data.gameId !== game.slug) return;
      const score = Math.max(0, Math.min(1_000_000_000, Math.floor(Number(data.score) || 0)));
      if (!Number.isFinite(score) || score <= reportedBestRef.current) return;
      reportedBestRef.current = score;
      void submitGameScore({ ...playerIdentity, score })
        .then((result) => {
          if (result.improved) toast.success(`New ${game.title} best: ${result.personalBest.toLocaleString()}`);
        })
        .catch(() => undefined);
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [game.slug, game.title, playerIdentity, started]);

  const rememberGame = () => {
    try {
      const recent = JSON.parse(localStorage.getItem(RECENT_KEY) || "[]") as string[];
      localStorage.setItem(RECENT_KEY, JSON.stringify([game.slug, ...recent.filter((slug) => slug !== game.slug)].slice(0, 8)));
    } catch { /* private browsing */ }
  };

  const launch = async () => {
    rememberGame();
    setStarted(true);
    setChromeVisible(true);
    if (playerIdentity) void recordGamePlay(playerIdentity).catch(() => undefined);
    try {
      if (window.matchMedia("(max-width: 900px)").matches) await shellRef.current?.requestFullscreen?.();
    } catch { /* iPhone Safari may not expose element fullscreen */ }
  };

  const restart = () => {
    reportedBestRef.current = 0;
    setFrameKey((value) => value + 1);
    if (playerIdentity) void recordGamePlay(playerIdentity).catch(() => undefined);
  };

  const toggleFavorite = () => {
    try {
      const saved = JSON.parse(localStorage.getItem(FAVORITES_KEY) || "[]") as string[];
      const next = saved.includes(game.slug) ? saved.filter((slug) => slug !== game.slug) : [game.slug, ...saved];
      localStorage.setItem(FAVORITES_KEY, JSON.stringify(next));
      setFavorite(next.includes(game.slug));
    } catch { toast.error("Favorites are unavailable in this browser."); }
  };

  const enterFullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await shellRef.current?.requestFullscreen();
    } catch { toast.message("The game is already using the available screen area."); }
  };

  return (
    <div ref={shellRef} className="relative h-[100dvh] w-full overflow-hidden bg-black text-white" onPointerDown={() => started && setChromeVisible(true)}>
      {started ? (
        <>
          <iframe ref={iframeRef} key={frameKey} src={gameUrl} title={game.title} className="absolute inset-0 h-full w-full border-0 bg-black" allow="autoplay; fullscreen; gamepad; clipboard-write" sandbox="allow-scripts allow-same-origin allow-pointer-lock allow-forms" allowFullScreen />
          <header className={cn("absolute inset-x-0 top-0 z-30 flex items-center gap-2 bg-gradient-to-b from-black/88 via-black/35 to-transparent px-3 pb-9 pt-[max(.55rem,env(safe-area-inset-top))] transition-opacity duration-150", chromeVisible ? "opacity-100" : "pointer-events-none opacity-0")}>
            <Link href="/games" className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-black/62" aria-label="Back to games"><ArrowLeft className="h-4.5 w-4.5" /></Link>
            <div className="min-w-0 flex-1"><p className="truncate text-sm font-black">{game.title}</p><p className="truncate text-[9px] font-black uppercase tracking-[.13em] text-white/50">Open source · hosted by Flux · {game.dimension}</p></div>
            <button type="button" onClick={toggleFavorite} className="grid h-9 w-9 place-items-center rounded-full bg-black/62" aria-label="Favorite"><Heart className={cn("h-4 w-4", favorite && "fill-rose-400 text-rose-400")} /></button>
            <button type="button" onClick={() => setLeaderboardOpen(true)} className="grid h-9 w-9 place-items-center rounded-full bg-black/62" aria-label="Leaderboard"><Trophy className="h-4 w-4" /></button>
            <button type="button" onClick={() => setControlsOpen(true)} className="grid h-9 w-9 place-items-center rounded-full bg-black/62" aria-label="Controls"><Info className="h-4 w-4" /></button>
            <button type="button" onClick={restart} className="hidden h-9 w-9 place-items-center rounded-full bg-black/62 sm:grid" aria-label="Restart game"><RefreshCw className="h-4 w-4" /></button>
            <button type="button" onClick={() => void enterFullscreen()} className="grid h-9 w-9 place-items-center rounded-full bg-black/62" aria-label="Fullscreen"><Expand className="h-4 w-4" /></button>
          </header>
          {!chromeVisible ? <button type="button" onClick={() => setChromeVisible(true)} className="absolute left-3 top-[max(.6rem,env(safe-area-inset-top))] z-20 h-1.5 w-14 rounded-full bg-white/30" aria-label="Show controls" /> : null}
        </>
      ) : (
        <main className="relative grid h-full place-items-end overflow-hidden sm:place-items-center">
          <img src={assetUrl(game.thumbnail)} alt="" className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/45 to-black/10" />
          <Link href="/games" className="absolute left-3 top-[max(.7rem,env(safe-area-inset-top))] z-10 grid h-10 w-10 place-items-center rounded-full bg-black/60" aria-label="Back to games"><ArrowLeft className="h-5 w-5" /></Link>
          <section className="relative z-10 w-full border-t border-white/14 bg-black/72 p-5 backdrop-blur-xl sm:max-w-lg sm:rounded-[24px] sm:border">
            <p className="text-[10px] font-black uppercase tracking-[.18em] text-white/48">Open source · hosted by Flux · {game.dimension}</p>
            <h1 className="mt-2 text-4xl font-black tracking-[-.055em] sm:text-5xl">{game.title}</h1>
            <p className="mt-3 text-sm leading-6 text-white/62">{game.description}</p>
            <div className="mt-4 rounded-2xl bg-white/8 p-3 text-xs font-semibold leading-5 text-white/72"><Gamepad2 className="mr-2 inline h-4 w-4" />{game.controls}</div>
            <div className="mt-5 grid grid-cols-[1fr_auto_auto] gap-2">
              <button type="button" onClick={() => void launch()} className="flex h-12 items-center justify-center gap-2 rounded-full bg-white text-sm font-black text-black"><Gamepad2 className="h-4.5 w-4.5" />Play</button>
              <button type="button" onClick={() => setLeaderboardOpen(true)} className="grid h-12 w-12 place-items-center rounded-full border border-white/18 bg-white/8" aria-label="Leaderboard"><Trophy className="h-4.5 w-4.5" /></button>
              <Link href="/games/licenses" className="grid h-12 w-12 place-items-center rounded-full border border-white/18 bg-white/8" aria-label="License information"><Info className="h-4.5 w-4.5" /></Link>
            </div>
          </section>
        </main>
      )}

      {controlsOpen ? (
        <div className="absolute inset-0 z-50 grid place-items-end bg-black/60 p-3 sm:place-items-center" onClick={() => setControlsOpen(false)}>
          <section className="w-full max-w-md rounded-[24px] border border-white/12 bg-[#0b1018] p-5" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center gap-3"><div className="min-w-0 flex-1"><h2 className="font-black">Controls</h2><p className="text-xs text-white/42">{game.title}</p></div><button type="button" onClick={() => setControlsOpen(false)} className="grid h-9 w-9 place-items-center rounded-full bg-white/8"><X className="h-4 w-4" /></button></div>
            <p className="mt-4 rounded-2xl bg-white/6 p-4 text-sm font-semibold leading-6 text-white/70">{game.controls}</p>
            <button type="button" onClick={() => { restart(); setControlsOpen(false); }} className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-full bg-white text-sm font-black text-black"><RefreshCw className="h-4 w-4" />Restart game</button>
          </section>
        </div>
      ) : null}

      {leaderboardOpen ? (
        <div className="absolute inset-0 z-[60] grid place-items-end bg-black/70 p-3 sm:place-items-center" onClick={() => setLeaderboardOpen(false)}>
          <section className="w-full max-w-md overflow-hidden rounded-[26px] border border-white/12 bg-[#0b1018]" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center gap-3 border-b border-white/10 p-5">
              <span className="grid h-10 w-10 place-items-center rounded-full bg-amber-400/14 text-amber-300"><Trophy className="h-5 w-5" /></span>
              <div className="min-w-0 flex-1"><h2 className="font-black">{game.title} leaderboard</h2><p className="text-xs text-white/42">Flux players</p></div>
              <button type="button" onClick={() => setLeaderboardOpen(false)} className="grid h-9 w-9 place-items-center rounded-full bg-white/8"><X className="h-4 w-4" /></button>
            </div>
            <div className="grid grid-cols-2 gap-1 p-2">
              <button type="button" onClick={() => setLeaderboardMetric("plays")} className={cn("rounded-xl px-3 py-2 text-xs font-black", leaderboardMetric === "plays" ? "bg-white text-black" : "bg-white/6 text-white/60")}>Most played</button>
              <button type="button" onClick={() => setLeaderboardMetric("score")} className={cn("rounded-xl px-3 py-2 text-xs font-black", leaderboardMetric === "score" ? "bg-white text-black" : "bg-white/6 text-white/60")}>High scores</button>
            </div>
            <div className="max-h-[52vh] overflow-y-auto px-3 pb-4">
              {leaderboardLoading ? <p className="py-10 text-center text-sm text-white/45">Loading leaderboard…</p> : leaderboard.length ? leaderboard.map((entry, index) => (
                <div key={entry.uid} className="flex items-center gap-3 border-b border-white/7 px-2 py-3 last:border-0">
                  <span className="w-6 text-center text-xs font-black text-white/45">#{index + 1}</span>
                  {entry.avatarUrl ? <img src={entry.avatarUrl} alt="" className="h-9 w-9 rounded-full object-cover" /> : <span className="grid h-9 w-9 place-items-center rounded-full bg-white/8 text-xs font-black">{entry.displayName.slice(0, 1).toUpperCase()}</span>}
                  <div className="min-w-0 flex-1"><p className="truncate text-sm font-black">{entry.displayName}</p><p className="truncate text-[10px] text-white/40">@{entry.username}</p></div>
                  <strong className="text-sm">{(leaderboardMetric === "score" ? entry.score : entry.plays).toLocaleString()}</strong>
                </div>
              )) : <div className="py-10 text-center"><Trophy className="mx-auto h-8 w-8 text-white/22" /><p className="mt-3 text-sm font-bold">No {leaderboardMetric === "score" ? "scores" : "plays"} yet</p><p className="mt-1 text-xs text-white/40">Play the game and be the first on the board.</p></div>}
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
