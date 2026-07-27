"use client";

import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 280, damping: 24 }}
      className="flex flex-col items-center justify-center px-6 py-20 text-center"
    >
      <motion.div
        animate={{ y: [0, -4, 0] }}
        transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
        className="mb-5 flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-br from-primary/15 to-fuchsia-500/15 text-primary shadow-soft ring-1 ring-border"
      >
        <Icon className="h-7 w-7" />
      </motion.div>
      <h3 className="text-lg font-bold tracking-tight">{title}</h3>
      {description ? (
        <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
          {description}
        </p>
      ) : null}
      {action ? <div className="mt-6">{action}</div> : null}
    </motion.div>
  );
}
