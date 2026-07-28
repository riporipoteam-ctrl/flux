"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { assetUrl } from "@/lib/asset-url";

export function LoadingScreen({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-background px-6" role="status" aria-live="polite">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_45%,rgba(29,155,240,.09),transparent_28%)]" />
      <div className="relative">
        <motion.div
          className="absolute -inset-3 rounded-[24px] border border-[#1d9bf0]/25"
          animate={{ scale: [0.88, 1.18], opacity: [0.65, 0] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: "easeOut" }}
        />
        <motion.div
          initial={{ opacity: 0, scale: 0.86 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          className="relative overflow-hidden rounded-[18px] bg-card p-1.5 shadow-xl ring-1 ring-border"
        >
          <Image src={assetUrl("/flux-icon.png")} alt="Flux" width={48} height={48} className="h-12 w-12 rounded-[13px] object-cover" priority />
        </motion.div>
      </div>
      <motion.p initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }} className="relative mt-5 text-sm font-semibold tracking-tight text-foreground">{label}</motion.p>
      <div className="relative mt-3 flex gap-1" aria-hidden="true">
        {[0, 1, 2].map((index) => (
          <motion.span key={index} className="h-1.5 w-1.5 rounded-full bg-[#1d9bf0]" animate={{ opacity: [0.25, 1, 0.25], y: [0, -2, 0] }} transition={{ duration: 1, repeat: Infinity, delay: index * 0.14 }} />
        ))}
      </div>
    </div>
  );
}
