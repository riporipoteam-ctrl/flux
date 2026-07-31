"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { BrowserGame } from "@/data/browser-games";

export function GameCoverArt({ game, compact = false }: { game: BrowserGame; compact?: boolean }) {
  const reduceMotion = useReducedMotion();

  return (
    <div className="absolute inset-0 isolate overflow-hidden bg-slate-950" aria-hidden="true">
      <motion.img
        src={game.thumbnail}
        alt=""
        className="absolute inset-0 h-full w-full object-cover"
        initial={{ scale: 1.02, opacity: 0.94 }}
        animate={reduceMotion ? { scale: 1, opacity: 1 } : { scale: 1.06, opacity: 1 }}
        transition={{ duration: reduceMotion ? 0 : 12, ease: "easeOut" }}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-black/5" />
      <div className="absolute inset-0 bg-gradient-to-r from-black/72 via-black/28 to-transparent" />
      {!compact ? (
        <>
          <motion.div
            className="absolute -left-16 bottom-0 h-48 w-48 rounded-full bg-white/10 blur-3xl"
            animate={reduceMotion ? undefined : { x: [0, 24, 0], y: [0, -10, 0] }}
            transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.div
            className="absolute right-8 top-8 rounded-full border border-white/15 bg-black/35 px-4 py-2 text-[10px] font-black uppercase tracking-[0.22em] text-white/88 backdrop-blur-xl"
            animate={reduceMotion ? undefined : { y: [0, -4, 0] }}
            transition={{ duration: 4.2, repeat: Infinity, ease: "easeInOut" }}
          >
            Play on Flux
          </motion.div>
        </>
      ) : null}
    </div>
  );
}
