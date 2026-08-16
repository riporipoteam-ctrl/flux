"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  Cloud,
  Cpu,
  Gamepad2,
  Loader2,
  RefreshCw,
  Server,
  ShieldCheck,
  Users,
} from "lucide-react";
import { getRecRoomBrokerStatus, type RecRoomBrokerStatus } from "@/services/recroom-browser";

export function RecRoomFeatureBanner() {
  const [status, setStatus] = useState<RecRoomBrokerStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshStatus = async () => {
    setLoading(true);
    try {
      setStatus(await getRecRoomBrokerStatus());
    } catch (error) {
      setStatus({
        ok: false,
        configured: false,
        sessions: 0,
        error: error instanceof Error ? error.message : "Rec Room compatibility service is unavailable.",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refreshStatus();
    const timer = window.setInterval(() => void refreshStatus(), 5000);
    return () => window.clearInterval(timer);
  }, []);

  const serviceOnline = Boolean(status?.ok);
  const runtime = status?.serverRuntime || status?.vmRuntime;
  const runtimeReady = Boolean(runtime?.readyForGame || status?.runtimeReadyForGame);
  const sessions = Number(status?.sessions || 0);
  const maxSessions = Number(runtime?.maxSandboxes || runtime?.maxVms || 0);
  const provider = runtime?.provider === "wine" ? "Wine sandbox" : runtime?.provider === "kvm" ? "Windows VM" : "Server runtime";
  const detail = status?.error || runtime?.reason || runtime?.warning || "RipoTeamServer browser runtime ready.";

  return (
    <section className="px-3 pt-4 sm:px-5">
      <div className="relative overflow-hidden rounded-[28px] border border-border bg-[#07111f] text-white shadow-sm">
        <div className="pointer-events-none absolute inset-0 opacity-90" style={{ background: "radial-gradient(circle at 15% 15%, rgba(34,197,94,.28), transparent 30%), radial-gradient(circle at 88% 20%, rgba(59,130,246,.28), transparent 35%), linear-gradient(135deg,#07111f,#101827 55%,#08131d)" }} />

        <div className="relative p-6 sm:p-8">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
            <div className="max-w-3xl">
              <div className="flex flex-wrap gap-2">
                <Pill icon={Cpu}>RipoTeamServer runtime</Pill>
                <Pill icon={Cloud}>No download · browser only</Pill>
                <Pill icon={ShieldCheck}>Flux account + saves</Pill>
              </div>
              <h2 className="mt-5 text-[clamp(2.2rem,6vw,4.6rem)] font-black leading-[.9] tracking-[-.065em]">Rec Room · May 2022</h2>
              <p className="mt-4 max-w-2xl text-sm leading-6 text-white/62 sm:text-base">
                Press Play and RipoTeamServer starts a private disposable game session, signs the May 19, 2022 client into your Flux-backed identity, and streams the running game straight into your browser with video, sound and controls. Players install nothing. Leaving destroys the temporary session while supported account and save state remain persistent.
              </p>
              <p className="mt-3 text-xs font-semibold text-white/42">Build 8751857 · Depot 471711 · Manifest 6337851004861751095 · storage-efficient per-player sandbox</p>
            </div>

            <button type="button" onClick={() => void refreshStatus()} className="inline-flex h-10 shrink-0 items-center justify-center gap-2 self-start rounded-full border border-white/12 bg-white/7 px-4 text-xs font-black text-white/75 transition hover:bg-white/12" aria-label="Refresh Rec Room server status">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Refresh status
            </button>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <LiveStat icon={Server} label="Compatibility API" value={loading && !status ? "Checking…" : serviceOnline ? "Online" : "Unavailable"} detail={status?.error || "Flux identity + May 2022 backend"} good={serviceOnline} />
            <LiveStat icon={Cpu} label="Server game runtime" value={loading && !status ? "Checking…" : runtimeReady ? `${provider} ready` : "Preparing"} detail={detail} good={runtimeReady} />
            <LiveStat icon={Users} label="Disposable sessions" value={`${sessions}${maxSessions ? ` / ${maxSessions}` : ""} active`} detail="One isolated server session per player" good={sessions > 0} />
          </div>

          <div className={`mt-4 rounded-2xl border p-4 ${runtimeReady ? "border-emerald-300/15 bg-emerald-300/[.07]" : "border-amber-300/15 bg-amber-300/[.07]"}`}>
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className={`text-sm font-black ${runtimeReady ? "text-emerald-100" : "text-amber-100"}`}>
                  {runtimeReady ? "RipoTeamServer can start Rec Room directly in your browser." : "RipoTeamServer is preparing the server-side game runtime."}
                </p>
                <p className={`mt-1 max-w-3xl text-xs leading-5 ${runtimeReady ? "text-emerald-50/55" : "text-amber-50/55"}`}>
                  {runtimeReady ? "Open Rec Room and press Play. The loading screen stays up until the live server stream is ready." : detail}
                </p>
              </div>
              <Link href="/games/recroom" className="inline-flex h-12 min-w-44 shrink-0 items-center justify-center gap-2 rounded-full bg-white px-6 text-sm font-black text-black transition hover:scale-[1.02]">
                <Gamepad2 className="h-4.5 w-4.5" /> Open Rec Room <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Pill({ icon: Icon, children }: { icon: typeof Cpu; children: string }) {
  return <span className="inline-flex items-center gap-1.5 rounded-full border border-white/12 bg-white/8 px-3 py-1 text-[10px] font-black uppercase tracking-[.12em] text-white/80"><Icon className="h-3.5 w-3.5" /> {children}</span>;
}

function LiveStat({ icon: Icon, label, value, detail, good }: { icon: typeof Server; label: string; value: string; detail: string; good: boolean }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
      <div className="flex items-center gap-2 text-white/45"><Icon className="h-4 w-4" /><p className="text-[10px] font-black uppercase tracking-[.12em]">{label}</p></div>
      <div className="mt-2 flex items-center gap-2"><span className={`h-2 w-2 rounded-full ${good ? "bg-emerald-400" : "bg-white/20"}`} /><p className="text-sm font-black">{value}</p></div>
      <p className="mt-1 line-clamp-2 text-[10px] leading-4 text-white/35">{detail}</p>
    </div>
  );
}
