"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Eye, Heart, Loader2, MessageCircle, Radio, Share2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/auth-context";
import {
  addLiveCandidate,
  createLivePeer,
  joinLiveStream,
  leaveLiveStream,
  removeLivePeer,
  sendLiveComment,
  setLivePeerAnswer,
  subscribeLiveCandidates,
  subscribeLiveComments,
  subscribeLivePeer,
  subscribeLiveStream,
  type FluxLiveStream,
  type LiveComment,
} from "@/services/live";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

export default function LiveViewerPage() {
  return <Suspense fallback={<LiveLoading />}><LiveViewer /></Suspense>;
}

function LiveViewer() {
  const id = useSearchParams().get("id") || "";
  const { user } = useAuth();
  const videoRef = useRef<HTMLVideoElement>(null);
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const cleanup = useRef<Array<() => void>>([]);
  const [stream, setStream] = useState<FluxLiveStream | null>(null);
  const [comments, setComments] = useState<LiveComment[]>([]);
  const [comment, setComment] = useState("");
  const [status, setStatus] = useState("Connecting to live…");
  const [liked, setLiked] = useState(false);

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

    void (async () => {
      try {
        await joinLiveStream(id, user.uid);
        await createLivePeer(id, user.uid);
        if (cancelled) return;
        const peer = new RTCPeerConnection({ iceServers: ICE_SERVERS });
        peerRef.current = peer;
        peer.ontrack = (event) => {
          const [media] = event.streams;
          if (videoRef.current && media) videoRef.current.srcObject = media;
          setStatus("Live");
        };
        peer.onicecandidate = (event) => {
          if (event.candidate) void addLiveCandidate(id, user.uid, "viewer", event.candidate.toJSON());
        };
        peer.onconnectionstatechange = () => {
          if (peer.connectionState === "connected") setStatus("Live");
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
            setStatus("Connecting…");
          })().catch(() => setStatus("Could not connect to this live"));
        }));
      } catch (error) {
        setStatus(error instanceof Error ? error.message : "Could not join live");
      }
    })();

    const leave = () => {
      void leaveLiveStream(id, user.uid);
      void removeLivePeer(id, user.uid);
    };
    window.addEventListener("pagehide", leave);
    return () => {
      cancelled = true;
      window.removeEventListener("pagehide", leave);
      leave();
      peerRef.current?.close();
      peerRef.current = null;
    };
  }, [id, stream?.hostId, stream?.status, user]);

  const send = async () => {
    if (!id || !user || !comment.trim()) return;
    await sendLiveComment(id, user.uid, comment);
    setComment("");
  };

  if (!id) return <div className="grid min-h-[70vh] place-items-center text-center"><div><Radio className="mx-auto h-10 w-10 text-muted-foreground" /><h1 className="mt-4 text-xl font-bold">Livestream not selected</h1><Link href="/live" className="mt-4 inline-flex rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-white">Browse live</Link></div></div>;
  if (!stream) return <LiveLoading />;

  if (stream.status === "ended") {
    return <main className="social-feed grid min-h-[70vh] place-items-center p-8 text-center"><div><Radio className="mx-auto h-12 w-12 text-muted-foreground" /><h1 className="mt-5 text-2xl font-bold">This livestream ended</h1><p className="mt-2 text-sm text-muted-foreground">Peak viewers: {stream.peakViewers}</p><Link href="/live" className="mt-5 inline-flex rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-white">Browse live</Link></div></main>;
  }

  const hostViewing = user?.uid === stream.hostId;

  return (
    <main className="min-h-screen bg-[#080a0d] text-white">
      <div className="grid min-h-[calc(100dvh-53px-env(safe-area-inset-top))] lg:grid-cols-[minmax(0,1fr)_360px]">
        <section className="relative flex min-h-[55vh] items-center justify-center bg-black">
          {hostViewing ? (
            <div className="text-center"><Radio className="mx-auto h-12 w-12 text-red-400" /><h2 className="mt-4 text-xl font-bold">You are the host</h2><Link href="/live/create" className="mt-4 inline-flex rounded-full bg-white px-5 py-2.5 text-sm font-bold text-black">Open dashboard</Link></div>
          ) : <video ref={videoRef} autoPlay playsInline controls className="h-full max-h-[calc(100dvh-53px)] w-full object-contain" />}
          <div className="absolute left-4 top-4 flex items-center gap-2"><span className="rounded bg-red-500 px-2 py-1 text-[10px] font-black">LIVE</span><span className="flex items-center gap-1 rounded bg-black/55 px-2 py-1 text-[10px] font-bold"><Eye className="h-3 w-3" />{stream.viewersCount}</span></div>
          <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between gap-3">
            <div className="min-w-0 rounded-xl bg-black/55 p-3 backdrop-blur-md"><h1 className="truncate text-lg font-bold">{stream.title}</h1><p className="truncate text-xs text-white/65">{status} · {stream.category}</p></div>
            <div className="flex gap-2">
              <button type="button" onClick={() => setLiked((value) => !value)} className={liked ? "grid h-11 w-11 place-items-center rounded-full bg-rose-500" : "grid h-11 w-11 place-items-center rounded-full bg-black/55 backdrop-blur-md"}><Heart className={liked ? "h-5 w-5 fill-white" : "h-5 w-5"} /></button>
              <button type="button" onClick={() => { if (navigator.share) void navigator.share({ title: stream.title, url: window.location.href }); else void navigator.clipboard.writeText(window.location.href).then(() => toast.success("Link copied")); }} className="grid h-11 w-11 place-items-center rounded-full bg-black/55 backdrop-blur-md"><Share2 className="h-5 w-5" /></button>
            </div>
          </div>
        </section>

        <aside className="flex min-h-[45vh] flex-col border-l border-white/10 bg-[#0d1014]">
          <div className="flex items-center gap-3 border-b border-white/10 p-4"><UserAvatar user={stream.host} size="sm" clickable={false} /><div className="min-w-0"><p className="truncate font-bold">{stream.host?.displayName || "Flux creator"}</p><p className="truncate text-xs text-white/55">@{stream.host?.username || "creator"}</p></div></div>
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
            {comments.length ? comments.map((item) => <div key={item.id} className="text-sm"><strong>{item.author?.displayName || "Viewer"}</strong> <span className="text-white/75">{item.text}</span></div>) : <p className="py-8 text-center text-sm text-white/45">Live comments appear here</p>}
          </div>
          <div className="flex gap-2 border-t border-white/10 p-3 story-safe-bottom"><Input value={comment} onChange={(event) => setComment(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void send(); }} placeholder="Add a comment" className="border-white/10 bg-white/5 text-white" /><Button size="icon" onClick={() => void send()}><MessageCircle className="h-4 w-4" /></Button></div>
        </aside>
      </div>
    </main>
  );
}

function LiveLoading() {
  return <div className="grid min-h-[70vh] place-items-center"><Loader2 className="h-7 w-7 animate-spin" /></div>;
}
