"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, Loader2, RefreshCw, ShieldCheck, Square, Steam, TriangleAlert } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import {
  cancelRecRoomSteamRecovery,
  getRecRoomSteamRecovery,
  startRecRoomSteamRecovery,
  type RecRoomSteamRecoveryStatus,
} from "@/services/recroom-browser";

function cleanLog(value: string) {
  return value.replace(/\x1b\[[0-9;?]*[ -/]*[@-~]/g, "");
}

export default function RecRoomRecoveryPage() {
  const { user, profile, loading } = useAuth();
  const [status, setStatus] = useState<RecRoomSteamRecoveryStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const authorized = Boolean(user && profile?.isAdmin);
  const running = Boolean(status && !["idle", "ready", "failed", "cancelled"].includes(status.state || "idle"));

  const refresh = useCallback(async () => {
    if (!user || !profile?.isAdmin) return;
    try {
      const token = await user.getIdToken(true);
      setStatus(await getRecRoomSteamRecovery(token));
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not read Steam recovery status.");
    }
  }, [profile?.isAdmin, user]);

  useEffect(() => {
    if (!authorized) return;
    void refresh();
  }, [authorized, refresh]);

  useEffect(() => {
    if (!authorized || !running) return;
    const timer = window.setInterval(() => void refresh(), 1200);
    return () => window.clearInterval(timer);
  }, [authorized, refresh, running]);

  const start = async () => {
    if (!user || !profile?.isAdmin || busy) return;
    setBusy(true);
    setError("");
    try {
      const token = await user.getIdToken(true);
      setStatus(await startRecRoomSteamRecovery(token));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start Steam recovery.");
    } finally {
      setBusy(false);
    }
  };

  const cancel = async () => {
    if (!user || !profile?.isAdmin || busy) return;
    setBusy(true);
    try {
      const token = await user.getIdToken(true);
      setStatus(await cancelRecRoomSteamRecovery(token));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not cancel Steam recovery.");
    } finally {
      setBusy(false);
    }
  };

  const logs = useMemo(() => (status?.logs || []).map(cleanLog).join("\n"), [status?.logs]);

  if (loading) {
    return <main className="grid min-h-dvh place-items-center bg-[#05080d] text-white"><Loader2 className="h-8 w-8 animate-spin" /></main>;
  }

  if (!authorized) {
    return (
      <main className="min-h-dvh bg-[#05080d] px-5 py-8 text-white">
        <div className="mx-auto max-w-xl rounded-[28px] border border-white/10 bg-white/[.045] p-6">
          <ShieldCheck className="h-8 w-8 text-white/70" />
          <h1 className="mt-4 text-2xl font-black">RipoTeam admin only</h1>
          <p className="mt-2 text-sm leading-6 text-white/55">Steam recovery controls can only be opened by the Flux owner/admin account.</p>
          <Link href="/games/recroom" className="mt-6 inline-flex h-11 items-center gap-2 rounded-full bg-white px-5 text-sm font-black text-black"><ArrowLeft className="h-4 w-4" /> Back to Rec Room</Link>
        </div>
      </main>
    );
  }

  const ready = Boolean(status?.clientReady || status?.state === "ready");
  const progress = Math.max(0, Math.min(100, Number(status?.progress || 0)));

  return (
    <main className="min-h-dvh bg-[#05080d] text-white">
      <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6 sm:py-10">
        <div className="flex items-center gap-3">
          <Link href="/games/recroom" className="grid h-10 w-10 place-items-center rounded-full border border-white/10 bg-white/5" aria-label="Back to Rec Room"><ArrowLeft className="h-4 w-4" /></Link>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-black uppercase tracking-[.18em] text-white/40">RipoTeamServer · owner recovery</p>
            <h1 className="truncate text-xl font-black">Recover Rec Room · May 19, 2022</h1>
          </div>
          <button type="button" onClick={() => void refresh()} className="grid h-10 w-10 place-items-center rounded-full border border-white/10 bg-white/5" aria-label="Refresh recovery status"><RefreshCw className="h-4 w-4" /></button>
        </div>

        <section className="mt-6 overflow-hidden rounded-[30px] border border-white/10 bg-[#0a1019]">
          <div className="p-6 sm:p-8">
            <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
              <span className="rounded-full bg-white/8 px-3 py-1.5">App 471710</span>
              <span className="rounded-full bg-white/8 px-3 py-1.5">Depot 471711</span>
              <span className="rounded-full bg-white/8 px-3 py-1.5">Manifest 6337851004861751095</span>
            </div>

            <div className="mt-6 flex items-start gap-4">
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white/8"><Steam className="h-6 w-6" /></div>
              <div className="min-w-0 flex-1">
                <h2 className="text-xl font-black">Official Steam account recovery</h2>
                <p className="mt-2 text-sm leading-6 text-white/55">RipoTeamServer runs the official DepotDownloader flow on the server. Flux never asks for your Steam password. When Steam shows a QR code below, scan it with the Steam Mobile App and approve the sign-in. The recovered game stays on RipoTeamServer; Flux players still download nothing.</p>
              </div>
            </div>

            <div className="mt-7 rounded-2xl border border-white/8 bg-black/20 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[.14em] text-white/35">Status</p>
                  <p className="mt-1 text-sm font-black">{status?.phase || "Ready to start Steam recovery"}</p>
                </div>
                <span className="text-sm font-black text-white/60">{progress}%</span>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/8"><div className="h-full rounded-full bg-white transition-all" style={{ width: `${progress}%` }} /></div>
            </div>

            {error || status?.error ? (
              <div className="mt-4 flex gap-3 rounded-2xl border border-amber-300/15 bg-amber-300/8 p-4 text-amber-50"><TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" /><p className="text-sm leading-6">{error || status?.error}</p></div>
            ) : null}

            {ready ? (
              <div className="mt-4 flex gap-3 rounded-2xl border border-emerald-300/15 bg-emerald-300/8 p-4"><CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-300" /><div><p className="text-sm font-black">Server client is installed</p><p className="mt-1 text-xs leading-5 text-white/55">Return to Rec Room and press Play. The browser session can now attempt the native May 2022 launch.</p></div></div>
            ) : null}

            {status?.qrReady || logs ? (
              <div className="mt-5">
                <div className="mb-2 flex items-center justify-between gap-3"><p className="text-xs font-black uppercase tracking-[.14em] text-white/45">Steam QR / recovery console</p><span className="text-[10px] text-white/30">Do not share this screen</span></div>
                <pre className="max-h-[62dvh] overflow-auto rounded-2xl border border-white/10 bg-black p-3 font-mono text-[8px] leading-[8px] text-white sm:p-5 sm:text-[10px] sm:leading-[10px]">{logs || "Waiting for Steam QR…"}</pre>
              </div>
            ) : null}

            <div className="mt-6 flex flex-col gap-2 sm:flex-row">
              {!ready && !running ? (
                <button type="button" disabled={busy} onClick={() => void start()} className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-full bg-white px-6 text-sm font-black text-black disabled:opacity-50">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Steam className="h-4 w-4" />} Recover May 2022 from Steam</button>
              ) : null}
              {running ? (
                <button type="button" disabled={busy} onClick={() => void cancel()} className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-full border border-white/12 bg-white/5 px-6 text-sm font-black disabled:opacity-50">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Square className="h-4 w-4" />} Cancel recovery</button>
              ) : null}
              {ready ? <Link href="/games/recroom" className="inline-flex h-12 flex-1 items-center justify-center rounded-full bg-white px-6 text-sm font-black text-black">Back to Rec Room</Link> : null}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
