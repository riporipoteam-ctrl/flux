"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Activity,
  Camera,
  Clock3,
  Copy,
  Eye,
  Loader2,
  Mic,
  MicOff,
  MonitorUp,
  Radio,
  ScreenShare,
  Send,
  Settings2,
  Signal,
  Square,
  Users,
  Video,
  VideoOff,
  Wifi,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/auth-context";
import {
  addLiveCandidate,
  createLiveStream,
  endLiveStream,
  sendLiveComment,
  setLivePeerOffer,
  setLivePeerStatus,
  subscribeLiveCandidates,
  subscribeLiveComments,
  subscribeLivePeer,
  subscribeLivePeers,
  subscribeLiveViewerAnalytics,
  syncLiveAnalytics,
  type LiveComment,
  type LivePeer,
  type LiveViewerAnalytics,
} from "@/services/live";
import {
  captureFluxMedia,
  createIceCandidateQueue,
  describeMediaError,
  getFluxIceServers,
  listMediaDevices,
  mediaCaptureReady,
  supportsScreenShare,
  type CapturedMedia,
  type IceCandidateQueue,
  type LiveSourceMode,
} from "@/lib/webrtc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const EMPTY_ANALYTICS: LiveViewerAnalytics = {
  activeViewers: 0,
  uniqueViewers: 0,
  totalWatchSeconds: 0,
  likesCount: 0,
  sharesCount: 0,
};

const CATEGORIES = ["Chatting", "Gaming", "Music", "Creative", "News", "Sports", "Education"];

function isIOSBrowser(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent)
    || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

export default function LiveStudioV2() {
  const { user } = useAuth();
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const captureRef = useRef<CapturedMedia | null>(null);
  const peersRef = useRef(new Map<string, RTCPeerConnection>());
  const queuesRef = useRef(new Map<string, IceCandidateQueue>());
  const peerSubscriptionsRef = useRef(new Map<string, Array<() => void>>());
  const globalSubscriptionsRef = useRef<Array<() => void>>([]);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("Chatting");
  const [source, setSource] = useState<LiveSourceMode>("camera");
  const [microphoneEnabled, setMicrophoneEnabled] = useState(true);
  const [cameraEnabled, setCameraEnabled] = useState(true);
  const [systemAudioEnabled, setSystemAudioEnabled] = useState(true);
  const [microphones, setMicrophones] = useState<MediaDeviceInfo[]>([]);
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [audioInputId, setAudioInputId] = useState("");
  const [videoInputId, setVideoInputId] = useState("");
  const [previewReady, setPreviewReady] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [starting, setStarting] = useState(false);
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [mediaStatus, setMediaStatus] = useState("Open your camera or screen to begin");
  const [streamId, setStreamId] = useState<string | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [secondsLive, setSecondsLive] = useState(0);
  const [analytics, setAnalytics] = useState<LiveViewerAnalytics>(EMPTY_ANALYTICS);
  const [peakViewers, setPeakViewers] = useState(0);
  const [connectedViewers, setConnectedViewers] = useState(0);
  const [comments, setComments] = useState<LiveComment[]>([]);
  const [comment, setComment] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);

  const captureSupported = useMemo(mediaCaptureReady, []);
  const screenSupported = useMemo(() => supportsScreenShare() && !isIOSBrowser(), []);
  const isLive = Boolean(streamId);

  useEffect(() => {
    void refreshDevices();
  }, []);

  useEffect(() => {
    if (!startedAt) return;
    const timer = window.setInterval(() => {
      setSecondsLive(Math.floor((Date.now() - startedAt) / 1000));
    }, 1_000);
    return () => window.clearInterval(timer);
  }, [startedAt]);

  useEffect(() => () => cleanupEverything(), []);

  const attachPreview = async (capture = captureRef.current) => {
    const element = videoRef.current;
    if (!element || !capture) return;
    if (element.srcObject !== capture.stream) element.srcObject = capture.stream;
    element.muted = true;
    element.playsInline = true;
    await element.play().catch(() => undefined);
  };

  const refreshDevices = async () => {
    const devices = await listMediaDevices().catch(() => ({ microphones: [], cameras: [] }));
    setMicrophones(devices.microphones);
    setCameras(devices.cameras);
    setAudioInputId((current) => current || devices.microphones[0]?.deviceId || "");
    setVideoInputId((current) => current || devices.cameras[0]?.deviceId || "");
  };

  const stopCapture = () => {
    captureRef.current?.cleanup();
    captureRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setPreviewReady(false);
  };

  const openPreview = async (): Promise<CapturedMedia | null> => {
    if (!captureSupported) {
      const message = "Camera and microphone require HTTPS and browser permission.";
      setPermissionError(message);
      toast.error(message);
      return null;
    }
    if (source === "screen" && !screenSupported) {
      const message = isIOSBrowser()
        ? "iPhone and iPad browsers cannot broadcast the screen from a normal web page. Camera live works here; screen sharing needs desktop Chrome, Edge or Safari."
        : "This browser does not support screen sharing.";
      setPermissionError(message);
      toast.error(message);
      return null;
    }

    setPreparing(true);
    setPermissionError(null);
    stopCapture();
    try {
      const capture = await captureFluxMedia({
        source,
        microphone: microphoneEnabled,
        camera: cameraEnabled,
        systemAudio: systemAudioEnabled,
        audioInputId: audioInputId || undefined,
        videoInputId: videoInputId || undefined,
      });
      captureRef.current = capture;
      setPreviewReady(true);
      setMediaStatus(`${capture.source === "screen" ? "Screen" : "Camera"} ready · ${capture.stream.getVideoTracks().length ? "video" : "no video"} · ${capture.stream.getAudioTracks().length ? "audio" : "no audio"}`);
      const videoTrack = capture.stream.getVideoTracks()[0];
      videoTrack?.addEventListener("ended", () => {
        setMediaStatus("The selected media source ended");
        if (streamId) toast.error("Your broadcast source ended. End the live or open a new source.");
        else setPreviewReady(false);
      }, { once: true });
      await refreshDevices();
      window.requestAnimationFrame(() => void attachPreview(capture));
      return capture;
    } catch (error) {
      const message = describeMediaError(error);
      setPermissionError(message);
      setMediaStatus("Could not open media");
      toast.error(message);
      return null;
    } finally {
      setPreparing(false);
    }
  };

  const cleanupPeer = (viewerId: string) => {
    peerSubscriptionsRef.current.get(viewerId)?.forEach((unsubscribe) => unsubscribe());
    peerSubscriptionsRef.current.delete(viewerId);
    queuesRef.current.get(viewerId)?.clear();
    queuesRef.current.delete(viewerId);
    peersRef.current.get(viewerId)?.close();
    peersRef.current.delete(viewerId);
    setConnectedViewers([...peersRef.current.values()].filter((peer) => peer.connectionState === "connected").length);
  };

  const connectViewer = async (
    activeStreamId: string,
    livePeer: LivePeer,
    media: MediaStream
  ) => {
    const viewerId = livePeer.viewerId;
    if (peersRef.current.has(viewerId) || livePeer.status === "failed") return;

    const peer = new RTCPeerConnection({
      iceServers: getFluxIceServers(),
      iceCandidatePoolSize: 4,
      bundlePolicy: "max-bundle",
    });
    const queue = createIceCandidateQueue(peer);
    peersRef.current.set(viewerId, peer);
    queuesRef.current.set(viewerId, queue);
    media.getTracks().filter((track) => track.readyState === "live").forEach((track) => peer.addTrack(track, media));

    peer.onicecandidate = (event) => {
      if (event.candidate) void addLiveCandidate(activeStreamId, viewerId, "host", event.candidate.toJSON());
    };
    peer.onconnectionstatechange = () => {
      setConnectedViewers([...peersRef.current.values()].filter((item) => item.connectionState === "connected").length);
      if (peer.connectionState === "connected") {
        void setLivePeerStatus(activeStreamId, viewerId, "connected");
      } else if (peer.connectionState === "failed") {
        void setLivePeerStatus(activeStreamId, viewerId, "failed");
        cleanupPeer(viewerId);
      } else if (peer.connectionState === "closed") {
        cleanupPeer(viewerId);
      }
    };
    peer.oniceconnectionstatechange = () => {
      if (peer.iceConnectionState === "failed") {
        try { peer.restartIce(); } catch { /* viewer retry creates a new handshake */ }
      }
    };

    const subscriptions = [
      subscribeLiveCandidates(activeStreamId, viewerId, "viewer", (candidate) => void queue.add(candidate)),
      subscribeLivePeer(activeStreamId, viewerId, (data) => {
        if (!data?.answer || peer.remoteDescription?.sdp === data.answer.sdp) return;
        void peer.setRemoteDescription(new RTCSessionDescription(data.answer))
          .then(() => queue.flush())
          .catch((error) => console.error("Host could not apply live answer", error));
      }),
    ];
    peerSubscriptionsRef.current.set(viewerId, subscriptions);

    const offer = await peer.createOffer({
      offerToReceiveAudio: false,
      offerToReceiveVideo: false,
      iceRestart: livePeer.attempt > 1,
    });
    await peer.setLocalDescription(offer);
    await setLivePeerOffer(activeStreamId, viewerId, { type: offer.type, sdp: offer.sdp });
  };

  const reconcilePeers = (activeStreamId: string, items: LivePeer[], media: MediaStream) => {
    const currentIds = new Set(items.map((item) => item.viewerId));
    for (const viewerId of peersRef.current.keys()) {
      if (!currentIds.has(viewerId)) cleanupPeer(viewerId);
    }
    for (const item of items) {
      if (!peersRef.current.has(item.viewerId) && item.status !== "failed") {
        void connectViewer(activeStreamId, item, media).catch((error) => {
          console.error("Could not connect live viewer", error);
          cleanupPeer(item.viewerId);
          void setLivePeerStatus(activeStreamId, item.viewerId, "failed");
        });
      }
    }
  };

  const startLive = async () => {
    if (!user || starting || !title.trim()) return;
    setStarting(true);
    try {
      const capture = captureRef.current || await openPreview();
      if (!capture) return;
      if (!capture.stream.getTracks().some((track) => track.readyState === "live")) {
        throw new Error("The selected camera or screen is no longer active. Open preview again.");
      }

      const id = await createLiveStream({
        hostId: user.uid,
        title: title.trim(),
        description: description.trim(),
        category,
        sourceType: capture.source,
      });
      setStreamId(id);
      setStartedAt(Date.now());
      setSecondsLive(0);
      setSettingsOpen(false);

      globalSubscriptionsRef.current.push(subscribeLiveComments(id, setComments));
      globalSubscriptionsRef.current.push(subscribeLiveViewerAnalytics(id, (next) => {
        setAnalytics(next);
        setPeakViewers((current) => Math.max(current, next.activeViewers));
        void syncLiveAnalytics(id, next).catch(() => undefined);
      }));
      globalSubscriptionsRef.current.push(subscribeLivePeers(id, (items) => reconcilePeers(id, items, capture.stream)));

      window.requestAnimationFrame(() => void attachPreview(capture));
      toast.success("You are live");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not start the livestream");
    } finally {
      setStarting(false);
    }
  };

  const cleanupEverything = () => {
    globalSubscriptionsRef.current.forEach((unsubscribe) => unsubscribe());
    globalSubscriptionsRef.current = [];
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

  const toggleMicrophone = () => {
    const next = !microphoneEnabled;
    setMicrophoneEnabled(next);
    captureRef.current?.stream.getAudioTracks().forEach((track) => { track.enabled = next; });
  };

  const toggleCamera = () => {
    const next = !cameraEnabled;
    setCameraEnabled(next);
    if (source === "camera") captureRef.current?.stream.getVideoTracks().forEach((track) => { track.enabled = next; });
  };

  const copyLink = async () => {
    if (!streamId) return;
    const base = process.env.NEXT_PUBLIC_BASE_PATH || "";
    await navigator.clipboard.writeText(`${window.location.origin}${base}/live/view/?id=${encodeURIComponent(streamId)}`);
    toast.success("Live link copied");
  };

  const postComment = async () => {
    if (!streamId || !user || !comment.trim()) return;
    try {
      await sendLiveComment(streamId, user.uid, comment.trim());
      setComment("");
    } catch {
      toast.error("Could not send this comment");
    }
  };

  return (
    <main className="flux-live-stage min-h-screen text-white">
      <header className="sticky top-0 z-50 border-b border-white/10 bg-black/75 backdrop-blur-2xl">
        <div className="mx-auto flex min-h-16 max-w-[1500px] items-center gap-3 px-3 sm:px-5">
          <span className={cn("flex items-center gap-2 rounded-full px-3 py-2 text-xs font-black", isLive ? "bg-red-500" : "bg-white/10 text-white/70")}>
            <span className={cn("h-2 w-2 rounded-full", isLive ? "flux-live-status-dot bg-white" : "bg-white/35")} />{isLive ? "LIVE" : "PREVIEW"}
          </span>
          <div className="min-w-0 flex-1"><h1 className="truncate text-base font-black">{title.trim() || "Flux Live Studio"}</h1><p className="truncate text-[11px] text-white/45">{mediaStatus}</p></div>
          {isLive ? <button type="button" onClick={() => void copyLink()} className="grid h-11 w-11 place-items-center rounded-full bg-white/10 hover:bg-white/15" aria-label="Copy viewer link"><Copy className="h-5 w-5" /></button> : null}
          <button type="button" onClick={() => setSettingsOpen((value) => !value)} className="grid h-11 w-11 place-items-center rounded-full bg-white/10 hover:bg-white/15 lg:hidden" aria-label="Open live settings"><Settings2 className="h-5 w-5" /></button>
          {isLive ? <Button onClick={() => void stopLive()} className="h-11 rounded-full bg-white px-5 font-black text-black hover:bg-white/90"><Square className="h-4 w-4 fill-current" />End</Button> : <Button onClick={() => void startLive()} disabled={starting || !previewReady || !title.trim()} className="h-11 rounded-full bg-red-500 px-5 font-black text-white hover:bg-red-600">{starting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Radio className="h-4 w-4" />}Go live</Button>}
        </div>
      </header>

      <div className="mx-auto grid min-h-[calc(100dvh-4rem)] max-w-[1500px] lg:grid-cols-[minmax(0,1fr)_380px]">
        <section className="relative flex min-h-[64dvh] items-center justify-center overflow-hidden bg-black lg:min-h-[calc(100dvh-4rem)]">
          <video ref={videoRef} autoPlay muted playsInline className="h-full max-h-[calc(100dvh-4rem)] w-full object-contain" />
          {!previewReady ? <div className="absolute inset-0 grid place-items-center p-6 text-center"><div className="max-w-sm"><span className="mx-auto grid h-20 w-20 place-items-center rounded-[28px] bg-white/8"><Video className="h-8 w-8 text-white/45" /></span><h2 className="mt-5 text-2xl font-black">Open your preview</h2><p className="mt-2 text-sm leading-6 text-white/45">Check camera, microphone and framing before you broadcast.</p><Button onClick={() => void openPreview()} disabled={preparing} className="mt-5 h-12 rounded-full bg-white px-6 font-black text-black hover:bg-white/90">{preparing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}Open preview</Button></div></div> : null}
          {isLive ? <div className="absolute left-4 top-4 flex flex-wrap gap-2"><StatusPill icon={Eye} text={`${analytics.activeViewers} watching`} /><StatusPill icon={Signal} text={`${connectedViewers} media links`} /><StatusPill icon={Clock3} text={formatDuration(secondsLive)} /></div> : null}
          {previewReady ? <div className="absolute bottom-5 left-1/2 flex -translate-x-1/2 items-center gap-3 rounded-full border border-white/10 bg-black/65 p-2 backdrop-blur-2xl"><ControlButton active={microphoneEnabled} label={microphoneEnabled ? "Mute microphone" : "Unmute microphone"} onClick={toggleMicrophone}>{microphoneEnabled ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}</ControlButton><ControlButton active={cameraEnabled} label={cameraEnabled ? "Turn camera off" : "Turn camera on"} onClick={toggleCamera}>{cameraEnabled ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}</ControlButton>{!isLive ? <button type="button" onClick={() => void openPreview()} className="grid h-12 w-12 place-items-center rounded-full bg-white/10 hover:bg-white/20" aria-label="Restart preview"><Activity className="h-5 w-5" /></button> : null}</div> : null}
        </section>

        <aside className={cn("flex flex-col border-l border-white/10 bg-[#0d1016]/96 backdrop-blur-xl", settingsOpen ? "fixed inset-0 z-[70]" : "hidden lg:flex")}>
          <div className="flex items-center border-b border-white/10 px-5 py-4"><div><h2 className="font-black">{isLive ? "Live control room" : "Broadcast settings"}</h2><p className="mt-0.5 text-[11px] text-white/40">Firebase signaling · direct WebRTC media</p></div>{settingsOpen ? <button type="button" onClick={() => setSettingsOpen(false)} className="ml-auto grid h-10 w-10 place-items-center rounded-full bg-white/8"><X className="h-5 w-5" /></button> : null}</div>

          <div className="min-h-0 flex-1 overflow-y-auto p-5">
            {!isLive ? <>
              <label className="text-xs font-bold text-white/50">Title</label><Input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={100} placeholder="What are you streaming?" className="mt-2 h-12 rounded-xl border-white/10 bg-white/5 text-white" />
              <label className="mt-4 block text-xs font-bold text-white/50">Description</label><textarea value={description} onChange={(event) => setDescription(event.target.value)} maxLength={500} rows={3} className="mt-2 w-full resize-none rounded-xl border border-white/10 bg-white/5 p-3 text-sm outline-none focus:border-blue-400/60" placeholder="Tell viewers what to expect" />
              <label className="mt-4 block text-xs font-bold text-white/50">Category</label><select value={category} onChange={(event) => setCategory(event.target.value)} className="mt-2 h-12 w-full rounded-xl border border-white/10 bg-[#151922] px-3 text-sm">{CATEGORIES.map((item) => <option key={item}>{item}</option>)}</select>
              <div className="mt-5 grid grid-cols-2 gap-2"><SourceButton active={source === "camera"} icon={Camera} label="Camera" onClick={() => setSource("camera")} /><SourceButton active={source === "screen"} disabled={!screenSupported} icon={ScreenShare} label="Screen" onClick={() => setSource("screen")} /></div>
              <div className="mt-4 space-y-3 rounded-2xl border border-white/8 bg-white/[.035] p-4"><ToggleRow label="Microphone" checked={microphoneEnabled} onClick={() => setMicrophoneEnabled((value) => !value)} /><ToggleRow label="Camera" checked={cameraEnabled} disabled={source === "screen"} onClick={() => setCameraEnabled((value) => !value)} />{source === "screen" ? <ToggleRow label="System audio" checked={systemAudioEnabled} onClick={() => setSystemAudioEnabled((value) => !value)} /> : null}</div>
              {microphones.length ? <><label className="mt-4 block text-xs font-bold text-white/50">Microphone</label><select value={audioInputId} onChange={(event) => setAudioInputId(event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-white/10 bg-[#151922] px-3 text-xs">{microphones.map((device, index) => <option key={device.deviceId} value={device.deviceId}>{device.label || `Microphone ${index + 1}`}</option>)}</select></> : null}
              {source === "camera" && cameras.length ? <><label className="mt-4 block text-xs font-bold text-white/50">Camera</label><select value={videoInputId} onChange={(event) => setVideoInputId(event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-white/10 bg-[#151922] px-3 text-xs">{cameras.map((device, index) => <option key={device.deviceId} value={device.deviceId}>{device.label || `Camera ${index + 1}`}</option>)}</select></> : null}
              {permissionError ? <p className="mt-4 rounded-xl border border-red-400/20 bg-red-500/10 p-3 text-xs leading-5 text-red-200">{permissionError}</p> : null}
              <Button onClick={() => void openPreview()} disabled={preparing} className="mt-5 h-12 w-full rounded-xl bg-white font-black text-black hover:bg-white/90">{preparing ? <Loader2 className="h-4 w-4 animate-spin" /> : source === "screen" ? <MonitorUp className="h-4 w-4" /> : <Camera className="h-4 w-4" />}Open {source} preview</Button>
            </> : <>
              <div className="grid grid-cols-2 gap-2"><Metric icon={Users} label="Active" value={analytics.activeViewers} /><Metric icon={Wifi} label="Connected" value={connectedViewers} /><Metric icon={Eye} label="Reached" value={analytics.uniqueViewers} /><Metric icon={Activity} label="Peak" value={peakViewers} /></div>
              <div className="mt-5 flex items-center gap-2"><Button onClick={() => void copyLink()} className="h-11 flex-1 rounded-xl bg-white text-black hover:bg-white/90"><Copy className="h-4 w-4" />Copy link</Button><Button onClick={() => void stopLive()} className="h-11 flex-1 rounded-xl bg-red-500 text-white hover:bg-red-600"><Square className="h-4 w-4 fill-current" />End live</Button></div>
              <div className="mt-6 border-t border-white/10 pt-5"><h3 className="font-black">Host chat</h3><div className="mt-3 max-h-72 space-y-3 overflow-y-auto rounded-2xl bg-black/20 p-3">{comments.length ? comments.map((item) => <div key={item.id} className="text-sm"><strong>{item.author?.displayName || "Viewer"}</strong><span className="ml-2 text-white/60">{item.text}</span></div>) : <p className="py-8 text-center text-xs text-white/35">No comments yet</p>}</div><div className="mt-3 flex gap-2"><Input value={comment} onChange={(event) => setComment(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void postComment(); }} placeholder="Comment as host" className="h-11 rounded-full border-white/10 bg-white/5 text-white" /><Button size="icon" onClick={() => void postComment()} disabled={!comment.trim()} className="h-11 w-11 rounded-full"><Send className="h-4 w-4" /></Button></div></div>
            </>}
          </div>
        </aside>
      </div>
    </main>
  );
}

function ControlButton({ active, label, onClick, children }: { active: boolean; label: string; onClick: () => void; children: React.ReactNode }) {
  return <button type="button" onClick={onClick} aria-label={label} className={cn("grid h-12 w-12 place-items-center rounded-full", active ? "bg-white text-black" : "bg-red-500 text-white")}>{children}</button>;
}

function SourceButton({ active, disabled, icon: Icon, label, onClick }: { active: boolean; disabled?: boolean; icon: typeof Camera; label: string; onClick: () => void }) {
  return <button type="button" disabled={disabled} onClick={onClick} className={cn("flex h-20 flex-col items-center justify-center gap-2 rounded-2xl border text-sm font-bold", active ? "border-blue-400/60 bg-blue-400/12" : "border-white/8 bg-white/[.035]", disabled && "cursor-not-allowed opacity-30")}><Icon className="h-5 w-5" />{label}</button>;
}

function ToggleRow({ label, checked, disabled, onClick }: { label: string; checked: boolean; disabled?: boolean; onClick: () => void }) {
  return <button type="button" disabled={disabled} onClick={onClick} className="flex w-full items-center justify-between text-sm disabled:opacity-35"><span>{label}</span><span className={cn("relative h-6 w-11 rounded-full", checked ? "bg-blue-500" : "bg-white/15")}><span className={cn("absolute top-1 h-4 w-4 rounded-full bg-white transition-transform", checked ? "translate-x-6" : "translate-x-1")} /></span></button>;
}

function StatusPill({ icon: Icon, text }: { icon: typeof Eye; text: string }) {
  return <span className="flex items-center gap-1.5 rounded-full bg-black/65 px-3 py-1.5 text-[11px] font-bold backdrop-blur-xl"><Icon className="h-3.5 w-3.5" />{text}</span>;
}

function Metric({ icon: Icon, label, value }: { icon: typeof Users; label: string; value: number }) {
  return <div className="rounded-2xl border border-white/8 bg-white/[.035] p-4"><Icon className="h-4 w-4 text-white/40" /><strong className="mt-3 block text-2xl">{value}</strong><span className="text-[11px] text-white/35">{label}</span></div>;
}

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remaining = seconds % 60;
  return hours ? `${hours}:${String(minutes).padStart(2, "0")}:${String(remaining).padStart(2, "0")}` : `${minutes}:${String(remaining).padStart(2, "0")}`;
}
