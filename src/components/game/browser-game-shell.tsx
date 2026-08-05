"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Expand, Gamepad2, Heart, Info, RefreshCw, X } from "lucide-react";
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
    } catch { setFavorite(false); }
  }, [game.slug]);

  useEffect(() => {
    if (!started) return;
    const timer = window.setTimeout(() => setChromeVisible(false), 2_200);
    return () => window.clearTimeout(timer);
  }, [started, frameKey]);

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
    try {
      if (window.matchMedia("(max-width: 900px)").matches) await shellRef.current?.requestFullscreen?.();
    } catch { /* iPhone Safari may not expose element fullscreen */ }
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
          <iframe key={frameKey} src={gameUrl} title={game.title} className="absolute inset-0 h-full w-full border-0 bg-black" allow="autoplay; fullscreen; gamepad; clipboard-write" sandbox="allow-scripts allow-same-origin allow-pointer-lock allow-forms" allowFullScreen />
          <header className={cn("absolute inset-x-0 top-0 z-30 flex items-center gap-2 bg-gradient-to-b from-black/88 via-black/35 to-transparent px-3 pb-9 pt-[max(.55rem,env(safe-area-inset-top))] transition-opacity duration-150", chromeVisible ? "opacity-100" : "pointer-events-none opacity-0")}>
            <Link href="/games" className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-black/62" aria-label="Back to games"><ArrowLeft className="h-4.5 w-4.5" /></Link>
            <div className="min-w-0 flex-1"><p className="truncate text-sm font-black">{game.title}</p><p className="truncate text-[9px] font-black uppercase tracking-[.13em] text-white/50">Open source · hosted by Flux · {game.dimension}</p></div>
            <button type="button" onClick={toggleFavorite} className="grid h-9 w-9 place-items-center rounded-full bg-black/62" aria-label="Favorite"><Heart className={cn("h-4 w-4", favorite && "fill-rose-400 text-rose-400")} /></button>
            <button type="button" onClick={() => setControlsOpen(true)} className="grid h-9 w-9 place-items-center rounded-full bg-black/62" aria-label="Controls"><Info className="h-4 w-4" /></button>
            <button type="button" onClick={() => setFrameKey((value) => value + 1)} className="hidden h-9 w-9 place-items-center rounded-full bg-black/62 sm:grid" aria-label="Restart game"><RefreshCw className="h-4 w-4" /></button>
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
            <div className="mt-5 grid grid-cols-[1fr_auto] gap-2">
              <button type="button" onClick={() => void launch()} className="flex h-12 items-center justify-center gap-2 rounded-full bg-white text-sm font-black text-black"><Gamepad2 className="h-4.5 w-4.5" />Play</button>
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
            <button type="button" onClick={() => { setFrameKey((value) => value + 1); setControlsOpen(false); }} className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-full bg-white text-sm font-black text-black"><RefreshCw className="h-4 w-4" />Restart game</button>
          </section>
        </div>
      ) : null}
    </div>
  );
}
