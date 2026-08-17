"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  FileArchive,
  Fingerprint,
  HardDriveDownload,
  Loader2,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import {
  getRecRoomClientInstall,
  startRecRoomClientInstall,
  type RecRoomClientInstallStatus,
} from "@/services/recroom-browser";

const TARGET_BUILD = "8751857";
const TARGET_MANIFEST = "6337851004861751095";
const TARGET_FINGERPRINT = "aa367ee11821b6abcbf9bd81cda393f4a872e74af5ba13ca843a0031948c32cf";

function bytes(value?: number) {
  if (!value || value <= 0) return "";
  const units = ["B", "KB", "MB", "GB"];
  let amount = value;
  let unit = 0;
  while (amount >= 1024 && unit < units.length - 1) {
    amount /= 1024;
    unit += 1;
  }
  return `${amount.toFixed(unit >= 3 ? 2 : 1)} ${units[unit]}`;
}

export default function RecRoomRecoveryPage() {
  const { user, profile, loading } = useAuth();
  const [url, setUrl] = useState("");
  const [archiveSha, setArchiveSha] = useState("");
  const [status, setStatus] = useState<RecRoomClientInstallStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const authorized = Boolean(user && profile?.isAdmin);
  const running = Boolean(status?.jobId && !["ready", "failed"].includes(status.state || ""));
  const ready = Boolean(status?.state === "ready" && status?.installed && status?.exactBuild);
  const progress = Math.max(0, Math.min(100, Number(status?.progress || 0)));

  useEffect(() => {
    if (!authorized || !user || !status?.jobId || !running) return;
    let stopped = false;
    const poll = async () => {
      try {
        const token = await user.getIdToken(true);
        const next = await getRecRoomClientInstall(token, status.jobId!);
        if (!stopped) {
          setStatus(next);
          if (next.state === "failed") setError(next.error || "The client install failed.");
        }
      } catch (e) {
        if (!stopped) setError(e instanceof Error ? e.message : "Could not read install status.");
      }
    };
    void poll();
    const timer = window.setInterval(() => void poll(), 1200);
    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, [authorized, running, status?.jobId, user]);

  const start = async () => {
    if (!authorized || !user || busy) return;
    const source = url.trim();
    if (!source) {
      setError("Paste the HTTPS URL of the authorized May 19, 2022 client ZIP.");
      return;
    }
    if (!/^https:\/\//i.test(source)) {
      setError("The client archive URL must use HTTPS.");
      return;
    }
    const digest = archiveSha.trim().toLowerCase();
    if (digest && !/^[a-f0-9]{64}$/.test(digest)) {
      setError("Archive SHA-256 must contain exactly 64 hexadecimal characters.");
      return;
    }

    setBusy(true);
    setError("");
    setStatus(null);
    try {
      const token = await user.getIdToken(true);
      setStatus(await startRecRoomClientInstall(token, source, digest || undefined));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start the server client install.");
    } finally {
      setBusy(false);
    }
  };

  const detail = useMemo(() => {
    if (!status) return "Waiting for an authorized client archive.";
    if (status.state === "queued") return "Queued on RipoTeamServer.";
    if (status.state === "downloading") {
      const downloaded = bytes(status.downloadedBytes);
      const total = bytes(status.totalBytes);
      return downloaded && total ? `Downloading ${downloaded} of ${total}.` : "Downloading the client archive to RipoTeamServer.";
    }
    if (status.state === "extracting") return "Extracting the archive inside the server staging area.";
    if (status.state === "validating") return `Checking exact build ${TARGET_BUILD} binary hashes.`;
    if (status.state === "installing") return "Installing the verified client into the Wine runtime.";
    if (status.state === "ready") return "Exact May 19, 2022 client installed and accepted by RipoTeamServer.";
    if (status.state === "failed") return status.error || "Install failed.";
    return status.state || "Working…";
  }, [status]);

  if (loading) {
    return <main className="grid min-h-dvh place-items-center bg-[#05080d] text-white"><Loader2 className="h-8 w-8 animate-spin" /></main>;
  }

  if (!authorized) {
    return (
      <main className="min-h-dvh bg-[#05080d] px-5 py-8 text-white">
        <div className="mx-auto max-w-xl rounded-[28px] border border-white/10 bg-white/[.045] p-6">
          <ShieldCheck className="h-8 w-8 text-white/70" />
          <h1 className="mt-4 text-2xl font-black">RipoTeam admin only</h1>
          <p className="mt-2 text-sm leading-6 text-white/55">Only the Flux owner/admin account can install the server-side Rec Room client.</p>
          <Link href="/games/recroom" className="mt-6 inline-flex h-11 items-center gap-2 rounded-full bg-white px-5 text-sm font-black text-black"><ArrowLeft className="h-4 w-4" /> Back to Rec Room</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-dvh bg-[#05080d] text-white">
      <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6 sm:py-10">
        <div className="flex items-center gap-3">
          <Link href="/games/recroom" className="grid h-10 w-10 place-items-center rounded-full border border-white/10 bg-white/5" aria-label="Back to Rec Room"><ArrowLeft className="h-4 w-4" /></Link>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-black uppercase tracking-[.18em] text-white/40">RipoTeamServer · exact client installer</p>
            <h1 className="truncate text-xl font-black">Install Rec Room · May 19, 2022</h1>
          </div>
        </div>

        <section className="mt-6 overflow-hidden rounded-[30px] border border-white/10 bg-[#0a1019]">
          <div className="p-6 sm:p-8">
            <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
              <span className="rounded-full bg-white/8 px-3 py-1.5">Build {TARGET_BUILD}</span>
              <span className="rounded-full bg-white/8 px-3 py-1.5">Manifest {TARGET_MANIFEST}</span>
              <span className="rounded-full bg-white/8 px-3 py-1.5">3,693 files · 6,790,009,298 bytes</span>
            </div>

            <div className="mt-6 flex items-start gap-4">
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white/8"><Fingerprint className="h-6 w-6" /></div>
              <div className="min-w-0 flex-1">
                <h2 className="text-xl font-black">Exact-build verification</h2>
                <p className="mt-2 text-sm leading-6 text-white/55">RipoTeamServer no longer trusts a folder name or downloader marker. It checks the pinned SHA-256 fingerprints of RecRoom.exe, Recroom_Release.exe, GameAssembly.dll, UnityPlayer.dll and global-metadata.dat before installing anything.</p>
                <p className="mt-2 break-all font-mono text-[10px] text-white/30">Fingerprint {TARGET_FINGERPRINT}</p>
              </div>
            </div>

            {!ready ? (
              <div className="mt-7 space-y-4 rounded-2xl border border-white/8 bg-black/20 p-4 sm:p-5">
                <div>
                  <label htmlFor="recroom-client-url" className="text-xs font-black text-white/70">Authorized client ZIP URL</label>
                  <div className="mt-2 flex items-center rounded-xl border border-white/10 bg-white/5 px-3 focus-within:border-white/25">
                    <FileArchive className="h-4 w-4 shrink-0 text-white/35" />
                    <input id="recroom-client-url" value={url} onChange={(event) => setUrl(event.target.value)} disabled={running || busy} placeholder="https://…/recroom-may-19-2022.zip" className="h-12 min-w-0 flex-1 bg-transparent px-3 text-sm text-white outline-none placeholder:text-white/25 disabled:opacity-50" />
                  </div>
                  <p className="mt-2 text-[11px] leading-5 text-white/35">Use a client archive you are authorized to access. The ZIP goes to RipoTeamServer; normal Flux players download nothing.</p>
                </div>
                <div>
                  <label htmlFor="recroom-archive-sha" className="text-xs font-black text-white/70">Archive SHA-256 <span className="font-medium text-white/30">(optional)</span></label>
                  <input id="recroom-archive-sha" value={archiveSha} onChange={(event) => setArchiveSha(event.target.value.replace(/[^a-fA-F0-9]/g, "").slice(0, 64))} disabled={running || busy} placeholder="64-character archive digest" className="mt-2 h-12 w-full rounded-xl border border-white/10 bg-white/5 px-3 font-mono text-xs text-white outline-none placeholder:text-white/25 focus:border-white/25 disabled:opacity-50" />
                </div>
                {!running ? (
                  <button type="button" disabled={busy} onClick={() => void start()} className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-white px-6 text-sm font-black text-black disabled:opacity-50">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <HardDriveDownload className="h-4 w-4" />} Verify & install exact May 2022 client</button>
                ) : null}
              </div>
            ) : null}

            {status ? (
              <div className="mt-5 rounded-2xl border border-white/8 bg-black/20 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[.14em] text-white/35">Server install status</p>
                    <p className="mt-1 text-sm font-black capitalize">{status.state || "working"}</p>
                  </div>
                  <span className="text-sm font-black text-white/60">{progress}%</span>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/8"><div className="h-full rounded-full bg-white transition-all" style={{ width: `${progress}%` }} /></div>
                <p className="mt-3 text-xs leading-5 text-white/45">{detail}</p>
              </div>
            ) : null}

            {error || status?.error ? (
              <div className="mt-4 flex gap-3 rounded-2xl border border-amber-300/15 bg-amber-300/8 p-4 text-amber-50"><TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" /><p className="text-sm leading-6">{error || status?.error}</p></div>
            ) : null}

            {ready ? (
              <div className="mt-5 rounded-2xl border border-emerald-300/15 bg-emerald-300/8 p-5">
                <div className="flex gap-3"><CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-300" /><div><p className="text-sm font-black">Exact build {TARGET_BUILD} installed</p><p className="mt-1 text-xs leading-5 text-white/55">RipoTeamServer accepted the pinned binary fingerprint. Return to Rec Room and press Play to attempt the native client launch.</p></div></div>
                <Link href="/games/recroom" className="mt-5 inline-flex h-12 w-full items-center justify-center rounded-full bg-white px-6 text-sm font-black text-black">Back to Rec Room · Play</Link>
              </div>
            ) : null}
          </div>
        </section>
      </div>
    </main>
  );
}
