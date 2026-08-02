"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowLeft, Eye, Heart, Loader2, MessageCircle, Play, Radio, Share2, Signal, Sparkles, Users, Volume2 } from "lucide-react";
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
import { createIceCandidateQueue, getFluxIceServers } from "@/lib/webrtc";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function LiveViewer() {
  const { user } = useAuth();
  const videoRef = useRef<HTMLVideoElement>(null);
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const cleanupRef = useRef<Array<() => void>>([]);
  const joinedAt = useRef<number | null>(null);
  const [id, setId] = useState("");
  const [stream, setStream] = useState<FluxLiveStream | null>(null);
  const [comments, setComments] = useState<LiveComment[]>([]);
  const [comment, setComment] = useState("");
  const [status, setStatus] = useState("Connecting…");
  const [liked, setLiked] = useState(false);
  const [needsPlay, setNeedsPlay] = useState(false);
  const [connectionState, setConnectionState] = useState<RTCPeerConnectionState>("new");

  useEffect(() => setId(new URLSearchParams(window.location.search).get("id") || ""), []);

  useEffect(() => {
    if (!id) return;
    const streamUnsub = subscribeLiveStream(id, setStream);
    const commentsUnsub = subscribeLiveComments(id, setComments);
    return () => { streamUnsub(); commentsUnsub(); };
  }, [id]);

  useEffect(() => {
    if (!id || !user || stream?.status !== "live" || stream.hostId === user.uid || peerRef.current) return;
    let cancelled = false;
    let heartbeat = 0;
    let candidateUnsub: () => void = () => {};
    let peerUnsub: () => void = () => {};

    const leave = () => {
      const watched = joinedAt.current ? Math.max(0, Math.floor((Date.now() - joinedAt.current) / 1000)) : 0;
      void leaveLiveStream(id, user.uid, watched);
      void removeLivePeer(id, user.uid);
    };

    void (async () => {
      try {
        setStatus("Joining live room…");
        await joinLiveStream(id, user.uid);
        joinedAt.current = Date.now();
        heartbeat = window.setInterval(() => void heartbeatLiveViewer(id, user.uid), 20_000);
        await createLivePeer(id, user.uid);
        if (cancelled) return;

        const peer = new RTCPeerConnection({ iceServers: getFluxIceServers() });
        const queue = createIceCandidateQueue(peer);
        peerRef.current = peer;
        peer.ontrack = (event) => {
          const media = event.streams[0] || new MediaStream([event.track]);
          if (!videoRef.current) return;
          videoRef.current.srcObject = media;
          void videoRef.current.play().then(() => { setNeedsPlay(false); setStatus("Live"); }).catch(() => { setNeedsPlay(true); setStatus("Tap for playback"); });
        };
        peer.onicecandidate = (event) => { if (event.candidate) void addLiveCandidate(id, user.uid, "viewer", event.candidate.toJSON()); };
        peer.onconnectionstatechange = () => {
          setConnectionState(peer.connectionState);
          if (peer.connectionState === "connected") setStatus("Live");
          else if (peer.connectionState === "connecting") setStatus("Connecting media…");
          else if (peer.connectionState === "disconnected") setStatus("Reconnecting…");
          else if (peer.connectionState === "failed") setStatus("Connection failed — reload to retry");
        };
        candidateUnsub = subscribeLiveCandidates(id, user.uid, "host", (candidate) => { void queue.add(candidate); });
        peerUnsub = subscribeLivePeer(id, user.uid, (data) => {
          if (!data?.offer || peer.currentRemoteDescription) return;
          void (async () => {
            await peer.setRemoteDescription(new RTCSessionDescription(data.offer!));
            await queue.flush();
            const answer = await peer.createAnswer();
            await peer.setLocalDescription(answer);
            await setLivePeerAnswer(id, user.uid, { type: answer.type, sdp: answer.sdp });
            setStatus("Connecting media…");
          })().catch((error) => { console.error(error); setStatus("Could not negotiate this live"); });
        });
        cleanupRef.current.push(() => queue.clear());
      } catch (error) {
        setStatus(error instanceof Error ? error.message : "Could not join live");
      }
    })();

    window.addEventListener("pagehide", leave);
    return () => {
      cancelled = true;
      window.removeEventListener("pagehide", leave);
      if (heartbeat) window.clearInterval(heartbeat);
      candidateUnsub();
      peerUnsub();
      cleanupRef.current.forEach((fn) => fn());
      cleanupRef.current = [];
      leave();
      peerRef.current?.close();
      peerRef.current = null;
      joinedAt.current = null;
    };
  }, [id, stream?.hostId, stream?.status, user]);

  const send = async () => { if (!id || !user || !comment.trim()) return; await sendLiveComment(id, user.uid, comment); setComment(""); };
  const react = async () => {
    if (!user || !id) return;
    try { setLiked(await toggleLiveLike(id, user.uid)); } catch { toast.error("Could not react right now"); }
  };
  const share = async () => {
    if (!user || !id || !stream) return;
    try {
      if (navigator.share) await navigator.share({ title: stream.title, text: stream.description, url: window.location.href });
      else { await navigator.clipboard.writeText(window.location.href); toast.success("Live link copied"); }
      await recordLiveShare(id, user.uid);
    } catch (error) { if ((error as DOMException)?.name !== "AbortError") toast.error("Could not share live"); }
  };
  const startPlayback = async () => {
    if (!videoRef.current) return;
    videoRef.current.muted = false;
    await videoRef.current.play().then(() => { setNeedsPlay(false); setStatus("Live"); }).catch(() => toast.error("Your browser still blocked playback. Tap the video once more."));
  };

  if (!id) return <StatePage icon={AlertTriangle} title="Live link is missing" text="Open a live stream from the Flux Live page." />;
  if (!stream) return <StatePage icon={Loader2} title="Loading live" text={status} spinning />;
  if (stream.status === "ended") return <StatePage icon={Radio} title="This live has ended" text={`${stream.uniqueViewers} viewers · ${stream.likesCount} likes · peak ${stream.peakViewers}`} />;
  if (stream.hostId === user?.uid) return <StatePage icon={Radio} title="You are hosting this live" text="Use the host studio to control media and analytics." action="/live/create" actionLabel="Open host studio" />;

  return (
    <main className="min-h-screen bg-[#07080a] text-white">
      <div className="grid min-h-[calc(100dvh-53px-env(safe-area-inset-top))] xl:grid-cols-[minmax(0,1fr)_390px]">
        <section className="relative flex min-h-[58vh] items-center justify-center overflow-hidden bg-black">
          <video ref={videoRef} autoPlay playsInline className="h-full max-h-[calc(100dvh-53px)] w-full object-contain" onClick={() => needsPlay && void startPlayback()} />
          <div className="pointer-events-none absolute inset-x-0 top-0 h-36 bg-gradient-to-b from-black/75 to-transparent" />
          <div className="absolute left-4 top-4 flex flex-wrap items-center gap-2"><Link href="/live" className="grid h-9 w-9 place-items-center rounded-full bg-black/60 backdrop-blur-xl"><ArrowLeft className="h-4 w-4" /></Link><span className="flex items-center gap-1.5 rounded-full bg-red-500 px-3 py-1.5 text-[11px] font-black"><span className="h-2 w-2 animate-pulse rounded-full bg-white" />LIVE</span><span className="flex items-center gap-1.5 rounded-full bg-black/60 px-3 py-1.5 text-[11px] font-bold backdrop-blur-xl"><Eye className="h-3.5 w-3.5" />{stream.viewersCount}</span><span className="flex items-center gap-1.5 rounded-full bg-black/60 px-3 py-1.5 text-[11px] font-bold backdrop-blur-xl"><Signal className="h-3.5 w-3.5" />{connectionState === "connected" ? "Connected" : status}</span></div>
          {needsPlay ? <button onClick={() => void startPlayback()} className="absolute inset-0 z-20 grid place-items-center bg-black/40 backdrop-blur-[2px]"><span className="grid h-20 w-20 place-items-center rounded-full bg-white text-black"><Play className="ml-1 h-8 w-8 fill-current" /></span><span className="absolute mt-32 rounded-full bg-black/65 px-4 py-2 text-sm font-bold"><Volume2 className="mr-2 inline h-4 w-4" />Tap for live audio</span></button> : null}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-56 bg-gradient-to-t from-black/85 to-transparent" />
          <div className="absolute bottom-5 left-4 right-4 flex items-end justify-between gap-4"><div className="min-w-0 max-w-2xl"><div className="flex items-center gap-2"><UserAvatar user={stream.host} size="sm" clickable={false} /><div className="min-w-0"><p className="truncate text-sm font-black">{stream.host?.displayName || "Flux creator"}</p><p className="truncate text-[11px] text-white/55">@{stream.host?.username || "creator"}</p></div></div><h1 className="mt-3 line-clamp-2 text-xl font-black tracking-tight sm:text-2xl">{stream.title}</h1>{stream.description ? <p className="mt-1 line-clamp-2 text-xs leading-5 text-white/55">{stream.description}</p> : null}</div><div className="flex gap-2"><button onClick={() => void react()} className={cn("grid h-12 w-12 place-items-center rounded-full backdrop-blur-xl active:scale-90", liked ? "bg-rose-500" : "bg-black/55")}><Heart className={cn("h-5 w-5", liked && "fill-white")} /></button><button onClick={() => void share()} className="grid h-12 w-12 place-items-center rounded-full bg-black/55 backdrop-blur-xl"><Share2 className="h-5 w-5" /></button></div></div>
        </section>
        <aside className="flex min-h-[42vh] flex-col border-l border-white/10 bg-[#0d0f12]"><div className="flex items-center gap-3 border-b border-white/10 p-4"><div><p className="font-black">Live chat</p><p className="mt-0.5 text-[11px] text-white/40">{comments.length} comments · {stream.category}</p></div><span className="ml-auto flex items-center gap-1.5 rounded-full bg-white/6 px-3 py-1.5 text-[11px] font-bold text-white/65"><Users className="h-3.5 w-3.5" />{stream.uniqueViewers} reached</span></div><div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">{comments.length ? comments.map((item) => <div key={item.id} className="flex gap-2.5 text-sm leading-5"><UserAvatar user={item.author} size="xs" clickable={false} /><p><strong className="mr-1.5">{item.author?.displayName || "Viewer"}</strong><span className="text-white/70">{item.text}</span></p></div>) : <div className="grid min-h-48 place-items-center text-center"><div><Sparkles className="mx-auto h-7 w-7 text-white/20" /><p className="mt-3 text-sm font-bold text-white/45">Be the first to comment</p></div></div>}</div><div className="border-t border-white/10 p-3">{user ? <div className="flex gap-2"><Input value={comment} onChange={(event) => setComment(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void send(); }} placeholder="Add a comment" className="h-11 rounded-full border-white/10 bg-white/5 px-4 text-white" /><Button size="icon" onClick={() => void send()} disabled={!comment.trim()} className="h-11 w-11 rounded-full"><MessageCircle className="h-4 w-4" /></Button></div> : <Link href="/login" className="flex h-11 items-center justify-center rounded-full bg-white text-sm font-black text-black">Sign in to chat</Link>}</div></aside>
      </div>
    </main>
  );
}

function StatePage({ icon: Icon, title, text, spinning, action = "/live", actionLabel = "Browse live streams" }: { icon: typeof Radio; title: string; text: string; spinning?: boolean; action?: string; actionLabel?: string }) {
  return <main className="grid min-h-[calc(100dvh-53px)] place-items-center bg-[#0a0c0f] p-6 text-center text-white"><div className="max-w-md"><span className="mx-auto grid h-16 w-16 place-items-center rounded-3xl bg-white/8"><Icon className={cn("h-8 w-8 text-white/45", spinning && "animate-spin")} /></span><h1 className="mt-5 text-3xl font-black tracking-tight">{title}</h1><p className="mt-3 text-sm leading-6 text-white/45">{text}</p><Link href={action} className="mt-6 inline-flex h-12 items-center rounded-full bg-white px-6 text-sm font-black text-black">{actionLabel}</Link></div></main>;
}
