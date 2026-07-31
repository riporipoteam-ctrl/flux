"use client";

import { useId } from "react";
import { motion } from "framer-motion";
import type { AnimatedGiftDefinition } from "@/services/gift-experience";
import { cn } from "@/lib/utils";

export function GiftVisual({ gift, compact = false, className }: { gift: AnimatedGiftDefinition; compact?: boolean; className?: string }) {
  const id = useId().replace(/:/g, "");
  return (
    <div className={cn("relative grid place-items-center overflow-hidden", compact ? "h-16 w-16 rounded-2xl" : "h-60 w-60", className)}>
      <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle,rgba(124,92,255,.3),transparent_68%)] blur-xl" />
      {gift.visual === "heart" ? <HeartScene id={id} compact={compact} /> : null}
      {gift.visual === "orb" ? <OrbScene id={id} compact={compact} /> : null}
      {gift.visual === "rocket" ? <RocketScene id={id} compact={compact} /> : null}
      {gift.visual === "coins" ? <CoinScene id={id} compact={compact} /> : null}
      {gift.visual === "dragon" ? <DragonScene id={id} compact={compact} /> : null}
      {gift.visual === "galaxy" ? <GalaxyScene id={id} compact={compact} /> : null}
      {gift.visual === "crown" ? <CrownScene id={id} compact={compact} /> : null}
      {gift.visual === "titan" ? <TitanScene id={id} compact={compact} /> : null}
    </div>
  );
}

function HeartScene({ id, compact }: { id: string; compact: boolean }) {
  return <motion.svg viewBox="0 0 200 200" className="relative h-full w-full" initial={{ scale: .35, opacity: 0 }} animate={{ scale: [0.35, 1.12, 1, 1.05, 1], opacity: 1 }} transition={{ duration: 1.5, ease: "easeOut" }}>
    <defs><linearGradient id={`${id}-heart`} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#ff4da6" /><stop offset="1" stopColor="#7c3aed" /></linearGradient><filter id={`${id}-glow`}><feGaussianBlur stdDeviation="5" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter></defs>
    <motion.path d="M100 165 36 105C8 77 24 30 63 31c19 0 31 12 37 24 7-12 19-24 38-24 39-1 55 46 27 74Z" fill={`url(#${id}-heart)`} filter={`url(#${id}-glow)`} animate={{ scale: [1, 1.06, 1] }} style={{ transformOrigin: "100px 100px" }} transition={{ duration: 1, repeat: Infinity }} />
    {!compact ? [0,1,2,3,4,5].map((item) => <motion.circle key={item} cx="100" cy="95" r="5" fill={item % 2 ? "#fff" : "#ff9bd1"} initial={{ opacity: 0 }} animate={{ opacity: [0,1,0], cx: 100 + Math.cos(item) * 72, cy: 95 + Math.sin(item) * 65 }} transition={{ duration: 1.7, delay: item * .12, repeat: Infinity }} />) : null}
  </motion.svg>;
}

function OrbScene({ id, compact }: { id: string; compact: boolean }) {
  return <svg viewBox="0 0 200 200" className="relative h-full w-full"><defs><radialGradient id={`${id}-orb`}><stop stopColor="#fff" /><stop offset=".25" stopColor="#67e8f9" /><stop offset=".62" stopColor="#7c3aed" /><stop offset="1" stopColor="#111827" /></radialGradient><filter id={`${id}-orbglow`}><feGaussianBlur stdDeviation="8" /></filter></defs><motion.circle cx="100" cy="100" r="58" fill="#7c3aed" opacity=".35" filter={`url(#${id}-orbglow)`} animate={{ r: [48,68,48], opacity: [.25,.55,.25] }} transition={{ duration: 2.2, repeat: Infinity }} /><motion.circle cx="100" cy="100" r="47" fill={`url(#${id}-orb)`} animate={{ y: compact ? 0 : [-5,5,-5], rotate: [0,360] }} style={{ transformOrigin: "100px 100px" }} transition={{ y: { duration: 2.2, repeat: Infinity }, rotate: { duration: 8, repeat: Infinity, ease: "linear" } }} />{!compact ? [0,1,2].map((ring) => <motion.ellipse key={ring} cx="100" cy="100" rx={72-ring*8} ry={25+ring*7} fill="none" stroke={ring === 1 ? "#67e8f9" : "#c4b5fd"} strokeWidth="2" opacity=".7" animate={{ rotate: ring % 2 ? [360,0] : [0,360] }} style={{ transformOrigin: "100px 100px" }} transition={{ duration: 4+ring, repeat: Infinity, ease: "linear" }} />) : null}</svg>;
}

function RocketScene({ id, compact }: { id: string; compact: boolean }) {
  return <svg viewBox="0 0 200 200" className="relative h-full w-full"><defs><linearGradient id={`${id}-rocket`} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#fff" /><stop offset="1" stopColor="#94a3b8" /></linearGradient><linearGradient id={`${id}-fire`} x1="0" y1="0" x2="0" y2="1"><stop stopColor="#fff7a8" /><stop offset=".45" stopColor="#fb923c" /><stop offset="1" stopColor="#ef4444" /></linearGradient></defs><motion.g initial={{ y: 70, opacity: 0 }} animate={{ y: compact ? 0 : [-5,4,-5], opacity: 1 }} transition={{ opacity: { duration: .6 }, y: { duration: 1.2, repeat: Infinity } }}><path d="M100 22c25 19 35 51 25 91l-25 22-25-22c-10-40 0-72 25-91Z" fill={`url(#${id}-rocket)`} /><circle cx="100" cy="74" r="14" fill="#38bdf8" stroke="#0f172a" strokeWidth="5" /><path d="M76 105 51 132l28-2m45-25 25 27-28-2" fill="#7c3aed" /><motion.path d="M84 132 100 181l16-49-16 11Z" fill={`url(#${id}-fire)`} animate={{ d: ["M84 132 100 181l16-49-16 11Z","M84 132 100 195l16-63-16 15Z","M84 132 100 181l16-49-16 11Z"] }} transition={{ duration: .45, repeat: Infinity }} /></motion.g>{!compact ? [0,1,2,3].map((star) => <motion.circle key={star} cx={35+star*42} cy={40+(star%2)*65} r="3" fill="white" animate={{ opacity: [.15,1,.15] }} transition={{ duration: 1.3, delay: star*.2, repeat: Infinity }} />) : null}</svg>;
}

function CoinScene({ id, compact }: { id: string; compact: boolean }) {
  const coins = compact ? [0,1,2] : Array.from({ length: 11 }, (_, index) => index);
  return <svg viewBox="0 0 200 200" className="relative h-full w-full"><defs><linearGradient id={`${id}-coin`} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#fff3a3" /><stop offset=".48" stopColor="#fbbf24" /><stop offset="1" stopColor="#b45309" /></linearGradient></defs>{coins.map((coin) => { const x = 24 + (coin * 37) % 155; const delay = (coin % 6) * .13; return <motion.g key={coin} initial={{ y: -45, opacity: 0 }} animate={{ y: [compact ? 20 : -20, 170], opacity: [0,1,1,0], rotate: [0,360] }} transition={{ duration: compact ? 1.1 : 2.1, delay, repeat: Infinity }}><ellipse cx={x} cy="0" rx="12" ry="15" fill={`url(#${id}-coin)`} stroke="#fef3c7" strokeWidth="2" /><path d={`M${x} -7v14m-5-10h7c6 0 6 7 0 7h-7`} fill="none" stroke="#92400e" strokeWidth="2" /></motion.g>; })}<motion.circle cx="100" cy="104" r="50" fill="none" stroke="#fbbf24" strokeWidth="3" opacity=".4" animate={{ r: [35,65], opacity: [.65,0] }} transition={{ duration: 1.4, repeat: Infinity }} /></svg>;
}

function DragonScene({ id, compact }: { id: string; compact: boolean }) {
  return <motion.svg viewBox="0 0 200 200" className="relative h-full w-full" initial={{ scale: .4, opacity: 0 }} animate={{ scale: 1, opacity: 1, rotate: compact ? 0 : [0,-3,3,0] }} transition={{ scale: { duration: .8 }, rotate: { duration: 2.5, repeat: Infinity } }}><defs><linearGradient id={`${id}-dragon`} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#22d3ee" /><stop offset=".5" stopColor="#7c3aed" /><stop offset="1" stopColor="#ec4899" /></linearGradient><filter id={`${id}-dglow`}><feGaussianBlur stdDeviation="4" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter></defs><path d="M39 139c25 28 79 32 111 1 24-23 15-57-10-63-12-3-23 3-29 12 4-30-16-51-40-52 12 12 13 26 4 38-11 14-30 19-39 36-5 9-4 19 3 28Zm54-30c12-16 26-21 45-14-8 2-14 8-16 16 11 1 20 7 23 17-18-9-36-8-52 2Z" fill={`url(#${id}-dragon)`} filter={`url(#${id}-dglow)`} /><path d="M63 73 42 45l34 14m46 20 27-28-11 39" fill="none" stroke="#67e8f9" strokeWidth="8" strokeLinecap="round" /><motion.path d="M143 105c28-12 40 4 37 21-8-7-15-7-25-2 5-8 1-14-12-19Z" fill="#f97316" animate={{ scale: [0.75,1.15,.75] }} style={{ transformOrigin: "150px 110px" }} transition={{ duration: .6, repeat: Infinity }} /></motion.svg>;
}

function GalaxyScene({ id, compact }: { id: string; compact: boolean }) {
  return <svg viewBox="0 0 200 200" className="relative h-full w-full"><defs><radialGradient id={`${id}-galaxy`}><stop stopColor="#fff" /><stop offset=".12" stopColor="#67e8f9" /><stop offset=".42" stopColor="#7c3aed" /><stop offset=".72" stopColor="#ec4899" /><stop offset="1" stopColor="#020617" /></radialGradient></defs><motion.circle cx="100" cy="100" r="58" fill={`url(#${id}-galaxy)`} animate={{ rotate: [0,360], scale: [1,1.05,1] }} style={{ transformOrigin: "100px 100px" }} transition={{ rotate: { duration: 9, repeat: Infinity, ease: "linear" }, scale: { duration: 2, repeat: Infinity } }} /><motion.path d="M25 109c34-42 114-47 153-5-43-19-106-16-153 5Z" fill="none" stroke="#f0abfc" strokeWidth="7" opacity=".7" animate={{ rotate: [0,360] }} style={{ transformOrigin: "100px 100px" }} transition={{ duration: 6, repeat: Infinity, ease: "linear" }} />{!compact ? Array.from({ length: 12 }, (_, star) => <motion.circle key={star} cx={20+(star*47)%170} cy={18+(star*73)%165} r={star%3===0?3:1.5} fill="white" animate={{ opacity: [.2,1,.2] }} transition={{ duration: 1.1+star*.08, repeat: Infinity }} />) : null}</svg>;
}

function CrownScene({ id, compact }: { id: string; compact: boolean }) {
  return <motion.svg viewBox="0 0 200 200" className="relative h-full w-full" initial={{ y: -70, opacity: 0, rotate: -12 }} animate={{ y: compact ? 0 : [2,-5,2], opacity: 1, rotate: 0 }} transition={{ opacity: { duration: .6 }, y: { duration: 2, repeat: Infinity } }}><defs><linearGradient id={`${id}-crown`} x1="0" y1="0" x2="0" y2="1"><stop stopColor="#fff7b2" /><stop offset=".45" stopColor="#fbbf24" /><stop offset="1" stopColor="#b45309" /></linearGradient><filter id={`${id}-cglow`}><feGaussianBlur stdDeviation="4" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter></defs><path d="m34 67 32 31 34-58 34 58 32-31-15 82H49Z" fill={`url(#${id}-crown)`} stroke="#fef3c7" strokeWidth="4" filter={`url(#${id}-cglow)`} /><rect x="48" y="139" width="104" height="24" rx="10" fill="#f59e0b" stroke="#fff7b2" strokeWidth="4" /><circle cx="66" cy="111" r="8" fill="#22d3ee" /><circle cx="100" cy="103" r="9" fill="#ec4899" /><circle cx="134" cy="111" r="8" fill="#7c3aed" />{!compact ? [0,1,2,3].map((spark) => <motion.path key={spark} d="m0-8 3 5 5 3-5 3-3 5-3-5-5-3 5-3Z" fill="white" transform={`translate(${45+spark*38} ${37+(spark%2)*28})`} animate={{ scale: [.3,1,.3], opacity: [0,1,0] }} transition={{ duration: 1.3, delay: spark*.18, repeat: Infinity }} />) : null}</motion.svg>;
}

function TitanScene({ id, compact }: { id: string; compact: boolean }) {
  return <motion.svg viewBox="0 0 200 200" className="relative h-full w-full" initial={{ scale: .25, opacity: 0 }} animate={{ scale: [0.25,1.08,1], opacity: 1 }} transition={{ duration: .9 }}><defs><linearGradient id={`${id}-metal`} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#e2e8f0" /><stop offset=".45" stopColor="#64748b" /><stop offset="1" stopColor="#111827" /></linearGradient><filter id={`${id}-tglow`}><feGaussianBlur stdDeviation="5" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter></defs><path d="M57 41h86l24 39-12 83H45L33 80Z" fill={`url(#${id}-metal)`} stroke="#c4b5fd" strokeWidth="5" /><path d="m57 41 19-20m67 20-19-20" stroke="#94a3b8" strokeWidth="8" strokeLinecap="round" /><rect x="57" y="70" width="86" height="62" rx="20" fill="#06090f" /><motion.circle cx="79" cy="98" r="10" fill="#22d3ee" filter={`url(#${id}-tglow)`} animate={{ opacity: [.35,1,.35] }} transition={{ duration: .8, repeat: Infinity }} /><motion.circle cx="121" cy="98" r="10" fill="#ec4899" filter={`url(#${id}-tglow)`} animate={{ opacity: [1,.35,1] }} transition={{ duration: .8, repeat: Infinity }} /><path d="M77 145h46" stroke="#67e8f9" strokeWidth="6" strokeLinecap="round" />{!compact ? <motion.circle cx="100" cy="110" r="75" fill="none" stroke="#7c3aed" strokeWidth="3" animate={{ r: [55,88], opacity: [.6,0] }} transition={{ duration: 1.5, repeat: Infinity }} /> : null}</motion.svg>;
}
