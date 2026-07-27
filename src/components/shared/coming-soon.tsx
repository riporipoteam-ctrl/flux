"use client";

import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";

export function ComingSoon({
  title,
  description,
  icon: Icon,
}: {
  title: string;
  description: string;
  icon: LucideIcon;
}) {
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 glass border-b border-border px-4 py-3">
        <h1 className="text-lg font-bold">{title}</h1>
      </header>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center justify-center px-6 py-24 text-center"
      >
        <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-fuchsia-500 text-white shadow-glow">
          <Icon className="h-8 w-8" />
        </div>
        <h2 className="text-2xl font-bold tracking-tight">{title}</h2>
        <p className="mt-2 max-w-md text-sm text-muted-foreground">
          {description}
        </p>
        <p className="mt-1 text-xs font-medium text-primary">
          Coming in the next build wave — say &quot;next&quot; to unlock.
        </p>
        <Link
          href="/home"
          className="mt-6 inline-flex h-10 items-center justify-center rounded-full border border-border px-5 text-sm font-bold transition hover:bg-muted"
        >
          Back to Home
        </Link>
      </motion.div>
    </div>
  );
}
