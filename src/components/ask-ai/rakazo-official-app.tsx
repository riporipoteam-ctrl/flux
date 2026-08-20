"use client";

import { useCallback, useEffect, useRef } from "react";
import { signInAnonymously } from "firebase/auth";
import { auth, isFirebaseConfigured } from "@/lib/firebase";
import { useAuth } from "@/contexts/auth-context";

const RAKAZO_GUEST_PATH = "/flux/rakazo/";
const ASK_AI_ENDPOINT = process.env.NEXT_PUBLIC_ASK_AI_ENDPOINT || "https://echoxr-ripoteam-cloud-pc.hf.space/api/flux/askai/chat";

/**
 * AskAI renders the actual Rakazo web client from https://github.com/elie222/rakazo.
 * The Pages workflow builds that source at a pinned commit with Rakazo's own
 * guest adapter and publishes it at /flux/rakazo/. Flux owns only this route
 * bridge; the workspace UI remains Rakazo's source UI.
 */
export default function RakazoOfficialApp() {
  const frameRef = useRef<HTMLIFrameElement | null>(null);
  const { user } = useAuth();

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

  useEffect(() => {
    void sendAuthBridge();
  }, [sendAuthBridge]);

  return (
    <main className="h-full w-full overflow-hidden bg-[#050506]">
      <iframe
        ref={frameRef}
        title="Rakazo"
        src={RAKAZO_GUEST_PATH}
        onLoad={() => void sendAuthBridge()}
        className="block h-full w-full border-0"
        allow="clipboard-read; clipboard-write; microphone; camera; display-capture; fullscreen"
      />
    </main>
  );
}
