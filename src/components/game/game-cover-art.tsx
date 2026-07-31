"use client";

import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import type { BrowserGame } from "@/data/browser-games";
import { assetUrl } from "@/lib/asset-url";

const embeddedCoverCache = new Map<string, Promise<string>>();

async function resolveCoverSource(url: string): Promise<string> {
  if (!url.toLowerCase().endsWith(".svg")) return url;
  const cached = embeddedCoverCache.get(url);
  if (cached) return cached;

  const request = fetch(url, { cache: "force-cache" })
    .then(async (response) => {
      if (!response.ok) throw new Error(`Cover returned ${response.status}`);
      const svg = await response.text();
      const match = svg.match(/(?:href|xlink:href)=["'](data:image\/(?:webp|png|jpeg);base64,[^"']+)["']/i);
      return match?.[1] || url;
    })
    .catch(() => url);

  embeddedCoverCache.set(url, request);
  return request;
}

export function GameCoverArt({ game, compact = false }: { game: BrowserGame; compact?: boolean }) {
  const reduceMotion = useReducedMotion();
  const originalSource = assetUrl(game.thumbnail);
  const [source, setSource] = useState(originalSource);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setSource(originalSource);
    setFailed(false);
    void resolveCoverSource(originalSource).then((resolved) => {
      if (!cancelled) setSource(resolved);
    });
    return () => { cancelled = true; };
  }, [originalSource]);

  return (
    <div
      className="absolute inset-0 isolate overflow-hidden bg-[#0f1419]"
      style={{ background: `linear-gradient(135deg, ${game.palette[0]}, ${game.palette[1]} 58%, ${game.palette[2]})` }}
      aria-hidden="true"
    >
      {!failed ? (
        <motion.img
          key={source}
          src={source}
          alt=""
          loading={compact ? "lazy" : "eager"}
          decoding="async"
          className="absolute inset-0 h-full w-full object-cover"
          initial={{ scale: 1.01, opacity: 0 }}
          animate={reduceMotion ? { scale: 1, opacity: 1 } : { scale: 1.025, opacity: 1 }}
          transition={{ duration: reduceMotion ? 0 : 0.6, ease: "easeOut" }}
          onError={() => {
            if (source !== originalSource) setSource(originalSource);
            else setFailed(true);
          }}
        />
      ) : (
        <div className="absolute inset-0 grid place-items-center overflow-hidden">
          <span className="absolute -right-8 -top-10 text-[150px] opacity-15 blur-[1px]">{game.symbol}</span>
          <div className="relative text-center text-white">
            <span className="text-6xl drop-shadow-xl">{game.symbol}</span>
            <p className="mt-3 text-sm font-black tracking-tight">{game.title}</p>
          </div>
        </div>
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/78 via-black/14 to-black/5" />
      {!compact ? (
        <span className="absolute right-5 top-5 rounded-full border border-white/20 bg-black/50 px-3 py-1.5 text-[10px] font-black text-white backdrop-blur-md">Play on Flux</span>
      ) : null}
    </div>
  );
}
