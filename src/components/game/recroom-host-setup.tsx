"use client";

import { useState } from "react";
import { Copy, KeyRound, Loader2, MonitorUp, X } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/auth-context";
import { createRecRoomHostPairing } from "@/services/recroom-browser";

const INSTALLER_URL = "https://raw.githubusercontent.com/riporipoteam-ctrl/ripoteamserver/main/windows-live-agent/install-recroom-host.ps1";

type RecRoomHostSetupProps = {
  variant?: "floating" | "inline";
  label?: string;
};

export function RecRoomHostSetup({
  variant = "floating",
  label = "Windows host setup",
}: RecRoomHostSetupProps = {}) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [pairingCode, setPairingCode] = useState("");
  const [expiresAtMs, setExpiresAtMs] = useState(0);

  if (!user) return null;

  const generatePairingCode = async () => {
    setLoading(true);
    try {
      const token = await user.getIdToken(true);
      const result = await createRecRoomHostPairing(token);
      if (!result.pairingCode) throw new Error(result.error || result.detail || "Flux did not return a pairing code.");
      setPairingCode(result.pairingCode);
      setExpiresAtMs(result.expiresAtMs || 0);
      toast.success("One-time Windows host pairing code created");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not create a Windows host pairing code.");
    } finally {
      setLoading(false);
    }
  };

  const installCommand = pairingCode
    ? `powershell -ExecutionPolicy Bypass -Command "$p=$env:TEMP+'\\\\install-recroom-host.ps1'; irm '${INSTALLER_URL}' -OutFile $p; & $p -PairingCode '${pairingCode}' -TrySteamDownload -Start"`
    : "";

  const copy = async (value: string, copyLabel: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${copyLabel} copied`);
    } catch {
      toast.error(`Could not copy ${copyLabel.toLowerCase()}.`);
    }
  };

  const triggerClassName = variant === "inline"
    ? "inline-flex h-12 items-center justify-center gap-2 rounded-full border border-white/15 bg-white/10 px-5 text-sm font-black text-white transition hover:bg-white/15"
    : "fixed bottom-[max(1rem,env(safe-area-inset-bottom))] right-4 z-[65] inline-flex h-11 items-center gap-2 rounded-full border border-white/12 bg-[#101722]/95 px-4 text-xs font-black text-white shadow-2xl backdrop-blur-xl transition hover:bg-[#182231] sm:right-6";

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={triggerClassName}
      >
        <MonitorUp className="h-4 w-4" /> {label}
      </button>

      {open ? (
        <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/70 p-3 backdrop-blur-sm sm:items-center sm:p-6">
          <section className="max-h-[88dvh] w-full max-w-2xl overflow-auto rounded-[28px] border border-white/12 bg-[#0a1019] p-5 text-white shadow-2xl sm:p-7">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[.14em] text-white/35">Flux Rec Room</p>
                <h2 className="mt-1 text-xl font-black tracking-[-.04em]">Pair a Windows game host</h2>
                <p className="mt-2 max-w-xl text-xs leading-5 text-white/45">
                  Flux creates a short-lived, single-use pairing code. The Windows installer claims it once, verifies the exact May 19 2022 client, then starts the host and browser stream.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/6 text-white/60 hover:bg-white/12 hover:text-white"
                aria-label="Close Windows host setup"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-5 grid gap-2 sm:grid-cols-3">
              <BuildFact label="Build" value="8751857" />
              <BuildFact label="Depot" value="471711" />
              <BuildFact label="Manifest" value="6337851004861751095" />
            </div>

            {!pairingCode ? (
              <button
                type="button"
                disabled={loading}
                onClick={() => void generatePairingCode()}
                className="mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-white px-5 text-sm font-black text-black disabled:cursor-wait disabled:opacity-55"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
                {loading ? "Creating secure code…" : "Generate one-time pairing code"}
              </button>
            ) : (
              <div className="mt-6 space-y-4">
                <div className="rounded-2xl border border-emerald-300/15 bg-emerald-300/[.07] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[.13em] text-emerald-200/50">Pairing code</p>
                      <p className="mt-1 break-all font-mono text-lg font-black text-emerald-100">{pairingCode}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void copy(pairingCode, "Pairing code")}
                      className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/10 hover:bg-white/15"
                      aria-label="Copy pairing code"
                    >
                      <Copy className="h-4 w-4" />
                    </button>
                  </div>
                  <p className="mt-2 text-[11px] leading-5 text-emerald-50/50">
                    Single use. {expiresAtMs ? `Expires at ${new Date(expiresAtMs).toLocaleTimeString()}.` : "Expires shortly."}
                  </p>
                </div>

                <div className="rounded-2xl border border-white/8 bg-black/30 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs font-black">Run this once in Windows PowerShell</p>
                    <button
                      type="button"
                      onClick={() => void copy(installCommand, "Install command")}
                      className="inline-flex h-8 items-center gap-1.5 rounded-full bg-white/8 px-3 text-[10px] font-black hover:bg-white/13"
                    >
                      <Copy className="h-3.5 w-3.5" /> Copy
                    </button>
                  </div>
                  <code className="mt-3 block max-h-40 overflow-auto whitespace-pre-wrap break-all rounded-xl bg-black/45 p-3 text-[10px] leading-5 text-white/62">
                    {installCommand}
                  </code>
                  <p className="mt-3 text-[11px] leading-5 text-white/38">
                    The host verifies depot 471711 / manifest 6337851004861751095 before registering. If that exact client is not already on the PC, the installer can request it through your Steam account locally. Steam authentication stays on the Windows PC.
                  </p>
                </div>

                <button
                  type="button"
                  disabled={loading}
                  onClick={() => void generatePairingCode()}
                  className="h-10 w-full rounded-full border border-white/10 bg-white/5 text-xs font-black text-white/65 hover:bg-white/9"
                >
                  Generate a new code
                </button>
              </div>
            )}
          </section>
        </div>
      ) : null}
    </>
  );
}

function BuildFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/8 bg-white/[.035] p-3">
      <p className="text-[9px] font-black uppercase tracking-[.12em] text-white/35">{label}</p>
      <p className="mt-1 break-all font-mono text-[11px] font-bold text-white/75">{value}</p>
    </div>
  );
}
