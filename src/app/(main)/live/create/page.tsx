"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, Eye, Loader2, MessageCircle, Mic, MicOff, Radio, Square, Users, Video, VideoOff } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/auth-context";
import {
  addLiveCandidate,
  createLiveStream,
  endLiveStream,
  sendLiveComment,
  setLivePeerOffer,
  subscribeLiveCandidates,
  subscribeLiveComments,
  subscribeLivePeer,
  subscribeLivePeers,
  subscribeLiveViewerCount,
  syncLiveViewerCount,
  type LiveComment,
} from "@/services/live";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

export default function CreateLivePage() {
  const { user } = useAuth();
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const localStream = useRef<MediaStream | null>(null);
  const peers = useRef(new Map<string, RTCPeerConnection>());
  const handled = useRef(new Set<string>());
  const cleanup = useRef<Array<() => void>>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("Chatting");
  const [starting, setStarting] = useState(false);
  const [streamId, setStreamId] = useState<string | null>(null);
  const [viewers, setViewers] = useState(0);
  const [peak, setPeak] = useState(0);
  const [comments, setComments] = useState<LiveComment[]>([]);
  const [comment, setComment] = useState("");
  const [micOn, setMicOn] = useState(true);
  const [cameraOn, setCameraOn] = useState(true);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [secondsLive, setSecondsLive] = useState(0);

  useEffect(() => {
    if (!startedAt) return;
    const timer = window.setInterval(() => setSecondsLive(Math.floor((Date.now() - startedAt) / 1000)), 1000);
    return () => window.clearInterval(timer);
  }, [startedAt]);

  useEffect(() => () => {
    cleanup.current.forEach((fn) => fn());
    cleanup.current = [];
    peers.current.forEach((peer) => peer.close());
    localStream.current?.getTracks().forEach((track) => track.stop());
  }, []);

  const start = async () => {
    if (!user || starting) return;
    setStarting(true);
    try {
      const media = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      localStream.current = media;
      if (videoRef.current) videoRef.current.srcObject = media;

      const id = await createLiveStream({ hostId: user.uid, title, description, category });
      setStreamId(id);
      setStartedAt(Date.now());

      cleanup.current.push(subscribeLiveComments(id, setComments));
      cleanup.current.push(subscribeLiveViewerCount(id, (count) => {
        setViewers(count);
        setPeak((value) => Math.max(value, count));
        void syncLiveViewerCount(id, count);
      }));
      cleanup.current.push(subscribeLivePeers(id, (items) => {
        for (const peerData of items) {
          if (handled.current.has(peerData.viewerId)) continue;
          handled.current.add(peerData.viewerId);
          void connectViewer(id, peerData.viewerId, media);
        }
      }));
      toast.success("You are live");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not start livestream");
      localStream.current?.getTracks().forEach((track) => track.stop());
      localStream.current = null;
    } finally {
      setStarting(false);
    }
  };

  const connectViewer = async (id: string, viewerId: string, media: MediaStream) => {
    const peer = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    peers.current.set(viewerId, peer);
    media.getTracks().forEach((track) => peer.addTrack(track, media));
    peer.onicecandidate = (event) => {
      if (event.candidate) void addLiveCandidate(id, viewerId, "host", event.candidate.toJSON());
    };
    peer.onconnectionstatechange = () => {
      if (["failed", "closed", "disconnected"].includes(peer.connectionState)) {
        peer.close();
        peers.current.delete(viewerId);
      }
    };

    cleanup.current.push(subscribeLiveCandidates(id, viewerId, "viewer", (candidate) => {
      void peer.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => undefined);
    }));
    cleanup.current.push(subscribeLivePeer(id, viewerId, (data) => {
      if (data?.answer && !peer.currentRemoteDescription) {
        void peer.setRemoteDescription(new RTCSessionDescription(data.answer)).catch(() => undefined);
      }
    }));

    const offer = await peer.createOffer();
    await peer.setLocalDescription(offer);
    await setLivePeerOffer(id, viewerId, { type: offer.type, sdp: offer.sdp });
  };

  const stopLive = async () => {
    if (streamId) await endLiveStream(streamId).catch(() => undefined);
    cleanup.current.forEach((fn) => fn());
    cleanup.current = [];
    peers.current.forEach((peer) => peer.close());
    peers.current.clear();
    localStream.current?.getTracks().forEach((track) => track.stop());
    localStream.current = null;
    router.push("/live");
  };

  const toggleMic = () => {
    const next = !micOn;
    setMicOn(next);
    localStream.current?.getAudioTracks().forEach((track) => { track.enabled = next; });
  };

  const toggleCamera = () => {
    const next = !cameraOn;
    setCameraOn(next);
    localStream.current?.getVideoTracks().forEach((track) => { track.enabled = next; });
  };

  const postComment = async () => {
    if (!streamId || !user || !comment.trim()) return;
    await sendLiveComment(streamId, user.uid, comment);
    setComment("");
  };

  if (!streamId) {
    return (
      <main className="social-feed pb-20">
        <header className="social-page-header"><h1 className="text-xl font-bold">Go live</h1></header>
        <div className="p-5 sm:p-7">
          <div className="mx-auto max-w-xl">
            <span className="grid h-14 w-14 place-items-center rounded-full bg-red-500 text-white"><Radio className="h-7 w-7" /></span>
            <h2 className="mt-5 text-3xl font-bold tracking-tight">Start a Flux livestream</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">Camera and microphone stream directly from your browser. This free beta is designed for small live rooms.</p>
            <div className="mt-7 space-y-4">
              <label className="block text-sm font-semibold">Title<Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="What are you streaming?" className="mt-2" /></label>
              <label className="block text-sm font-semibold">Description<textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Tell viewers what to expect" className="mt-2 min-h-28 w-full rounded-xl border border-input bg-background p-3 text-sm outline-none focus:border-primary" /></label>
              <label className="block text-sm font-semibold">Category<select value={category} onChange={(event) => setCategory(event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-input bg-background px-3 text-sm"><option>Chatting</option><option>Gaming</option><option>Music</option><option>Creative</option><option>News</option><option>Sports</option></select></label>
              <Button onClick={() => void start()} disabled={starting || !title.trim()} className="h-12 w-full rounded-full bg-red-500 text-white hover:bg-red-600">{starting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Radio className="h-5 w-5" />}Start live</Button>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#080a0d] text-white">
      <header className="flex h-14 items-center gap-3 border-b border-white/10 px-4"><span className="rounded bg-red-500 px-2 py-1 text-[10px] font-black">LIVE</span><h1 className="min-w-0 flex-1 truncate font-bold">{title}</h1><Button onClick={() => void stopLive()} className="rounded-full bg-red-500 text-white hover:bg-red-600"><Square className="h-4 w-4 fill-current" />End</Button></header>
      <div className="grid min-h-[calc(100dvh-3.5rem)] lg:grid-cols-[minmax(0,1fr)_360px]">
        <section className="relative flex min-h-[55vh] items-center justify-center bg-black">
          <video ref={videoRef} autoPlay muted playsInline className="h-full max-h-[calc(100dvh-3.5rem)] w-full object-contain" />
          {!cameraOn ? <div className="absolute inset-0 grid place-items-center bg-[#111]"><VideoOff className="h-14 w-14 text-white/40" /></div> : null}
          <div className="absolute bottom-5 left-1/2 flex -translate-x-1/2 gap-3 rounded-full bg-black/55 p-2 backdrop-blur-xl">
            <button type="button" onClick={toggleMic} className={micOn ? "grid h-11 w-11 place-items-center rounded-full bg-white/15" : "grid h-11 w-11 place-items-center rounded-full bg-white text-black"}>{micOn ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}</button>
            <button type="button" onClick={toggleCamera} className={cameraOn ? "grid h-11 w-11 place-items-center rounded-full bg-white/15" : "grid h-11 w-11 place-items-center rounded-full bg-white text-black"}>{cameraOn ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}</button>
            <button type="button" onClick={() => navigator.clipboard.writeText(`${window.location.origin}${process.env.NEXT_PUBLIC_BASE_PATH || ""}/live/${streamId}`).then(() => toast.success("Live link copied"))} className="grid h-11 w-11 place-items-center rounded-full bg-white/15"><Copy className="h-5 w-5" /></button>
          </div>
        </section>

        <aside className="flex min-h-0 flex-col border-l border-white/10 bg-[#0d1014]">
          <div className="grid grid-cols-3 gap-2 border-b border-white/10 p-3">
            <Stat icon={Eye} label="Watching" value={viewers} />
            <Stat icon={Users} label="Peak" value={peak} />
            <Stat icon={MessageCircle} label="Comments" value={comments.length} />
          </div>
          <div className="border-b border-white/10 px-4 py-3 text-xs text-white/55">Live for {formatDuration(secondsLive)} · Direct browser beta</div>
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
            {comments.map((item) => <div key={item.id} className="text-sm"><strong>{item.author?.displayName || "Viewer"}</strong> <span className="text-white/75">{item.text}</span></div>)}
          </div>
          <div className="flex gap-2 border-t border-white/10 p-3"><Input value={comment} onChange={(event) => setComment(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void postComment(); }} placeholder="Comment as host" className="border-white/10 bg-white/5 text-white" /><Button size="icon" onClick={() => void postComment()}><MessageCircle className="h-4 w-4" /></Button></div>
        </aside>
      </div>
    </main>
  );
}

function Stat({ icon: Icon, label, value }: { icon: typeof Eye; label: string; value: number }) {
  return <div className="rounded-xl bg-white/5 p-3"><Icon className="h-4 w-4 text-blue-400" /><p className="mt-3 text-xl font-bold">{value}</p><p className="text-[10px] text-white/50">{label}</p></div>;
}

function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, "0")}`;
}
