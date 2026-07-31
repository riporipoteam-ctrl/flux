"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  Eye,
  Heart,
  Loader2,
  MessageCircle,
  Play,
  Radio,
  Share2,
  Signal,
  Sparkles,
  Users,
  Volume2,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/auth-context";
import {
  addLiveCandidate,
  createLivePeer,
  heartbeatLiveViewer,
  joinLiveStream,
  leaveLiveStream,
  recordLiveShare,
  removeLivePeer,
  sendLiveComment,
  setLivePeerAnswer,
  subscribeLiveCandidates,
  subscribeLiveComments,
  subscribeLivePeer,
  subscribeLiveStream,
  toggleLiveLike,
  type FluxLiveStream,
  type LiveComment,
} from "@/services/live";
import { getFluxIceServers } from "@/lib/webrtc";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function LiveViewerPage() {
  return <Suspense fallback={<LiveLoading />}><LiveViewer /></Suspense>;
}

function LiveViewer() {
  const id = useSearchParams().get("id") || "";
  const { user } = useAuth();
  const videoRef = useRef<HTMLVideoElement>(null);
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const cleanup = useRef<Array<() => void>>([]);
  const joinedAt = useRef<number | null>(null);
  const [stream, setStream] = useState<FluxLiveStream | null>(null);
  const [comments, setComments] = useState<LiveComment[]>([]);
  const [comment, setComment] = useState("");
  const [status, setStatus] = useState("Connecting to live…");
  const [liked, setLiked] = useState(false);
  const [needsPlay, setNeedsPlay] = useState(false);
  const [heartBursts, setHeartBursts] = useState<number[]>([]);

  useEffect(() => {
    if (!id) return;
    cleanup.current.push(subscribeLiveStream(id, setStream));
    cleanup.current.push(subscribeLiveComments(id, setComments));
    return () => {
      cleanup.current.forEach((fn) => fn());
      cleanup.current = [];
    };
  }, [id]);

  useEffect(() => {
    if (!id || !user || stream?.status !== "live" || stream.hostId === user.uid || peerRef.current) return;
    let cancelled = false;
    let heartbeat = 0;

    const leave = () => {
      const watchedSeconds = joinedAt.current ? Math.max(0, Math.floor((Date.now() - joinedAt.current) / 1000)) : 0;
      void leaveLiveStream(id, user.uid, watchedSeconds);
      void removeLivePeer(id, user.uid);
    };

    void (async () => {
      try {
        setStatus("Joining room…");
        await joinLiveStream(id, user.uid);
        joinedAt.current = Date.now();
        heartbeat = window.setInterval(() => void heartbeatLiveViewer(id, user.uid), 20_000);
        await createLivePeer(id, user.uid);
        if (cancelled) return;

        const peer = new RTCPeerConnection({ iceServers: getFluxIceServers() });
        peerRef.current = peer;
        peer.ontrack = (event) => {
          const [media] = event.streams;
          if (!videoRef.current || !media) return;
          videoRef.current.srcObject = media;
          void videoRef.current.play().then(() => {
            setNeedsPlay(false);
            setStatus("Live");
          }).catch(() => {
            setNeedsPlay(true);
            setStatus("Tap to start playback");
          });
        };
        peer.onicecandidate = (event) => {
          if (event.candidate) void addLiveCandidate(id, user.uid, "viewer", event.candidate.toJSON());
        };
        peer.onconnectionstatechange = () => {
          if (peer.connectionState === "connected") setStatus("Live");
          if (peer.connectionState === "disconnected") setStatus("Reconnecting…");
          if (peer.connectionState === "failed") setStatus("Connection failed — refresh to retry");
        };
        cleanup.current.push(subscribeLiveCandidates(id, user.uid, "host", (candidate) => {
          void peer.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => undefined);
        }));
        cleanup.current.push(subscribeLivePeer(id, user.uid, (data) => {
          if (!data?.offer || peer.currentRemoteDescription) return;
          void (async () => {
            await peer.setRemoteDescription(new RTCSessionDescription(data.offer!));
            const answer = await peer.createAnswer();
            await peer.setLocalDescription(answer);
            await setLivePeerAnswer(id, user.uid, { type: answer.type, sdp: answer.sdp });
            setStatus("Connecting media…");
          })().catch(() => setStatus("Could not connect to this live"));
        }));
      } catch (error) {
        setStatus(error instanceof Error ? error.message : "Could not join live");
      }
    })();

    window.addEventListener("pagehide", leave);
    return () => {
      cancelled = true;
      window.removeEventListener("pagehide", leave);
      if (heartbeat) window.clearInterval(heartbeat);
      leave();
      peerRef.current?.close();
      peerRef.current = null;
      joinedAt.current = null;
    };
  }, [id, stream?.hostId, stream?.status, user]);

  const send = async () => {
    if (!id || !user || !comment.trim()) return;
    await sendLiveComment(id, user.uid, comment);
    setComment("");
  };

  const react = async () => {
    if (!user || !id) return;
    try {
      const next = await toggleLiveLike(id, user.uid);
      setLiked(next);
      if (next) {
        const burst = Date.now();
        setHeartBursts((items) => [...items, burst]);
        window.setTimeout(() => setHeartBursts((items) => items.filter((item) => item !== burst)), 1500);
      }
    } catch {
      toast.error("Could not react to this live");
    }
  };

  const share = async () => {
    if (!user || !id || !stream) return;
    try {
      if (navigator.share) await navigator.share({ title: stream.title, text: stream.description, url: window.location.href });
      else {
        await navigator.clipboard.writeText(window.location.href);
        toast.success("Live link copied");
      }
      await recordLiveShare(id, user.uid);
    } catch (error) {
      if ((error as DOMException)?.name !== "AbortError") toast.error("Could not share live");
    }
  };

  const startPlayback = async () => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = false;
    await video.play().then(() => {
      setNeedsPlay(false);
      setStatus("Live");
    }).catch(() => toast.error("Your browser blocked playback. Tap the video once more."));
  };

  if (!id) return <MissingLive />;
  if (!stream) return <LiveLoading />;

  if (stream.status === "ended") {
    return (
      <main className="grid min-h-[calc(100dvh-53px)] place-items-center bg-[#08090b] p-6 text-center text-white">
        <div className="max-w-md">
          <span className="mx-auto grid h-16 w-16 place-items-center rounded-3xl bg-white/8"><Radio className="h-8 w-8 text-white/45" /></span>
          <h1 className="mt-5 text-3xl font-black tracking-tight">This live has ended</h1>
          <div className="mt-5 grid grid-cols-3 gap-2">
            <EndStat label="Peak" value={stream.peakViewers} />
            <EndStat label="Viewers" value={stream.uniqueViewers} />
            <EndStat label="Likes" value={stream.likesCount} />
          </div>
          <Link href="/live" className="mt-6 inline-flex h-12 items-center rounded-full bg-white px-6 text-sm font-black text-black">Browse live streams</Link>
        </div>
      </main>
    );
  }

  const hostViewing = user?.uid === stream.hostId;

  return (
    <main className="min-h-screen bg-[#07080a] text-white">
      <div className="grid min-h-[calc(100dvh-53px-env(safe-area-inset-top))] xl:grid-cols-[minmax(0,1fr)_390px]">
        <section className="relative flex min-h-[58vh] items-center justify-center overflow-hidden bg-black">
          {hostViewing ? (
            <div className="p-8 text-center">
              <span className="mx-auto grid h-16 w-16 place-items-center rounded-3xl bg-red-500/15 text-red-300"><Radio className="h-8 w-8" /></span>
              <h2 className="mt-5 text-2xl font-black">You are hosting this live</h2>
              <p className="mt-2 text-sm text-white/45">Open the dashboard to control media and view analytics.</p>
              <Link href="/live/create" className="mt-5 inline-flex rounded-full bg-white px-5 py-2.5 text-sm font-black text-black">Open dashboard</Link>
            </div>
          ) : (
            <video ref={videoRef} autoPlay playsInline controls={false} className="h-full max-h-[calc(100dvh-53px)] w-full object-contain" />
          )}

          <div className="pointer-events-none absolute inset-x-0 top-0 h-36 bg-gradient-to-b from-black/70 to-transparent" />
          <div className="absolute left-4 top-4 flex flex-wrap items-center gap-2">
            <span className="flex items-center gap-1.5 rounded-full bg-red-500 px-3 py-1.5 text-[11px] font-black"><span className="h-2 w-2 animate-pulse rounded-full bg-white" />LIVE</span>
            <span className="flex items-center gap-1.5 rounded-full bg-black/60 px-3 py-1.5 text-[11px] font-bold backdrop-blur-xl"><Eye className="h-3.5 w-3.5" />{stream.viewersCount}</span>
            <span className="hidden items-center gap-1.5 rounded-full bg-black/60 px-3 py-1.5 text-[11px] font-bold backdrop-blur-xl sm:flex"><Signal className="h-3.5 w-3.5" />{status}</span>
          </div>

          {needsPlay ? (
            <button type="button" onClick={() => void startPlayback()} className="absolute inset-0 z-20 grid place-items-center bg-black/35 backdrop-blur-[2px]">
              <span className="grid h-20 w-20 place-items-center rounded-full bg-white text-black shadow-2xl"><Play className="ml-1 h-8 w-8 fill-current" /></span>
              <span className="absolute mt-32 rounded-full bg-black/65 px-4 py-2 text-sm font-bold"><Volume2 className="mr-2 inline h-4 w-4" />Tap for live audio</span>
            </button>
          ) : null}

          {heartBursts.map((burst, index) => <Heart key={burst} className="pointer-events-none absolute bottom-24 right-8 h-10 w-10 animate-[ping_1.4s_ease-out] fill-rose-500 text-rose-500" style={{ marginRight: `${index * 12}px` }} />)}

          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-52 bg-gradient-to-t from-black/80 to-transparent" />
          <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between gap-3">
            <div className="min-w-0 max-w-2xl">
              <div className="flex items-center gap-2"><UserAvatar user={stream.host} size="sm" clickable={false} /><div className="min-w-0"><p className="truncate text-sm font-black">{stream.host?.displayName || "Flux creator"}</p><p className="truncate text-[11px] text-white/55">@{stream.host?.username || "creator"}</p></div></div>
              <h1 className="mt-3 line-clamp-2 text-xl font-black tracking-tight sm:text-2xl">{stream.title}</h1>
              {stream.description ? <p className="mt-1 line-clamp-2 max-w-xl text-xs leading-5 text-white/55">{stream.description}</p> : null}
            </div>
            <div className="flex shrink-0 gap-2">
              <button type="button" onClick={() => void react()} className={cn("relative grid h-12 w-12 place-items-center rounded-full backdrop-blur-xl transition active:scale-90", liked ? "bg-rose-500" : "bg-black/55")} aria-label="Like live"><Heart className={cn("h-5 w-5", liked && "fill-white")} />{stream.likesCount ? <span className="absolute -bottom-5 text-[10px] font-bold">{stream.likesCount}</span> : null}</button>
              <button type="button" onClick={() => void share()} className="relative grid h-12 w-12 place-items-center rounded-full bg-black/55 backdrop-blur-xl transition active:scale-90" aria-label="Share live"><Share2 className="h-5 w-5" />{stream.sharesCount ? <span className="absolute -bottom-5 text-[10px] font-bold">{stream.sharesCount}</span> : null}</button>
            </div>
          </div>
        </section>

        <aside className="flex min-h-[42vh] flex-col border-l border-white/10 bg-[#0d0f12]">
          <div className="flex items-center justify-between border-b border-white/10 p-4">
            <div><p className="font-black">Live chat</p><p className="mt-0.5 text-[11px] text-white/40">{comments.length} comments · {stream.category}</p></div>
            <div className="flex items-center gap-1.5 rounded-full bg-white/6 px-3 py-1.5 text-[11px] font-bold text-white/65"><Users className="h-3.5 w-3.5" />{stream.uniqueViewers} reached</div>
          </div>
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
            {comments.length ? comments.map((item) => (
              <div key={item.id} className="flex gap-2.5 text-sm leading-5">
                <UserAvatar user={item.author} size="xs" clickable={false} />
                <p className="min-w-0"><strong className="mr-1.5">{item.author?.displayName || "Viewer"}</strong><span className="text-white/70">{item.text}</span></p>
              </div>
            )) : <div className="grid min-h-48 place-items-center text-center"><div><Sparkles className="mx-auto h-7 w-7 text-white/20" /><p className="mt-3 text-sm font-bold text-white/45">Be the first to comment</p><p className="mt-1 text-xs text-white/25">Keep it friendly and on topic.</p></div></div>}
          </div>
          <div className="border-t border-white/10 p-3 story-safe-bottom">
            {user ? <div className="flex gap-2"><Input value={comment} onChange={(event) => setComment(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void send(); }} placeholder="Add a comment" className="h-11 rounded-full border-white/10 bg-white/5 px-4 text-white" /><Button size="icon" onClick={() => void send()} disabled={!comment.trim()} className="h-11 w-11 rounded-full"><MessageCircle className="h-4 w-4" /></Button></div> : <Link href="/login" className="flex h-11 items-center justify-center rounded-full bg-white text-sm font-black text-black">Sign in to join chat</Link>}
          </div>
        </aside>
      </div>
    </main>
  );
}

function LiveLoading() {
  return <div className="grid min-h-[70vh] place-items-center bg-[#08090b] text-white"><div className="text-center"><Loader2 className="mx-auto h-8 w-8 animate-spin text-blue-400" /><p className="mt-4 text-sm font-bold text-white/45">Opening livestream…</p></div></div>;
}

function MissingLive() {
  return <div className="grid min-h-[70vh] place-items-center p-6 text-center"><div><AlertTriangle className="mx-auto h-10 w-10 text-muted-foreground" /><h1 className="mt-4 text-xl font-black">Livestream not selected</h1><Link href="/live" className="mt-4 inline-flex rounded-full bg-primary px-5 py-2.5 text-sm font-black text-white">Browse live</Link></div></div>;
}

function EndStat({ label, value }: { label: string; value: number }) {
  return <div className="rounded-2xl bg-white/6 p-4"><p className="text-xl font-black">{value}</p><p className="mt-1 text-[11px] text-white/40">{label}</p></div>;
}
