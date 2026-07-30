"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { BrowserGame } from "@/data/browser-games";

export function GameCoverArt({ game, compact = false }: { game: BrowserGame; compact?: boolean }) {
  const reduceMotion = useReducedMotion();
  const [dark, mid, glow] = game.palette;

  return (
    <div
      className="absolute inset-0 isolate overflow-hidden"
      style={{ background: `linear-gradient(145deg, ${dark}, ${mid})` }}
      aria-hidden="true"
    >
      <motion.div
        className="absolute -right-[12%] -top-[28%] h-[72%] w-[72%] rounded-full blur-3xl"
        style={{ backgroundColor: glow, opacity: 0.24 }}
        animate={reduceMotion ? undefined : { x: [0, -18, 0], y: [0, 14, 0], scale: [1, 1.08, 1] }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute -bottom-[34%] -left-[10%] h-[72%] w-[72%] rounded-full border border-white/10 bg-white/5 blur-2xl"
        animate={reduceMotion ? undefined : { rotate: [0, 12, 0], x: [0, 16, 0] }}
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
      />
      <div className="absolute inset-0 opacity-[0.13] [background-image:linear-gradient(rgba(255,255,255,.22)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.22)_1px,transparent_1px)] [background-size:26px_26px] [mask-image:linear-gradient(to_bottom,black,transparent_88%)]" />
      <motion.div
        className={compact ? "absolute inset-0 grid place-items-center text-6xl drop-shadow-2xl" : "absolute right-[8%] top-1/2 grid h-44 w-44 -translate-y-1/2 place-items-center rounded-[46px] border border-white/15 bg-white/10 text-8xl shadow-[0_40px_100px_rgba(0,0,0,.35)] backdrop-blur-xl sm:h-56 sm:w-56 sm:text-9xl"}
        initial={{ opacity: 0, scale: 0.82, rotate: -7 }}
        animate={{ opacity: 1, scale: 1, rotate: 0 }}
        whileHover={reduceMotion ? undefined : { scale: 1.04, rotate: 2 }}
        transition={{ type: "spring", stiffness: 120, damping: 16 }}
      >
        <span className="select-none">{game.symbol}</span>
      </motion.div>
      {!compact ? (
        <>
          <motion.span
            className="absolute right-[29%] top-[17%] h-3 w-3 rounded-full bg-white/70 shadow-[0_0_30px_white]"
            animate={reduceMotion ? undefined : { y: [0, -12, 0], opacity: [0.45, 1, 0.45] }}
            transition={{ duration: 3.4, repeat: Infinity }}
          />
          <motion.span
            className="absolute bottom-[18%] right-[5%] h-5 w-5 rounded-full border border-white/40"
            animate={reduceMotion ? undefined : { y: [0, 10, 0], rotate: [0, 180, 360] }}
            transition={{ duration: 7, repeat: Infinity, ease: "linear" }}
          />
        </>
      ) : null}
      <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/65 via-black/10 to-transparent" />
    </div>
  );
}
