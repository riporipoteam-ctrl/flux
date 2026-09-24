"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Gamepad2, Link2, Loader2, Unlink } from "lucide-react";
import { toast } from "sonner";
import { XCard } from "@/components/x/x-ui";

const STORAGE_KEY = "fluxrec.linked";
const CODE_RE = /^[A-Za-z0-9]{4,12}$/;

/**
 * Links a Flux account to a Flux Rec game account via the pairing code the
 * player generates inside the game (Settings → Connect Flux account).
 * UI only for now — the in-game code generation ships separately.
 */
export function FluxRecLinkCard() {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [linked, setLinked] = useState<string | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) setLinked(saved);
    } catch {
      /* storage unavailable */
    }
    if (window.location.search.includes("link=fluxrec")) {
      window.setTimeout(() => {
        cardRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
        inputRef.current?.focus({ preventScroll: true });
      }, 350);
    }
  }, []);

  const connect = async () => {
    const clean = code.trim().toUpperCase();
    if (!CODE_RE.test(clean)) {
      toast.error("Enter the code shown in the game", {
        description: "In Flux Rec: Settings → Connect Flux account.",
      });
      return;
    }
    setBusy(true);
    // Simulated verification round-trip; real verification ships with the game update.
    await new Promise((r) => setTimeout(r, 900));
    setBusy(false);
    try {
      window.localStorage.setItem(STORAGE_KEY, clean);
    } catch {
      /* storage unavailable */
    }
    setLinked(clean);
    setCode("");
    toast.success("Flux Rec account linked", {
      description: "Your game photos and rooms will sync to Flux.",
    });
  };

  const disconnect = () => {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* storage unavailable */
    }
    setLinked(null);
    toast.success("Flux Rec account unlinked");
  };

  return (
    <div className="p-4 pt-0" ref={cardRef} id="fluxrec-link">
      <XCard className="fluxrec-link-card p-4">
        <div className="flex items-center gap-3">
          <span className="fluxrec-link-icon">
            <Gamepad2 className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-bold">Flux Rec account</p>
            <p className="text-[13px] text-[var(--v8-muted)]">
              Link your game account to sync rooms, inventions and photos.
            </p>
          </div>
          {linked ? (
            <span className="fluxrec-linked-badge">
              <CheckCircle2 className="h-3.5 w-3.5" /> Linked
            </span>
          ) : null}
        </div>

        {linked ? (
          <div className="mt-3">
            <p className="text-[13px] text-[var(--v8-muted)]">
              Connected with code <strong className="font-mono text-foreground">{linked}</strong>.
              Public photos appear on your profile and the Flux Rec page.
            </p>
            <button
              type="button"
              onClick={disconnect}
              className="fluxrec-unlink-btn"
            >
              <Unlink className="h-4 w-4" /> Unlink account
            </button>
          </div>
        ) : (
          <div className="mt-3">
            <p className="text-[13px] leading-5 text-[var(--v8-muted)]">
              Open Flux Rec on your device, go to <strong className="text-foreground">Settings → Connect Flux account</strong>,
              then enter the code it shows here.
            </p>
            <div className="fluxrec-code-row">
              <input
                ref={inputRef}
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12))}
                onKeyDown={(e) => { if (e.key === "Enter") void connect(); }}
                placeholder="ABC123"
                inputMode="text"
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                aria-label="Flux Rec pairing code"
                className="fluxrec-code-input"
              />
              <button
                type="button"
                onClick={() => void connect()}
                disabled={busy}
                className="fluxrec-connect-btn-sm"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
                {busy ? "Linking…" : "Link"}
              </button>
            </div>
          </div>
        )}
      </XCard>
    </div>
  );
}
