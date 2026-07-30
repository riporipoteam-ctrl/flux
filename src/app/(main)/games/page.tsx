"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowRight,
  CloudRain,
  Gamepad2,
  MoonStar,
  Save,
  Sparkles,
  Sun,
  Trophy,
  Users,
  Wheat,
  Wind,
} from "lucide-react";

const FEATURES = [
  { icon: Wheat, label: "Farming & crops" },
  { icon: Sun, label: "Day and night" },
  { icon: CloudRain, label: "Dynamic weather" },
  { icon: Users, label: "Hire farmers" },
  { icon: Trophy, label: "Flux leaderboard" },
  { icon: Save, label: "Cloud saving" },
];

export default function GamesPage() {
  return (
    <div className="min-h-screen pb-10">
      <header className="sticky top-0 z-30 hidden border-b border-border/70 px-5 py-3 glass-strong lg:block">
        <h1 className="text-xl font-black tracking-[-0.04em]">Games</h1>
        <p className="text-xs text-muted-foreground">Original games built for Flux accounts.</p>
      </header>

      <div className="px-3 pt-3 sm:px-5 sm:pt-5">
        <section className="relative overflow-hidden rounded-[30px] border border-emerald-100/10 bg-[#10251a] shadow-[0_30px_90px_rgba(7,25,13,.34)] sm:rounded-[38px]">
          <FarmArtwork />
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(10,26,16,.98)_0%,rgba(10,26,16,.88)_44%,rgba(10,26,16,.1)_82%)]" />
          <div className="relative flex min-h-[430px] max-w-2xl flex-col justify-end p-6 sm:min-h-[500px] sm:p-10">
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
              <div className="mb-4 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-emerald-200"><Sparkles className="h-4 w-4" /> First official Flux game</div>
              <h2 className="text-5xl font-black leading-[0.92] tracking-[-0.065em] text-white sm:text-7xl">Flux <span className="text-emerald-300">Farm</span></h2>
              <p className="mt-5 max-w-lg text-sm leading-6 text-white/65 sm:text-base">Restore an abandoned valley, grow crops, survive changing weather, hire farmers, expand your land and climb the real Flux rankings.</p>
              <div className="mt-7 flex flex-wrap gap-3">
                <Link href="/games/flux-farm" className="inline-flex h-13 items-center gap-2 rounded-full bg-gradient-to-r from-emerald-300 to-lime-300 px-7 text-sm font-black text-emerald-950 shadow-[0_16px_40px_rgba(74,222,128,.26)] transition hover:-translate-y-0.5"><Gamepad2 className="h-5 w-5" /> Play now <ArrowRight className="h-4 w-4" /></Link>
                <span className="inline-flex h-13 items-center gap-2 rounded-full border border-white/15 bg-white/8 px-5 text-xs font-black text-white/75 backdrop-blur-xl"><span className="h-2 w-2 animate-pulse rounded-full bg-emerald-300" /> Browser · mobile · PC</span>
              </div>
            </motion.div>
          </div>
        </section>

        <section className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {FEATURES.map(({ icon: Icon, label }) => (
            <div key={label} className="flex min-h-24 flex-col justify-between rounded-[22px] border border-border/70 bg-card/80 p-4 shadow-soft backdrop-blur-xl">
              <Icon className="h-5 w-5 text-emerald-500" />
              <p className="mt-4 text-xs font-black">{label}</p>
            </div>
          ))}
        </section>

        <section className="mt-9">
          <div className="flex items-end justify-between gap-4">
            <div><h2 className="text-2xl font-black tracking-[-0.04em]">Flux originals</h2><p className="mt-1 text-sm text-muted-foreground">Real playable games — not a world-builder shell.</p></div>
            <span className="rounded-full border border-border bg-card px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-muted-foreground">More games later</span>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <Link href="/games/flux-farm" className="group overflow-hidden rounded-[28px] border border-border/70 bg-card shadow-soft transition hover:-translate-y-1 hover:border-emerald-400/35 hover:shadow-[0_22px_60px_rgba(34,197,94,.14)]">
              <div className="relative aspect-[16/10] overflow-hidden bg-[#335f39]"><FarmArtwork compact /><div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/5 to-transparent" /><span className="absolute left-3 top-3 rounded-full border border-white/15 bg-black/35 px-2.5 py-1 text-[9px] font-black uppercase tracking-wider text-white backdrop-blur-lg">Official</span><span className="absolute bottom-3 right-3 grid h-11 w-11 place-items-center rounded-full bg-white text-emerald-950 shadow-xl transition group-hover:scale-110"><ArrowRight className="h-5 w-5" /></span></div>
              <div className="p-5"><div className="flex items-start justify-between gap-3"><div><h3 className="text-xl font-black">Flux Farm</h3><p className="mt-1 text-xs font-semibold text-muted-foreground">By Ripo Team</p></div><span className="rounded-full bg-emerald-500/12 px-2.5 py-1 text-[10px] font-black text-emerald-600">PLAYABLE</span></div><p className="mt-4 line-clamp-2 text-sm leading-6 text-muted-foreground">A story-driven 2D farming adventure with events, weather, progression, workers and online rankings.</p><div className="mt-4 flex flex-wrap gap-2 text-[10px] font-bold text-muted-foreground"><span className="rounded-full bg-muted px-2 py-1">Farming</span><span className="rounded-full bg-muted px-2 py-1">Story</span><span className="rounded-full bg-muted px-2 py-1">Simulation</span></div></div>
            </Link>

            <div className="grid min-h-[320px] place-items-center rounded-[28px] border border-dashed border-border bg-card/45 p-8 text-center"><div><div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-muted"><MoonStar className="h-6 w-6 text-muted-foreground" /></div><h3 className="mt-4 font-black">Next Flux original</h3><p className="mt-2 max-w-xs text-sm leading-6 text-muted-foreground">The games shelf is ready. Flux Farm comes first, then new full games can be added here.</p></div></div>
          </div>
        </section>
      </div>
    </div>
  );
}

function FarmArtwork({ compact = false }: { compact?: boolean }) {
  return (
    <div className={compact ? "absolute inset-0 overflow-hidden" : "absolute inset-0 overflow-hidden"} aria-hidden="true">
      <div className="absolute inset-0 bg-[linear-gradient(#87c9e8_0_45%,#79b86c_45%)]" />
      <div className="absolute left-[58%] top-[11%] h-24 w-24 rounded-full bg-amber-200/90 blur-[1px]" />
      <div className="absolute left-[66%] top-[22%] h-28 w-48 rounded-full bg-white/50 blur-xl" />
      <div className="absolute bottom-0 left-[42%] h-[52%] w-[58%] rotate-[-4deg] rounded-tl-[55%] bg-[#5f9a54]" />
      <div className="absolute bottom-[12%] right-[4%] h-[33%] w-[48%] -rotate-3 rounded-[24px] bg-[#8a5a36] shadow-2xl">
        {Array.from({ length: 15 }).map((_, index) => <span key={index} className="absolute h-5 w-2 rounded-full bg-amber-300 shadow-[0_0_0_3px_rgba(65,122,54,.85)]" style={{ left: `${8 + (index % 5) * 19}%`, top: `${13 + Math.floor(index / 5) * 31}%`, transform: `rotate(${index % 2 ? 7 : -6}deg)` }} />)}
      </div>
      <div className="absolute bottom-[23%] left-[8%] h-[29%] w-[26%] rounded-xl bg-[#f0d2a0] shadow-2xl"><div className="absolute -left-[8%] -top-[29%] h-[45%] w-[116%] -skew-x-12 bg-[#b64f43]" /><div className="absolute bottom-0 left-[42%] h-[48%] w-[24%] bg-[#6d352b]" /><div className="absolute left-[12%] top-[31%] h-[24%] w-[20%] bg-sky-200" /><div className="absolute right-[12%] top-[31%] h-[24%] w-[20%] bg-sky-200" /></div>
      <div className="absolute bottom-[10%] left-[31%] h-[31%] w-[3%] rounded-full bg-[#6d472e]" /><div className="absolute bottom-[33%] left-[25%] h-[20%] w-[17%] rounded-full bg-[#2f7c45] shadow-[20px_8px_0_#3f8d4e,-18px_11px_0_#3f8d4e]" />
      <div className="absolute bottom-[4%] left-[49%] h-[28%] w-[8%] rounded-[45%_45%_25%_25%] bg-[#6655df] shadow-2xl"><div className="absolute -top-[22%] left-[18%] h-[35%] w-[64%] rounded-full bg-[#efbd8e]" /></div>
      <div className="absolute inset-x-0 bottom-0 h-[16%] bg-gradient-to-t from-black/20 to-transparent" />
      {!compact ? <div className="absolute right-[12%] top-[8%] flex items-center gap-2 rounded-full border border-white/20 bg-black/20 px-3 py-2 text-[10px] font-black text-white backdrop-blur-xl"><Wind className="h-3.5 w-3.5" /> Living weather</div> : null}
    </div>
  );
}
