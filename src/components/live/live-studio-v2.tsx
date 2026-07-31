"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Activity,
  Camera,
  Check,
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
  Send,
  Settings2,
  Share2,
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
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

export default function LiveStudioV2() {
  const { user } = useAuth();
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const captureRef = useRef<CapturedMedia | null>(null);
  const peersRef = useRef(new Map<string, RTCPeerConnection>());
  const queuesRef = useRef(new Map<string, IceCandidateQueue>());
  const handledViewerIds = useRef(new Set<string>());
  const subscriptionsRef = useRef<Array<() => void>>([]);

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
  const [mediaStatus, setMediaStatus] = useState("No media source opened");
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

  const attachPreview = async () => {
    const element = videoRef.current;
    const captured = captureRef.current;
    if (!element || !captured) return;
    if (element.srcObject !== captured.stream) element.srcObject = captured.stream;
    element.muted = true;
    element.playsInline = true;
    await element.play().catch(() => undefined);
  };

  useEffect(() => {
    void attachPreview();
  }, [streamId, previewReady]);

  useEffect(() => {
    if (!startedAt) return;
    const timer = window.setInterval(() => setSecondsLive(Math.floor((Date.now() - startedAt) / 1000)), 1000);
    return () => window.clearInterval(timer);
  }, [startedAt]);

  useEffect(() => {
    return () => cleanupEverything();
    // cleanupEverything intentionally reads refs only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refreshDevices = async () => {
    const devices = await listMediaDevices().catch(() => ({ microphones: [], cameras: [] }));
    setMicrophones(devices.microphones);
    setCameras(devices.cameras);
    if (!audioInputId && devices.microphones[0]) setAudioInputId(devices.microphones[0].deviceId);
    if (!videoInputId && devices.cameras[0]) setVideoInputId(devices.cameras[0].deviceId);
  };

  const stopCapture = () => {
    captureRef.current?.cleanup();
    captureRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setPreviewReady(false);
    setMediaStatus("No media source opened");
  };

  const openPreview = async (): Promise<CapturedMedia | null> => {
    if (!captureSupported) {
      const message = "Camera and microphone need HTTPS and browser permission.";
      setPermissionError(message);
      toast.error(message);
      return null;
    }
    if (source === "screen" && !screenSupported) {
      const message = isIOSBrowser()
        ? "iPhone and iPad browsers cannot broadcast the screen through a normal web page. Use camera live here, or use desktop Chrome/Edge/Safari for screen sharing."
        : "This browser does not support screen sharing.";
      setPermissionError(message);
      toast.error(message);
      return null;
    }

    setPreparing(true);
    setPermissionError(null);
    stopCapture();
    try {
      const captured = await captureFluxMedia({
        source,
        microphone: microphoneEnabled,
        camera: cameraEnabled,
        systemAudio: systemAudioEnabled,
        audioInputId: audioInputId || undefined,
        videoInputId: videoInputId || undefined,
      });
      captureRef.current = captured;
      setPreviewReady(true);
      setMediaStatus(`${captured.source === "screen" ? "Screen" : "Camera"} ready · ${captured.stream.getVideoTracks().length ? "video" : "no video"} · ${captured.stream.getAudioTracks().length ? "audio" : "no audio"}`);
      const videoTrack = captured.stream.getVideoTracks()[0];
      videoTrack?.addEventListener(
        "ended",
        () => {
          setMediaStatus("The selected media source ended");
          toast.message("The captured source ended. End the live or open another preview.");
        },
        { once: true }
      );
      await refreshDevices();
      window.requestAnimationFrame(() => void attachPreview());
      return captured;
    } catch (error) {
      const message = describeMediaError(error);
      setPermissionError(message);
      setMediaStatus("Media source failed");
      toast.error(message);
      return null;
    } finally {
      setPreparing(false);
    }
  };

  const connectViewer = async (activeStreamId: string, viewerId: string, media: MediaStream) => {
    if (peersRef.current.has(viewerId)) return;
    const peer = new RTCPeerConnection({ iceServers: getFluxIceServers() });
    const queue = createIceCandidateQueue(peer);
    peersRef.current.set(viewerId, peer);
    queuesRef.current.set(viewerId, queue);
    media.getTracks().forEach((track) => peer.addTrack(track, media));

    peer.onicecandidate = (event) => {
      if (event.candidate) void addLiveCandidate(activeStreamId, viewerId, "host", event.candidate.toJSON());
    };
    peer.onconnectionstatechange = () => {
      setConnectedViewers([...peersRef.current.values()].filter((item) => item.connectionState === "connected").length);
      if (["failed", "closed"].includes(peer.connectionState)) {
        queue.clear();
        peer.close();
        peersRef.current.delete(viewerId);
        queuesRef.current.delete(viewerId);
        handledViewerIds.current.delete(viewerId);
      }
    };

    subscriptionsRef.current.push(
      subscribeLiveCandidates(activeStreamId, viewerId, "viewer", (candidate) => void queue.add(candidate))
    );
    subscriptionsRef.current.push(
      subscribeLivePeer(activeStreamId, viewerId, (data) => {
        if (!data?.answer || peer.currentRemoteDescription) return;
        void peer
          .setRemoteDescription(new RTCSessionDescription(data.answer))
          .then(() => queue.flush())
          .catch(() => undefined);
      })
    );

    const offer = await peer.createOffer({ offerToReceiveAudio: false, offerToReceiveVideo: false });
    await peer.setLocalDescription(offer);
    await setLivePeerOffer(activeStreamId, viewerId, { type: offer.type, sdp: offer.sdp });
  };

  const startLive = async () => {
    if (!user || starting || !title.trim()) return;
    setStarting(true);
    try {
      const captured = captureRef.current || (await openPreview());
      if (!captured) return;
      if (!captured.stream.getTracks().some((track) => track.readyState === "live")) {
        throw new Error("The selected media source is no longer active. Open the preview again.");
      }

      const id = await createLiveStream({
        hostId: user.uid,
        title: title.trim(),
        description: description.trim(),
        category,
        sourceType: captured.source,
      });
      setStreamId(id);
      setStartedAt(Date.now());
      setSettingsOpen(false);
      subscriptionsRef.current.push(subscribeLiveComments(id, setComments));
      subscriptionsRef.current.push(
        subscribeLiveViewerAnalytics(id, (next) => {
          setAnalytics(next);
          setPeakViewers((current) => Math.max(current, next.activeViewers));
          void syncLiveAnalytics(id, next).catch(() => undefined);
        })
      );
      subscriptionsRef.current.push(
        subscribeLivePeers(id, (items) => {
          for (const item of items) {
            if (handledViewerIds.current.has(item.viewerId)) continue;
            handledViewerIds.current.add(item.viewerId);
            void connectViewer(id, item.viewerId, captured.stream).catch(() => handledViewerIds.current.delete(item.viewerId));
          }
        })
      );
      window.requestAnimationFrame(() => void attachPreview());
      toast.success("You are live");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not start the livestream");
    } finally {
      setStarting(false);
    }
  };

  const cleanupEverything = () => {
    subscriptionsRef.current.forEach((unsubscribe) => unsubscribe());
    subscriptionsRef.current = [];
    queuesRef.current.forEach((queue) => queue.clear());
    queuesRef.current.clear();
    peersRef.current.forEach((peer) => peer.close());
    peersRef.current.clear();
    handledViewerIds.current.clear();
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
    captureRef.current?.stream.getAudioTracks().forEach((track) => {
      track.enabled = next;
    });
  };

  const toggleCamera = () => {
    const next = !cameraEnabled;
    setCameraEnabled(next);
    if (source === "camera") {
      captureRef.current?.stream.getVideoTracks().forEach((track) => {
        track.enabled = next;
      });
    }
  };

  const copyLink = async () => {
    if (!streamId) return;
    const base = process.env.NEXT_PUBLIC_BASE_PATH || "";
    await navigator.clipboard.writeText(`${window.location.origin}${base}/live/view/?id=${encodeURIComponent(streamId)}`);
    toast.success("Live link copied");
  };

  const postComment = async () => {
    if (!streamId || !user || !comment.trim()) return;
    await sendLiveComment(streamId, user.uid, comment.trim());
    setComment("");
  };

  return (
    <main className="min-h-screen bg-black text-white">
      <header className="sticky top-0 z-50 border-b border-white/10 bg-black/92 backdrop-blur-xl">
        <div className="mx-auto flex min-h-16 max-w-[1500px] items-center gap-3 px-3 sm:px-5">
          <span className={cn("flex items-center gap-2 rounded-full px-3 py-2 text-xs font-black", isLive ? "bg-red-500" : "bg-white/10 text-white/70")}>
            <span className={cn("h-2 w-2 rounded-full", isLive ? "animate-pulse bg-white" : "bg-white/35")} />
            {isLive ? "LIVE" : "PREVIEW"}
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-base font-black">{title.trim() || "Flux Live"}</h1>
            <p className="truncate text-[11px] text-white/45">{mediaStatus}</p>
          </div>
          {isLive ? <button type="button" onClick={() => void copyLink()} className="grid h-11 w-11 place-items-center rounded-full bg-white/10" aria-label="Copy viewer link"><Copy className="h-5 w-5" /></button> : null}
          <button type="button" onClick={() => setSettingsOpen((value) => !value)} className="grid h-11 w-11 place-items-center rounded-full bg-white/10 lg:hidden" aria-label="Open live settings"><Settings2 className="h-5 w-5" /></button>
          {isLive ? (
            <Button onClick={() => void stopLive()} className="h-11 rounded-full bg-white px-5 font-black text-black hover:bg-white/90"><Square className="h-4 w-4 fill-current" />End</Button>
          ) : (
            <Button onClick={() => void startLive()} disabled={starting || !previewReady || !title.trim()} className="h-11 rounded-full bg-red-500 px-5 font-black text-white hover:bg-red-600">{starting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Radio className="h-4 w-4" />}Go live</Button>
          )}
        </div>
      </header>

      <div className="mx-auto grid min-h-[calc(100dvh-4rem)] max-w-[1500px] lg:grid-cols-[minmax(0,1fr)_360px]">
        <section className="relative flex min-h-[64dvh] items-center justify-center overflow-hidden bg-[#030303] lg:min-h-[calc(100dvh-4rem)]">
          <video ref={videoRef} autoPlay muted playsInline className="h-full max-h-[calc(100dvh-4rem)] w-full object-contain" />
          {!previewReady ? (
            <div className="absolute inset-0 grid place-items-center p-8 text-center">
              <div className="max-w-sm">
                <span className="mx-auto grid h-16 w-16 place-items-center rounded-full border border-white/10 bg-white/5"><Camera className="h-7 w-7 text-white/60" /></span>
                <h2 className="mt-5 text-2xl font-black">Open a real preview first</h2>
                <p className="mt-2 text-sm leading-6 text-white/42">Flux will not create a fake live state without an active camera or supported screen capture.</p>
                <Button onClick={() => void openPreview()} disabled={preparing} className="mt-5 h-11 rounded-full bg-white px-5 font-black text-black hover:bg-white/90">{preparing ? <Loader2 className="h-4 w-4 animate-spin" /> : source === "screen" ? <MonitorUp className="h-4 w-4" /> : <Camera className="h-4 w-4" />}Open preview</Button>
              </div>
            </div>
          ) : null}

          <div className="absolute left-3 top-3 flex flex-wrap gap-2 sm:left-5 sm:top-5">
            <StatusPill icon={Eye} text={`${analytics.activeViewers} watching`} />
            <StatusPill icon={Wifi} text={`${connectedViewers} connected`} />
            {isLive ? <StatusPill icon={Clock3} text={formatDuration(secondsLive)} /> : null}
          </div>

          {permissionError ? (
            <div className="absolute inset-x-3 top-20 z-20 rounded-2xl border border-red-400/30 bg-red-500/14 p-4 text-sm font-semibold leading-6 text-red-100 backdrop-blur-xl sm:inset-x-auto sm:left-5 sm:max-w-xl">{permissionError}</div>
          ) : null}

          <div className="absolute bottom-5 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full border border-white/10 bg-black/70 p-2 shadow-2xl backdrop-blur-xl">
            <MediaButton active={microphoneEnabled} onClick={toggleMicrophone} on={Mic} off={MicOff} label="Microphone" />
            <MediaButton active={cameraEnabled} disabled={source === "screen"} onClick={toggleCamera} on={Video} off={VideoOff} label="Camera" />
            {isLive ? <button type="button" onClick={() => void copyLink()} className="grid h-12 w-12 place-items-center rounded-full bg-white/10" aria-label="Share live"><Share2 className="h-5 w-5" /></button> : <button type="button" onClick={() => void openPreview()} disabled={preparing} className="grid h-12 w-12 place-items-center rounded-full bg-white/10 disabled:opacity-50" aria-label="Restart preview">{preparing ? <Loader2 className="h-5 w-5 animate-spin" /> : <Camera className="h-5 w-5" />}</button>}
          </div>
        </section>

        <aside className={cn("border-l border-white/10 bg-[#0b0b0c] lg:block", settingsOpen ? "block" : "hidden")}>
          <div className="flex items-center border-b border-white/10 px-4 py-3 lg:hidden"><h2 className="font-black">Live controls</h2><button type="button" onClick={() => setSettingsOpen(false)} className="ml-auto grid h-10 w-10 place-items-center rounded-full bg-white/8"><X className="h-5 w-5" /></button></div>
          {!isLive ? (
            <div className="space-y-5 p-4">
              <section>
                <h2 className="text-sm font-black">Source</h2>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <SourceButton active={source === "camera"} icon={Camera} title="Camera" text="Front, rear or USB" onClick={() => { stopCapture(); setSource("camera"); }} />
                  <SourceButton active={source === "screen"} disabled={!screenSupported} icon={ScreenShare} title="Screen" text={screenSupported ? "Tab, window or display" : isIOSBrowser() ? "Not available on iPhone web" : "Unavailable in this browser"} onClick={() => { stopCapture(); setSource("screen"); }} />
                </div>
              </section>

              <section className="space-y-2">
                <ToggleRow label="Microphone" detail="Noise suppression and echo cancellation" checked={microphoneEnabled} onChange={(value) => { stopCapture(); setMicrophoneEnabled(value); }} />
                {source === "camera" ? <ToggleRow label="Camera" detail="Adaptive mobile-friendly quality" checked={cameraEnabled} onChange={(value) => { stopCapture(); setCameraEnabled(value); }} /> : <ToggleRow label="Screen audio" detail="Only when the selected source supplies audio" checked={systemAudioEnabled} onChange={(value) => { stopCapture(); setSystemAudioEnabled(value); }} />}
              </section>

              {(microphones.length || cameras.length) ? (
                <section className="grid gap-3">
                  {microphones.length ? <DeviceSelect label="Microphone" value={audioInputId} devices={microphones} onChange={(value) => { stopCapture(); setAudioInputId(value); }} /> : null}
                  {source === "camera" && cameras.length ? <DeviceSelect label="Camera" value={videoInputId} devices={cameras} onChange={(value) => { stopCapture(); setVideoInputId(value); }} /> : null}
                </section>
              ) : null}

              <section className="space-y-3 border-t border-white/10 pt-5">
                <label className="block text-xs font-black text-white/65">Title<Input value={title} onChange={(event) => setTitle(event.target.value.slice(0, 100))} placeholder="What are you streaming?" className="mt-2 h-11 rounded-xl border-white/10 bg-white/5 text-white" /></label>
                <label className="block text-xs font-black text-white/65">Description<textarea value={description} onChange={(event) => setDescription(event.target.value.slice(0, 500))} placeholder="Tell viewers what to expect" className="mt-2 min-h-24 w-full resize-none rounded-xl border border-white/10 bg-white/5 p-3 text-sm outline-none" /></label>
                <label className="block text-xs font-black text-white/65">Category<select value={category} onChange={(event) => setCategory(event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-white/10 bg-white/5 px-3 text-sm font-semibold">{CATEGORIES.map((item) => <option key={item} className="bg-black">{item}</option>)}</select></label>
              </section>

              <Button onClick={() => void openPreview()} disabled={preparing || (source === "screen" && !screenSupported)} variant="outline" className="h-11 w-full rounded-full border-white/15 bg-transparent text-white hover:bg-white/8">{preparing ? <Loader2 className="h-4 w-4 animate-spin" /> : <MonitorUp className="h-4 w-4" />}{previewReady ? "Restart preview" : "Open preview"}</Button>
            </div>
          ) : (
            <div className="flex min-h-[42dvh] flex-col lg:min-h-[calc(100dvh-4rem)]">
              <div className="grid grid-cols-3 gap-2 border-b border-white/10 p-3">
                <Metric icon={Eye} label="Watching" value={analytics.activeViewers} />
                <Metric icon={Users} label="Unique" value={analytics.uniqueViewers} />
                <Metric icon={Activity} label="Peak" value={peakViewers} />
                <Metric icon={Heart} label="Likes" value={analytics.likesCount} />
                <Metric icon={Share2} label="Shares" value={analytics.sharesCount} />
                <Metric icon={Clock3} label="Live" value={formatDuration(secondsLive)} />
              </div>
              <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3"><MessageCircle className="h-4 w-4 text-white/40" /><h2 className="text-sm font-black">Live chat</h2><span className="ml-auto text-[10px] text-white/35">{comments.length}</span></div>
              <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
                {comments.length ? comments.map((item) => <p key={item.id} className="text-sm leading-5"><strong className="mr-1.5">{item.author?.displayName || "Viewer"}</strong><span className="text-white/65">{item.text}</span></p>) : <p className="py-12 text-center text-xs text-white/30">Viewer comments will appear here.</p>}
              </div>
              <div className="flex gap-2 border-t border-white/10 p-3"><Input value={comment} onChange={(event) => setComment(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void postComment(); }} placeholder="Comment as host" className="h-11 rounded-full border-white/10 bg-white/5 text-white" /><Button size="icon" onClick={() => void postComment()} disabled={!comment.trim()} className="h-11 w-11 rounded-full"><Send className="h-4 w-4" /></Button></div>
            </div>
          )}
        </aside>
      </div>
    </main>
  );
}

function MediaButton({ active, disabled, onClick, on: On, off: Off, label }: { active: boolean; disabled?: boolean; onClick: () => void; on: typeof Mic; off: typeof MicOff; label: string }) {
  return <button type="button" onClick={onClick} disabled={disabled} aria-label={label} className={cn("grid h-12 w-12 place-items-center rounded-full transition disabled:opacity-30", active ? "bg-white/12 text-white" : "bg-white text-black")}>{active ? <On className="h-5 w-5" /> : <Off className="h-5 w-5" />}</button>;
}

function StatusPill({ icon: Icon, text }: { icon: typeof Eye; text: string }) {
  return <span className="flex items-center gap-1.5 rounded-full border border-white/10 bg-black/65 px-3 py-2 text-[11px] font-bold backdrop-blur-xl"><Icon className="h-3.5 w-3.5" />{text}</span>;
}

function SourceButton({ active, disabled, icon: Icon, title, text, onClick }: { active: boolean; disabled?: boolean; icon: typeof Camera; title: string; text: string; onClick: () => void }) {
  return <button type="button" onClick={onClick} disabled={disabled} className={cn("rounded-2xl border p-3 text-left transition disabled:cursor-not-allowed disabled:opacity-35", active ? "border-white bg-white text-black" : "border-white/10 bg-white/[.035] hover:bg-white/8")}><Icon className="h-5 w-5" /><p className="mt-3 text-sm font-black">{title}</p><p className={cn("mt-1 text-[10px] leading-4", active ? "text-black/55" : "text-white/38")}>{text}</p></button>;
}

function ToggleRow({ label, detail, checked, onChange }: { label: string; detail: string; checked: boolean; onChange: (value: boolean) => void }) {
  return <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[.025] p-3"><span className="min-w-0 flex-1"><span className="block text-sm font-black">{label}</span><span className="block text-[10px] leading-4 text-white/38">{detail}</span></span><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="h-5 w-5 accent-white" /></label>;
}

function DeviceSelect({ label, value, devices, onChange }: { label: string; value: string; devices: MediaDeviceInfo[]; onChange: (value: string) => void }) {
  return <label className="block text-[10px] font-black uppercase tracking-wider text-white/40">{label}<select value={value} onChange={(event) => onChange(event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-white/10 bg-white/5 px-3 text-xs font-semibold normal-case tracking-normal">{devices.map((device, index) => <option key={device.deviceId} value={device.deviceId} className="bg-black">{device.label || `${label} ${index + 1}`}</option>)}</select></label>;
}

function Metric({ icon: Icon, label, value }: { icon: typeof Eye; label: string; value: string | number }) {
  return <div className="rounded-2xl border border-white/8 bg-white/[.035] p-3"><Icon className="h-4 w-4 text-white/35" /><p className="mt-2 text-lg font-black">{value}</p><p className="text-[9px] font-black uppercase tracking-wider text-white/28">{label}</p></div>;
}

function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes}:${remainder.toString().padStart(2, "0")}`;
}
