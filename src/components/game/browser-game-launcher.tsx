"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, Gamepad2 } from "lucide-react";
import { getBrowserGame } from "@/data/browser-games";
import { BrowserGameShell } from "@/components/game/browser-game-shell";

export function BrowserGameLauncher() {
  const searchParams = useSearchParams();
  const game = getBrowserGame(searchParams.get("game"));

  if (!game || game.internal) {
    return (
      <main className="grid min-h-dvh place-items-center bg-[#06080d] px-5 text-white">
        <div className="w-full max-w-md rounded-[30px] border border-white/10 bg-white/5 p-8 text-center shadow-2xl">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-3xl bg-white/8"><Gamepad2 className="h-7 w-7 text-white/60" /></div>
          <h1 className="mt-5 text-2xl font-black tracking-[-0.04em]">Game not found</h1>
          <p className="mt-2 text-sm leading-6 text-white/50">This Flux game link is missing or no longer available.</p>
          <Link href="/games" className="mt-6 inline-flex h-11 items-center gap-2 rounded-full bg-white px-5 text-sm font-black text-black"><ArrowLeft className="h-4 w-4" /> Back to games</Link>
        </div>
      </main>
    );
  }

  return <BrowserGameShell game={game} />;
}
