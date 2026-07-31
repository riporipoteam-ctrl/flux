"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { doc, getDoc } from "firebase/firestore";
import { Camera, CameraOff, Loader2, Mic, MicOff, PhoneOff, Video } from "lucide-react";
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
  const [cameraOn, setCameraOn] = useState(requestedMode === "video");
  const localVideo = useRef<HTMLVideoElement>(null);
  const remoteVideo = useRef<HTMLVideoElement>(null);
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
  };

  useEffect(() => cleanup, []);

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
      if (remoteVideo.current && stream) remoteVideo.current.srcObject = stream;
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
    <main className="relative flex h-[calc(100dvh_-_53px_-_env(safe-area-inset-top))] min-h-[520px] flex-col overflow-hidden bg-[#090b0e] text-white lg:h-[100dvh]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_15%,rgba(29,155,240,.18),transparent_36%)]" />

      <div className="relative flex flex-1 items-center justify-center overflow-hidden">
        {isVideo ? (
          <video ref={remoteVideo} autoPlay playsInline className="h-full w-full object-cover" />
        ) : (
          <div className="text-center">
            <UserAvatar user={otherUser} size="xl" className="mx-auto h-32 w-32" clickable={false} />
            <h1 className="mt-5 text-3xl font-bold">{otherUser?.displayName || "Flux call"}</h1>
            <p className="mt-2 text-sm text-white/65">{status}</p>
          </div>
        )}

        {isVideo ? (
          <div className="absolute left-0 right-0 top-0 bg-gradient-to-b from-black/70 to-transparent px-5 pb-20 pt-[max(1.25rem,env(safe-area-inset-top))]">
            <h1 className="text-xl font-bold">{otherUser?.displayName || "Video call"}</h1>
            <p className="text-sm text-white/70">{status}</p>
          </div>
        ) : null}

        {isVideo ? <video ref={localVideo} autoPlay muted playsInline className="absolute bottom-28 right-4 h-40 w-28 rounded-2xl border border-white/20 bg-black object-cover shadow-2xl sm:h-52 sm:w-36" /> : <video ref={localVideo} autoPlay muted playsInline className="hidden" />}
      </div>

      {error ? <div className="relative border-t border-red-400/20 bg-red-500/10 px-4 py-3 text-center text-sm text-red-200">{error}</div> : null}

      <div className="relative flex items-center justify-center gap-4 border-t border-white/10 bg-black/45 px-4 py-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] backdrop-blur-xl">
        {isIncoming ? (
          <>
            <Button onClick={() => void end("declined")} className="h-14 rounded-full bg-red-500 px-7 text-white hover:bg-red-600"><PhoneOff className="h-5 w-5" />Decline</Button>
            <Button onClick={() => void accept()} className="h-14 rounded-full bg-emerald-500 px-7 text-white hover:bg-emerald-600">{isVideo ? <Video className="h-5 w-5" /> : <Mic className="h-5 w-5" />}Answer</Button>
          </>
        ) : (
          <>
            <CallButton onClick={toggleMic} active={micOn} label={micOn ? "Mute" : "Unmute"}>{micOn ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}</CallButton>
            {isVideo ? <CallButton onClick={toggleCamera} active={cameraOn} label={cameraOn ? "Camera off" : "Camera on"}>{cameraOn ? <Camera className="h-5 w-5" /> : <CameraOff className="h-5 w-5" />}</CallButton> : null}
            <button type="button" onClick={() => void end()} className="grid h-14 w-14 place-items-center rounded-full bg-red-500 text-white hover:bg-red-600" aria-label="End call"><PhoneOff className="h-6 w-6" /></button>
          </>
        )}
      </div>
    </main>
  );
}

function CallButton({ onClick, active, label, children }: { onClick: () => void; active: boolean; label: string; children: React.ReactNode }) {
  return <button type="button" onClick={onClick} className={active ? "grid h-14 w-14 place-items-center rounded-full bg-white/15 text-white hover:bg-white/25" : "grid h-14 w-14 place-items-center rounded-full bg-white text-black"} aria-label={label}>{children}</button>;
}

function CallLoading() {
  return <div className="grid min-h-[70vh] place-items-center bg-[#090b0e] text-white"><Loader2 className="h-7 w-7 animate-spin" /></div>;
}
