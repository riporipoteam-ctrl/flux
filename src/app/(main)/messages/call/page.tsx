"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { doc, getDoc } from "firebase/firestore";
import {
  Camera,
  CameraOff,
  FlipHorizontal,
  Loader2,
  Mic,
  MicOff,
  PhoneOff,
  RefreshCw,
  Video,
  WifiOff,
} from "lucide-react";
import { toast } from "sonner";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/auth-context";
import { getUser } from "@/services/users";
import {
  addCallCandidate,
  createCall,
  getCall,
  setCallAnswer,
  setCallOffer,
  setCallStatus,
  subscribeCall,
  subscribeCallCandidates,
  type CallMode,
  type FluxCall,
} from "@/services/calls";
import {
  createIceCandidateQueue,
  describeMediaError,
  getFluxIceServers,
  listMediaDevices,
  type IceCandidateQueue,
} from "@/lib/webrtc";
import type { UserProfile } from "@/types";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Button } from "@/components/ui/button";

export default function CallPage() {
  return <Suspense fallback={<CallLoading />}><CallInner /></Suspense>;
}

function CallInner() {
  const { user } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const requestedCallId = params.get("call");
  const conversationId = params.get("c");
  const requestedMode: CallMode = params.get("mode") === "video" ? "video" : "voice";

  const [callId, setCallId] = useState<string | null>(requestedCallId);
  const [call, setCall] = useState<FluxCall | null>(null);
  const [otherUser, setOtherUser] = useState<UserProfile | null>(null);
  const [role, setRole] = useState<"caller" | "callee" | null>(null);
  const [accepted, setAccepted] = useState(false);
  const [status, setStatus] = useState("Preparing call…");
  const [error, setError] = useState<string | null>(null);
  const [micOn, setMicOn] = useState(true);
  const [cameraOn, setCameraOn] = useState(requestedMode === "video");
  const [remoteReady, setRemoteReady] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [microphones, setMicrophones] = useState<MediaDeviceInfo[]>([]);
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [audioInputId, setAudioInputId] = useState("");
  const [videoInputId, setVideoInputId] = useState("");
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user");

  const localVideo = useRef<HTMLVideoElement>(null);
  const remoteVideo = useRef<HTMLVideoElement>(null);
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const queueRef = useRef<IceCandidateQueue | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef(new MediaStream());
  const cleanupRef = useRef<Array<() => void>>([]);
  const timersRef = useRef<Array<ReturnType<typeof setTimeout> | ReturnType<typeof setInterval>>>([]);
  const startedRef = useRef(false);
  const reconnectingRef = useRef(false);
  const currentCallIdRef = useRef<string | null>(requestedCallId);
  const roleRef = useRef<"caller" | "callee" | null>(null);

  const attachStreams = () => {
    if (localVideo.current && localVideo.current.srcObject !== localStreamRef.current) {
      localVideo.current.srcObject = localStreamRef.current;
      void localVideo.current.play().catch(() => undefined);
    }
    if (remoteVideo.current && remoteVideo.current.srcObject !== remoteStreamRef.current) {
      remoteVideo.current.srcObject = remoteStreamRef.current;
      void remoteVideo.current.play().catch(() => undefined);
    }
  };

  const cleanup = () => {
    cleanupRef.current.splice(0).forEach((unsubscribe) => unsubscribe());
    timersRef.current.splice(0).forEach((timer) => {
      clearTimeout(timer);
      clearInterval(timer);
    });
    queueRef.current?.clear();
    queueRef.current = null;
    peerRef.current?.close();
    peerRef.current = null;
    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    localStreamRef.current = null;
    remoteStreamRef.current.getTracks().forEach((track) => remoteStreamRef.current.removeTrack(track));
    if (localVideo.current) localVideo.current.srcObject = null;
    if (remoteVideo.current) remoteVideo.current.srcObject = null;
  };

  useEffect(() => cleanup, []);

  const refreshDevices = async () => {
    const devices = await listMediaDevices().catch(() => ({ microphones: [], cameras: [] }));
    setMicrophones(devices.microphones);
    setCameras(devices.cameras);
    if (!audioInputId && devices.microphones[0]) setAudioInputId(devices.microphones[0].deviceId);
    if (!videoInputId && devices.cameras[0]) setVideoInputId(devices.cameras[0].deviceId);
  };

  useEffect(() => {
    if (!navigator.mediaDevices?.addEventListener) return;
    const onChange = () => void refreshDevices();
    navigator.mediaDevices.addEventListener("devicechange", onChange);
    return () => navigator.mediaDevices.removeEventListener("devicechange", onChange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (status !== "Connected") return;
    const timer = setInterval(() => setSeconds((value) => value + 1), 1_000);
    timersRef.current.push(timer);
    return () => clearInterval(timer);
  }, [status]);

  const openMedia = async (mode: CallMode): Promise<MediaStream> => {
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      throw new Error("Voice and video calls require HTTPS or the installed Flux app.");
    }
    const constraints: MediaStreamConstraints = {
      audio: {
        deviceId: audioInputId ? { exact: audioInputId } : undefined,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
      video: mode === "video" ? {
        deviceId: videoInputId ? { exact: videoInputId } : undefined,
        facingMode: videoInputId ? undefined : facingMode,
        width: { ideal: 1280 },
        height: { ideal: 720 },
        frameRate: { ideal: 30, max: 60 },
      } : false,
    };

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia(constraints);
    } catch (cause) {
      if (!(cause instanceof DOMException) || cause.name !== "OverconstrainedError") throw cause;
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
        video: mode === "video" ? { facingMode, width: { ideal: 960 }, height: { ideal: 540 } } : false,
      });
    }
    localStreamRef.current = stream;
    setMicOn(stream.getAudioTracks().some((track) => track.enabled));
    setCameraOn(stream.getVideoTracks().some((track) => track.enabled));
    await refreshDevices();
    window.requestAnimationFrame(attachStreams);
    return stream;
  };

  const sendReconnectOffer = async () => {
    const peer = peerRef.current;
    const id = currentCallIdRef.current;
    if (!peer || !id || roleRef.current !== "caller" || peer.signalingState === "closed") return;
    try {
      reconnectingRef.current = true;
      setReconnecting(true);
      setStatus("Reconnecting…");
      peer.restartIce();
      const offer = await peer.createOffer({ iceRestart: true });
      await peer.setLocalDescription(offer);
      await setCallOffer(id, { type: offer.type, sdp: offer.sdp });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not reconnect the call.");
    } finally {
      reconnectingRef.current = false;
    }
  };

  const createPeer = (id: string, ownSide: "caller" | "callee", remoteSide: "caller" | "callee") => {
    const peer = new RTCPeerConnection({ iceServers: getFluxIceServers(), iceCandidatePoolSize: 8 });
    const queue = createIceCandidateQueue(peer);
    peerRef.current = peer;
    queueRef.current = queue;

    peer.onicecandidate = (event) => {
      if (event.candidate) void addCallCandidate(id, ownSide, event.candidate.toJSON());
    };
    peer.ontrack = (event) => {
      const track = event.track;
      if (!remoteStreamRef.current.getTracks().some((item) => item.id === track.id)) {
        remoteStreamRef.current.addTrack(track);
      }
      setRemoteReady(true);
      window.requestAnimationFrame(attachStreams);
      track.addEventListener("ended", () => setRemoteReady(remoteStreamRef.current.getTracks().some((item) => item.readyState === "live")), { once: true });
    };
    peer.onconnectionstatechange = () => {
      if (peer.connectionState === "connected") {
        setStatus("Connected");
        setError(null);
        setReconnecting(false);
      } else if (peer.connectionState === "disconnected") {
        setStatus("Connection interrupted…");
        const timer = setTimeout(() => {
          if (peer.connectionState === "disconnected" && !reconnectingRef.current) void sendReconnectOffer();
        }, 4_000);
        timersRef.current.push(timer);
      } else if (peer.connectionState === "failed") {
        setStatus("Connection failed");
        setReconnecting(false);
        setError("The direct call connection failed. Configure a TURN server for mobile networks, then retry.");
      }
    };
    peer.oniceconnectionstatechange = () => {
      if (peer.iceConnectionState === "checking") setStatus("Connecting securely…");
      if (peer.iceConnectionState === "failed" && roleRef.current === "caller") void sendReconnectOffer();
    };

    cleanupRef.current.push(subscribeCallCandidates(id, remoteSide, (candidate) => void queue.add(candidate)));
    return peer;
  };

  const beginCaller = async (id: string, mode: CallMode) => {
    setStatus("Starting microphone and camera…");
    const stream = await openMedia(mode);
    const peer = createPeer(id, "caller", "callee");
    stream.getTracks().forEach((track) => peer.addTrack(track, stream));
    const offer = await peer.createOffer();
    await peer.setLocalDescription(offer);
    await setCallOffer(id, { type: offer.type, sdp: offer.sdp });

    cleanupRef.current.push(subscribeCall(id, (next) => {
      if (!next?.answer) return;
      const applyAnswer = async () => {
        if (peer.currentRemoteDescription?.sdp === next.answer?.sdp) return;
        await peer.setRemoteDescription(new RTCSessionDescription(next.answer!));
        await queueRef.current?.flush();
      };
      void applyAnswer().catch(() => undefined);
    }));
    setStatus("Calling…");

    const ringTimer = setTimeout(() => {
      if (["new", "connecting"].includes(peer.connectionState)) {
        void setCallStatus(id, "ended").catch(() => undefined);
        setStatus("No answer");
        setError("The call was not answered.");
      }
    }, 60_000);
    timersRef.current.push(ringTimer);
  };

  const accept = async () => {
    if (!callId || !call?.offer || accepted) return;
    setAccepted(true);
    try {
      setStatus("Starting microphone and camera…");
      const stream = await openMedia(call.mode);
      const peer = createPeer(callId, "callee", "caller");
      stream.getTracks().forEach((track) => peer.addTrack(track, stream));
      await peer.setRemoteDescription(new RTCSessionDescription(call.offer));
      await queueRef.current?.flush();
      const answer = await peer.createAnswer();
      await peer.setLocalDescription(answer);
      await setCallAnswer(callId, { type: answer.type, sdp: answer.sdp });
      setStatus("Connecting…");
    } catch (cause) {
      const message = describeMediaError(cause);
      setAccepted(false);
      setError(message);
      setStatus("Could not answer");
      toast.error(message);
    }
  };

  useEffect(() => {
    if (!user || startedRef.current) return;
    startedRef.current = true;
    void (async () => {
      try {
        let id = requestedCallId;
        let currentCall = requestedCallId ? await getCall(requestedCallId) : null;
        if (!id) {
          if (!conversationId) throw new Error("Conversation missing");
          const conversationSnap = await getDoc(doc(db, "conversations", conversationId));
          if (!conversationSnap.exists()) throw new Error("Conversation not found");
          const data = conversationSnap.data();
          if (data.type !== "dm") throw new Error("Group calls are not available yet.");
          const participantIds: string[] = data.participantIds || [];
          if (!participantIds.includes(user.uid)) throw new Error("You are not in this conversation.");
          const calleeId = participantIds.find((uid) => uid !== user.uid);
          if (!calleeId) throw new Error("Friend not found");
          id = await createCall({ conversationId, callerId: user.uid, calleeId, mode: requestedMode });
          currentCall = await getCall(id);
          setCallId(id);
          currentCallIdRef.current = id;
          router.replace(`/messages/call?call=${id}`);
        }
        if (!id || !currentCall) throw new Error("Call not found");
        if (!currentCall.participantIds.includes(user.uid)) throw new Error("You cannot join this call");

        currentCallIdRef.current = id;
        const currentRole = currentCall.callerId === user.uid ? "caller" : "callee";
        roleRef.current = currentRole;
        setRole(currentRole);
        setCall(currentCall);
        setCameraOn(currentCall.mode === "video");
        const friendId = currentRole === "caller" ? currentCall.calleeId : currentCall.callerId;
        setOtherUser(await getUser(friendId));

        cleanupRef.current.push(subscribeCall(id, (next) => {
          setCall(next);
          if (!next) return;
          if (next.status === "ringing") setStatus(currentRole === "caller" ? "Calling…" : "Incoming call");
          if (next.status === "connecting" && peerRef.current?.connectionState !== "connected") setStatus("Connecting…");
          if (next.status === "active" && peerRef.current?.connectionState === "connected") setStatus("Connected");
          if (next.status === "declined" || next.status === "ended") {
            setStatus(next.status === "declined" ? "Call declined" : "Call ended");
            cleanup();
          }
        }));

        if (currentRole === "caller") {
          setAccepted(true);
          await beginCaller(id, currentCall.mode);
        }
      } catch (cause) {
        const message = describeMediaError(cause);
        setError(message);
        setStatus(message);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const end = async (nextStatus: "ended" | "declined" = "ended") => {
    if (callId) await setCallStatus(callId, nextStatus).catch(() => undefined);
    cleanup();
    router.replace(call?.conversationId ? `/messages?c=${call.conversationId}` : "/messages");
  };

  const toggleMic = () => {
    const next = !micOn;
    setMicOn(next);
    localStreamRef.current?.getAudioTracks().forEach((track) => { track.enabled = next; });
  };

  const toggleCamera = () => {
    const next = !cameraOn;
    setCameraOn(next);
    localStreamRef.current?.getVideoTracks().forEach((track) => { track.enabled = next; });
  };

  const replaceInput = async (kind: "audio" | "video", deviceId: string, nextFacingMode = facingMode) => {
    const peer = peerRef.current;
    const current = localStreamRef.current;
    if (!peer || !current) return;
    try {
      const replacement = await navigator.mediaDevices.getUserMedia(kind === "audio"
        ? { audio: { deviceId: { exact: deviceId }, echoCancellation: true, noiseSuppression: true }, video: false }
        : { audio: false, video: deviceId ? { deviceId: { exact: deviceId }, width: { ideal: 1280 }, height: { ideal: 720 } } : { facingMode: nextFacingMode, width: { ideal: 1280 }, height: { ideal: 720 } } });
      const newTrack = kind === "audio" ? replacement.getAudioTracks()[0] : replacement.getVideoTracks()[0];
      const oldTrack = kind === "audio" ? current.getAudioTracks()[0] : current.getVideoTracks()[0];
      const sender = peer.getSenders().find((item) => item.track?.kind === kind);
      if (!newTrack || !sender) throw new Error(`Could not switch ${kind === "audio" ? "microphone" : "camera"}.`);
      await sender.replaceTrack(newTrack);
      if (oldTrack) {
        current.removeTrack(oldTrack);
        oldTrack.stop();
      }
      current.addTrack(newTrack);
      window.requestAnimationFrame(attachStreams);
      replacement.getTracks().filter((track) => track.id !== newTrack.id).forEach((track) => track.stop());
    } catch (cause) {
      toast.error(describeMediaError(cause));
    }
  };

  const flipCamera = async () => {
    const next = facingMode === "user" ? "environment" : "user";
    setFacingMode(next);
    setVideoInputId("");
    await replaceInput("video", "", next);
  };

  const isIncoming = role === "callee" && !accepted && call?.status !== "declined" && call?.status !== "ended";
  const isVideo = call?.mode === "video" || requestedMode === "video";

  return (
    <main className="relative flex h-[calc(100dvh_-_53px_-_env(safe-area-inset-top))] min-h-[520px] flex-col overflow-hidden bg-[#0f1419] text-white lg:h-[100dvh]">
      <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden">
        {isVideo ? <video ref={remoteVideo} autoPlay playsInline onClick={() => void remoteVideo.current?.play()} className="h-full w-full bg-black object-cover" /> : <div className="text-center"><UserAvatar user={otherUser} size="xl" className="mx-auto h-32 w-32" clickable={false} /><h1 className="mt-5 text-3xl font-bold">{otherUser?.displayName || "Flux call"}</h1><p className="mt-2 text-sm text-white/65">{status}</p>{status === "Connected" ? <p className="mt-2 font-mono text-xs text-white/45">{formatDuration(seconds)}</p> : null}</div>}

        {isVideo ? <div className="absolute inset-x-0 top-0 bg-gradient-to-b from-black/75 to-transparent px-5 pb-20 pt-[max(1.25rem,env(safe-area-inset-top))]"><h1 className="text-xl font-bold">{otherUser?.displayName || "Video call"}</h1><p className="text-sm text-white/70">{status}{status === "Connected" ? ` · ${formatDuration(seconds)}` : ""}</p></div> : null}
        {isVideo && !remoteReady && !isIncoming ? <div className="absolute inset-0 grid place-items-center bg-black/35"><div className="rounded-full bg-black/55 px-4 py-2 text-sm text-white/75">Waiting for video…</div></div> : null}
        {isVideo ? <video ref={localVideo} autoPlay muted playsInline className="absolute bottom-4 right-4 h-40 w-28 rounded-2xl border border-white/20 bg-black object-cover shadow-2xl sm:h-52 sm:w-36" /> : <video ref={localVideo} autoPlay muted playsInline className="hidden" />}
      </div>

      {error ? <div className="relative flex items-center justify-center gap-3 border-t border-red-400/20 bg-red-500/10 px-4 py-3 text-center text-sm text-red-100"><WifiOff className="h-4 w-4" /><span>{error}</span>{peerRef.current && role === "caller" ? <button type="button" onClick={() => void sendReconnectOffer()} className="rounded-full border border-red-200/25 px-3 py-1 text-xs font-bold"><RefreshCw className="mr-1 inline h-3.5 w-3.5" />Retry</button> : null}</div> : null}

      {!isIncoming && (microphones.length > 1 || (isVideo && cameras.length > 1)) ? <div className="relative flex flex-wrap justify-center gap-2 border-t border-white/10 bg-black/45 px-3 py-2 text-xs"><select value={audioInputId} onChange={(event) => { setAudioInputId(event.target.value); void replaceInput("audio", event.target.value); }} className="max-w-48 rounded-full border border-white/10 bg-white/10 px-3 py-2">{microphones.map((device, index) => <option key={device.deviceId} value={device.deviceId} className="bg-black">{device.label || `Microphone ${index + 1}`}</option>)}</select>{isVideo && cameras.length > 1 ? <select value={videoInputId} onChange={(event) => { setVideoInputId(event.target.value); void replaceInput("video", event.target.value); }} className="max-w-48 rounded-full border border-white/10 bg-white/10 px-3 py-2">{cameras.map((device, index) => <option key={device.deviceId} value={device.deviceId} className="bg-black">{device.label || `Camera ${index + 1}`}</option>)}</select> : null}</div> : null}

      <div className="relative flex items-center justify-center gap-3 border-t border-white/10 bg-black/65 px-4 py-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] backdrop-blur-xl">
        {isIncoming ? <><Button onClick={() => void end("declined")} className="h-14 rounded-full bg-red-500 px-7 text-white hover:bg-red-600"><PhoneOff className="h-5 w-5" />Decline</Button><Button onClick={() => void accept()} className="h-14 rounded-full bg-emerald-500 px-7 text-white hover:bg-emerald-600">{isVideo ? <Video className="h-5 w-5" /> : <Mic className="h-5 w-5" />}Answer</Button></> : <><CallButton onClick={toggleMic} active={micOn} label={micOn ? "Mute" : "Unmute"}>{micOn ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}</CallButton>{isVideo ? <CallButton onClick={toggleCamera} active={cameraOn} label={cameraOn ? "Camera off" : "Camera on"}>{cameraOn ? <Camera className="h-5 w-5" /> : <CameraOff className="h-5 w-5" />}</CallButton> : null}{isVideo ? <CallButton onClick={() => void flipCamera()} active label="Flip camera"><FlipHorizontal className="h-5 w-5" /></CallButton> : null}{reconnecting ? <span className="grid h-14 w-14 place-items-center rounded-full bg-white/10"><Loader2 className="h-5 w-5 animate-spin" /></span> : null}<button type="button" onClick={() => void end()} className="grid h-14 w-14 place-items-center rounded-full bg-red-500 text-white hover:bg-red-600" aria-label="End call"><PhoneOff className="h-6 w-6" /></button></>}
      </div>
    </main>
  );
}

function CallButton({ onClick, active, label, children }: { onClick: () => void; active: boolean; label: string; children: React.ReactNode }) {
  return <button type="button" onClick={onClick} className={active ? "grid h-14 w-14 place-items-center rounded-full bg-white/15 text-white hover:bg-white/25" : "grid h-14 w-14 place-items-center rounded-full bg-white text-black"} aria-label={label}>{children}</button>;
}

function CallLoading() {
  return <div className="grid min-h-[70vh] place-items-center bg-[#0f1419] text-white"><div className="text-center"><Loader2 className="mx-auto h-7 w-7 animate-spin" /><p className="mt-3 text-sm text-white/55">Opening call…</p></div></div>;
}

function formatDuration(total: number): string {
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}
