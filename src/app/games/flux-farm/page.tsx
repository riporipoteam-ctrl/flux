"use client";

import Link from "next/link";
import { ArrowLeft, Leaf, LogIn } from "lucide-react";
import { FluxFarmGame } from "@/components/game/flux-farm/flux-farm-game";
import { useAuth } from "@/contexts/auth-context";

export default function FluxFarmPage() {
  const { profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="grid min-h-[100dvh] place-items-center bg-[#0d2818] text-white" aria-live="polite">
        <div className="text-center">
          <Leaf className="mx-auto h-12 w-12 animate-bounce text-[#c7f284]" />
          <p className="mt-4 font-black">Opening Flux Farm…</p>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="grid min-h-[100dvh] place-items-center bg-[radial-gradient(circle_at_top,#2f7d42,#0d2818_65%)] p-5 text-white">
        <div className="w-full max-w-md rounded-[28px] border border-white/12 bg-black/25 p-7 text-center backdrop-blur-xl">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-3xl bg-[#c7f284]/15 text-3xl" aria-hidden>
            🌻
          </div>
          <h1 className="mt-5 text-3xl font-black tracking-[-0.05em]">Flux Farm</h1>
          <p className="mt-3 text-sm leading-6 text-white/60">
            Sign in with your Flux account so your farm, rank and leaderboard position save automatically across
            every device.
          </p>
          <Link
            href="/login"
            className="mt-6 inline-flex h-12 items-center justify-center gap-2 rounded-full bg-[#c7f284] px-6 font-black text-[#0d2818]"
          >
            <LogIn className="h-4 w-4" /> Sign in to play
          </Link>
          <Link href="/games" className="mt-4 flex items-center justify-center gap-2 text-sm font-bold text-white/55">
            <ArrowLeft className="h-4 w-4" /> Back to games
          </Link>
        </div>
      </div>
    );
  }

  return <FluxFarmGame profile={profile} />;
}
