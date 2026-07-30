"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { BrowserGame } from "@/data/browser-games";
import { assetUrl } from "@/lib/asset-url";

export function GameCoverArt({ game, compact = false }: { game: BrowserGame; compact?: boolean }) {
  const reduceMotion = useReducedMotion();

  return (
    <div className="absolute inset-0 overflow-hidden bg-black" aria-hidden="true">
      <motion.img
        src={assetUrl(game.thumbnail)}
        alt=""
        className="h-full w-full object-cover"
        initial={{ opacity: 0, scale: 1.02 }}
        animate={{ opacity: 1, scale: 1 }}
        whileHover={reduceMotion || compact ? undefined : { scale: 1.025 }}
        transition={{ duration: reduceMotion ? 0 : 0.45, ease: "easeOut" }}
        loading={compact ? "lazy" : "eager"}
        draggable={false}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/72 via-black/5 to-black/5" />
    </div>
  );
}
