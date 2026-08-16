"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  Cloud,
  Gamepad2,
  Loader2,
  Radio,
  RefreshCw,
  Server,
  ShieldCheck,
  Users,
} from "lucide-react";
import { RecRoomHostSetup } from "@/components/game/recroom-host-setup";
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
        onlineHosts: 0,
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

  const serviceOnline = Boolean(status?.ok && status?.configured);
  const onlineHosts = Number(status?.onlineHosts || 0);
  const sessions = Number(status?.sessions || 0);
  const readyToPlay = serviceOnline && onlineHosts > 0;

  return (
    <section className="px-3 pt-4 sm:px-5">
      <div className="relative overflow-hidden rounded-[28px] border border-border bg-[#07111f] text-white shadow-sm">
        <div
          className="pointer-events-none absolute inset-0 opacity-90"
          style={{
            background:
              "radial-gradient(circle at 15% 15%, rgba(34,197,94,.28), transparent 30%), radial-gradient(circle at 88% 20%, rgba(59,130,246,.28), transparent 35%), linear-gradient(135deg,#07111f,#101827 55%,#08131d)",
          }}
        />

        <div className="relative p-6 sm:p-8">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
            <div className="max-w-3xl">
              <div className="flex flex-wrap gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-white/12 bg-white/8 px-3 py-1 text-[10px] font-black uppercase tracking-[.12em] text-white/80">
                  <Radio className="h-3.5 w-3.5 text-emerald-300" /> Flux streamed game
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-white/12 bg-white/8 px-3 py-1 text-[10px] font-black uppercase tracking-[.12em] text-white/80">
                  <Cloud className="h-3.5 w-3.5" /> Browser player
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-white/12 bg-white/8 px-3 py-1 text-[10px] font-black uppercase tracking-[.12em] text-white/80">
                  <ShieldCheck className="h-3.5 w-3.5" /> Flux account
                </span>
              </div>

              <h2 className="mt-5 text-[clamp(2.2rem,6vw,4.6rem)] font-black leading-[.9] tracking-[-.065em]">
                Rec Room · May 2022
              </h2>
              <p className="mt-4 max-w-2xl text-sm leading-6 text-white/62 sm:text-base">
                The real May 19, 2022 Windows client runs on your paired Windows game host. Flux handles account identity, the compatibility backend, session allocation, browser streaming, controls, captures, and supported save data from this Games experience.
              </p>
              <p className="mt-3 text-xs font-semibold text-white/42">
                Build 8751857 · Depot 471711 · Manifest 6337851004861751095
              </p>
            </div>

            <button
              type="button"
              onClick={() => void refreshStatus()}
              className="inline-flex h-10 shrink-0 items-center justify-center gap-2 self-start rounded-full border border-white/12 bg-white/7 px-4 text-xs font-black text-white/75 transition hover:bg-white/12"
              aria-label="Refresh Rec Room host status"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Refresh status
            </button>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <LiveStat
              icon={Server}
              label="Compatibility service"
              value={loading && !status ? "Checking…" : serviceOnline ? "Online" : "Unavailable"}
              detail={status?.error || "May 2022 gateway + broker"}
              good={serviceOnline}
            />
            <LiveStat
              icon={Gamepad2}
              label="Windows game hosts"
              value={loading && !status ? "Checking…" : `${onlineHosts} online`}
              detail={onlineHosts > 0 ? "A host can accept Play requests." : "Pair your Windows PC below to test."}
              good={onlineHosts > 0}
            />
            <LiveStat
              icon={Users}
              label="Active sessions"
              value={`${sessions} running`}
              detail="Live Flux browser sessions"
              good={sessions > 0}
            />
          </div>

          <div className={`mt-4 rounded-2xl border p-4 ${
            readyToPlay
              ? "border-emerald-300/15 bg-emerald-300/[.07]"
              : "border-amber-300/15 bg-amber-300/[.07]"
          }`}>
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className={`text-sm font-black ${readyToPlay ? "text-emerald-100" : "text-amber-100"}`}>
                  {readyToPlay ? "Rec Room is ready to launch from Flux." : "Connect a Windows Rec Room host to start the real game."}
                </p>
                <p className={`mt-1 text-xs leading-5 ${readyToPlay ? "text-emerald-50/55" : "text-amber-50/55"}`}>
                  {readyToPlay
                    ? "Open the player and press Play Rec Room. Flux will allocate the online host and stream the game into the browser."
                    : "Use Windows host setup, run the one-command installer on the PC that has or can download the exact May 19, 2022 client, then this status will turn green automatically."}
                </p>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <RecRoomHostSetup variant="inline" label="Set up Windows host" />
                <Link
                  href="/games/recroom"
                  className="inline-flex h-12 min-w-44 items-center justify-center gap-2 rounded-full bg-white px-6 text-sm font-black text-black transition hover:scale-[1.02]"
                >
                  <Gamepad2 className="h-4.5 w-4.5" /> {readyToPlay ? "Play Rec Room" : "Open Rec Room"} <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function LiveStat({
  icon: Icon,
  label,
  value,
  detail,
  good,
}: {
  icon: typeof Server;
  label: string;
  value: string;
  detail: string;
  good: boolean;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
      <div className="flex items-center gap-2 text-white/45">
        <Icon className="h-4 w-4" />
        <p className="text-[10px] font-black uppercase tracking-[.12em]">{label}</p>
      </div>
      <div className="mt-2 flex items-center gap-2">
        <span className={`h-2 w-2 rounded-full ${good ? "bg-emerald-400" : "bg-white/20"}`} />
        <p className="text-sm font-black">{value}</p>
      </div>
      <p className="mt-1 truncate text-[10px] text-white/35">{detail}</p>
    </div>
  );
}
