"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

export function FluxMark({ size = 34, className }: { size?: number; className?: string }) {
  return (
    <span
      className={cn("flux-brand-mark inline-grid shrink-0 place-items-center", className)}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <svg viewBox="0 0 40 40" width={size} height={size} fill="none">
        <rect x="1.5" y="1.5" width="37" height="37" rx="12" fill="currentColor" />
        <path d="M11.5 11.5h18v5.4H17.8v4.1h10v5.2h-10v7h-6.3V11.5Z" fill="var(--flux-mark-ink,#fff)" />
        <path d="M27.3 28.2 32 32.9" stroke="var(--flux-mark-ink,#fff)" strokeWidth="3.4" strokeLinecap="round" />
      </svg>
    </span>
  );
}

export function Logo({
  className,
  showWordmark = true,
  href = "/home",
  size = 36,
}: {
  className?: string;
  showWordmark?: boolean;
  href?: string;
  size?: number;
}) {
  const reduceMotion = useReducedMotion();
  return (
    <Link href={href} className={cn("group inline-flex items-center gap-2.5 outline-none", className)} aria-label="Flux home">
      <motion.span
        whileHover={reduceMotion ? undefined : { scale: 1.045, rotate: -2 }}
        whileTap={reduceMotion ? undefined : { scale: 0.94 }}
        transition={{ type: "spring", stiffness: 480, damping: 26 }}
        className="inline-flex"
      >
        <FluxMark size={size} />
      </motion.span>
      {showWordmark ? <span className="flux-brand-word text-xl font-black tracking-[-0.055em]">Flux</span> : null}
    </Link>
  );
}
