"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { BrowserGame } from "@/data/browser-games";
import { assetUrl } from "@/lib/asset-url";

export function GameCoverArt({ game, compact = false }: { game: BrowserGame; compact?: boolean }) {
  const reduceMotion = useReducedMotion();

  return (
    <div className="absolute inset-0 isolate overflow-hidden bg-[#0f1419]" aria-hidden="true">
      <motion.img
        src={assetUrl(game.thumbnail)}
        alt=""
        className="absolute inset-0 h-full w-full object-cover"
        initial={{ scale: 1.015, opacity: 0.96 }}
        animate={reduceMotion ? { scale: 1, opacity: 1 } : { scale: 1.035, opacity: 1 }}
        transition={{ duration: reduceMotion ? 0 : 10, ease: "easeOut" }}
        onError={(event) => {
          const image = event.currentTarget;
          image.style.display = "none";
          image.parentElement?.setAttribute("data-cover-error", "true");
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/16 to-transparent" />
      {!compact ? (
        <motion.span
          className="absolute right-5 top-5 rounded-full border border-white/20 bg-black/45 px-3 py-1.5 text-[10px] font-bold text-white backdrop-blur-md"
          animate={reduceMotion ? undefined : { y: [0, -3, 0] }}
          transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut" }}
        >
          Play on Flux
        </motion.span>
      ) : null}
    </div>
  );
}
