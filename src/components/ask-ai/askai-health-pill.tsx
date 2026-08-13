"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2, RefreshCw, ServerCrash } from "lucide-react";
import { checkAskAIGroqHealth, type AskAIGroqHealth, type AskAIHealthState } from "@/lib/ai/askai-groq";
import { cn } from "@/lib/utils";

const copy: Record<AskAIHealthState, string> = {
  checking: "Checking AskAI…",
  connected: "AskAI online",
  "missing-secret": "AskAI needs provider setup",
  "not-deployed": "AskAI gateway missing",
  offline: "AskAI offline",
};

export function AskAIHealthPill() {
  const [state, setState] = useState<AskAIHealthState>("checking");
  const [health, setHealth] = useState<AskAIGroqHealth | null>(null);
  const [expanded, setExpanded] = useState(false);

  const refresh = useCallback(async () => {
    setState("checking");
    const next = await checkAskAIGroqHealth();
    setHealth(next);
    setState(next.state);
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const Icon = state === "checking"
    ? Loader2
    : state === "connected"
      ? CheckCircle2
      : state === "not-deployed"
        ? ServerCrash
        : AlertTriangle;

  const provider = health?.primary === "ripo-local"
    ? "Ripo Local"
    : health?.primary === "cloud-fallback"
      ? "Connected fallback"
      : health?.primary || "Flux gateway";

  return (
    <div className="pointer-events-none fixed right-3 top-[calc(env(safe-area-inset-top)+64px)] z-[2147482000] sm:right-4">
      <div className={cn(
        "pointer-events-auto overflow-hidden rounded-2xl border shadow-xl backdrop-blur-xl",
        state === "connected"
          ? "border-emerald-500/20 bg-emerald-950/82 text-emerald-50"
          : "border-white/10 bg-black/82 text-white"
      )}>
        <button type="button" onClick={() => setExpanded((value) => !value)} className="flex h-10 items-center gap-2 px-3 text-left">
          <Icon className={cn("h-3.5 w-3.5", state === "checking" && "animate-spin")} />
          <span className="text-[11px] font-black">{copy[state]}</span>
        </button>
        {expanded ? (
          <div className="w-[min(320px,calc(100vw-24px))] border-t border-white/10 p-3">
            <p className="text-[11px] font-bold">{provider}{health?.models.instant ? ` · ${health.models.instant}` : ""}</p>
            <p className="mt-1 text-[10px] leading-4 opacity-65">{health?.message || "Checking the Flux AI gateway."}</p>
            <button type="button" onClick={() => void refresh()} className="mt-3 inline-flex h-8 items-center gap-2 rounded-full bg-white px-3 text-[10px] font-black text-black">
              <RefreshCw className="h-3 w-3" /> Test again
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
