"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  CheckCircle2,
  Gamepad2,
  Link2,
  Loader2,
  Unlink,
} from "lucide-react";
import { toast } from "sonner";
import { XCard } from "@/components/x/x-ui";
import {
  clearStoredFluxToken,
  exchangePairingCode,
  getFluxRecApiBase,
  getFluxSocialMe,
  readStoredFluxToken,
  storeFluxToken,
  unlinkFluxSocial,
  updateFluxSocialPrivacy,
  type FluxSocialLinkedAccount,
  type FluxSocialPrivacy,
  FluxPairingError,
} from "@/services/fluxrec-pairing";

const CODE_RE = /^\d{6}$/;

const PRIVACY_LABELS: Array<{ key: keyof FluxSocialPrivacy; label: string; hint: string }> = [
  { key: "showProfile", label: "Profile", hint: "Show your linked game profile" },
  { key: "showRooms", label: "Rooms", hint: "Show your public rooms" },
  { key: "showPhotos", label: "Photos", hint: "Show your public photos" },
  { key: "showInventions", label: "Inventions", hint: "Show your inventions" },
];

function errorMessage(err: unknown): string {
  if (err instanceof FluxPairingError) return err.message;
  return "Something went wrong. Try again in a bit.";
}

/**
 * Links a Flux account to a Flux Rec game account via the 6-digit pairing code
 * the player generates inside the game (Settings → Connect Flux account).
 * Real backend flow: POST /fluxsocial/exchange → opaque website session token,
 * validated on load via GET /fluxsocial/me, revocable via POST /fluxsocial/unlink.
 */
export function FluxRecLinkCard() {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(true);
  const [account, setAccount] = useState<FluxSocialLinkedAccount | null>(null);
  const [privacy, setPrivacy] = useState<FluxSocialPrivacy | null>(null);
  const [privacyBusy, setPrivacyBusy] = useState<keyof FluxSocialPrivacy | null>(null);
  const [formError, setFormError] = useState("");
  const [configured] = useState(() => getFluxRecApiBase() !== null);
  const cardRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Validate any stored session on load.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const token = readStoredFluxToken();
      if (!token) {
        setChecking(false);
        return;
      }
      try {
        const me = await getFluxSocialMe(token);
        if (cancelled) return;
        setAccount(me);
        setPrivacy(me.privacy);
      } catch (err) {
        if (cancelled) return;
        // 401 = revoked/expired → drop back to the "link again" state.
        if (err instanceof FluxPairingError && err.code === "unauthorized") {
          clearStoredFluxToken();
          setAccount(null);
          setPrivacy(null);
        }
        // not_configured / network: keep the token stored, show "retry later"
        // rather than silently unlinking a session that may still be valid.
      } finally {
        if (!cancelled) setChecking(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.location.search.includes("link=fluxrec")) {
      window.setTimeout(() => {
        cardRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
        inputRef.current?.focus({ preventScroll: true });
      }, 350);
    }
  }, []);

  const connect = async () => {
    const clean = code.trim();
    if (!CODE_RE.test(clean)) {
      setFormError("Enter the 6-digit code shown in the game.");
      toast.error("Enter the code shown in the game", {
        description: "In Flux Rec: Settings → Connect Flux account.",
      });
      return;
    }
    setFormError("");
    setBusy(true);
    try {
      const result = await exchangePairingCode(clean);
      storeFluxToken(result.token);
      const me = await getFluxSocialMe(result.token);
      setAccount(me);
      setPrivacy(me.privacy);
      setCode("");
      toast.success("Flux Rec account linked", {
        description: `@${me.username} — your game photos and rooms will sync to Flux.`,
      });
    } catch (err) {
      const msg = errorMessage(err);
      setFormError(msg);
      toast.error("Couldn't link your account", { description: msg });
    } finally {
      setBusy(false);
    }
  };

  const disconnect = async () => {
    const token = readStoredFluxToken();
    setBusy(true);
    try {
      if (token) await unlinkFluxSocial(token);
    } catch {
      // Unlink is idempotent — even if the call fails, drop the local session.
    } finally {
      clearStoredFluxToken();
      setAccount(null);
      setPrivacy(null);
      setBusy(false);
      toast.success("Flux Rec account unlinked");
    }
  };

  const togglePrivacy = useCallback(
    async (key: keyof FluxSocialPrivacy) => {
      const token = readStoredFluxToken();
      if (!token || privacyBusy) return;
      setPrivacyBusy(key);
      const next = { ...((privacy ?? { showProfile: true, showRooms: true, showPhotos: true, showInventions: true })), [key]: !(privacy?.[key] ?? true) };
      // Optimistic update.
      setPrivacy(next);
      try {
        const saved = await updateFluxSocialPrivacy(token, { [key]: next[key] });
        setPrivacy(saved);
      } catch (err) {
        // Roll back on failure.
        setPrivacy(privacy);
        toast.error("Couldn't update visibility", { description: errorMessage(err) });
      } finally {
        setPrivacyBusy(null);
      }
    },
    [privacy, privacyBusy]
  );

  const linked = account !== null;

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

        {checking ? (
          <div className="mt-3 flex items-center gap-2 text-[13px] text-[var(--v8-muted)]">
            <Loader2 className="h-4 w-4 animate-spin" /> Checking link status…
          </div>
        ) : !configured && !linked ? (
          <div className="mt-3">
            <p className="text-[13px] leading-5 text-[var(--v8-muted)]">
              Account linking ships with the backend update — come back soon.
            </p>
          </div>
        ) : linked && account ? (
          <div className="mt-3">
            <p className="text-[13px] text-[var(--v8-muted)]">
              Connected as <strong className="text-foreground">{account.displayName}</strong>{" "}
              <span className="font-mono">@{account.username}</span>. Public photos appear
              on your profile and the Flux Rec page.
            </p>

            {privacy ? (
              <div className="fluxrec-privacy-wrap">
                <p className="fluxrec-privacy-title">What Flux Social shows</p>
                {PRIVACY_LABELS.map(({ key, label, hint }) => {
                  const on = privacy[key];
                  const toggling = privacyBusy === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      role="switch"
                      aria-checked={on}
                      aria-label={label}
                      disabled={toggling}
                      onClick={() => void togglePrivacy(key)}
                      className="fluxrec-privacy-row"
                    >
                      <span className="fluxrec-privacy-text">
                        <span className="fluxrec-privacy-label">{label}</span>
                        <span className="fluxrec-privacy-hint">{hint}</span>
                      </span>
                      <span className={`fluxrec-switch${on ? " is-on" : ""}`} aria-hidden="true">
                        {toggling ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : null}
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : null}

            <button
              type="button"
              onClick={() => void disconnect()}
              disabled={busy}
              className="fluxrec-unlink-btn"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Unlink className="h-4 w-4" />}
              {busy ? "Unlinking…" : "Unlink account"}
            </button>
          </div>
        ) : (
          <div className="mt-3">
            <p className="text-[13px] leading-5 text-[var(--v8-muted)]">
              Open Flux Rec on your device, go to <strong className="text-foreground">Settings → Connect Flux account</strong>,
              then enter the 6-digit code it shows here.
            </p>
            <div className="fluxrec-code-row">
              <input
                ref={inputRef}
                value={code}
                onChange={(e) => {
                  setCode(e.target.value.replace(/\D/g, "").slice(0, 6));
                  if (formError) setFormError("");
                }}
                onKeyDown={(e) => { if (e.key === "Enter") void connect(); }}
                placeholder="123456"
                inputMode="numeric"
                autoComplete="one-time-code"
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
            {formError ? (
              <p className="mt-2 text-[13px] font-semibold text-[var(--v8-red)]">{formError}</p>
            ) : null}
          </div>
        )}
      </XCard>
    </div>
  );
}
