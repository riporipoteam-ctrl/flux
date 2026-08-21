"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { CheckCircle2, Loader2, ShieldCheck, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/auth-context";
import { claimRecRoomPairing, getRecRoomPairing, type RecRoomPairing } from "@/services/recroom-revival";

export default function RecRoomLinkPage() {
  const params = useSearchParams();
  const code = params.get("code") || "";
  const { user, loading: authLoading } = useAuth();
  const [pairing, setPairing] = useState<RecRoomPairing | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<RecRoomPairing | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!code) {
      setError("No Rec Room pairing code was supplied.");
      return;
    }
    void getRecRoomPairing(code)
      .then((next) => {
        if (!next) throw new Error("This Rec Room pairing code is invalid or expired.");
        setPairing(next);
      })
      .catch((reason) => setError(reason instanceof Error ? reason.message : "Could not load this pairing link."));
  }, [code]);

  const claim = async () => {
    if (!user || !code || busy) return;
    setBusy(true);
    setError("");
    try {
      const next = await claimRecRoomPairing(user, code);
      setResult(next);
      toast.success("Rec Room revival account linked");
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
            {error ? (
              <div className="rounded-2xl border border-amber-300/15 bg-amber-300/8 p-4 text-sm text-amber-50">{error}</div>
            ) : result ? (
              <div className="rounded-2xl border border-emerald-300/15 bg-emerald-300/8 p-5">
                <CheckCircle2 className="h-7 w-7 text-emerald-200" />
                <p className="mt-3 text-lg font-black">Device linked successfully.</p>
                <p className="mt-2 text-sm leading-6 text-emerald-50/65">This Flux account can now reuse its persistent Rec Room revival identity on future launches.</p>
                <Link href="/games/recroom" className="mt-5 inline-flex h-11 items-center justify-center rounded-full bg-white px-5 text-sm font-black text-black">Open Rec Room</Link>
              </div>
            ) : authLoading || !pairing ? (
              <div className="flex items-center justify-center gap-3 py-10 text-sm font-bold text-white/55"><Loader2 className="h-5 w-5 animate-spin" /> Checking pairing…</div>
            ) : !user ? (
              <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
                <Smartphone className="h-6 w-6 text-white/70" />
                <p className="mt-3 text-base font-black">Sign in to Flux first</p>
                <p className="mt-2 text-sm leading-6 text-white/45">After signing in, open this link again to finish the one-time device pairing.</p>
                <Link href={`/login?next=${encodeURIComponent(`/games/recroom/link?code=${code}`)}`} className="mt-5 inline-flex h-11 items-center justify-center rounded-full bg-white px-5 text-sm font-black text-black">Sign in to Flux</Link>
              </div>
            ) : (
              <>
                <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
                  <p className="text-[10px] font-black uppercase tracking-[.16em] text-white/30">Pairing code</p>
                  <p className="mt-2 text-3xl font-black tracking-[.12em]">{pairing.code}</p>
                  <p className="mt-2 text-xs text-white/40">This code expires soon and can only be used once.</p>
                </div>
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
