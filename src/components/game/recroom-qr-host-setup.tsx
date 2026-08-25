"use client";

import { useMemo, useState } from "react";
import { Copy, KeyRound, Loader2, QrCode, ShieldCheck, X } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/auth-context";
import { createRecRoomHostPairing } from "@/services/recroom-browser";

const INSTALLER_URL = "https://raw.githubusercontent.com/riporipoteam-ctrl/ripoteamserver/main/windows-live-agent/install-recroom-host.ps1";

export function RecRoomQrHostSetup() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [code, setCode] = useState("");
  const [expiresAtMs, setExpiresAtMs] = useState(0);

  const pairUrl = useMemo(() => {
    if (!code || typeof window === "undefined") return "";
    return `${window.location.origin}/games/recroom/host-pair?code=${encodeURIComponent(code)}`;
  }, [code]);

  const qrUrl = useMemo(() => {
    if (!pairUrl) return "";
    return `https://api.qrserver.com/v1/create-qr-code/?size=260x260&margin=10&data=${encodeURIComponent(pairUrl)}`;
  }, [pairUrl]);

  const installCommand = code
    ? `powershell -ExecutionPolicy Bypass -Command "$p=$env:TEMP+'\\install-recroom-host.ps1'; irm '${INSTALLER_URL}' -OutFile $p; & $p -PairingCode '${code}' -TrySteamDownload -Start"`
    : "";

  const makeCode = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const token = await user.getIdToken(true);
      const result = await createRecRoomHostPairing(token);
      if (!result.pairingCode) throw new Error(result.error || result.detail || "Flux did not return a pairing code.");
      setCode(result.pairingCode);
      setExpiresAtMs(result.expiresAtMs || 0);
      toast.success("Secure Rec Room host code created");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not create the Rec Room host code.");
    } finally {
      setLoading(false);
    }
  };

  const copy = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label} copied`);
    } catch {
      toast.error(`Could not copy ${label.toLowerCase()}.`);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] left-4 z-[260] inline-flex h-11 items-center gap-2 rounded-full border border-white/15 bg-black/85 px-4 text-xs font-black text-white shadow-2xl backdrop-blur-xl transition hover:-translate-y-0.5 hover:bg-black sm:left-5"
      >
        <QrCode className="h-4 w-4" />
        Set up host
      </button>

      {open ? (
        <div className="fixed inset-0 z-[300] flex items-end justify-center bg-black/75 p-3 backdrop-blur-md sm:items-center sm:p-6">
          <section className="max-h-[92dvh] w-full max-w-3xl overflow-auto rounded-[30px] border border-white/12 bg-[#091018] p-5 text-white shadow-2xl sm:p-7">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[.16em] text-white/35">Flux Rec Room host</p>
                <h2 className="mt-1 text-2xl font-black tracking-[-.04em]">Steam on the host. Flux sessions for players.</h2>
                <p className="mt-2 max-w-2xl text-xs leading-5 text-white/50">
                  Sign into Steam only on the Windows host PC when the legacy client needs it. Players never receive your Steam password or Steam cookies; they get separate Flux game sessions.
                </p>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="grid h-9 w-9 place-items-center rounded-full bg-white/7 text-white/60 hover:bg-white/12 hover:text-white" aria-label="Close Rec Room host setup">
                <X className="h-4 w-4" />
              </button>
            </div>

            {!code ? (
              <button type="button" onClick={() => void makeCode()} disabled={loading || !user} className="mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-white px-5 text-sm font-black text-black disabled:cursor-wait disabled:opacity-55">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
                {loading ? "Creating secure host code…" : "Create one-time host pairing QR"}
              </button>
            ) : (
              <div className="mt-6 grid gap-5 lg:grid-cols-[280px_1fr]">
                <div className="rounded-[26px] border border-white/10 bg-white p-4 shadow-2xl">
                  <img src={qrUrl} alt="One-time Flux Rec Room host pairing QR code" className="mx-auto aspect-square w-full rounded-2xl" />
                  <p className="mt-3 text-center text-[10px] font-black uppercase tracking-[.13em] text-slate-500">One-time Flux pairing only</p>
                </div>

                <div className="space-y-4">
                  <div className="rounded-2xl border border-emerald-300/15 bg-emerald-300/[.07] p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-[.13em] text-emerald-200/50">Host code</p>
                        <p className="mt-1 break-all font-mono text-xl font-black text-emerald-100">{code}</p>
                      </div>
                      <button type="button" onClick={() => void copy(code, "Host code")} className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/10 hover:bg-white/15" aria-label="Copy host code">
                        <Copy className="h-4 w-4" />
                      </button>
                    </div>
                    <p className="mt-2 text-[11px] leading-5 text-emerald-50/50">Single use. {expiresAtMs ? `Expires at ${new Date(expiresAtMs).toLocaleTimeString()}.` : "Expires shortly."}</p>
                  </div>

                  <div className="rounded-2xl border border-white/8 bg-black/30 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-xs font-black">Install/start the Windows host once</p>
                      <button type="button" onClick={() => void copy(installCommand, "Install command")} className="inline-flex h-8 items-center gap-1.5 rounded-full bg-white/8 px-3 text-[10px] font-black hover:bg-white/13"><Copy className="h-3.5 w-3.5" />Copy</button>
                    </div>
                    <code className="mt-3 block max-h-32 overflow-auto whitespace-pre-wrap break-all rounded-xl bg-black/45 p-3 text-[10px] leading-5 text-white/60">{installCommand}</code>
                    <p className="mt-3 text-[11px] leading-5 text-white/38">After Steam is signed in on that Windows PC, the host agent keeps the Steam session local to the host. Flux does not send Steam credentials to players.</p>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <button type="button" onClick={() => void copy(pairUrl, "Pairing link")} className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-white/10 bg-white/5 text-xs font-black text-white/75 hover:bg-white/9"><QrCode className="h-4 w-4" />Copy QR link</button>
                    <button type="button" onClick={() => void makeCode()} disabled={loading} className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-white/10 bg-white/5 text-xs font-black text-white/75 hover:bg-white/9 disabled:opacity-50"><KeyRound className="h-4 w-4" />New code</button>
                  </div>

                  <div className="flex items-start gap-3 rounded-2xl border border-white/8 bg-white/[.03] p-4">
                    <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-300" />
                    <div>
                      <p className="text-xs font-black">Steam account isolation</p>
                      <p className="mt-1 text-[11px] leading-5 text-white/45">The QR contains only a short-lived Flux pairing code. It does not contain your Steam password, Steam cookie, or Steam session token.</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </section>
        </div>
      ) : null}
    </>
  );
}
