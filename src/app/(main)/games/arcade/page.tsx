"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Gamepad2 } from "lucide-react";
import { FluxArcadePlayer } from "@/components/game/flux-arcade-player";
import { getFluxArcadeGame } from "@/data/flux-arcade-games";

export default function FluxArcadePage() {
  return (
    <Suspense fallback={<div className="grid min-h-[100dvh] place-items-center bg-[#05070b] text-sm font-black text-white/45">Preparing Flux Arcade…</div>}>
      <ArcadeRoute />
    </Suspense>
  );
}

function ArcadeRoute() {
  const searchParams = useSearchParams();
  const game = getFluxArcadeGame(searchParams.get("game"));
  if (!game) {
    return (
      <main className="grid min-h-[100dvh] place-items-center bg-[#05070b] p-6 text-center text-white">
        <div className="max-w-md">
          <span className="mx-auto grid h-20 w-20 place-items-center rounded-[28px] bg-white/8"><Gamepad2 className="h-8 w-8 text-white/45" /></span>
          <h1 className="mt-5 text-3xl font-black tracking-tight">Arcade game not found</h1>
          <p className="mt-2 text-sm leading-6 text-white/42">This game link is missing or no longer exists.</p>
          <Link href="/games" className="mt-6 inline-flex h-12 items-center rounded-full bg-white px-6 text-sm font-black text-black">Back to Games</Link>
        </div>
      </main>
    );
  }
  return <FluxArcadePlayer game={game} />;
}
