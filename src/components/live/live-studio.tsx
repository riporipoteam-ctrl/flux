"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Activity, Camera, CheckCircle2, Clock3, Copy, Eye, Heart, Loader2, MessageCircle, Mic, MicOff, MonitorUp, Radio, ScreenShare, Settings2, Share2, Square, Users, Video, VideoOff, Volume2, Wifi, XCircle } from "lucide-react";
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

const EMPTY: LiveViewerAnalytics = { activeViewers: 0, uniqueViewers: 0, totalWatchSeconds: 0, likesCount: 0, sharesCount: 0 };
const CATEGORIES = ["Chatting", "Gaming", "Music", "Creative", "News", "Sports", "Education"];

export default function LiveStudio() {
  const { user } = useAuth();
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const captureRef = useRef<CapturedMedia | null>(null);
  const peers = useRef(new Map<string, RTCPeerConnection>());
  const queues = useRef(new Map<string, IceCandidateQueue>());
  const handled = useRef(new Set<string>());
  const subscriptions = useRef<Array<() => void>>([]);
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
  const [analytics, setAnalytics] = useState<LiveViewerAnalytics>(EMPTY);
  const [peak, setPeak] = useState(0);
  const [comments, setComments] = useState<LiveComment[]>([]);
  const [comment, setComment] = useState("");
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [secondsLive, setSecondsLive] = useState(0);
  const [connected, setConnected] = useState(0);
  const screenSupported = useMemo(supportsScreenShare, []);
  const captureSupported = useMemo(mediaCaptureReady, []);

  useEffect(() => {
    if (!startedAt) return;
    const timer = window.setInterval(() => setSecondsLive(Math.floor((Date.now() - startedAt) / 1000)), 1000);
    return () => window.clearInterval(timer);
  }, [startedAt]);

  useEffect(() => () => cleanupEverything(), []);

  const refreshDevices = async () => {
    const devices = await listMediaDevices().catch(() => ({ microphones: [], cameras: [] }));
    setMicrophones(devices.microphones); setCameras(devices.cameras);
    if (!audioInputId && devices.microphones[0]) setAudioInputId(devices.microphones[0].deviceId);
    if (!videoInputId && devices.cameras[0]) setVideoInputId(devices.cameras[0].deviceId);
  };

  const stopPreview = () => {
    captureRef.current?.cleanup(); captureRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setPreviewReady(false);
  };

  const prepareMedia = async () => {
    if (!captureSupported) {
      const message = "Camera and microphone require HTTPS or the installed Flux app.";
      setPermissionError(message); toast.error(message); return null;
    }
    setPreparing(true); setPermissionError(null); stopPreview();
    try {
      const captured = await captureFluxMedia({ source, microphone, camera, systemAudio, audioInputId: audioInputId || undefined, videoInputId: videoInputId || undefined });
      captureRef.current = captured;
      if (videoRef.current) { videoRef.current.srcObject = captured.stream; await videoRef.current.play().catch(() => undefined); }
      const videoTrack = captured.stream.getVideoTracks()[0];
      if (source === "screen" && videoTrack) videoTrack.addEventListener("ended", () => toast.message("Screen sharing ended. End the live or restart with another source."), { once: true });
      setPreviewReady(true); await refreshDevices(); return captured;
    } catch (error) {
      const message = describeMediaError(error); setPermissionError(message); toast.error(message); return null;
    } finally { setPreparing(false); }
  };

  const connectViewer = async (id: string, viewerId: string, media: MediaStream) => {
    if (peers.current.has(viewerId)) return;
    const peer = new RTCPeerConnection({ iceServers: getFluxIceServers() });
    const queue = createIceCandidateQueue(peer);
    peers.current.set(viewerId, peer); queues.current.set(viewerId, queue);
    media.getTracks().forEach((track) => peer.addTrack(track, media));
    peer.onicecandidate = (event) => { if (event.candidate) void addLiveCandidate(id, viewerId, "host", event.candidate.toJSON()); };
    peer.onconnectionstatechange = () => {
      setConnected([...peers.current.values()].filter((item) => item.connectionState === "connected").length);
      if (["failed", "closed"].includes(peer.connectionState)) {
        queue.clear(); peer.close(); peers.current.delete(viewerId); queues.current.delete(viewerId); handled.current.delete(viewerId);
      }
    };
    subscriptions.current.push(subscribeLiveCandidates(id, viewerId, "viewer", (candidate) => { void queue.add(candidate); }));
    subscriptions.current.push(subscribeLivePeer(id, viewerId, (data) => {
      if (!data?.answer || peer.currentRemoteDescription) return;
      void peer.setRemoteDescription(new RTCSessionDescription(data.answer)).then(() => queue.flush()).catch(() => undefined);
    }));
    const offer = await peer.createOffer({ offerToReceiveAudio: false, offerToReceiveVideo: false });
    await peer.setLocalDescription(offer);
    await setLivePeerOffer(id, viewerId, { type: offer.type, sdp: offer.sdp });
  };

  const start = async () => {
    if (!user || starting || !title.trim()) return;
    setStarting(true);
    try {
      const captured = captureRef.current || await prepareMedia();
      if (!captured) return;
      const id = await createLiveStream({ hostId: user.uid, title, description, category, sourceType: source });
      setStreamId(id); setStartedAt(Date.now());
      subscriptions.current.push(subscribeLiveComments(id, setComments));
      subscriptions.current.push(subscribeLiveViewerAnalytics(id, (next) => { setAnalytics(next); setPeak((value) => Math.max(value, next.activeViewers)); void syncLiveAnalytics(id, next).catch(() => undefined); }));
      subscriptions.current.push(subscribeLivePeers(id, (items) => {
        for (const item of items) {
          if (handled.current.has(item.viewerId)) continue;
          handled.current.add(item.viewerId);
          void connectViewer(id, item.viewerId, captured.stream).catch(() => handled.current.delete(item.viewerId));
        }
      }));
      toast.success("You are live");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Could not start livestream"); }
    finally { setStarting(false); }
  };

  const cleanupEverything = () => {
    subscriptions.current.forEach((fn) => fn()); subscriptions.current = [];
    queues.current.forEach((queue) => queue.clear()); queues.current.clear();
    peers.current.forEach((peer) => peer.close()); peers.current.clear(); handled.current.clear();
    captureRef.current?.cleanup(); captureRef.current = null;
  };

  const stopLive = async () => {
    if (streamId) { await syncLiveAnalytics(streamId, analytics).catch(() => undefined); await endLiveStream(streamId).catch(() => undefined); }
    cleanupEverything(); router.push("/live");
  };

  const toggleMic = () => { const next = !microphone; setMicrophone(next); captureRef.current?.stream.getAudioTracks().forEach((track) => { track.enabled = next; }); };
  const toggleCamera = () => { const next = !camera; setCamera(next); if (source === "camera") captureRef.current?.stream.getVideoTracks().forEach((track) => { track.enabled = next; }); };
  const postComment = async () => { if (!streamId || !user || !comment.trim()) return; await sendLiveComment(streamId, user.uid, comment); setComment(""); };
  const copyLink = async () => { if (!streamId) return; const base = process.env.NEXT_PUBLIC_BASE_PATH || ""; await navigator.clipboard.writeText(`${window.location.origin}${base}/live/view/?id=${encodeURIComponent(streamId)}`); toast.success("Live link copied"); };

  if (!streamId) return <PreLiveStudio title={title} setTitle={setTitle} description={description} setDescription={setDescription} category={category} setCategory={setCategory} source={source} setSource={(next) => { stopPreview(); setSource(next); }} microphone={microphone} setMicrophone={(next) => { setMicrophone(next); if (previewReady) stopPreview(); }} camera={camera} setCamera={(next) => { setCamera(next); if (previewReady) stopPreview(); }} systemAudio={systemAudio} setSystemAudio={(next) => { setSystemAudio(next); if (previewReady) stopPreview(); }} microphones={microphones} cameras={cameras} audioInputId={audioInputId} setAudioInputId={setAudioInputId} videoInputId={videoInputId} setVideoInputId={setVideoInputId} previewReady={previewReady} preparing={preparing} starting={starting} permissionError={permissionError} captureSupported={captureSupported} screenSupported={screenSupported} videoRef={videoRef} onPrepare={() => void prepareMedia()} onStart={() => void start()} onStopPreview={stopPreview} onToggleMic={toggleMic} onToggleCamera={toggleCamera} />;

  return (
    <main className="min-h-screen bg-[#07080a] text-white">
      <header className="sticky top-0 z-40 flex min-h-16 items-center gap-3 border-b border-white/10 bg-[#090a0c]/95 px-4 py-3 backdrop-blur-xl"><span className="flex items-center gap-2 rounded-full bg-red-500 px-3 py-1.5 text-[11px] font-black"><span className="h-2 w-2 animate-pulse rounded-full bg-white" />LIVE</span><div className="min-w-0 flex-1"><h1 className="truncate font-black">{title}</h1><p className="truncate text-xs text-white/45">{category} · {source === "screen" ? "Screen sharing" : "Camera"}</p></div><button onClick={() => void copyLink()} className="grid h-10 w-10 place-items-center rounded-full bg-white/8"><Copy className="h-4 w-4" /></button><Button onClick={() => void stopLive()} className="rounded-full bg-white px-4 font-black text-black"><Square className="h-4 w-4 fill-current" />End</Button></header>
      <div className="grid min-h-[calc(100dvh-4rem)] xl:grid-cols-[minmax(0,1fr)_400px]">
        <section className="relative flex min-h-[58vh] items-center justify-center bg-black"><video ref={videoRef} autoPlay muted playsInline className="h-full max-h-[calc(100dvh-4rem)] w-full object-contain" /><div className="absolute left-4 top-4 flex gap-2"><LivePill icon={Eye} text={`${analytics.activeViewers} watching`} /><LivePill icon={Wifi} text={`${connected} connected`} /></div><div className="absolute bottom-5 left-1/2 flex -translate-x-1/2 gap-2 rounded-full bg-black/65 p-2 backdrop-blur-xl"><CircleControl active={microphone} onClick={toggleMic} on={Mic} off={MicOff} label="Microphone" /><CircleControl active={camera} disabled={source === "screen"} onClick={toggleCamera} on={Video} off={VideoOff} label="Camera" /><button onClick={() => void copyLink()} className="grid h-12 w-12 place-items-center rounded-full bg-white/12"><Share2 className="h-5 w-5" /></button></div></section>
        <aside className="flex min-h-[42vh] flex-col border-l border-white/10 bg-[#0d0f12]"><div className="grid grid-cols-3 gap-2 border-b border-white/10 p-3"><Stat icon={Eye} label="Watching" value={analytics.activeViewers} /><Stat icon={Users} label="Unique" value={analytics.uniqueViewers} /><Stat icon={Activity} label="Peak" value={peak} /><Stat icon={Heart} label="Likes" value={analytics.likesCount} /><Stat icon={Share2} label="Shares" value={analytics.sharesCount} /><Stat icon={Clock3} label="Live" value={formatDuration(secondsLive)} /></div><div className="flex items-center gap-2 border-b border-white/10 px-4 py-3"><MessageCircle className="h-4 w-4 text-white/40" /><p className="text-sm font-black">Live chat</p><span className="ml-auto text-[10px] text-white/35">{comments.length}</span></div><div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">{comments.map((item) => <p key={item.id} className="text-sm leading-5"><strong className="mr-1.5">{item.author?.displayName || "Viewer"}</strong><span className="text-white/65">{item.text}</span></p>)}</div><div className="flex gap-2 border-t border-white/10 p-3"><Input value={comment} onChange={(event) => setComment(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void postComment(); }} placeholder="Comment as host" className="h-11 rounded-full border-white/10 bg-white/5 text-white" /><Button size="icon" onClick={() => void postComment()} className="h-11 w-11 rounded-full"><MessageCircle className="h-4 w-4" /></Button></div></aside>
      </div>
    </main>
  );
}

function PreLiveStudio(props: {
  title: string; setTitle: (value: string) => void; description: string; setDescription: (value: string) => void; category: string; setCategory: (value: string) => void;
  source: LiveSourceMode; setSource: (value: LiveSourceMode) => void; microphone: boolean; setMicrophone: (value: boolean) => void; camera: boolean; setCamera: (value: boolean) => void; systemAudio: boolean; setSystemAudio: (value: boolean) => void;
  microphones: MediaDeviceInfo[]; cameras: MediaDeviceInfo[]; audioInputId: string; setAudioInputId: (value: string) => void; videoInputId: string; setVideoInputId: (value: string) => void;
  previewReady: boolean; preparing: boolean; starting: boolean; permissionError: string | null; captureSupported: boolean; screenSupported: boolean; videoRef: React.RefObject<HTMLVideoElement | null>;
  onPrepare: () => void; onStart: () => void; onStopPreview: () => void; onToggleMic: () => void; onToggleCamera: () => void;
}) {
  return <main className="min-h-screen bg-[#f6f7f9] pb-24 text-[#101114] dark:bg-black dark:text-white"><header className="sticky top-0 z-40 border-b border-black/5 bg-white/90 px-4 py-3 backdrop-blur-xl dark:border-white/10 dark:bg-black/85"><div className="mx-auto flex max-w-6xl items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-2xl bg-red-500 text-white"><Radio className="h-5 w-5" /></span><div className="min-w-0 flex-1"><h1 className="text-lg font-black">Flux Live Studio</h1><p className="text-xs text-muted-foreground">Camera, microphone, screen audio and analytics</p></div><span className={cn("hidden items-center gap-2 rounded-full px-3 py-1.5 text-xs font-bold sm:flex", props.captureSupported ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "bg-red-500/10 text-red-700 dark:text-red-300")}>{props.captureSupported ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}{props.captureSupported ? "Media ready" : "HTTPS required"}</span></div></header><div className="mx-auto grid max-w-6xl gap-5 p-3 sm:p-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(330px,.8fr)]"><section className="overflow-hidden rounded-[28px] border border-black/5 bg-[#090a0c] shadow-[0_24px_80px_rgba(0,0,0,.16)] dark:border-white/10"><div className="relative aspect-video min-h-[260px] bg-black"><video ref={props.videoRef} autoPlay muted playsInline className="h-full w-full object-contain" />{!props.previewReady ? <div className="absolute inset-0 grid place-items-center bg-[radial-gradient(circle_at_center,#202329_0,#090a0c_70%)] p-8 text-center"><div><span className="mx-auto grid h-16 w-16 place-items-center rounded-3xl bg-white/8 text-white/80">{props.source === "screen" ? <MonitorUp className="h-7 w-7" /> : <Camera className="h-7 w-7" />}</span><h2 className="mt-5 text-xl font-black text-white">Preview before going live</h2><p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-white/50">Nothing is published until you press Start Live.</p></div></div> : null}{props.previewReady ? <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 gap-2 rounded-full bg-black/65 p-2 backdrop-blur-xl"><CircleControl active={props.microphone} onClick={props.onToggleMic} on={Mic} off={MicOff} label="Microphone" /><CircleControl active={props.camera} disabled={props.source === "screen"} onClick={props.onToggleCamera} on={Video} off={VideoOff} label="Camera" /><button onClick={props.onStopPreview} className="grid h-12 w-12 place-items-center rounded-full bg-red-500 text-white"><Square className="h-4 w-4 fill-current" /></button></div> : null}</div><div className="grid gap-2 border-t border-white/10 bg-[#111318] p-4 text-white sm:grid-cols-3"><Signal icon={props.microphone ? Mic : MicOff} label="Microphone" value={props.microphone ? "Enabled" : "Muted"} /><Signal icon={props.source === "screen" ? ScreenShare : Camera} label="Source" value={props.source === "screen" ? "Screen" : "Camera"} /><Signal icon={Wifi} label="Network" value={process.env.NEXT_PUBLIC_TURN_URL ? "TURN + STUN" : "STUN / direct"} /></div></section><section className="space-y-4"><div className="rounded-[28px] border border-black/5 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-[#101114]"><div className="flex items-center gap-2"><Settings2 className="h-5 w-5 text-primary" /><h2 className="font-black">Media source</h2></div><div className="mt-4 grid grid-cols-2 gap-2"><Source active={props.source === "camera"} icon={Camera} title="Camera" text="Front, rear or USB camera" onClick={() => props.setSource("camera")} /><Source active={props.source === "screen"} disabled={!props.screenSupported} icon={ScreenShare} title="Share screen" text={props.screenSupported ? "Tab, window or display" : "Unavailable here"} onClick={() => props.setSource("screen")} /></div><div className="mt-4 space-y-2"><Toggle icon={Mic} label="Microphone" text="Echo cancellation and noise suppression" checked={props.microphone} onChange={props.setMicrophone} />{props.source === "camera" ? <Toggle icon={Video} label="Camera" text="Adaptive 720p target" checked={props.camera} onChange={props.setCamera} /> : <Toggle icon={Volume2} label="Screen audio" text="Included when the selected tab/display provides audio" checked={props.systemAudio} onChange={props.setSystemAudio} />}</div>{props.microphones.length || props.cameras.length ? <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">{props.microphones.length ? <Device label="Microphone" value={props.audioInputId} devices={props.microphones} onChange={props.setAudioInputId} /> : null}{props.source === "camera" && props.cameras.length ? <Device label="Camera" value={props.videoInputId} devices={props.cameras} onChange={props.setVideoInputId} /> : null}</div> : null}<Button onClick={props.onPrepare} disabled={props.preparing || (props.source === "screen" && !props.screenSupported)} variant="outline" className="mt-4 h-11 w-full rounded-full">{props.preparing ? <Loader2 className="h-4 w-4 animate-spin" /> : props.source === "screen" ? <MonitorUp className="h-4 w-4" /> : <Camera className="h-4 w-4" />}{props.previewReady ? "Restart preview" : "Open preview"}</Button>{props.permissionError ? <p className="mt-3 rounded-2xl bg-red-500/10 p-3 text-xs font-semibold leading-5 text-red-600 dark:text-red-300">{props.permissionError}</p> : null}</div><div className="rounded-[28px] border border-black/5 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-[#101114]"><h2 className="font-black">Live details</h2><div className="mt-4 space-y-4"><label className="block text-sm font-bold">Title<Input value={props.title} onChange={(event) => props.setTitle(event.target.value.slice(0, 100))} placeholder="What are you streaming?" className="mt-2 h-12 rounded-2xl" /></label><label className="block text-sm font-bold">Description<textarea value={props.description} onChange={(event) => props.setDescription(event.target.value.slice(0, 500))} className="mt-2 min-h-24 w-full resize-none rounded-2xl border border-input bg-background p-3 text-sm outline-none" placeholder="Tell viewers what to expect" /></label><label className="block text-sm font-bold">Category<select value={props.category} onChange={(event) => props.setCategory(event.target.value)} className="mt-2 h-12 w-full rounded-2xl border border-input bg-background px-3 text-sm font-semibold">{CATEGORIES.map((item) => <option key={item}>{item}</option>)}</select></label></div><Button onClick={props.onStart} disabled={props.starting || !props.title.trim() || !props.previewReady} className="mt-5 h-13 w-full rounded-full bg-red-500 text-base font-black text-white hover:bg-red-600">{props.starting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Radio className="h-5 w-5" />}Start live</Button><p className="mt-3 text-center text-[11px] leading-5 text-muted-foreground">A TURN server is strongly recommended for viewers on strict mobile networks.</p></div></section></div></main>;
}

function CircleControl({ active, disabled, onClick, on: On, off: Off, label }: { active: boolean; disabled?: boolean; onClick: () => void; on: typeof Mic; off: typeof MicOff; label: string }) { return <button onClick={onClick} disabled={disabled} className={cn("grid h-12 w-12 place-items-center rounded-full disabled:opacity-30", active ? "bg-white/12 text-white" : "bg-white text-black")} aria-label={label}>{active ? <On className="h-5 w-5" /> : <Off className="h-5 w-5" />}</button>; }
function LivePill({ icon: Icon, text }: { icon: typeof Eye; text: string }) { return <span className="flex items-center gap-1.5 rounded-full bg-black/65 px-3 py-1.5 text-[11px] font-bold backdrop-blur-xl"><Icon className="h-3.5 w-3.5" />{text}</span>; }
function Stat({ icon: Icon, label, value }: { icon: typeof Eye; label: string; value: string | number }) { return <div className="rounded-2xl bg-white/6 p-3"><Icon className="h-4 w-4 text-white/35" /><p className="mt-2 text-lg font-black">{value}</p><p className="text-[9px] font-black uppercase tracking-wider text-white/30">{label}</p></div>; }
function Signal({ icon: Icon, label, value }: { icon: typeof Mic; label: string; value: string }) { return <div className="flex items-center gap-3 rounded-2xl bg-white/5 p-3"><Icon className="h-4 w-4 text-white/50" /><div><p className="text-[9px] font-black uppercase tracking-wider text-white/30">{label}</p><p className="mt-0.5 text-xs font-bold">{value}</p></div></div>; }
function Source({ active, disabled, icon: Icon, title, text, onClick }: { active: boolean; disabled?: boolean; icon: typeof Camera; title: string; text: string; onClick: () => void }) { return <button onClick={onClick} disabled={disabled} className={cn("rounded-2xl border p-3 text-left disabled:opacity-35", active ? "border-primary bg-primary/7" : "border-border hover:bg-muted")}><Icon className="h-5 w-5 text-primary" /><p className="mt-3 text-sm font-black">{title}</p><p className="mt-1 text-[10px] leading-4 text-muted-foreground">{text}</p></button>; }
function Toggle({ icon: Icon, label, text, checked, onChange }: { icon: typeof Mic; label: string; text: string; checked: boolean; onChange: (value: boolean) => void }) { return <label className="flex items-center gap-3 rounded-2xl border border-border p-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-muted"><Icon className="h-4 w-4" /></span><span className="min-w-0 flex-1"><span className="block text-sm font-black">{label}</span><span className="block text-[10px] leading-4 text-muted-foreground">{text}</span></span><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="h-5 w-5 accent-primary" /></label>; }
function Device({ label, value, devices, onChange }: { label: string; value: string; devices: MediaDeviceInfo[]; onChange: (value: string) => void }) { return <label className="block text-[10px] font-black uppercase tracking-wider text-muted-foreground">{label}<select value={value} onChange={(event) => onChange(event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-input bg-background px-3 text-xs font-semibold normal-case tracking-normal">{devices.map((device, index) => <option key={device.deviceId} value={device.deviceId}>{device.label || `${label} ${index + 1}`}</option>)}</select></label>; }
function formatDuration(seconds: number) { const minutes = Math.floor(seconds / 60); const rest = seconds % 60; return `${minutes}:${rest.toString().padStart(2, "0")}`; }
