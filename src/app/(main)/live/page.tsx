"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Eye, Radio, RefreshCw, Sparkles, Users, Video, Zap } from "lucide-react";
import { type FluxLiveStream } from "@/services/live";
import { subscribeLiveDirectory } from "@/services/live-directory";
import { UserAvatar } from "@/components/shared/user-avatar";

export default function LivePage() {
  const [streams, setStreams] = useState<FluxLiveStream[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const totalViewers = useMemo(() => streams.reduce((sum, stream) => sum + Math.max(0, Number(stream.viewersCount || 0)), 0), [streams]);

  useEffect(() => {
    const unsubscribe = subscribeLiveDirectory(
      (next) => {
        setStreams(next);
        setLoading(false);
        setError(false);
      },
      () => {
        setLoading(false);
        setError(true);
      }
    );
    return unsubscribe;
  }, []);

  return (
    <main className="flux10-page pb-24 lg:pb-10">
      <header className="flux10-page-head">
        <span className="relative grid h-10 w-10 shrink-0 place-items-center rounded-full bg-red-500 text-white shadow-[0_8px_24px_rgba(244,33,46,.2)]">
          <Radio className="h-[18px] w-[18px]" />
          <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-background bg-white" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="flux10-kicker">Realtime video</p>
          <h1 className="flux10-title mt-1">Flux Live</h1>
        </div>
        <span className="flux10-chip hidden sm:inline-flex"><span className="flux10-live-dot" /> {streams.length} live</span>
        <Link href="/live/create" className="flux10-primary !bg-red-500 !shadow-[0_8px_22px_rgba(244,33,46,.2)]"><Video className="h-4 w-4" /> Go live</Link>
      </header>

      <section className="flux10-hero flux10-live-hero">
        <span className="flux10-glow-orb right-8 top-3 h-44 w-44 bg-primary/40" />
        <div className="relative z-10 grid gap-7 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <div className="flex flex-wrap gap-2"><span className="flux10-chip"><Zap className="h-3.5 w-3.5 text-primary" /> Browser-native</span><span className="flux10-chip"><Sparkles className="h-3.5 w-3.5 text-primary" /> Realtime chat</span></div>
            <h2 className="mt-5 max-w-3xl text-[clamp(2.5rem,7vw,5.2rem)] font-black leading-[.9] tracking-[-.075em]">Watch what&apos;s happening <span className="text-primary">right now.</span></h2>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">Creators can broadcast camera, microphone or screen straight from the browser. Viewers join from mobile or desktop with no install.</p>
            <div className="mt-6 flex flex-wrap gap-2"><Link href="/live/create" className="flux10-primary !bg-red-500">Start broadcasting <ArrowRight className="h-4 w-4" /></Link>{streams[0] ? <Link href={`/live/view?id=${encodeURIComponent(streams[0].id)}`} className="flux10-secondary">Watch top stream <Eye className="h-4 w-4" /></Link> : null}</div>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:min-w-[290px]">
            <StatCard icon={Radio} value={String(streams.length)} label="Live now" accent="text-red-500" />
            <StatCard icon={Users} value={String(totalViewers)} label="Watching" accent="text-primary" />
          </div>
        </div>
      </section>

      <section className="px-3 py-7 sm:px-5">
        <div className="flex items-end justify-between gap-4">
          <div><p className="flux10-kicker">Live directory</p><h2 className="mt-1 text-2xl font-black tracking-[-.05em] sm:text-3xl">On air now</h2><p className="mt-1 text-xs leading-5 text-muted-foreground sm:text-sm">This list updates automatically as creators start and end streams.</p></div>
          {!loading && !error ? <span className="flux10-chip hidden sm:inline-flex"><span className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_0_4px_rgba(16,185,129,.1)]" /> Synced</span> : null}
        </div>

        {loading ? (
          <div className="flux10-live-grid !px-0">
            {Array.from({ length: 4 }).map((_, index) => <div key={index}><div className="skeleton aspect-video rounded-[18px]" /><div className="mt-3 flex gap-3"><div className="skeleton h-10 w-10 rounded-full" /><div className="flex-1 space-y-2"><div className="skeleton h-4 w-2/3" /><div className="skeleton h-3 w-1/2" /></div></div></div>)}
          </div>
        ) : error ? (
          <div className="flux10-panel mt-5 grid min-h-72 place-items-center p-8 text-center">
            <div><span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-amber-500/10 text-amber-500"><RefreshCw className="h-6 w-6" /></span><h2 className="mt-4 text-xl font-black">Live directory disconnected</h2><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">Flux lost the realtime directory connection. Your account is fine; reconnect the page to resume the stream list.</p><button type="button" onClick={() => window.location.reload()} className="flux10-primary mt-5">Reconnect</button></div>
          </div>
        ) : streams.length ? (
          <div className="flux10-live-grid !px-0">
            {streams.map((stream, index) => (
              <Link key={stream.id} href={`/live/view?id=${encodeURIComponent(stream.id)}`} className="flux10-live-card group">
                <div className="flux10-live-preview">
                  <div className="absolute inset-0 grid place-items-center"><div className="absolute h-40 w-40 rounded-full bg-primary/20 blur-3xl" /><Video className="relative h-12 w-12 text-white/38 transition-transform group-hover:scale-110" /></div>
                  <span className="flux10-live-badge"><span className="h-1.5 w-1.5 rounded-full bg-white" /> LIVE</span>
                  {index === 0 && streams.length > 1 ? <span className="absolute right-3 top-3 rounded-full border border-white/15 bg-black/55 px-2.5 py-1 text-[9px] font-black uppercase tracking-[.11em] text-white backdrop-blur">Trending</span> : null}
                  <span className="absolute bottom-3 right-3 flex items-center gap-1.5 rounded-full bg-black/65 px-2.5 py-1 text-[10px] font-black text-white backdrop-blur"><Eye className="h-3 w-3" />{stream.viewersCount}</span>
                </div>
                <div className="flux10-live-meta">
                  <UserAvatar user={stream.host} size="sm" clickable={false} />
                  <div className="min-w-0 flex-1"><h3 className="line-clamp-2 text-[15px] font-black leading-5 tracking-[-.02em] group-hover:underline">{stream.title}</h3><p className="mt-1 truncate text-xs text-muted-foreground">{stream.host?.displayName || "Flux creator"}</p><p className="mt-1 text-[10px] font-black uppercase tracking-[.1em] text-muted-foreground">{stream.category}</p></div>
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-border transition group-hover:border-primary/40 group-hover:bg-primary/10 group-hover:text-primary"><ArrowRight className="h-4 w-4" /></span>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="flux10-panel mt-5 overflow-hidden">
            <div className="grid min-h-80 place-items-center bg-[radial-gradient(circle_at_50%_10%,rgba(244,33,46,.10),transparent_45%)] p-8 text-center"><div><span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-red-500/10 text-red-500"><Radio className="h-7 w-7" /></span><h2 className="mt-5 text-2xl font-black tracking-[-.04em]">The stage is yours</h2><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">Nobody is live yet. Start the first stream and it will appear here for everyone in realtime.</p><Link href="/live/create" className="flux10-primary mt-6 !bg-red-500">Go live now <ArrowRight className="h-4 w-4" /></Link></div></div>
          </div>
        )}
      </section>
    </main>
  );
}

function StatCard({ icon: Icon, value, label, accent }: { icon: typeof Radio; value: string; label: string; accent: string }) {
  return <div className="flux10-panel min-w-0 p-4"><Icon className={`h-4 w-4 ${accent}`} /><p className="mt-4 text-3xl font-black tracking-[-.055em] tabular-nums">{value}</p><p className="mt-1 text-[10px] font-black uppercase tracking-[.12em] text-muted-foreground">{label}</p></div>;
}
