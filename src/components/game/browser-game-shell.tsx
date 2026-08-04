"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Expand,
  Gamepad2,
  Heart,
  Info,
  RefreshCw,
  Smartphone,
  X,
} from "lucide-react";
import { toast } from "sonner";
import type { BrowserGame } from "@/data/browser-games";
import { assetUrl } from "@/lib/asset-url";
import { cn } from "@/lib/utils";

const FAVORITES_KEY = "flux-games-favorites";
const RECENT_KEY = "flux-games-recent";

export function BrowserGameShell({ game }: { game: BrowserGame }) {
  const shellRef = useRef<HTMLDivElement>(null);
  const [started, setStarted] = useState(false);
  const [frameKey, setFrameKey] = useState(0);
  const [favorite, setFavorite] = useState(false);
  const [controlsOpen, setControlsOpen] = useState(false);
  const [chromeVisible, setChromeVisible] = useState(true);
  const gameUrl = assetUrl(game.playUrl);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(FAVORITES_KEY) || "[]") as string[];
      setFavorite(saved.includes(game.slug));
    } catch {
      setFavorite(false);
    }
  }, [game.slug]);

  useEffect(() => {
    if (!started) return;
    const timer = window.setTimeout(() => setChromeVisible(false), 2_800);
    return () => window.clearTimeout(timer);
  }, [started, frameKey]);

  const rememberGame = () => {
    try {
      const recent = JSON.parse(localStorage.getItem(RECENT_KEY) || "[]") as string[];
      localStorage.setItem(RECENT_KEY, JSON.stringify([game.slug, ...recent.filter((slug) => slug !== game.slug)].slice(0, 8)));
    } catch {
      // Private browsing should never prevent a game from opening.
    }
  };

  const launch = async () => {
    rememberGame();
    setStarted(true);
    setChromeVisible(true);
    try {
      if (window.matchMedia("(max-width: 900px)").matches) {
        await shellRef.current?.requestFullscreen?.();
      }
    } catch {
      // iPhone Safari may not expose element fullscreen. The game still fills the viewport.
    }
  };

  const toggleFavorite = () => {
    try {
      const saved = JSON.parse(localStorage.getItem(FAVORITES_KEY) || "[]") as string[];
      const next = saved.includes(game.slug)
        ? saved.filter((slug) => slug !== game.slug)
        : [game.slug, ...saved];
      localStorage.setItem(FAVORITES_KEY, JSON.stringify(next));
      setFavorite(next.includes(game.slug));
    } catch {
      toast.error("Favorites are unavailable in this browser.");
    }
  };

  const enterFullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await shellRef.current?.requestFullscreen();
    } catch {
      toast.message("Your browser does not provide webpage fullscreen. The game is already using the full screen area.");
    }
  };

  return (
    <div
      ref={shellRef}
      className="relative h-[100dvh] w-full overflow-hidden bg-[#03050a] text-white"
      onPointerDown={() => started && setChromeVisible(true)}
    >
      {started ? (
        <>
          <iframe
            key={frameKey}
            src={gameUrl}
            title={game.title}
            className="absolute inset-0 h-full w-full border-0 bg-black"
            allow="autoplay; fullscreen; gamepad; clipboard-write"
            sandbox="allow-scripts allow-same-origin allow-pointer-lock allow-forms"
            allowFullScreen
          />
          <header className={cn("absolute inset-x-0 top-0 z-30 flex items-center gap-2 bg-gradient-to-b from-black/85 via-black/45 to-transparent px-3 pb-10 pt-[max(.65rem,env(safe-area-inset-top))] transition duration-300", chromeVisible ? "translate-y-0 opacity-100" : "pointer-events-none -translate-y-4 opacity-0")}>
            <Link href="/games" className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-white/12 bg-black/45 backdrop-blur-xl" aria-label="Back to games"><ArrowLeft className="h-5 w-5" /></Link>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-black">{game.title}</p>
              <p className="truncate text-[9px] font-black uppercase tracking-[.15em] text-white/45">Flux Original · {game.dimension} · Touch ready</p>
            </div>
            <button type="button" onClick={toggleFavorite} className="grid h-10 w-10 place-items-center rounded-full border border-white/12 bg-black/45 backdrop-blur-xl" aria-label="Favorite"><Heart className={cn("h-4.5 w-4.5", favorite && "fill-rose-400 text-rose-400")} /></button>
            <button type="button" onClick={() => setControlsOpen(true)} className="grid h-10 w-10 place-items-center rounded-full border border-white/12 bg-black/45 backdrop-blur-xl" aria-label="Controls"><Info className="h-4.5 w-4.5" /></button>
            <button type="button" onClick={() => { setFrameKey((value) => value + 1); setChromeVisible(true); }} className="hidden h-10 w-10 place-items-center rounded-full border border-white/12 bg-black/45 backdrop-blur-xl sm:grid" aria-label="Restart game"><RefreshCw className="h-4.5 w-4.5" /></button>
            <button type="button" onClick={() => void enterFullscreen()} className="grid h-10 w-10 place-items-center rounded-full border border-white/12 bg-black/45 backdrop-blur-xl" aria-label="Fullscreen"><Expand className="h-4.5 w-4.5" /></button>
          </header>
          {!chromeVisible ? <button type="button" onClick={() => setChromeVisible(true)} className="absolute left-3 top-[max(.7rem,env(safe-area-inset-top))] z-20 h-1.5 w-16 rounded-full bg-white/25" aria-label="Show game controls" /> : null}
        </>
      ) : (
        <main className="relative grid h-full place-items-center overflow-hidden px-5 py-8">
          <div className="absolute inset-0" style={{ background: `radial-gradient(circle at 70% 20%, ${game.palette[2]}66, transparent 32%), linear-gradient(145deg, ${game.palette[0]}, ${game.palette[1]})` }} />
          <div className="absolute inset-0 bg-[linear-gradient(115deg,transparent_25%,rgba(255,255,255,.07)_25.5%,transparent_26%)] bg-[length:44px_44px] opacity-40" />
          <Link href="/games" className="absolute left-4 top-[max(1rem,env(safe-area-inset-top))] z-10 grid h-11 w-11 place-items-center rounded-full border border-white/15 bg-black/30 backdrop-blur-xl" aria-label="Back to games"><ArrowLeft className="h-5 w-5" /></Link>
          <section className="relative z-10 w-full max-w-lg rounded-[32px] border border-white/15 bg-black/48 p-6 text-center shadow-[0_40px_120px_rgba(0,0,0,.5)] backdrop-blur-2xl sm:p-9">
            <span className="mx-auto grid h-24 w-24 place-items-center rounded-[30px] border border-white/12 bg-white/8 text-5xl shadow-2xl">{game.symbol}</span>
            <p className="mt-5 text-[10px] font-black uppercase tracking-[.2em] text-white/50">Flux Original · {game.dimension}</p>
            <h1 className="mt-2 text-4xl font-black tracking-[-.06em] sm:text-6xl">{game.title}</h1>
            <p className="mx-auto mt-4 max-w-md text-sm leading-6 text-white/58">{game.description}</p>
            <div className="mt-6 grid gap-2 text-left text-xs font-bold text-white/65 sm:grid-cols-2">
              <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/6 p-3"><Smartphone className="h-4 w-4 text-cyan-300" /> Mobile controls included</div>
              <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/6 p-3"><Gamepad2 className="h-4 w-4 text-violet-300" /> {game.controls}</div>
            </div>
            <button type="button" onClick={() => void launch()} className="mt-7 inline-flex h-14 w-full items-center justify-center gap-2 rounded-full bg-white px-7 text-sm font-black text-black shadow-[0_18px_50px_rgba(255,255,255,.16)] transition hover:scale-[1.01]"><Gamepad2 className="h-5 w-5" /> Play now</button>
          </section>
        </main>
      )}

      {controlsOpen ? (
        <div className="absolute inset-0 z-50 grid place-items-end bg-black/55 p-3 backdrop-blur-sm sm:place-items-center" onClick={() => setControlsOpen(false)}>
          <section className="w-full max-w-md rounded-[28px] border border-white/12 bg-[#0b1018] p-5 shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center gap-3"><div className="grid h-11 w-11 place-items-center rounded-2xl bg-white/8"><Gamepad2 className="h-5 w-5" /></div><div className="min-w-0 flex-1"><h2 className="font-black">Controls</h2><p className="text-xs text-white/40">{game.title}</p></div><button type="button" onClick={() => setControlsOpen(false)} className="grid h-10 w-10 place-items-center rounded-full bg-white/7"><X className="h-4 w-4" /></button></div>
            <p className="mt-5 rounded-2xl border border-white/8 bg-white/5 p-4 text-sm font-semibold leading-6 text-white/68">{game.controls}</p>
            <button type="button" onClick={() => { setFrameKey((value) => value + 1); setControlsOpen(false); }} className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-white text-sm font-black text-black"><RefreshCw className="h-4 w-4" /> Restart game</button>
          </section>
        </div>
      ) : null}
    </div>
  );
}
