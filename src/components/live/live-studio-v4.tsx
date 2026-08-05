"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Camera,
  Copy,
  Eye,
  Loader2,
  Mic,
  MicOff,
  Radio,
  Send,
  Settings2,
  Square,
  Video,
  VideoOff,
  Wifi,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/auth-context";
import {
  captureFluxMedia,
  createIceCandidateQueue,
  describeMediaError,
  mediaCaptureReady,
  type CapturedMedia,
  type IceCandidateQueue,
} from "@/lib/webrtc";
import { createReliableLivePeer, limitLiveSender } from "@/lib/live-ice";
import {
  addReliableLiveCandidate,
  setReliableLiveOffer,
  setReliableLiveStatus,
  subscribeReliableLiveCandidates,
  subscribeReliableLivePeer,
  subscribeReliableLivePeers,
} from "@/services/live-reliable";
import {
  createLiveStream,
  endLiveStream,
  sendLiveComment,
  subscribeLiveComments,
  subscribeLiveViewerAnalytics,
  syncLiveAnalytics,
  type LiveComment,
  type LivePeer,
  type LiveViewerAnalytics,
} from "@/services/live";
import { UserAvatar } from "@/components/shared/user-avatar";
import { cn } from "@/lib/utils";

const EMPTY_ANALYTICS: LiveViewerAnalytics = {
  activeViewers: 0,
  uniqueViewers: 0,
  totalWatchSeconds: 0,
  likesCount: 0,
  sharesCount: 0,
};

export default function LiveStudioV4() {
  const { user, profile } = useAuth();
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const captureRef = useRef<CapturedMedia | null>(null);
  const peersRef = useRef(new Map<string, RTCPeerConnection>());
  const queuesRef = useRef(new Map<string, IceCandidateQueue>());
  const peerStopsRef = useRef(new Map<string, Array<() => void>>());
  const globalStopsRef = useRef<Array<() => void>>([]);

  const [title, setTitle] = useState("");
  const [streamId, setStreamId] = useState<string | null>(null);
  const [previewReady, setPreviewReady] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [starting, setStarting] = useState(false);
  const [microphoneEnabled, setMicrophoneEnabled] = useState(true);
  const [cameraEnabled, setCameraEnabled] = useState(true);
  const [comments, setComments] = useState<LiveComment[]>([]);
  const [comment, setComment] = useState("");
  const [analytics, setAnalytics] = useState<LiveViewerAnalytics>(EMPTY_ANALYTICS);
  const [connectedViewers, setConnectedViewers] = useState(0);
  const [status, setStatus] = useState("Open your camera to prepare the broadcast");

  const isLive = Boolean(streamId);

  useEffect(() => () => cleanupEverything(), []);

  const attachPreview = async (capture = captureRef.current) => {
    if (!videoRef.current || !capture) return;
    videoRef.current.srcObject = capture.stream;
    videoRef.current.muted = true;
    videoRef.current.playsInline = true;
    await videoRef.current.play().catch(() => undefined);
  };

  const openCamera = async () => {
    if (!mediaCaptureReady()) {
      toast.error("Camera and microphone require HTTPS and browser permission.");
      return;
    }
    setPreparing(true);
    captureRef.current?.cleanup();
    try {
      const capture = await captureFluxMedia({
        source: "camera",
        microphone: microphoneEnabled,
        camera: cameraEnabled,
        systemAudio: false,
      });
      captureRef.current = capture;
      setPreviewReady(true);
      setStatus(`Camera ready · ${capture.stream.getVideoTracks().length ? "video" : "no video"} · ${capture.stream.getAudioTracks().length ? "audio" : "no audio"}`);
      await attachPreview(capture);
    } catch (error) {
      const message = describeMediaError(error);
      setStatus(message);
      toast.error(message);
    } finally {
      setPreparing(false);
    }
  };

  const cleanupPeer = (viewerId: string) => {
    peerStopsRef.current.get(viewerId)?.forEach((stop) => stop());
    peerStopsRef.current.delete(viewerId);
    queuesRef.current.get(viewerId)?.clear();
    queuesRef.current.delete(viewerId);
    peersRef.current.get(viewerId)?.close();
    peersRef.current.delete(viewerId);
    setConnectedViewers([...peersRef.current.values()].filter((peer) => peer.connectionState === "connected").length);
  };

  const connectViewer = async (activeStreamId: string, livePeer: LivePeer, media: MediaStream) => {
    const viewerId = livePeer.viewerId;
    if (peersRef.current.has(viewerId) || livePeer.status === "failed") return;
    const peer = await createReliableLivePeer();
    const queue = createIceCandidateQueue(peer);
    peersRef.current.set(viewerId, peer);
    queuesRef.current.set(viewerId, queue);

    const senders = media.getTracks().filter((track) => track.readyState === "live").map((track) => peer.addTrack(track, media));
    await Promise.all(senders.map((sender) => limitLiveSender(sender, peersRef.current.size)));

    peer.onicecandidate = (event) => {
      if (event.candidate) void addReliableLiveCandidate(activeStreamId, viewerId, "host", livePeer.attempt, event.candidate.toJSON());
    };
    peer.onicecandidateerror = (event) => console.warn("Host ICE error", event.errorCode, event.errorText);
    peer.onconnectionstatechange = () => {
      const connected = [...peersRef.current.values()].filter((item) => item.connectionState === "connected").length;
      setConnectedViewers(connected);
      if (peer.connectionState === "connected") {
        setStatus(`${connected} viewer${connected === 1 ? "" : "s"} receiving video`);
        void setReliableLiveStatus(activeStreamId, viewerId, livePeer.attempt, "connected");
      } else if (peer.connectionState === "failed") {
        void setReliableLiveStatus(activeStreamId, viewerId, livePeer.attempt, "failed");
        cleanupPeer(viewerId);
      }
    };

    const stops = [
      subscribeReliableLiveCandidates(activeStreamId, viewerId, "viewer", livePeer.attempt, (candidate) => void queue.add(candidate)),
      subscribeReliableLivePeer(activeStreamId, viewerId, livePeer.attempt, (data) => {
        const answer = data?.answer;
        if (!answer || peer.remoteDescription?.sdp === answer.sdp) return;
        void peer.setRemoteDescription(new RTCSessionDescription(answer))
          .then(() => queue.flush())
          .catch((error) => console.error("Host could not apply live answer", error));
      }),
    ];
    peerStopsRef.current.set(viewerId, stops);

    const offer = await peer.createOffer({ offerToReceiveAudio: false, offerToReceiveVideo: false, iceRestart: livePeer.attempt > 1 });
    await peer.setLocalDescription(offer);
    await setReliableLiveOffer(activeStreamId, viewerId, livePeer.attempt, { type: offer.type, sdp: offer.sdp });
  };

  const reconcilePeers = (activeStreamId: string, items: LivePeer[], media: MediaStream) => {
    const activeIds = new Set(items.map((item) => item.viewerId));
    for (const viewerId of peersRef.current.keys()) {
      if (!activeIds.has(viewerId)) cleanupPeer(viewerId);
    }
    for (const item of items) {
      const existing = peersRef.current.get(item.viewerId);
      const existingAttempt = existing ? Number((existing as RTCPeerConnection & { __fluxAttempt?: number }).__fluxAttempt || 0) : 0;
      if (existing && existingAttempt !== item.attempt) cleanupPeer(item.viewerId);
      if (!peersRef.current.has(item.viewerId) && item.status !== "failed") {
        void connectViewer(activeStreamId, item, media).then(() => {
          const peer = peersRef.current.get(item.viewerId) as (RTCPeerConnection & { __fluxAttempt?: number }) | undefined;
          if (peer) peer.__fluxAttempt = item.attempt;
        }).catch((error) => {
          console.error("Could not connect live viewer", error);
          cleanupPeer(item.viewerId);
          void setReliableLiveStatus(activeStreamId, item.viewerId, item.attempt, "failed");
        });
      }
    }
  };

  const startLive = async () => {
    if (!user || starting || !title.trim()) return;
    setStarting(true);
    try {
      const capture = captureRef.current || await (async () => { await openCamera(); return captureRef.current; })();
      if (!capture?.stream.getTracks().some((track) => track.readyState === "live")) throw new Error("Open the camera again before going live.");
      const id = await createLiveStream({ hostId: user.uid, title: title.trim(), description: "Live on Flux", category: "Chatting", sourceType: "camera" });
      setStreamId(id);
      setStatus("Live · waiting for viewers");
      globalStopsRef.current.push(subscribeLiveComments(id, setComments));
      globalStopsRef.current.push(subscribeLiveViewerAnalytics(id, (next) => {
        setAnalytics(next);
        void syncLiveAnalytics(id, next).catch(() => undefined);
      }));
      globalStopsRef.current.push(subscribeReliableLivePeers(id, (items) => reconcilePeers(id, items, capture.stream)));
      await attachPreview(capture);
      toast.success("You are live");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not start livestream");
    } finally { setStarting(false); }
  };

  const cleanupEverything = () => {
    globalStopsRef.current.forEach((stop) => stop());
    globalStopsRef.current = [];
    for (const viewerId of [...peersRef.current.keys()]) cleanupPeer(viewerId);
    captureRef.current?.cleanup();
    captureRef.current = null;
  };

  const stopLive = async () => {
    if (streamId) {
      await syncLiveAnalytics(streamId, analytics).catch(() => undefined);
      await endLiveStream(streamId).catch(() => undefined);
    }
    cleanupEverything();
    router.push("/live");
  };

  const copyLink = async () => {
    if (!streamId) return;
    const base = process.env.NEXT_PUBLIC_BASE_PATH || "";
    await navigator.clipboard.writeText(`${window.location.origin}${base}/live/view/?id=${encodeURIComponent(streamId)}`);
    toast.success("Live link copied");
  };

  const postComment = async () => {
    if (!streamId || !user || !comment.trim()) return;
    try { await sendLiveComment(streamId, user.uid, comment.trim()); setComment(""); }
    catch { toast.error("Could not send comment"); }
  };

  const toggleMic = () => {
    const next = !microphoneEnabled;
    setMicrophoneEnabled(next);
    captureRef.current?.stream.getAudioTracks().forEach((track) => { track.enabled = next; });
  };

  const toggleCamera = () => {
    const next = !cameraEnabled;
    setCameraEnabled(next);
    captureRef.current?.stream.getVideoTracks().forEach((track) => { track.enabled = next; });
  };

  return (
    <main className="h-[100dvh] overflow-hidden bg-black text-white">
      <div className="grid h-full lg:grid-cols-[minmax(0,1fr)_360px]">
        <section className="relative h-full overflow-hidden bg-black">
          <video ref={videoRef} autoPlay muted playsInline className="absolute inset-0 h-full w-full object-contain" />
          <div className="pointer-events-none absolute inset-x-0 top-0 h-44 bg-gradient-to-b from-black/90 to-transparent" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-64 bg-gradient-to-t from-black/92 to-transparent" />

          <header className="absolute inset-x-0 top-0 z-20 flex items-center gap-2 px-3 pt-[max(.7rem,env(safe-area-inset-top))] sm:px-5">
            <span className={cn("flex items-center gap-2 rounded-full px-3 py-2 text-[10px] font-black", isLive ? "bg-red-500" : "bg-black/55")}><span className="h-2 w-2 rounded-full bg-white" />{isLive ? "LIVE" : "PREVIEW"}</span>
            <div className="min-w-0 flex-1"><p className="truncate text-sm font-black">{title || "Flux Live Studio"}</p><p className="truncate text-[10px] text-white/58">{status}</p></div>
            {isLive ? <button onClick={() => void copyLink()} className="grid h-10 w-10 place-items-center rounded-full bg-black/55" aria-label="Copy live link"><Copy className="h-4.5 w-4.5" /></button> : null}
            <button onClick={() => void stopLive()} className="grid h-10 w-10 place-items-center rounded-full bg-black/55" aria-label="End or close"><Square className="h-4.5 w-4.5" /></button>
          </header>

          {!previewReady ? <div className="absolute inset-0 grid place-items-center p-6 text-center"><div><span className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-white/8"><Camera className="h-8 w-8 text-white/60" /></span><h1 className="mt-4 text-2xl font-black">Prepare your camera</h1><p className="mt-2 text-sm text-white/48">The preview stays attached to one video element so it cannot turn black when Live starts.</p><button onClick={() => void openCamera()} disabled={preparing} className="mt-5 inline-flex h-12 items-center gap-2 rounded-full bg-white px-6 font-black text-black disabled:opacity-50">{preparing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Video className="h-4 w-4" />}Open camera</button></div></div> : null}

          <div className="absolute inset-x-3 bottom-[max(1rem,env(safe-area-inset-bottom))] z-20 sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2">
            {!isLive ? <div className="w-full max-w-xl rounded-[22px] bg-black/72 p-3 backdrop-blur-xl"><input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Name your live" className="h-11 w-full rounded-full border border-white/14 bg-white/8 px-4 text-sm font-semibold outline-none" /><div className="mt-3 grid grid-cols-[auto_auto_1fr] gap-2"><button onClick={toggleMic} className="grid h-11 w-11 place-items-center rounded-full bg-white/10">{microphoneEnabled ? <Mic className="h-4.5 w-4.5" /> : <MicOff className="h-4.5 w-4.5" />}</button><button onClick={toggleCamera} className="grid h-11 w-11 place-items-center rounded-full bg-white/10">{cameraEnabled ? <Video className="h-4.5 w-4.5" /> : <VideoOff className="h-4.5 w-4.5" />}</button><button onClick={() => void startLive()} disabled={!title.trim() || starting || !previewReady} className="flex h-11 items-center justify-center gap-2 rounded-full bg-red-500 px-6 text-sm font-black disabled:opacity-40"><Radio className="h-4 w-4" />{starting ? "Starting…" : "Go Live"}</button></div></div> : <div className="flex items-center gap-3 rounded-full bg-black/72 px-4 py-3 text-xs font-black backdrop-blur-xl"><Wifi className="h-4 w-4 text-emerald-400" />{connectedViewers} receiving video <span className="text-white/38">·</span><Eye className="h-4 w-4" />{analytics.activeViewers}</div>}
          </div>
        </section>

        <aside className="hidden h-full min-h-0 border-l border-white/10 bg-[#090b0f] lg:flex lg:flex-col">
          <div className="border-b border-white/10 p-4"><div className="flex items-center gap-3"><UserAvatar user={profile} size="sm" clickable={false} /><div><h2 className="font-black">Host chat</h2><p className="text-[11px] text-white/42">Comments appear here in real time</p></div><Settings2 className="ml-auto h-4 w-4 text-white/35" /></div></div>
          <div className="min-h-0 flex-1 overflow-y-auto p-4"><div className="space-y-3">{comments.map((item) => <p key={item.id} className="text-sm"><strong>{item.author?.displayName || "Guest"}</strong> <span className="text-white/68">{item.text}</span></p>)}</div></div>
          <div className="border-t border-white/10 p-3"><div className="flex gap-2"><input value={comment} onChange={(event) => setComment(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void postComment(); }} placeholder="Write as host…" className="h-10 min-w-0 flex-1 rounded-full bg-white/8 px-4 text-sm outline-none" /><button onClick={() => void postComment()} className="grid h-10 w-10 place-items-center rounded-full bg-white text-black"><Send className="h-4 w-4" /></button></div></div>
        </aside>
      </div>
    </main>
  );
}
