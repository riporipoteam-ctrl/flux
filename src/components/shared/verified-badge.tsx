"use client";

import { BadgeCheck, Briefcase, Building2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function VerifiedBadge({
  className,
  title = "Verified on Flux",
  type = "flux",
}: {
  className?: string;
  title?: string;
  type?: "flux" | "business" | "government" | null;
}) {
  if (type === "business") {
    return (
      <span
        className={cn(
          "inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#1d9bf0] text-white",
          className
        )}
        title={title || "Business account"}
        aria-label={title || "Business account"}
      >
        <Briefcase className="h-2.5 w-2.5" strokeWidth={2.5} />
      </span>
    );
  }
  if (type === "government") {
    return (
      <span
        className={cn(
          "inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-gray-500 text-white",
          className
        )}
        title={title || "Government account"}
        aria-label={title || "Government account"}
      >
        <Building2 className="h-2.5 w-2.5" strokeWidth={2.5} />
      </span>
    );
  }
  return (
    <span title={title} className="inline-flex shrink-0">
      <BadgeCheck
        className={cn("h-4 w-4 fill-[#1d9bf0] text-white", className)}
        aria-label={title}
      />
    </span>
  );
}

export function BusinessBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full bg-[#1d9bf0]/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#1d9bf0]",
        className
      )}
    >
      <Briefcase className="h-3 w-3" />
      Business
    </span>
  );
}

/** Shop / custom flair badge next to a name */
export function ShopFlairBadge({
  emoji,
  label,
  className,
}: {
  emoji?: string;
  label?: string;
  className?: string;
}) {
  if (!emoji && !label) return null;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-bold text-amber-500",
        className
      )}
      title={label || "Shop badge"}
    >
      {emoji || "✨"}
      {label ? <span className="max-w-[72px] truncate">{label}</span> : null}
    </span>
  );
}
