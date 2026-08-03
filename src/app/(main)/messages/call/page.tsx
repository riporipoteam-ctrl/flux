"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { doc, getDoc } from "firebase/firestore";
import { Camera, CameraOff, Loader2, Mic, MicOff, Phone, PhoneOff, Video, Volume2 } from "lucide-react";
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
import type { UserProfile } from "@/types";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Button } from "@/components/ui/button";

const ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

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
  const [needsSound, setNeedsSound] = useState(false);
  const [cameraOn, setCameraOn] = useState(requestedMode === "video");
  const localVideo = useRef<HTMLVideoElement>(null);
  const remoteVideo = useRef<HTMLVideoElement>(null);
  // A voice call has no <video> on screen, so the remote stream needs its own
  // sink — without one `ontrack` had nothing to attach to and nobody was heard.
  const remoteAudio = useRef<HTMLAudioElement>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const cleanupRef = useRef<Array<() => void>>([]);
  const startedRef = useRef(false);

  const cleanup = () => {
    for (const unsubscribe of cleanupRef.current.splice(0)) unsubscribe();
    peerRef.current?.close();
    peerRef.current = null;
    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    localStreamRef.current = null;
    remoteStreamRef.current = null;
    if (remoteAudio.current) remoteAudio.current.srcObject = null;
    if (remoteVideo.current) remoteVideo.current.srcObject = null;
  };

  useEffect(() => cleanup, []);

  // The sink element changes when the call mode resolves, so re-point the
  // stream whenever the layout that renders it changes.
  useEffect(() => {
    attachRemote();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accepted, call?.mode, call?.status]);

  useEffect(() => {
    if (!user || startedRef.current) return;
    startedRef.current = true;

    void (async () => {
      try {
        let currentCallId = requestedCallId;
        let currentCall = requestedCallId ? await getCall(requestedCallId) : null;

        if (!currentCallId) {
          if (!conversationId) throw new Error("Conversation missing");
          const conversationSnap = await getDoc(doc(db, "conversations", conversationId));
          if (!conversationSnap.exists()) throw new Error("Conversation not found");
          const data = conversationSnap.data();
          if (data.type !== "dm") throw new Error("Group calls are coming in the next call update");
          const participantIds: string[] = data.participantIds || [];
          if (!participantIds.includes(user.uid)) throw new Error("You are not in this conversation");
          const calleeId = participantIds.find((uid) => uid !== user.uid);
          if (!calleeId) throw new Error("Friend not found");
          currentCallId = await createCall({
            conversationId,
            callerId: user.uid,
            calleeId,
            mode: requestedMode,
          });
          currentCall = await getCall(currentCallId);
          setCallId(currentCallId);
          router.replace(`/messages/call?call=${currentCallId}`);
        }

        if (!currentCallId || !currentCall) throw new Error("Call not found");
        if (!currentCall.participantIds.includes(user.uid)) throw new Error("You cannot join this call");

        const currentRole = currentCall.callerId === user.uid ? "caller" : "callee";
        setRole(currentRole);
        setCall(currentCall);
        setCameraOn(currentCall.mode === "video");
        const friendId = currentRole === "caller" ? currentCall.calleeId : currentCall.callerId;
        setOtherUser(await getUser(friendId));

        const unsubscribe = subscribeCall(currentCallId, (next) => {
          setCall(next);
          if (!next) return;
          if (next.status === "ringing") setStatus(currentRole === "caller" ? "Calling…" : "Incoming call");
          if (next.status === "connecting") setStatus("Connecting…");
          if (next.status === "active") setStatus("Connected");
          if (next.status === "declined") {
            setStatus("Call declined");
            cleanup();
          }
          if (next.status === "ended") {
            setStatus("Call ended");
            cleanup();
          }
        });
        cleanupRef.current.push(unsubscribe);

        if (currentRole === "caller") {
          setAccepted(true);
          await beginCaller(currentCallId, currentCall.mode);
        }
      } catch (cause) {
        const message = cause instanceof Error ? cause.message : "Call failed";
        setError(message);
        setStatus(message);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  /**
   * Points whichever element is on screen at the remote stream. Video mode uses
   * the <video>; voice mode uses the hidden <audio>. Browsers block autoplay
   * until a gesture, so a rejected play() is surfaced rather than swallowed.
   */
  const attachRemote = () => {
    const stream = remoteStreamRef.current;
    if (!stream) return;
    const wantsVideo = stream.getVideoTracks().length > 0;
    const sink = wantsVideo ? remoteVideo.current : remoteAudio.current;
    const idle = wantsVideo ? remoteAudio.current : remoteVideo.current;
    if (idle && idle.srcObject) idle.srcObject = null;
    if (!sink) return;
    if (sink.srcObject !== stream) sink.srcObject = stream;
    sink.muted = false;
    void sink.play().catch(() => setNeedsSound(true));
  };

  const getMedia = async (mode: CallMode) => {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: mode === "video" ? { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } } : false,
    });
    localStreamRef.current = stream;
    if (localVideo.current) localVideo.current.srcObject = stream;
    return stream;
  };

  const createPeer = (id: string, ownSide: "caller" | "callee", remoteSide: "caller" | "callee") => {
    const peer = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    peerRef.current = peer;
    peer.onicecandidate = (event) => {
      if (event.candidate) void addCallCandidate(id, ownSide, event.candidate.toJSON());
    };
    peer.ontrack = (event) => {
      const [stream] = event.streams;
      if (!stream) return;
      remoteStreamRef.current = stream;
      attachRemote();
    };
    peer.onconnectionstatechange = () => {
      if (peer.connectionState === "connected") setStatus("Connected");
      if (peer.connectionState === "failed") setStatus("Connection failed — try again");
    };
    const unsubscribe = subscribeCallCandidates(id, remoteSide, (candidate) => {
      void peer.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => undefined);
    });
    cleanupRef.current.push(unsubscribe);
    return peer;
  };

  const beginCaller = async (id: string, mode: CallMode) => {
    setStatus("Starting camera and microphone…");
    const stream = await getMedia(mode);
    const peer = createPeer(id, "caller", "callee");
    stream.getTracks().forEach((track) => peer.addTrack(track, stream));
    const offer = await peer.createOffer();
    await peer.setLocalDescription(offer);
    await setCallOffer(id, { type: offer.type, sdp: offer.sdp });

    const unsubscribe = subscribeCall(id, (next) => {
      if (!next?.answer || peer.currentRemoteDescription) return;
      void peer.setRemoteDescription(new RTCSessionDescription(next.answer)).catch(() => undefined);
    });
    cleanupRef.current.push(unsubscribe);
    setStatus("Calling…");
  };

  const accept = async () => {
    if (!callId || !call?.offer || accepted) return;
    setAccepted(true);
    try {
      setStatus("Starting camera and microphone…");
      const stream = await getMedia(call.mode);
      const peer = createPeer(callId, "callee", "caller");
      stream.getTracks().forEach((track) => peer.addTrack(track, stream));
      await peer.setRemoteDescription(new RTCSessionDescription(call.offer));
      const answer = await peer.createAnswer();
      await peer.setLocalDescription(answer);
      await setCallAnswer(callId, { type: answer.type, sdp: answer.sdp });
      setStatus("Connecting…");
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Could not answer call";
      setError(message);
      toast.error(message);
    }
  };

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

  const isIncoming = role === "callee" && !accepted && call?.status !== "declined" && call?.status !== "ended";
  const isVideo = call?.mode === "video" || requestedMode === "video";

  return (
    <main className="flux-call">
      <div className="flux-call-glow" aria-hidden />

      {/* Always mounted: this is what carries a voice call's audio. */}
      <audio ref={remoteAudio} autoPlay playsInline className="hidden" />

      <div className="flux-call-stage">
        {isVideo ? (
          <video ref={remoteVideo} autoPlay playsInline className="flux-call-remote" />
        ) : (
          <div className="flux-call-voice">
            <span className="flux-call-halo" data-live={call?.status === "active" ? "true" : undefined} aria-hidden />
            <UserAvatar user={otherUser} size="xl" className="relative h-32 w-32" clickable={false} />
            <h1>{otherUser?.displayName || "Flux call"}</h1>
            <p>{status}</p>
            {otherUser?.username ? <small>@{otherUser.username}</small> : null}
          </div>
        )}

        {isVideo ? (
          <div className="flux-call-topbar">
            <h1>{otherUser?.displayName || "Video call"}</h1>
            <p>{status}</p>
          </div>
        ) : null}

        <video
          ref={localVideo}
          autoPlay
          muted
          playsInline
          className={isVideo ? "flux-call-self" : "hidden"}
          data-off={isVideo && !cameraOn ? "true" : undefined}
        />
      </div>

      {needsSound ? (
        <button type="button" className="flux-call-notice is-action" onClick={() => { setNeedsSound(false); attachRemote(); }}>
          <Volume2 className="h-4 w-4" /> Tap to turn on call audio
        </button>
      ) : null}
      {error ? <div className="flux-call-notice is-error">{error}</div> : null}

      <div className="flux-call-dock">
        {isIncoming ? (
          <>
            <Button onClick={() => void end("declined")} className="flux-call-answer is-decline"><PhoneOff className="h-5 w-5" />Decline</Button>
            <Button onClick={() => void accept()} className="flux-call-answer is-accept">{isVideo ? <Video className="h-5 w-5" /> : <Phone className="h-5 w-5" />}Answer</Button>
          </>
        ) : (
          <>
            <CallButton onClick={toggleMic} active={micOn} label={micOn ? "Mute" : "Unmute"}>{micOn ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}</CallButton>
            {isVideo ? <CallButton onClick={toggleCamera} active={cameraOn} label={cameraOn ? "Camera off" : "Camera on"}>{cameraOn ? <Camera className="h-5 w-5" /> : <CameraOff className="h-5 w-5" />}</CallButton> : null}
            <button type="button" onClick={() => void end()} className="flux-call-hangup" aria-label="End call"><PhoneOff className="h-6 w-6" /></button>
          </>
        )}
      </div>
    </main>
  );
}

function CallButton({ onClick, active, label, children }: { onClick: () => void; active: boolean; label: string; children: React.ReactNode }) {
  return <button type="button" onClick={onClick} className="flux-call-toggle" data-off={active ? undefined : "true"} aria-label={label} aria-pressed={!active}>{children}</button>;
}

function CallLoading() {
  return <div className="grid min-h-[70dvh] place-items-center bg-[#0b0f14] text-white"><Loader2 className="h-7 w-7 animate-spin" /></div>;
}
