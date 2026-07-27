"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

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
  return (
    <Link
      href={href}
      className={cn(
        "group inline-flex items-center gap-2.5 outline-none",
        className
      )}
    >
      <motion.span
        whileHover={{ scale: 1.06, rotate: -2 }}
        whileTap={{ scale: 0.96 }}
        transition={{ type: "spring", stiffness: 420, damping: 18 }}
        className="relative shrink-0 overflow-hidden rounded-xl ring-1 ring-black/5 dark:ring-white/10"
        style={{ width: size, height: size }}
      >
        <Image
          src="/flux-icon.png"
          alt="Flux social media network"
          width={size}
          height={size}
          className="h-full w-full object-contain"
          priority
        />
      </motion.span>
      {showWordmark ? (
        <span className="text-xl font-extrabold tracking-tight text-foreground">
          Flux
        </span>
      ) : null}
    </Link>
  );
}
