"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { signInAnonymously, type User } from "firebase/auth";
import {
  AlertTriangle,
  ArrowLeft,
  Eye,
  Gift,
  Heart,
  Loader2,
  MessageCircle,
  Radio,
  RefreshCw,
  Send,
  Share2,
  Signal,
  Volume2,
  VolumeX,
  WifiOff,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/auth-context";
import { auth } from "@/lib/firebase";
import { createIceCandidateQueue } from "@/lib/webrtc";
import { createReliableLivePeer } from "@/lib/live-ice";
import {
  addReliableLiveCandidate,
  removeReliableLivePeer,
  resetReliableLivePeer,
  setReliableLiveAnswer,
  setReliableLiveStatus,
  subscribeReliableLiveCandidates,
  subscribeReliableLivePeer,
} from "@/services/live-reliable";
import {
  heartbeatLiveViewer,
  joinLiveStream,
  leaveLiveStream,
  recordLiveShare,
  sendLiveComment,
  subscribeLiveComments,
  subscribeLiveStream,
  toggleLiveLike,
  type FluxLiveStream,
  type LiveComment,
} from "@/services/live";
import { UserAvatar } from "@/components/shared/user-avatar";
import { cn } from "@/lib/utils";

type TransportKind = "direct" | "relay" | "unknown";

export default function LiveViewerV4() {
  const { user } = useAuth();
  const videoRef = useRef<HTMLVideoElement>(null);
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const joinedAtRef = useRef<number | null>(null);
  const [guestUser, setGuestUser] = useState<User | null>(null);
  const activeUser = user || guestUser;
  const [id, setId] = useState("");
  const [stream, setStream] = useState<FluxLiveStream | null>(null);
  const [comments, setComments] = useState<LiveComment[]>([]);
  const [comment, setComment] = useState("");
  const [status, setStatus] = useState("Preparing live…");
  const [attempt, setAttempt] = useState(1);
  const [canRetry, setCanRetry] = useState(false);
  const [liked, setLiked] = useState(false);
  const [muted, setMuted] = useState(true);
  const [chatOpen, setChatOpen] = useState(false);
  const [transport, setTransport] = useState<TransportKind>("unknown");
  const [guestError, setGuestError] = useState<string | null>(null);
  const [hearts, setHearts] = useState<Array<{ id: string; left: number }>>([]);

  useEffect(() => {
    setId(new URLSearchParams(window.location.search).get("id") || "");
  }, []);

  useEffect(() => {
    if (!id) return;
    const stopStream = subscribeLiveStream(id, setStream);
    const stopComments = subscribeLiveComments(id, setComments);
    return () => {
      stopStream();
      stopComments();
    };
  }, [id]);

  useEffect(() => {
    if (!id || user || guestUser || guestError) return;
    void signInAnonymously(auth)
      .then((result) => setGuestUser(result.user))
      .catch((error: { code?: string }) => {
        console.error("Guest live sign-in failed", error);
        setGuestError(error?.code === "auth/operation-not-allowed"
          ? "Guest viewing is not enabled in Firebase Authentication yet."
          : "Flux could not create a temporary guest viewer session.");
      });
  }, [guestError, guestUser, id, user]);

  useEffect(() => {
    if (!id || !activeUser || stream?.status !== "live" || stream.hostId === activeUser.uid) return;
    joinedAtRef.current = Date.now();
    void joinLiveStream(id, activeUser.uid);
    const heartbeat = window.setInterval(() => void heartbeatLiveViewer(id, activeUser.uid), 20_000);
    return () => {
      window.clearInterval(heartbeat);
      const watched = joinedAtRef.current
        ? Math.max(0, Math.floor((Date.now() - joinedAtRef.current) / 1000))
        : 0;
      void leaveLiveStream(id, activeUser.uid, watched);
      joinedAtRef.current = null;
    };
  }, [activeUser, id, stream?.hostId, stream?.status]);

  useEffect(() => {
    if (!id || !activeUser || stream?.status !== "live" || stream.hostId === activeUser.uid) return;
    let cancelled = false;
    let stopCandidates = () => {};
    let stopPeer = () => {};
    let timeout = 0;

    setCanRetry(false);
    setTransport("unknown");
    setStatus(attempt > 1 ? `Reconnecting · attempt ${attempt}` : "Joining live…");

    void (async () => {
      await resetReliableLivePeer(id, activeUser.uid, attempt);
      if (cancelled) return;

      const peer = await createReliableLivePeer();
      if (cancelled) {
        peer.close();
        return;
      }
      const queue = createIceCandidateQueue(peer);
      peerRef.current = peer;

      peer.ontrack = (event) => {
        const media = event.streams[0] || new MediaStream([event.track]);
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = media;
        video.muted = true;
        setMuted(true);
        void video.play()
          .then(() => setStatus("Live"))
          .catch(() => setStatus("Tap the video to start playback"));
      };

      peer.onicecandidate = (event) => {
        if (event.candidate) {
          void addReliableLiveCandidate(id, activeUser.uid, "viewer", attempt, event.candidate.toJSON());
        }
      };

      peer.onconnectionstatechange = () => {
        if (peer.connectionState === "connected") {
          setStatus("Live");
          setCanRetry(false);
          void setReliableLiveStatus(id, activeUser.uid, attempt, "connected");
          void detectTransport(peer).then(setTransport);
          if (timeout) window.clearTimeout(timeout);
        } else if (peer.connectionState === "connecting") {
          setStatus("Connecting video…");
        } else if (peer.connectionState === "failed" || peer.connectionState === "disconnected") {
          setStatus("Live signal interrupted");
          setCanRetry(true);
          void setReliableLiveStatus(id, activeUser.uid, attempt, "failed");
        }
      };

      peer.onicecandidateerror = (event) => {
        console.warn("Live ICE candidate error", event.errorCode, event.errorText);
      };

      stopCandidates = subscribeReliableLiveCandidates(
        id,
        activeUser.uid,
        "host",
        attempt,
        (candidate) => void queue.add(candidate)
      );
      stopPeer = subscribeReliableLivePeer(id, activeUser.uid, attempt, (data) => {
        const offer = data?.offer;
        if (!offer || cancelled || peer.remoteDescription?.sdp === offer.sdp) return;
        void (async () => {
          await peer.setRemoteDescription(new RTCSessionDescription(offer));
          await queue.flush();
          const answer = await peer.createAnswer();
          await peer.setLocalDescription(answer);
          await setReliableLiveAnswer(id, activeUser.uid, attempt, {
            type: answer.type,
            sdp: answer.sdp,
          });
          setStatus("Connecting video…");
        })().catch((error) => {
          console.error("Live negotiation failed", error);
          setStatus("Could not negotiate the live video");
          setCanRetry(true);
        });
      });

      timeout = window.setTimeout(() => {
        if (peer.connectionState !== "connected") {
          setStatus("The host did not connect in time");
          setCanRetry(true);
        }
      }, 30_000);
    })().catch((error) => {
      console.error(error);
      setStatus(error instanceof Error ? error.message : "Could not join live");
      setCanRetry(true);
    });

    return () => {
      cancelled = true;
      if (timeout) window.clearTimeout(timeout);
      stopCandidates();
      stopPeer();
      peerRef.current?.getReceivers().forEach((receiver) => receiver.track?.stop());
      peerRef.current?.close();
      peerRef.current = null;
      if (videoRef.current) videoRef.current.srcObject = null;
      void removeReliableLivePeer(id, activeUser.uid);
    };
  }, [activeUser, attempt, id, stream?.hostId, stream?.status]);

  const latestComments = useMemo(() => comments.slice(-6), [comments]);

  const send = async () => {
    if (!id || !activeUser || !comment.trim()) return;
    try {
      await sendLiveComment(id, activeUser.uid, comment.trim());
      setComment("");
    } catch {
      toast.error("Could not send this comment");
    }
  };

  const react = async () => {
    if (!activeUser || !id) return;
    const heart = { id: crypto.randomUUID(), left: 72 + Math.round(Math.random() * 15) };
    setHearts((current) => [...current.slice(-8), heart]);
    window.setTimeout(
      () => setHearts((current) => current.filter((item) => item.id !== heart.id)),
      1_500
    );
    try {
      setLiked(await toggleLiveLike(id, activeUser.uid));
    } catch {
      toast.error("Could not react");
    }
  };

  const share = async () => {
    if (!activeUser || !stream) return;
    try {
      if (navigator.share) {
        await navigator.share({ title: stream.title, text: stream.description, url: window.location.href });
      } else {
        await navigator.clipboard.writeText(window.location.href);
        toast.success("Live link copied");
      }
      await recordLiveShare(id, activeUser.uid);
    } catch (error) {
      if ((error as DOMException)?.name !== "AbortError") toast.error("Could not share live");
    }
  };

  const toggleSound = async () => {
    const video = videoRef.current;
    if (!video) return;
    const nextMuted = !muted;
    video.muted = nextMuted;
    setMuted(nextMuted);
    await video.play().catch(() => undefined);
  };

  if (!id) {
    return <StatePage icon={AlertTriangle} title="Live link is missing" text="Open a stream from the Flux Live page." />;
  }
  if (!stream) return <StatePage icon={Loader2} title="Loading live" text={status} spinning />;
  if (stream.status === "ended") {
    return <StatePage icon={Radio} title="This live has ended" text={`${stream.uniqueViewers} viewers · ${stream.likesCount} likes`} />;
  }
  if (guestError && !user) {
    return <StatePage icon={AlertTriangle} title="Guest viewing needs one Firebase setting" text={guestError} action="/login" actionLabel="Sign in instead" />;
  }
  if (!activeUser) {
    return <StatePage icon={Loader2} title="Creating guest viewer" text="Preparing a temporary Firebase session…" spinning />;
  }
  if (stream.hostId === activeUser.uid) {
    return <StatePage icon={Radio} title="You are hosting this live" text="Use Live Studio to control the broadcast." action="/live/create" actionLabel="Open Studio" />;
  }

  return (
    <main className="h-[100dvh] overflow-hidden bg-black text-white">
      <section className="relative mx-auto h-full max-w-[1500px] overflow-hidden bg-black xl:grid xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="relative h-full overflow-hidden">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted={muted}
            className="absolute inset-0 h-full w-full object-contain"
            onClick={() => void toggleSound()}
          />
          <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-40 bg-gradient-to-b from-black/88 to-transparent" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-[58%] bg-gradient-to-t from-black/94 via-black/28 to-transparent" />

          <header className="absolute inset-x-0 top-0 z-30 flex items-center gap-2 px-3 pt-[max(.7rem,env(safe-area-inset-top))] sm:px-5">
            <Link href="/live" className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-black/55">
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <UserAvatar user={stream.host} size="sm" clickable={false} />
            <div className="min-w-0">
              <p className="truncate text-sm font-black">{stream.host?.displayName || "Flux creator"}</p>
              <p className="truncate text-[10px] text-white/62">@{stream.host?.username || "creator"}</p>
            </div>
            <span className="ml-auto rounded-full bg-red-500 px-2.5 py-1.5 text-[10px] font-black">LIVE</span>
            <span className="flex items-center gap-1 rounded-full bg-black/55 px-2.5 py-1.5 text-[10px] font-black">
              <Eye className="h-3.5 w-3.5" />{stream.viewersCount}
            </span>
          </header>

          <div className="absolute bottom-[calc(78px+env(safe-area-inset-bottom))] right-3 z-30 flex flex-col items-center gap-4 xl:hidden">
            <ActionButton icon={Heart} label={String(stream.likesCount)} active={liked} onClick={() => void react()} />
            <ActionButton icon={MessageCircle} label={String(stream.commentsCount)} onClick={() => setChatOpen(true)} />
            <ActionButton icon={Share2} label="Share" onClick={() => void share()} />
            <Link href="/gifts" className="flex flex-col items-center gap-1 text-[9px] font-black">
              <span className="grid h-11 w-11 place-items-center rounded-full bg-black/55"><Gift className="h-5 w-5" /></span>Gift
            </Link>
            <button type="button" onClick={() => void toggleSound()} className="flex flex-col items-center gap-1 text-[9px] font-black">
              <span className="grid h-11 w-11 place-items-center rounded-full bg-black/55">
                {muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
              </span>{muted ? "Sound" : "Mute"}
            </button>
          </div>

          <div className="absolute inset-x-3 bottom-[calc(70px+env(safe-area-inset-bottom))] z-20 max-w-[78%] xl:hidden">
            <div className="space-y-2">
              {latestComments.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  onClick={() => setComment(`@${item.author?.username || "viewer"} `)}
                  className="block max-w-full rounded-2xl bg-black/32 px-3 py-2 text-left text-xs backdrop-blur-sm"
                >
                  <strong>{item.author?.displayName || "Guest"}</strong>{" "}
                  <span className="text-white/82">{item.text}</span>
                </button>
              ))}
            </div>
            <p className="mt-3 line-clamp-2 text-sm font-semibold">{stream.description}</p>
            <div className="mt-2 flex items-center gap-2 text-[10px] font-black text-white/52">
              <Signal className="h-3.5 w-3.5" />{status}{transport !== "unknown" ? ` · ${transport}` : ""}
            </div>
          </div>

          <div className="absolute inset-x-0 bottom-0 z-40 border-t border-white/10 bg-black/70 px-3 pb-[max(.55rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur-xl xl:hidden">
            <div className="flex items-center gap-2">
              <input
                value={comment}
                onChange={(event) => setComment(event.target.value)}
                onKeyDown={(event) => { if (event.key === "Enter") void send(); }}
                placeholder="Add comment…"
                className="h-10 min-w-0 flex-1 rounded-full border border-white/16 bg-white/8 px-4 text-sm outline-none placeholder:text-white/42"
              />
              <button type="button" onClick={() => void send()} disabled={!comment.trim()} className="grid h-10 w-10 place-items-center rounded-full bg-white text-black disabled:opacity-35">
                <Send className="h-4 w-4" />
              </button>
            </div>
          </div>

          {canRetry ? (
            <div className="absolute inset-0 z-50 grid place-items-center bg-black/78 p-6">
              <div className="max-w-sm text-center">
                <WifiOff className="mx-auto h-8 w-8 text-white/60" />
                <h2 className="mt-4 text-xl font-black">Live signal interrupted</h2>
                <p className="mt-2 text-sm leading-6 text-white/55">{status}. A new isolated connection attempt will be created.</p>
                <button onClick={() => setAttempt((value) => value + 1)} className="mt-5 inline-flex h-11 items-center gap-2 rounded-full bg-white px-6 font-black text-black">
                  <RefreshCw className="h-4 w-4" />Reconnect
                </button>
              </div>
            </div>
          ) : null}

          {hearts.map((heart) => (
            <span
              key={heart.id}
              className="flux-live-heart pointer-events-none absolute bottom-24 z-40 text-3xl text-rose-500"
              style={{ left: `${heart.left}%` }}
            >♥</span>
          ))}
        </div>

        <aside className="hidden h-full min-h-0 border-l border-white/10 bg-[#090b0f] xl:flex xl:flex-col">
          <div className="border-b border-white/10 p-4">
            <h2 className="font-black">Live chat</h2>
            <p className="mt-1 text-xs text-white/42">{status}{transport !== "unknown" ? ` · ${transport} connection` : ""}</p>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            <div className="space-y-3">
              {comments.map((item) => (
                <button type="button" key={item.id} onClick={() => setComment(`@${item.author?.username || "viewer"} `)} className="flex w-full gap-2 text-left">
                  <UserAvatar user={item.author} size="xs" clickable={false} />
                  <p className="min-w-0 text-sm"><strong>{item.author?.displayName || "Guest"}</strong>{" "}<span className="text-white/68">{item.text}</span></p>
                </button>
              ))}
            </div>
          </div>
          <div className="border-t border-white/10 p-3">
            <div className="flex gap-2">
              <input value={comment} onChange={(event) => setComment(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void send(); }} placeholder="Add comment…" className="h-10 min-w-0 flex-1 rounded-full bg-white/8 px-4 text-sm outline-none" />
              <button onClick={() => void send()} className="grid h-10 w-10 place-items-center rounded-full bg-white text-black"><Send className="h-4 w-4" /></button>
            </div>
          </div>
        </aside>
      </section>

      {chatOpen ? (
        <div className="fixed inset-0 z-[100] grid place-items-end bg-black/55 xl:hidden" onClick={() => setChatOpen(false)}>
          <div className="max-h-[70dvh] w-full overflow-hidden rounded-t-[24px] bg-[#0b0e13]" onClick={(event) => event.stopPropagation()}>
            <div className="border-b border-white/10 p-4 font-black">Comments</div>
            <div className="max-h-[55dvh] overflow-y-auto p-4">
              <div className="space-y-3">
                {comments.map((item) => <p key={item.id} className="text-sm"><strong>{item.author?.displayName || "Guest"}</strong>{" "}<span className="text-white/68">{item.text}</span></p>)}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}

async function detectTransport(peer: RTCPeerConnection): Promise<TransportKind> {
  try {
    const stats = await peer.getStats();
    let selected: Record<string, unknown> | undefined;
    stats.forEach((item) => {
      const candidatePair = item as unknown as Record<string, unknown>;
      if (
        candidatePair.type === "candidate-pair"
        && candidatePair.state === "succeeded"
        && (candidatePair.nominated === true || candidatePair.selected === true)
      ) {
        selected = candidatePair;
      }
    });
    const localCandidateId = typeof selected?.localCandidateId === "string" ? selected.localCandidateId : "";
    if (!localCandidateId) return "unknown";
    const local = stats.get(localCandidateId) as unknown as Record<string, unknown> | undefined;
    return local?.candidateType === "relay" ? "relay" : "direct";
  } catch {
    return "unknown";
  }
}

function ActionButton({ icon: Icon, label, active, onClick }: { icon: LucideIcon; label: string; active?: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex flex-col items-center gap-1 text-[9px] font-black">
      <span className={cn("grid h-11 w-11 place-items-center rounded-full bg-black/55", active && "text-rose-500")}>
        <Icon className={cn("h-5 w-5", active && "fill-current")} />
      </span>{label}
    </button>
  );
}

function StatePage({ icon: Icon, title, text, spinning, action, actionLabel }: { icon: LucideIcon; title: string; text: string; spinning?: boolean; action?: string; actionLabel?: string }) {
  return (
    <main className="grid min-h-[100dvh] place-items-center bg-black p-6 text-center text-white">
      <div className="max-w-sm">
        <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-white/8">
          <Icon className={cn("h-7 w-7 text-white/65", spinning && "animate-spin")} />
        </span>
        <h1 className="mt-4 text-xl font-black">{title}</h1>
        <p className="mt-2 text-sm leading-6 text-white/48">{text}</p>
        {action ? <Link href={action} className="mt-5 inline-flex h-11 items-center rounded-full bg-white px-6 font-black text-black">{actionLabel}</Link> : null}
      </div>
    </main>
  );
}
