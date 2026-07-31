"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Gamepad2, Heart, Loader2, Maximize2, Users } from "lucide-react";
import { toast } from "sonner";
import {
  cheerCommunityGame,
  getPublishedCommunityGame,
  recordCommunityGameVisit,
  type PublishedCommunityGame,
} from "@/services/studio-projects";
import { Button } from "@/components/ui/button";

export default function StudioPlayPage() {
  const [game, setGame] = useState<PublishedCommunityGame | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("id");
    if (!id) {
      setError("Game ID is missing.");
      setLoading(false);
      return;
    }
    getPublishedCommunityGame(id)
      .then((value) => {
        if (!value) throw new Error("This community game is unavailable.");
        setGame(value);
        void recordCommunityGameVisit(id);
      })
      .catch((reason) => setError(reason instanceof Error ? reason.message : "Could not load game"))
      .finally(() => setLoading(false));
  }, []);

  const cheer = async () => {
    if (!game) return;
    try {
      await cheerCommunityGame(game.id);
      setGame({ ...game, cheers: game.cheers + 1 });
      toast.success("Cheered this game");
    } catch {
      toast.error("Could not cheer right now");
    }
  };

  if (loading) return <main className="grid min-h-screen place-items-center bg-black text-white"><Loader2 className="h-7 w-7 animate-spin" /></main>;
  if (!game || error) return <main className="grid min-h-screen place-items-center bg-black p-6 text-white"><div className="text-center"><Gamepad2 className="mx-auto h-8 w-8 text-white/35" /><h1 className="mt-4 text-xl font-black">Game unavailable</h1><p className="mt-2 text-sm text-white/45">{error}</p><Link href="/games" className="mt-5 inline-flex rounded-full bg-white px-5 py-3 text-sm font-black text-black">Back to Games</Link></div></main>;

  return (
    <main className="flex h-[calc(100dvh_-_53px_-_env(safe-area-inset-top))] flex-col overflow-hidden bg-black text-white lg:h-[100dvh]">
      <header className="flex min-h-16 items-center gap-3 border-b border-white/10 bg-[#0b0c0f] px-3 sm:px-5">
        <Link href="/games" className="grid h-10 w-10 place-items-center rounded-xl hover:bg-white/8" aria-label="Back to games"><ArrowLeft className="h-5 w-5" /></Link>
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-violet-500"><Gamepad2 className="h-5 w-5" /></span>
        <div className="min-w-0 flex-1"><h1 className="truncate font-black">{game.title}</h1><p className="truncate text-[11px] text-white/40">Community game · {game.visits + 1} plays</p></div>
        {game.multiplayer ? <span className="hidden items-center gap-1.5 rounded-full bg-emerald-500/12 px-3 py-1.5 text-[10px] font-black text-emerald-300 sm:flex"><Users className="h-3.5 w-3.5" />Up to {game.maxPlayers}</span> : null}
        <Button variant="outline" onClick={() => document.querySelector("iframe")?.requestFullscreen?.()} className="h-10 rounded-xl border-white/12 bg-transparent text-white hover:bg-white/8"><Maximize2 className="h-4 w-4" /><span className="hidden sm:inline">Fullscreen</span></Button>
        <Button onClick={() => void cheer()} className="h-10 rounded-xl bg-white font-black text-black hover:bg-white/90"><Heart className="h-4 w-4" />{game.cheers}</Button>
      </header>
      <section className="relative min-h-0 flex-1 bg-black"><iframe title={game.title} srcDoc={game.code} sandbox="allow-scripts allow-pointer-lock" className="h-full w-full border-0" /></section>
    </main>
  );
}
