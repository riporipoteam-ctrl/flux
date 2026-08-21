"use client";

import { useEffect, useState } from "react";
import { Check, Copy, Link2, Loader2, QrCode, RefreshCw, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/auth-context";
import {
  createRecRoomPairing,
  ensureRecRoomRevivalIdentity,
  recRoomPairingUrl,
  recRoomQrUrl,
  type RecRoomPairing,
  type RecRoomRevivalIdentity,
} from "@/services/recroom-revival";

export function RecRoomRevivalAccount() {
  const { user, profile } = useAuth();
  const [identity, setIdentity] = useState<RecRoomRevivalIdentity | null>(null);
  const [pairing, setPairing] = useState<RecRoomPairing | null>(null);
  const [loading, setLoading] = useState(true);
  const [pairingLoading, setPairingLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!user) {
      setIdentity(null);
      setLoading(false);
      return;
    }
    void ensureRecRoomRevivalIdentity(user)
      .then((next) => {
        if (!cancelled) setIdentity(next);
      })
      .catch((error) => {
        if (!cancelled) toast.error(error instanceof Error ? error.message : "Could not initialize your Rec Room revival account.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  if (!user) return null;

  const newPairing = async () => {
    if (pairingLoading) return;
    setPairingLoading(true);
    try {
      setPairing(await createRecRoomPairing(user));
      toast.success("Rec Room device link created");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not create the Rec Room device link.");
    } finally {
      setPairingLoading(false);
    }
  };

  const copyLink = async () => {
    if (!pairing) return;
    await navigator.clipboard.writeText(recRoomPairingUrl(window.location.origin, pairing.code));
    toast.success("Pairing link copied");
  };

  const displayName = profile?.displayName || profile?.username || "Flux player";

  return (
    <section className="mt-4 overflow-hidden rounded-[26px] border border-emerald-300/12 bg-emerald-300/[0.045] shadow-xl">
      <div className="flex flex-col gap-4 p-5 sm:p-6 lg:flex-row lg:items-center">
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-emerald-300/10 text-emerald-200">
          <ShieldCheck className="h-6 w-6" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-black text-white">RipoTeam Rec Room Revival account</p>
            {identity?.linked ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-300/10 px-2 py-1 text-[10px] font-black text-emerald-200"><Check className="h-3 w-3" /> Linked</span>
            ) : null}
          </div>
          {loading ? (
            <p className="mt-1 text-xs text-white/45">Preparing your persistent revival identity…</p>
          ) : (
            <p className="mt-1 break-all text-xs text-white/45">Signed in as {displayName} · {identity?.revivalUserId || "initializing"}</p>
          )}
          <p className="mt-2 max-w-3xl text-xs leading-5 text-white/48">Flux keeps this revival identity separate from Steam credentials. Use a one-time QR/link to pair another Flux device; normal Rec Room launches reuse this account automatically.</p>
        </div>
        <button type="button" onClick={() => void newPairing()} disabled={pairingLoading || loading} className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-full bg-white px-5 text-xs font-black text-black disabled:cursor-wait disabled:opacity-50">
          {pairingLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <QrCode className="h-4 w-4" />}
          {pairing ? "New device link" : "Link device"}
        </button>
      </div>

      {pairing ? (
        <div className="grid gap-5 border-t border-white/8 bg-black/15 p-5 sm:p-6 md:grid-cols-[220px_1fr] md:items-center">
          <div className="mx-auto w-full max-w-[220px] rounded-3xl bg-white p-3 shadow-xl">
            <img src={recRoomQrUrl(window.location.origin, pairing.code)} alt="Rec Room revival device-link QR code" className="aspect-square w-full rounded-2xl" />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[.16em] text-white/35">Scan on another device</p>
            <p className="mt-1 text-2xl font-black tracking-tight text-white">{pairing.code}</p>
            <p className="mt-2 text-xs leading-5 text-white/45">The code expires in about 10 minutes and is single-use. The QR opens Flux directly on the Rec Room pairing page.</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" onClick={() => void copyLink()} className="inline-flex h-9 items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 text-xs font-bold text-white hover:bg-white/10"><Copy className="h-3.5 w-3.5" /> Copy link</button>
              <button type="button" onClick={() => setPairing(null)} className="inline-flex h-9 items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 text-xs font-bold text-white/60 hover:bg-white/10 hover:text-white"><RefreshCw className="h-3.5 w-3.5" /> Hide</button>
            </div>
            <div className="mt-4 flex items-center gap-2 text-[11px] text-white/32"><Link2 className="h-3.5 w-3.5" /> No Steam password is stored or transferred by this link.</div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
