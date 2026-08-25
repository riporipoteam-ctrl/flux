"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { Copy, Download, ShieldCheck } from "lucide-react";

const INSTALLER_URL = "https://raw.githubusercontent.com/riporipoteam-ctrl/ripoteamserver/main/windows-live-agent/install-recroom-host.ps1";

function HostPairContent() {
  const params = useSearchParams();
  const code = params.get("code") || "";
  const command = code
    ? `powershell -ExecutionPolicy Bypass -Command \"$p=$env:TEMP+'\\\\install-recroom-host.ps1'; irm '${INSTALLER_URL}' -OutFile $p; & $p -PairingCode '${code}' -TrySteamDownload -Start\"`
    : "";

  const copy = async () => {
    if (!command) return;
    await navigator.clipboard.writeText(command);
  };

  return (
    <main className="min-h-dvh bg-[#070b10] px-4 py-8 text-white sm:px-6">
      <div className="mx-auto flex min-h-[80dvh] max-w-2xl items-center justify-center">
        <section className="w-full rounded-[30px] border border-white/10 bg-[#0d141d] p-6 shadow-2xl sm:p-8">
          <ShieldCheck className="h-7 w-7 text-emerald-300" />
          <p className="mt-5 text-[10px] font-black uppercase tracking-[.16em] text-white/35">Flux Rec Room host</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight">Finish the Windows host setup</h1>
          <p className="mt-3 text-sm leading-6 text-white/50">This QR page contains only a short-lived Flux host pairing code. It does not contain a Steam password, Steam cookie, or Steam session token.</p>

          {code ? (
            <>
              <div className="mt-6 rounded-2xl border border-emerald-300/15 bg-emerald-300/[.07] p-5">
                <p className="text-[10px] font-black uppercase tracking-[.14em] text-emerald-200/50">Pairing code</p>
                <p className="mt-2 font-mono text-3xl font-black tracking-[.12em] text-emerald-100">{code.toUpperCase()}</p>
              </div>

              <div className="mt-5 rounded-2xl border border-white/8 bg-black/30 p-4">
                <p className="text-xs font-black">On the Windows host PC</p>
                <p className="mt-1 text-[11px] leading-5 text-white/40">Install/run the RipoTeam host agent once. Steam authentication, when required by the legacy client, remains on this Windows machine.</p>
                <code className="mt-3 block max-h-44 overflow-auto whitespace-pre-wrap break-all rounded-xl bg-black/45 p-3 text-[10px] leading-5 text-white/60">{command}</code>
                <button type="button" onClick={() => void copy()} className="mt-3 inline-flex h-10 items-center gap-2 rounded-full bg-white px-4 text-xs font-black text-black"><Copy className="h-4 w-4" />Copy PowerShell command</button>
              </div>

              <a href={INSTALLER_URL} className="mt-4 inline-flex h-11 items-center justify-center gap-2 rounded-full border border-white/10 bg-white/5 px-5 text-xs font-black text-white/80"><Download className="h-4 w-4" />Open host installer script</a>
            </>
          ) : (
            <div className="mt-6 rounded-2xl border border-amber-300/15 bg-amber-300/[.06] p-4 text-sm text-amber-50">This QR code is missing its one-time pairing code. Go back to Flux Rec Room and generate a new QR.</div>
          )}

          <Link href="/games/recroom" className="mt-6 inline-flex h-10 items-center rounded-full text-xs font-black text-white/45 hover:text-white">← Back to Rec Room</Link>
        </section>
      </div>
    </main>
  );
}

export default function RecRoomHostPairPage() {
  return (
    <Suspense fallback={<main className="grid min-h-dvh place-items-center bg-[#070b10] text-white">Loading host pairing…</main>}>
      <HostPairContent />
    </Suspense>
  );
}
