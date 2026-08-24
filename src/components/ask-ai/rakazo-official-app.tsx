"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, Bot, LayoutDashboard, Sparkles } from "lucide-react";
import { signInAnonymously } from "firebase/auth";
import { auth, isFirebaseConfigured } from "@/lib/firebase";
import { useAuth } from "@/contexts/auth-context";
import GrokPanel from "@/components/ask-ai/grok-panel";

const RAKAZO_GUEST_PATH = "/flux/rakazo/";
const ASK_AI_ENDPOINT = process.env.NEXT_PUBLIC_ASK_AI_ENDPOINT || "https://echoxr-ripoteam-cloud-pc.hf.space/api/flux/askai/chat";

type AskMode = "workspace" | "grok";

/**
 * Flux-owned AskAI shell.
 * Rakazo remains the workspace runtime, while Flux owns the responsive chrome
 * and the community Grok workspace so the mobile experience no longer depends
 * on the embedded app's old frame dimensions.
 */
export default function RakazoOfficialApp() {
  const frameRef = useRef<HTMLIFrameElement | null>(null);
  const { user } = useAuth();
  const [mode, setMode] = useState<AskMode>("workspace");

  const sendAuthBridge = useCallback(async () => {
    let token: string | null = null;
    try {
      const current = user || (auth.currentUser?.isAnonymous ? auth.currentUser : null);
      const session = current || (isFirebaseConfigured ? (await signInAnonymously(auth)).user : null);
      token = session ? await session.getIdToken() : null;
    } catch {
      // Local Rakazo mode remains usable when anonymous Auth is disabled.
    }
    frameRef.current?.contentWindow?.postMessage(
      { source: "flux", type: "rakazo-auth", token, endpoint: ASK_AI_ENDPOINT },
      window.location.origin,
    );
  }, [user]);

  useEffect(() => { void sendAuthBridge(); }, [sendAuthBridge]);

  return (
    <main className="askai-v11-shell">
      <header className="askai-v11-toolbar">
        <div className="askai-v11-brand">
          <Link href="/home" className="askai-v11-brand-mark" aria-label="Back to Flux home"><ArrowLeft className="h-[18px] w-[18px]" /></Link>
          <div>
            <h1>AskAI</h1>
            <p>Flux AI command center</p>
          </div>
        </div>
        <div className="askai-v11-toolbar-actions" role="tablist" aria-label="AskAI modes">
          <button type="button" role="tab" aria-selected={mode === "workspace"} className={`askai-v11-mode ${mode === "workspace" ? "is-active" : ""}`} onClick={() => setMode("workspace")}>
            <LayoutDashboard className="h-4 w-4" />Workspace
          </button>
          <button type="button" role="tab" aria-selected={mode === "grok"} className={`askai-v11-mode ${mode === "grok" ? "is-active" : ""}`} onClick={() => setMode("grok")}>
            <Bot className="h-4 w-4" />Grok
          </button>
        </div>
        <div className="hidden items-center gap-2 sm:flex">
          <span className="rounded-full border border-[var(--flux-line)] bg-[var(--flux-surface-2)] px-2.5 py-1 text-[9px] font-extrabold uppercase tracking-[.08em] text-[var(--flux-muted)]"><Sparkles className="mr-1 inline-block h-3 w-3" />v11 UI</span>
        </div>
      </header>

      <div className={`askai-v11-workspace ${mode === "grok" ? "is-split" : ""}`}>
        <div className="askai-v11-iframe-wrap">
          <iframe
            ref={frameRef}
            title="Flux AskAI workspace"
            src={RAKAZO_GUEST_PATH}
            onLoad={() => void sendAuthBridge()}
            className="block h-full w-full border-0"
            allow="clipboard-read; clipboard-write; microphone; camera; display-capture; fullscreen"
          />
        </div>
        {mode === "grok" ? <GrokPanel /> : null}
      </div>
    </main>
  );
}
