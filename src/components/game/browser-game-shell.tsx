"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ExternalLink, Expand, Gamepad2, Heart, RefreshCw, Share2, ShieldCheck, Smartphone } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import type { BrowserGame } from "@/data/browser-games";
import { GameCoverArt } from "@/components/game/game-cover-art";
import { assetUrl } from "@/lib/asset-url";

const FAVORITES_KEY = "flux-games-favorites";
const RECENT_KEY = "flux-games-recent";

export function BrowserGameShell({ game }: { game: BrowserGame }) {
  const shellRef = useRef<HTMLDivElement>(null);
  const [started, setStarted] = useState(false);
  const [frameKey, setFrameKey] = useState(0);
  const [favorite, setFavorite] = useState(false);
  const localGameUrl = assetUrl(game.playUrl);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(FAVORITES_KEY) || "[]") as string[];
      setFavorite(saved.includes(game.slug));
    } catch {
      setFavorite(false);
    }
  }, [game.slug]);

  const rememberGame = () => {
    try {
      const recent = JSON.parse(localStorage.getItem(RECENT_KEY) || "[]") as string[];
      localStorage.setItem(RECENT_KEY, JSON.stringify([game.slug, ...recent.filter((slug) => slug !== game.slug)].slice(0, 6)));
    } catch {
      // The game still launches when browser storage is blocked.
    }
  };

  const launch = () => {
    rememberGame();
    setStarted(true);
  };

  const toggleFavorite = () => {
    try {
      const saved = JSON.parse(localStorage.getItem(FAVORITES_KEY) || "[]") as string[];
      const next = saved.includes(game.slug) ? saved.filter((slug) => slug !== game.slug) : [game.slug, ...saved];
      localStorage.setItem(FAVORITES_KEY, JSON.stringify(next));
      setFavorite(next.includes(game.slug));
      window.dispatchEvent(new Event("flux-games-updated"));
    } catch {
      toast.error("Favorites are unavailable in this browser.");
    }
  };

  const share = async () => {
    try {
      if (navigator.share) await navigator.share({ title: `${game.title} on Flux`, text: game.shortDescription, url: window.location.href });
      else {
        await navigator.clipboard.writeText(window.location.href);
        toast.success("Flux game link copied.");
      }
    } catch (error) {
      if ((error as Error).name !== "AbortError") toast.error("Could not share this game.");
    }
  };

  const enterFullscreen = async () => {
    try {
      await shellRef.current?.requestFullscreen();
    } catch {
      toast.error("Fullscreen is unavailable in this browser.");
    }
  };

  return (
    <div ref={shellRef} className="relative min-h-dvh overflow-hidden bg-[#05070c] text-white">
      <header className="relative z-30 flex min-h-16 items-center gap-2 border-b border-white/10 bg-black/55 px-3 backdrop-blur-2xl sm:px-5">
        <Link href="/games" className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-white/10 bg-white/5 transition hover:bg-white/10" aria-label="Back to games"><ArrowLeft className="h-5 w-5" /></Link>
        <div className="min-w-0 flex-1"><p className="truncate text-sm font-black">{game.title}</p><p className="truncate text-[10px] font-bold uppercase tracking-[0.14em] text-white/45">Hosted on Flux · {game.license}</p></div>
        <button type="button" onClick={toggleFavorite} className="grid h-10 w-10 place-items-center rounded-full border border-white/10 bg-white/5 transition hover:bg-white/10" aria-label={favorite ? "Remove favorite" : "Add favorite"}><Heart className={`h-4.5 w-4.5 ${favorite ? "fill-rose-400 text-rose-400" : ""}`} /></button>
        <button type="button" onClick={share} className="grid h-10 w-10 place-items-center rounded-full border border-white/10 bg-white/5 transition hover:bg-white/10" aria-label="Share game"><Share2 className="h-4.5 w-4.5" /></button>
        {started ? <><button type="button" onClick={() => setFrameKey((value) => value + 1)} className="hidden h-10 items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 text-xs font-black transition hover:bg-white/10 sm:flex"><RefreshCw className="h-4 w-4" /> Reload</button><button type="button" onClick={enterFullscreen} className="grid h-10 w-10 place-items-center rounded-full border border-white/10 bg-white/5 transition hover:bg-white/10" aria-label="Fullscreen"><Expand className="h-4.5 w-4.5" /></button></> : null}
      </header>

      {started ? (
        <div className="relative h-[calc(100dvh-4rem)] bg-black">
          <iframe key={frameKey} src={localGameUrl} title={game.title} className="h-full w-full border-0 bg-black" allow="autoplay; fullscreen; gamepad; clipboard-write" sandbox="allow-scripts allow-same-origin allow-forms allow-pointer-lock allow-popups allow-modals allow-downloads" allowFullScreen />
        </div>
      ) : (
        <main className="relative grid min-h-[calc(100dvh-4rem)] place-items-center overflow-hidden px-4 py-8 sm:px-8">
          <GameCoverArt game={game} />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(0,0,0,.08),rgba(0,0,0,.72)_72%)]" />
          <motion.section initial={{ opacity: 0, y: 22, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.48, ease: "easeOut" }} className="relative z-10 w-full max-w-xl rounded-[30px] border border-white/15 bg-black/58 p-6 shadow-[0_40px_120px_rgba(0,0,0,.55)] backdrop-blur-2xl sm:rounded-[38px] sm:p-9">
            <div className="flex flex-wrap gap-2">{game.categories.slice(0, 3).map((category) => <span key={category} className="rounded-full border border-white/12 bg-white/8 px-3 py-1 text-[9px] font-black uppercase tracking-[0.15em] text-white/70">{category}</span>)}</div>
            <h1 className="mt-5 text-4xl font-black tracking-[-0.06em] sm:text-6xl">{game.title}</h1>
            <p className="mt-4 text-sm leading-6 text-white/65 sm:text-base sm:leading-7">{game.description}</p>
            <div className="mt-6 grid gap-2 text-xs font-bold text-white/65 sm:grid-cols-2">
              <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 p-3"><Smartphone className="h-4 w-4 text-cyan-300" /> {game.devices.join(" · ")}</div>
              <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 p-3"><Gamepad2 className="h-4 w-4 text-violet-300" /> {game.controls}</div>
              <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 p-3 sm:col-span-2"><ShieldCheck className="h-4 w-4 text-emerald-300" /> Stored and served by Flux · no redirect · no VPS</div>
            </div>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <button type="button" onClick={launch} className="inline-flex h-13 flex-1 items-center justify-center gap-2 rounded-full bg-white px-6 text-sm font-black text-black shadow-[0_18px_45px_rgba(255,255,255,.16)] transition hover:-translate-y-0.5"><Gamepad2 className="h-5 w-5" /> Play inside Flux</button>
              <a href={game.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex h-13 items-center justify-center gap-2 rounded-full border border-white/15 bg-white/7 px-6 text-sm font-black transition hover:bg-white/12">Open-source credits <ExternalLink className="h-4 w-4" /></a>
            </div>
          </motion.section>
        </main>
      )}
    </div>
  );
}
