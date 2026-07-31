"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Activity,
  Camera,
  CheckCircle2,
  Clipboard,
  Clock3,
  Copy,
  Eye,
  Heart,
  Loader2,
  MessageCircle,
  Mic,
  MicOff,
  MonitorUp,
  Radio,
  ScreenShare,
  Settings2,
  Share2,
  Square,
  Users,
  Video,
  VideoOff,
  Volume2,
  Wifi,
  XCircle,
} from "lucide-react";
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
  subscribeLiveViewerAnalytics,
  syncLiveAnalytics,
  type LiveComment,
  type LiveViewerAnalytics,
} from "@/services/live";
import {
  captureFluxMedia,
  describeMediaError,
  getFluxIceServers,
  listMediaDevices,
  mediaCaptureReady,
  supportsScreenShare,
  type CapturedMedia,
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

export default function CreateLivePage() {
  const { user } = useAuth();
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const capturedRef = useRef<CapturedMedia | null>(null);
  const peers = useRef(new Map<string, RTCPeerConnection>());
  const handled = useRef(new Set<string>());
  const cleanup = useRef<Array<() => void>>([]);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("Chatting");
  const [source, setSource] = useState<LiveSourceMode>("camera");
  const [microphone, setMicrophone] = useState(true);
  const [camera, setCamera] = useState(true);
  const [systemAudio, setSystemAudio] = useState(true);
  const [microphones, setMicrophones] = useState<MediaDeviceInfo[]>([]);
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [audioInputId, setAudioInputId] = useState("");
  const [videoInputId, setVideoInputId] = useState("");
  const [preparing, setPreparing] = useState(false);
  const [previewReady, setPreviewReady] = useState(false);
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [streamId, setStreamId] = useState<string | null>(null);
  const [analytics, setAnalytics] = useState<LiveViewerAnalytics>(EMPTY_ANALYTICS);
  const [peak, setPeak] = useState(0);
  const [comments, setComments] = useState<LiveComment[]>([]);
  const [comment, setComment] = useState("");
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [secondsLive, setSecondsLive] = useState(0);
  const [connectedPeers, setConnectedPeers] = useState(0);

  const screenSupported = useMemo(() => supportsScreenShare(), []);
  const captureSupported = useMemo(() => mediaCaptureReady(), []);

  useEffect(() => {
    if (!startedAt) return;
    const timer = window.setInterval(
      () => setSecondsLive(Math.floor((Date.now() - startedAt) / 1000)),
      1000
    );
    return () => window.clearInterval(timer);
  }, [startedAt]);

  useEffect(() => () => {
    cleanup.current.forEach((fn) => fn());
    cleanup.current = [];
    peers.current.forEach((peer) => peer.close());
    peers.current.clear();
    capturedRef.current?.cleanup();
    capturedRef.current = null;
  }, []);

  const refreshDevices = async () => {
    const devices = await listMediaDevices().catch(() => ({ microphones: [], cameras: [] }));
    setMicrophones(devices.microphones);
    setCameras(devices.cameras);
    if (!audioInputId && devices.microphones[0]?.deviceId) setAudioInputId(devices.microphones[0].deviceId);
    if (!videoInputId && devices.cameras[0]?.deviceId) setVideoInputId(devices.cameras[0].deviceId);
  };

  const stopPreview = () => {
    capturedRef.current?.cleanup();
    capturedRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setPreviewReady(false);
  };

  const prepareMedia = async (): Promise<CapturedMedia | null> => {
    if (!captureSupported) {
      const message = "Camera and microphone require HTTPS or the installed Flux app.";
      setPermissionError(message);
      toast.error(message);
      return null;
    }

    setPreparing(true);
    setPermissionError(null);
    stopPreview();

    try {
      const captured = await captureFluxMedia({
        source,
        microphone,
        camera,
        systemAudio,
        audioInputId: audioInputId || undefined,
        videoInputId: videoInputId || undefined,
      });
      capturedRef.current = captured;
      if (videoRef.current) {
        videoRef.current.srcObject = captured.stream;
        await videoRef.current.play().catch(() => undefined);
      }
      const displayTrack = captured.stream.getVideoTracks()[0];
      if (source === "screen" && displayTrack) {
        displayTrack.addEventListener("ended", () => {
          if (!streamId) stopPreview();
          else toast.message("Screen sharing ended. End the live or start a new screen live.");
        }, { once: true });
      }
      setPreviewReady(true);
      await refreshDevices();
      return captured;
    } catch (error) {
      const message = describeMediaError(error);
      setPermissionError(message);
      toast.error(message);
      return null;
    } finally {
      setPreparing(false);
    }
  };

  const start = async () => {
    if (!user || starting || !title.trim()) return;
    setStarting(true);
    try {
      const captured = capturedRef.current || await prepareMedia();
      if (!captured) return;

      const id = await createLiveStream({
        hostId: user.uid,
        title,
        description,
        category,
        sourceType: source,
      });
      setStreamId(id);
      setStartedAt(Date.now());

      cleanup.current.push(subscribeLiveComments(id, setComments));
      cleanup.current.push(subscribeLiveViewerAnalytics(id, (next) => {
        setAnalytics(next);
        setPeak((value) => Math.max(value, next.activeViewers));
        void syncLiveAnalytics(id, next).catch(() => undefined);
      }));
      cleanup.current.push(subscribeLivePeers(id, (items) => {
        for (const peerData of items) {
          if (handled.current.has(peerData.viewerId)) continue;
          handled.current.add(peerData.viewerId);
          void connectViewer(id, peerData.viewerId, captured.stream);
        }
      }));
      toast.success("You are live");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not start livestream");
    } finally {
      setStarting(false);
    }
  };

  const connectViewer = async (id: string, viewerId: string, media: MediaStream) => {
    const peer = new RTCPeerConnection({ iceServers: getFluxIceServers() });
    peers.current.set(viewerId, peer);
    media.getTracks().forEach((track) => peer.addTrack(track, media));

    peer.onicecandidate = (event) => {
      if (event.candidate) void addLiveCandidate(id, viewerId, "host", event.candidate.toJSON());
    };
    peer.onconnectionstatechange = () => {
      const connected = [...peers.current.values()].filter((item) => item.connectionState === "connected").length;
      setConnectedPeers(connected);
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
    if (streamId) {
      await syncLiveAnalytics(streamId, analytics).catch(() => undefined);
      await endLiveStream(streamId).catch(() => undefined);
    }
    cleanup.current.forEach((fn) => fn());
    cleanup.current = [];
    peers.current.forEach((peer) => peer.close());
    peers.current.clear();
    capturedRef.current?.cleanup();
    capturedRef.current = null;
    router.push("/live");
  };

  const toggleMic = () => {
    const next = !microphone;
    setMicrophone(next);
    capturedRef.current?.stream.getAudioTracks().forEach((track) => { track.enabled = next; });
  };

  const toggleCamera = () => {
    const next = !camera;
    setCamera(next);
    capturedRef.current?.stream.getVideoTracks().forEach((track) => { track.enabled = next; });
  };

  const postComment = async () => {
    if (!streamId || !user || !comment.trim()) return;
    await sendLiveComment(streamId, user.uid, comment);
    setComment("");
  };

  const copyLiveLink = async () => {
    if (!streamId) return;
    const base = process.env.NEXT_PUBLIC_BASE_PATH || "";
    const url = `${window.location.origin}${base}/live/view/?id=${encodeURIComponent(streamId)}`;
    await navigator.clipboard.writeText(url);
    toast.success("Live link copied");
  };

  if (!streamId) {
    return (
      <main className="min-h-screen bg-[#f6f7f9] pb-24 text-[#101114] dark:bg-black dark:text-white">
        <header className="sticky top-0 z-40 border-b border-black/5 bg-white/90 px-4 py-3 backdrop-blur-xl dark:border-white/10 dark:bg-black/85">
          <div className="mx-auto flex max-w-6xl items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-2xl bg-red-500 text-white shadow-sm"><Radio className="h-5 w-5" /></span>
            <div className="min-w-0 flex-1">
              <h1 className="text-lg font-black tracking-tight">Flux Live Studio</h1>
              <p className="text-xs text-black/55 dark:text-white/55">Preview everything before viewers see it</p>
            </div>
            <span className={cn("hidden items-center gap-2 rounded-full px-3 py-1.5 text-xs font-bold sm:flex", captureSupported ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300" : "bg-red-50 text-red-700 dark:bg-red-500/15 dark:text-red-300")}>{captureSupported ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}{captureSupported ? "Media ready" : "HTTPS required"}</span>
          </div>
        </header>

        <div className="mx-auto grid max-w-6xl gap-5 p-3 sm:p-5 lg:grid-cols-[minmax(0,1.25fr)_minmax(330px,.75fr)]">
          <section className="overflow-hidden rounded-[28px] border border-black/5 bg-[#090a0c] shadow-[0_24px_80px_rgba(0,0,0,.14)] dark:border-white/10">
            <div className="relative aspect-video min-h-[260px] bg-black">
              <video ref={videoRef} autoPlay muted playsInline className="h-full w-full object-contain" />
              {!previewReady ? (
                <div className="absolute inset-0 grid place-items-center bg-[radial-gradient(circle_at_center,#202329_0,#090a0c_70%)] p-8 text-center">
                  <div>
                    <span className="mx-auto grid h-16 w-16 place-items-center rounded-3xl bg-white/8 text-white/80"><Camera className="h-7 w-7" /></span>
                    <h2 className="mt-5 text-xl font-black text-white">Your preview appears here</h2>
                    <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-white/50">Choose camera or screen, check your sound, then start. Nothing is published during preview.</p>
                  </div>
                </div>
              ) : null}
              <div className="absolute left-4 top-4 flex items-center gap-2">
                <span className="rounded-full bg-black/60 px-3 py-1.5 text-[11px] font-black text-white backdrop-blur-xl">PREVIEW</span>
                <span className="rounded-full bg-black/60 px-3 py-1.5 text-[11px] font-bold text-white/75 backdrop-blur-xl">{source === "screen" ? "Screen" : "Camera"}</span>
              </div>
              {previewReady ? (
                <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 gap-2 rounded-full bg-black/65 p-2 backdrop-blur-xl">
                  <button type="button" onClick={toggleMic} className={cn("grid h-11 w-11 place-items-center rounded-full", microphone ? "bg-white/15 text-white" : "bg-white text-black")} aria-label="Toggle microphone">{microphone ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}</button>
                  <button type="button" onClick={toggleCamera} disabled={source === "screen"} className={cn("grid h-11 w-11 place-items-center rounded-full disabled:opacity-35", camera ? "bg-white/15 text-white" : "bg-white text-black")} aria-label="Toggle camera">{camera ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}</button>
                  <button type="button" onClick={stopPreview} className="grid h-11 w-11 place-items-center rounded-full bg-red-500 text-white" aria-label="Stop preview"><Square className="h-4 w-4 fill-current" /></button>
                </div>
              ) : null}
            </div>

            <div className="grid gap-3 border-t border-white/10 bg-[#111318] p-4 sm:grid-cols-3">
              <PreviewSignal icon={microphone ? Mic : MicOff} label="Microphone" value={microphone ? "On" : "Off"} ok={microphone} />
              <PreviewSignal icon={source === "screen" ? MonitorUp : Camera} label="Video source" value={source === "screen" ? "Screen" : camera ? "Camera" : "Off"} ok={previewReady} />
              <PreviewSignal icon={Wifi} label="Connection" value={process.env.NEXT_PUBLIC_TURN_URL ? "TURN ready" : "Direct P2P"} ok />
            </div>
          </section>

          <section className="space-y-4">
            <div className="rounded-[28px] border border-black/5 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-[#101114]">
              <div className="flex items-center gap-2"><Settings2 className="h-5 w-5 text-primary" /><h2 className="font-black">Stream source</h2></div>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <SourceButton active={source === "camera"} icon={Camera} title="Camera" description="Face camera or device camera" onClick={() => { stopPreview(); setSource("camera"); }} />
                <SourceButton active={source === "screen"} disabled={!screenSupported} icon={ScreenShare} title="Share screen" description={screenSupported ? "Window, tab, or display" : "Not supported here"} onClick={() => { stopPreview(); setSource("screen"); }} />
              </div>

              <div className="mt-4 space-y-2">
                <ToggleRow icon={Mic} label="Microphone" description="Noise suppression and echo cancellation" checked={microphone} onChange={(value) => { setMicrophone(value); if (previewReady) stopPreview(); }} />
                {source === "camera" ? <ToggleRow icon={Video} label="Camera" description="720p target with adaptive frame rate" checked={camera} onChange={(value) => { setCamera(value); if (previewReady) stopPreview(); }} /> : null}
                {source === "screen" ? <ToggleRow icon={Volume2} label="Screen audio" description="Browser support varies by shared source" checked={systemAudio} onChange={(value) => { setSystemAudio(value); if (previewReady) stopPreview(); }} /> : null}
              </div>

              {(microphones.length || cameras.length) ? (
                <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                  {microphones.length ? <DeviceSelect label="Microphone" value={audioInputId} devices={microphones} onChange={(value) => { setAudioInputId(value); if (previewReady) stopPreview(); }} /> : null}
                  {source === "camera" && cameras.length ? <DeviceSelect label="Camera" value={videoInputId} devices={cameras} onChange={(value) => { setVideoInputId(value); if (previewReady) stopPreview(); }} /> : null}
                </div>
              ) : null}

              <Button onClick={() => void prepareMedia()} disabled={preparing || (source === "screen" && !screenSupported)} variant="outline" className="mt-4 h-11 w-full rounded-full border-black/10 dark:border-white/15">
                {preparing ? <Loader2 className="h-4 w-4 animate-spin" /> : source === "screen" ? <MonitorUp className="h-4 w-4" /> : <Camera className="h-4 w-4" />}
                {previewReady ? "Restart preview" : source === "screen" ? "Choose screen to preview" : "Preview camera and mic"}
              </Button>
              {permissionError ? <p className="mt-3 rounded-2xl bg-red-50 p-3 text-xs font-semibold leading-5 text-red-700 dark:bg-red-500/10 dark:text-red-300">{permissionError}</p> : null}
            </div>

            <div className="rounded-[28px] border border-black/5 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-[#101114]">
              <h2 className="font-black">Live details</h2>
              <div className="mt-4 space-y-4">
                <label className="block text-sm font-bold">Title<Input value={title} onChange={(event) => setTitle(event.target.value.slice(0, 100))} placeholder="What are you streaming?" className="mt-2 h-12 rounded-2xl" /></label>
                <label className="block text-sm font-bold">Description<textarea value={description} onChange={(event) => setDescription(event.target.value.slice(0, 500))} placeholder="Tell viewers what to expect" className="mt-2 min-h-24 w-full resize-none rounded-2xl border border-input bg-background p-3 text-sm outline-none focus:border-primary" /></label>
                <label className="block text-sm font-bold">Category<select value={category} onChange={(event) => setCategory(event.target.value)} className="mt-2 h-12 w-full rounded-2xl border border-input bg-background px-3 text-sm font-semibold">{CATEGORIES.map((item) => <option key={item}>{item}</option>)}</select></label>
              </div>
              <Button onClick={() => void start()} disabled={starting || !title.trim() || !previewReady} className="mt-5 h-13 w-full rounded-full bg-red-500 text-base font-black text-white shadow-[0_10px_28px_rgba(239,68,68,.28)] hover:bg-red-600">
                {starting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Radio className="h-5 w-5" />}Start live
              </Button>
              <p className="mt-3 text-center text-[11px] leading-5 text-black/45 dark:text-white/45">Screen audio is offered when the browser and selected tab/window provide it. On iPhone, screen sharing may be unavailable in the browser.</p>
            </div>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#07080a] text-white">
      <header className="sticky top-0 z-40 flex min-h-16 items-center gap-3 border-b border-white/10 bg-[#090a0c]/95 px-4 py-3 backdrop-blur-xl">
        <span className="flex items-center gap-2 rounded-full bg-red-500 px-3 py-1.5 text-[11px] font-black"><span className="h-2 w-2 animate-pulse rounded-full bg-white" />LIVE</span>
        <div className="min-w-0 flex-1"><h1 className="truncate font-black">{title}</h1><p className="truncate text-xs text-white/45">{category} · {source === "screen" ? "Screen sharing" : "Camera"}</p></div>
        <button type="button" onClick={() => void copyLiveLink()} className="grid h-10 w-10 place-items-center rounded-full bg-white/8 hover:bg-white/14" aria-label="Copy live link"><Copy className="h-4 w-4" /></button>
        <Button onClick={() => void stopLive()} className="rounded-full bg-white px-4 font-black text-black hover:bg-white/90"><Square className="h-4 w-4 fill-current" />End</Button>
      </header>

      <div className="grid min-h-[calc(100dvh-4rem)] xl:grid-cols-[minmax(0,1fr)_390px]">
        <section className="relative flex min-h-[58vh] items-center justify-center bg-black">
          <video ref={videoRef} autoPlay muted playsInline className="h-full max-h-[calc(100dvh-4rem)] w-full object-contain" />
          <div className="absolute left-4 top-4 flex flex-wrap gap-2">
            <span className="flex items-center gap-1.5 rounded-full bg-black/65 px-3 py-1.5 text-[11px] font-bold backdrop-blur-xl"><Eye className="h-3.5 w-3.5" />{analytics.activeViewers} watching</span>
            <span className="flex items-center gap-1.5 rounded-full bg-black/65 px-3 py-1.5 text-[11px] font-bold backdrop-blur-xl"><Activity className="h-3.5 w-3.5" />{connectedPeers} connected</span>
          </div>
          <div className="absolute bottom-5 left-1/2 flex -translate-x-1/2 gap-2 rounded-full bg-black/65 p-2 backdrop-blur-xl">
            <button type="button" onClick={toggleMic} className={cn("grid h-12 w-12 place-items-center rounded-full", microphone ? "bg-white/12" : "bg-white text-black")} aria-label="Toggle microphone">{microphone ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}</button>
            <button type="button" onClick={toggleCamera} disabled={source === "screen"} className={cn("grid h-12 w-12 place-items-center rounded-full disabled:opacity-30", camera ? "bg-white/12" : "bg-white text-black")} aria-label="Toggle camera">{camera ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}</button>
            <button type="button" onClick={() => void copyLiveLink()} className="grid h-12 w-12 place-items-center rounded-full bg-white/12" aria-label="Share live"><Share2 className="h-5 w-5" /></button>
          </div>
        </section>

        <aside className="flex min-h-[42vh] flex-col border-l border-white/10 bg-[#0d0f12]">
          <div className="grid grid-cols-3 gap-2 border-b border-white/10 p-3">
            <Stat icon={Eye} label="Watching" value={analytics.activeViewers} />
            <Stat icon={Users} label="Unique" value={analytics.uniqueViewers} />
            <Stat icon={Activity} label="Peak" value={peak} />
            <Stat icon={Heart} label="Likes" value={analytics.likesCount} />
            <Stat icon={Share2} label="Shares" value={analytics.sharesCount} />
            <Stat icon={Clock3} label="Watch time" value={formatWatchTime(analytics.totalWatchSeconds)} />
          </div>
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3"><div><p className="text-sm font-black">Live chat</p><p className="text-[11px] text-white/40">{comments.length} comments · {formatDuration(secondsLive)}</p></div><MessageCircle className="h-4 w-4 text-white/35" /></div>
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
            {comments.length ? comments.map((item) => <div key={item.id} className="text-sm leading-5"><strong className="mr-1.5">{item.author?.displayName || "Viewer"}</strong><span className="text-white/70">{item.text}</span></div>) : <div className="grid min-h-36 place-items-center text-center"><div><MessageCircle className="mx-auto h-6 w-6 text-white/20" /><p className="mt-3 text-sm text-white/35">Comments will appear here</p></div></div>}
          </div>
          <div className="flex gap-2 border-t border-white/10 p-3 story-safe-bottom"><Input value={comment} onChange={(event) => setComment(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void postComment(); }} placeholder="Comment as host" className="h-11 rounded-full border-white/10 bg-white/5 px-4 text-white" /><Button size="icon" onClick={() => void postComment()} className="h-11 w-11 rounded-full"><MessageCircle className="h-4 w-4" /></Button></div>
        </aside>
      </div>
    </main>
  );
}

function SourceButton({ active, disabled, icon: Icon, title, description, onClick }: { active: boolean; disabled?: boolean; icon: typeof Camera; title: string; description: string; onClick: () => void }) {
  return <button type="button" disabled={disabled} onClick={onClick} className={cn("rounded-2xl border p-3 text-left transition disabled:cursor-not-allowed disabled:opacity-40", active ? "border-primary bg-primary/8 ring-2 ring-primary/15" : "border-black/8 hover:bg-black/[.025] dark:border-white/10 dark:hover:bg-white/5")}><span className={cn("grid h-10 w-10 place-items-center rounded-xl", active ? "bg-primary text-white" : "bg-black/5 text-black/65 dark:bg-white/8 dark:text-white/70")}><Icon className="h-5 w-5" /></span><strong className="mt-3 block text-sm">{title}</strong><span className="mt-1 block text-[11px] leading-4 text-black/50 dark:text-white/45">{description}</span></button>;
}

function ToggleRow({ icon: Icon, label, description, checked, onChange }: { icon: typeof Mic; label: string; description: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return <button type="button" onClick={() => onChange(!checked)} className="flex w-full items-center gap-3 rounded-2xl border border-black/5 p-3 text-left hover:bg-black/[.025] dark:border-white/8 dark:hover:bg-white/5"><span className="grid h-9 w-9 place-items-center rounded-xl bg-black/5 dark:bg-white/8"><Icon className="h-4 w-4" /></span><span className="min-w-0 flex-1"><strong className="block text-sm">{label}</strong><span className="block truncate text-[11px] text-black/45 dark:text-white/40">{description}</span></span><span className={cn("relative h-7 w-12 rounded-full transition", checked ? "bg-primary" : "bg-black/15 dark:bg-white/15")}><span className={cn("absolute top-1 h-5 w-5 rounded-full bg-white shadow-sm transition", checked ? "left-6" : "left-1")} /></span></button>;
}

function DeviceSelect({ label, value, devices, onChange }: { label: string; value: string; devices: MediaDeviceInfo[]; onChange: (value: string) => void }) {
  return <label className="block text-xs font-bold text-black/60 dark:text-white/55">{label}<select value={value} onChange={(event) => onChange(event.target.value)} className="mt-1.5 h-10 w-full rounded-xl border border-black/8 bg-white px-3 text-xs text-black outline-none focus:border-primary dark:border-white/10 dark:bg-black dark:text-white">{devices.map((device, index) => <option key={device.deviceId} value={device.deviceId}>{device.label || `${label} ${index + 1}`}</option>)}</select></label>;
}

function PreviewSignal({ icon: Icon, label, value, ok }: { icon: typeof Mic; label: string; value: string; ok: boolean }) {
  return <div className="flex items-center gap-3 rounded-2xl bg-white/5 p-3"><span className={cn("grid h-9 w-9 place-items-center rounded-xl", ok ? "bg-emerald-500/15 text-emerald-300" : "bg-white/8 text-white/35")}><Icon className="h-4 w-4" /></span><div><p className="text-[10px] font-bold uppercase tracking-[.12em] text-white/35">{label}</p><p className="mt-0.5 text-xs font-bold text-white/80">{value}</p></div></div>;
}

function Stat({ icon: Icon, label, value }: { icon: typeof Eye; label: string; value: number | string }) {
  return <div className="rounded-2xl bg-white/5 p-3"><Icon className="h-4 w-4 text-blue-400" /><p className="mt-3 truncate text-lg font-black">{value}</p><p className="text-[10px] text-white/40">{label}</p></div>;
}

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remaining = seconds % 60;
  return hours ? `${hours}:${String(minutes).padStart(2, "0")}:${String(remaining).padStart(2, "0")}` : `${minutes}:${String(remaining).padStart(2, "0")}`;
}

function formatWatchTime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  return `${(seconds / 3600).toFixed(1)}h`;
}
