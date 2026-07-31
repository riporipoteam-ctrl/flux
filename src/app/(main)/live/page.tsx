"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Eye, Radio, Video } from "lucide-react";
import { listLiveStreams, type FluxLiveStream } from "@/services/live";
import { UserAvatar } from "@/components/shared/user-avatar";

export default function LivePage() {
  const [streams, setStreams] = useState<FluxLiveStream[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listLiveStreams().then(setStreams).catch(() => setStreams([])).finally(() => setLoading(false));
  }, []);

  return (
    <main className="social-feed pb-20">
      <header className="social-page-header">
        <h1 className="text-xl font-bold">Live</h1>
        <Link href="/live/create" className="ml-auto flex items-center gap-2 rounded-full bg-red-500 px-4 py-2 text-sm font-bold text-white"><Radio className="h-4 w-4" />Go live</Link>
      </header>

      <section className="border-b border-border p-5">
        <h2 className="text-2xl font-bold tracking-tight">Live on Flux</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">Watch creators, chat in real time, and start a direct browser livestream without installing anything.</p>
      </section>

      {loading ? (
        <div className="grid gap-4 p-4 sm:grid-cols-2">{Array.from({ length: 4 }).map((_, index) => <div key={index}><div className="skeleton aspect-video rounded-xl" /><div className="mt-3 flex gap-3"><div className="skeleton h-10 w-10 rounded-full" /><div className="flex-1 space-y-2"><div className="skeleton h-4 w-2/3" /><div className="skeleton h-3 w-1/2" /></div></div></div>)}</div>
      ) : streams.length ? (
        <div className="grid gap-5 p-4 sm:grid-cols-2">
          {streams.map((stream) => (
            <Link key={stream.id} href={`/live/${stream.id}`} className="group block">
              <div className="relative aspect-video overflow-hidden rounded-xl bg-[#111]">
                <div className="absolute inset-0 grid place-items-center bg-[radial-gradient(circle_at_50%_30%,rgba(29,155,240,.24),transparent_50%)]"><Video className="h-12 w-12 text-white/50" /></div>
                <span className="absolute left-3 top-3 rounded bg-red-500 px-2 py-1 text-[10px] font-black text-white">LIVE</span>
                <span className="absolute bottom-3 right-3 flex items-center gap-1 rounded bg-black/60 px-2 py-1 text-[10px] font-bold text-white"><Eye className="h-3 w-3" />{stream.viewersCount}</span>
              </div>
              <div className="mt-3 flex gap-3">
                <UserAvatar user={stream.host} size="sm" clickable={false} />
                <div className="min-w-0"><h3 className="line-clamp-2 font-bold group-hover:underline">{stream.title}</h3><p className="mt-1 truncate text-xs text-muted-foreground">{stream.host?.displayName || "Flux creator"} · {stream.category}</p></div>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="grid min-h-72 place-items-center p-8 text-center"><div><Radio className="mx-auto h-10 w-10 text-muted-foreground" /><h2 className="mt-4 text-xl font-bold">Nobody is live yet</h2><p className="mt-2 text-sm text-muted-foreground">Be the first creator to start a Flux livestream.</p><Link href="/live/create" className="mt-5 inline-flex rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-white">Start live</Link></div></div>
      )}
    </main>
  );
}
