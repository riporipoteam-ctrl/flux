"use client";

import Link from "next/link";
import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, Loader2, ShieldCheck, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/auth-context";
import { claimRecRoomPairing, type RecRoomPairing } from "@/services/recroom-revival";

export default function RecRoomLinkPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-dvh bg-[#05080d] px-4 py-8 text-white sm:px-6">
          <div className="mx-auto flex min-h-[80dvh] max-w-xl items-center justify-center">
            <div className="flex items-center gap-3 rounded-3xl border border-white/10 bg-[#0a1019] px-6 py-5 text-sm font-bold text-white/60 shadow-2xl">
              <Loader2 className="h-5 w-5 animate-spin" /> Loading device link…
            </div>
          </div>
        </main>
      }
    >
      <RecRoomLinkContent />
    </Suspense>
  );
}

function RecRoomLinkContent() {
  const params = useSearchParams();
  const code = params.get("code") || "";
  const ownerUid = params.get("owner") || "";
  const ownerRevivalUserId = params.get("revival") || "";
  const { user, loading: authLoading } = useAuth();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<RecRoomPairing | null>(null);
  const [error, setError] = useState("");

  const pairing = useMemo<RecRoomPairing | null>(() => {
    if (!code || !ownerUid || !ownerRevivalUserId) return null;
    const now = Date.now();
    return {
      code: code.toUpperCase(),
      ownerUid,
      ownerRevivalUserId,
      createdAtMs: now,
      expiresAtMs: now + 10 * 60_000,
      status: "open",
    };
  }, [code, ownerUid, ownerRevivalUserId]);

  const claim = async () => {
    if (!user || !pairing || busy) return;
    setBusy(true);
    setError("");
    try {
      const next = await claimRecRoomPairing(user, pairing.ownerUid, pairing.ownerRevivalUserId, pairing.code);
      setResult(next);
      toast.success("Rec Room revival identity linked");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not link the Rec Room revival account.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="min-h-dvh bg-[#05080d] px-4 py-8 text-white sm:px-6">
      <div className="mx-auto flex min-h-[80dvh] max-w-xl items-center justify-center">
        <section className="w-full overflow-hidden rounded-[30px] border border-white/10 bg-[#0a1019] shadow-2xl">
          <div className="border-b border-white/8 p-6 sm:p-8">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-emerald-300/10 text-emerald-200"><ShieldCheck className="h-6 w-6" /></div>
            <p className="mt-5 text-[10px] font-black uppercase tracking-[.18em] text-white/35">RipoTeam Rec Room Revival</p>
            <h1 className="mt-2 text-3xl font-black tracking-tight">Link this device</h1>
            <p className="mt-3 text-sm leading-6 text-white/55">You scanned a Flux Rec Room device link. Sign into the Flux account you want to use for the revival and confirm the pairing.</p>
          </div>

          <div className="p-6 sm:p-8">
            {!pairing ? (
              <div className="rounded-2xl border border-amber-300/15 bg-amber-300/8 p-4 text-sm text-amber-50">This Rec Room device link is incomplete or invalid.</div>
            ) : result ? (
              <div className="rounded-2xl border border-emerald-300/15 bg-emerald-300/8 p-5">
                <CheckCircle2 className="h-7 w-7 text-emerald-200" />
                <p className="mt-3 text-lg font-black">Device linked successfully.</p>
                <p className="mt-2 text-sm leading-6 text-emerald-50/65">This Flux account now has a persistent Rec Room revival identity and the browser can reuse it on future launches.</p>
                <Link href="/games/recroom" className="mt-5 inline-flex h-11 items-center justify-center rounded-full bg-white px-5 text-sm font-black text-black">Open Rec Room</Link>
              </div>
            ) : authLoading ? (
              <div className="flex items-center justify-center gap-3 py-10 text-sm font-bold text-white/55"><Loader2 className="h-5 w-5 animate-spin" /> Checking Flux session…</div>
            ) : !user ? (
              <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
                <Smartphone className="h-6 w-6 text-white/70" />
                <p className="mt-3 text-base font-black">Sign in to Flux first</p>
                <p className="mt-2 text-sm leading-6 text-white/45">After signing in, open this link again to finish the one-time device pairing.</p>
                <Link href={`/login?next=${encodeURIComponent(`/games/recroom/link?code=${encodeURIComponent(code)}&owner=${encodeURIComponent(ownerUid)}&revival=${encodeURIComponent(ownerRevivalUserId)}`)}`} className="mt-5 inline-flex h-11 items-center justify-center rounded-full bg-white px-5 text-sm font-black text-black">Sign in to Flux</Link>
              </div>
            ) : (
              <>
                <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
                  <p className="text-[10px] font-black uppercase tracking-[.16em] text-white/30">Pairing code</p>
                  <p className="mt-2 text-3xl font-black tracking-[.12em]">{pairing.code}</p>
                  <p className="mt-2 text-xs text-white/40">This is a device link for the Flux-backed Rec Room revival identity.</p>
                </div>
                {error ? <div className="mt-4 rounded-2xl border border-amber-300/15 bg-amber-300/8 p-4 text-sm text-amber-50">{error}</div> : null}
                <button type="button" onClick={() => void claim()} disabled={busy} className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-white px-5 text-sm font-black text-black disabled:cursor-wait disabled:opacity-55">
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                  {busy ? "Linking…" : "Link Rec Room to this Flux account"}
                </button>
              </>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
