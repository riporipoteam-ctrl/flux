"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2, RefreshCw, ServerCrash, ShieldCheck, X } from "lucide-react";
import { checkAskAIGroqHealth, type AskAIGroqHealth, type AskAIHealthState } from "@/lib/ai/askai-groq";
import { cn } from "@/lib/utils";

const stateCopy: Record<AskAIHealthState, { title: string; tone: string }> = {
  checking: { title: "Checking AskAI backend…", tone: "border-white/10 bg-black/70 text-white" },
  connected: { title: "AskAI is online", tone: "border-emerald-400/30 bg-emerald-950/90 text-emerald-50" },
  "missing-secret": { title: "AI provider setup is incomplete", tone: "border-amber-400/30 bg-amber-950/95 text-amber-50" },
  "not-deployed": { title: "AskAI function is not deployed", tone: "border-red-400/30 bg-red-950/95 text-red-50" },
  offline: { title: "AskAI backend is unreachable", tone: "border-red-400/30 bg-red-950/95 text-red-50" },
};

export function AskAIConnectionStatus() {
  const [state, setState] = useState<AskAIHealthState>("checking");
  const [health, setHealth] = useState<AskAIGroqHealth | null>(null);
  const [open, setOpen] = useState(true);

  const check = useCallback(async () => {
    setState("checking");
    const next = await checkAskAIGroqHealth();
    setHealth(next);
    setState(next.state);
    setOpen(next.state !== "connected");
  }, []);

  useEffect(() => { void check(); }, [check]);

  const copy = stateCopy[state];
  const Icon = state === "checking" ? Loader2 : state === "connected" ? CheckCircle2 : state === "missing-secret" ? ShieldCheck : state === "not-deployed" ? ServerCrash : AlertTriangle;

  return (
    <div className="pointer-events-none fixed inset-x-3 top-[calc(env(safe-area-inset-top)+66px)] z-[2147482000] flex justify-center sm:left-auto sm:right-4 sm:w-[430px]">
      <div className={cn("pointer-events-auto w-full overflow-hidden rounded-2xl border shadow-2xl backdrop-blur-2xl", copy.tone)}>
        <button type="button" onClick={() => setOpen((value) => !value)} className="flex min-h-12 w-full items-center gap-3 px-4 text-left">
          <Icon className={cn("h-4.5 w-4.5 shrink-0", state === "checking" && "animate-spin")} />
          <div className="min-w-0 flex-1"><p className="truncate text-xs font-black">{copy.title}</p>{health ? <p className="truncate text-[10px] opacity-65">{health.version} · {health.models.instant}</p> : null}</div>
          <span className="text-[10px] font-black opacity-65">{open ? "HIDE" : "DETAILS"}</span>
        </button>
        {open ? <div className="border-t border-white/10 px-4 pb-4 pt-3">
          <p className="text-xs leading-5 opacity-85">{health?.message || "Testing the secure AskAI gateway."}</p>
          {state === "missing-secret" ? <div className="mt-3 rounded-xl bg-black/20 p-3 text-[11px] leading-5"><strong>Secure provider setup required</strong><p className="mt-1 opacity-80">AskAI will continue using its available local or remote engine.</p></div> : null}
          {state === "not-deployed" || state === "offline" ? <div className="mt-3 rounded-xl bg-black/20 p-3 text-[11px] leading-5"><strong>Backend endpoint</strong><p className="mt-1 break-all opacity-75">{health?.endpoint}</p><p className="mt-2 opacity-75">Deploy the Firebase Function before sending AskAI requests.</p></div> : null}
          <div className="mt-3 flex items-center gap-2"><button type="button" onClick={() => void check()} className="inline-flex h-9 items-center gap-2 rounded-full bg-white px-4 text-[11px] font-black text-black"><RefreshCw className="h-3.5 w-3.5" />Test again</button><button type="button" onClick={() => setOpen(false)} className="grid h-9 w-9 place-items-center rounded-full bg-white/10" aria-label="Close status"><X className="h-4 w-4" /></button></div>
        </div> : null}
      </div>
    </div>
  );
}
