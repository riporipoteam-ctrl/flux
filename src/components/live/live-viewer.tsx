"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  Eye,
  Heart,
  Loader2,
  MessageCircle,
  Play,
  Radio,
  RefreshCw,
  Share2,
  Signal,
  Sparkles,
  Users,
  Volume2,
  WifiOff,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/auth-context";
import {
  addLiveCandidate,
  createLivePeer,
  heartbeatLiveViewer,
  joinLiveStream,
  leaveLiveStream,
  recordLiveShare,
  removeLivePeer,
  sendLiveComment,
  setLivePeerAnswer,
  setLivePeerStatus,
  subscribeLiveCandidates,
  subscribeLiveComments,
  subscribeLivePeer,
  subscribeLiveStream,
  toggleLiveLike,
  type FluxLiveStream,
  type LiveComment,
} from "@/services/live";
import { createIceCandidateQueue, getFluxIceServers } from "@/lib/webrtc";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function LiveViewer() {
  const { user } = useAuth();
  const videoRef = useRef<HTMLVideoElement>(null);
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const joinedAtRef = useRef<number | null>(null);
  const connectedRef = useRef(false);
  const [id, setId] = useState("");
  const [stream, setStream] = useState<FluxLiveStream | null>(null);
  const [comments, setComments] = useState<LiveComment[]>([]);
  const [comment, setComment] = useState("");
  const [status, setStatus] = useState("Preparing live…");
  const [liked, setLiked] = useState(false);
  const [needsPlay, setNeedsPlay] = useState(false);
  const [connectionState, setConnectionState] = useState<RTCPeerConnectionState>("new");
  const [attempt, setAttempt] = useState(1);
  const [canRetry, setCanRetry] = useState(false);

  useEffect(() => {
    setId(new URLSearchParams(window.location.search).get("id") || "");
  }, []);

  useEffect(() => {
    if (!id) return;
    const streamUnsubscribe = subscribeLiveStream(id, setStream);
    const commentsUnsubscribe = subscribeLiveComments(id, setComments);
    return () => {
      streamUnsubscribe();
      commentsUnsubscribe();
    };
  }, [id]);

  useEffect(() => {
    if (!id || !user || stream?.status !== "live" || stream.hostId === user.uid) return;
    joinedAtRef.current = Date.now();
    void joinLiveStream(id, user.uid);
    const heartbeat = window.setInterval(() => void heartbeatLiveViewer(id, user.uid), 20_000);

    const leave = () => {
      const watched = joinedAtRef.current
        ? Math.max(0, Math.floor((Date.now() - joinedAtRef.current) / 1000))
        : 0;
      void leaveLiveStream(id, user.uid, watched);
    };
    window.addEventListener("pagehide", leave);
    return () => {
      window.removeEventListener("pagehide", leave);
      window.clearInterval(heartbeat);
      leave();
      joinedAtRef.current = null;
    };
  }, [id, stream?.hostId, stream?.status, user]);

  useEffect(() => {
    if (!id || !user || stream?.status !== "live" || stream.hostId === user.uid) return;
    let cancelled = false;
    let candidateUnsubscribe: () => void = () => {};
    let peerUnsubscribe: () => void = () => {};
    let connectionTimeout = 0;
    let disconnectedTimeout = 0;

    setStatus(attempt > 1 ? `Reconnecting · attempt ${attempt}` : "Joining live room…");
    setCanRetry(false);
    setNeedsPlay(false);
    connectedRef.current = false;

    void (async () => {
      try {
        await removeLivePeer(id, user.uid);
        await createLivePeer(id, user.uid, attempt);
        if (cancelled) return;

        const peer = new RTCPeerConnection({
          iceServers: getFluxIceServers(),
          iceCandidatePoolSize: 4,
          bundlePolicy: "max-bundle",
        });
        const queue = createIceCandidateQueue(peer);
        peerRef.current = peer;

        peer.ontrack = (event) => {
          const media = event.streams[0] || new MediaStream([event.track]);
          const video = videoRef.current;
          if (!video) return;
          video.srcObject = media;
          void video.play().then(() => {
            setNeedsPlay(false);
            setStatus("Live");
          }).catch(() => {
            setNeedsPlay(true);
            setStatus("Tap for live audio");
          });
        };

        peer.onicecandidate = (event) => {
          if (event.candidate) void addLiveCandidate(id, user.uid, "viewer", event.candidate.toJSON());
        };

        const updateConnectionState = () => {
          setConnectionState(peer.connectionState);
          if (peer.connectionState === "connected") {
            connectedRef.current = true;
            setCanRetry(false);
            setStatus("Live");
            if (connectionTimeout) window.clearTimeout(connectionTimeout);
            void setLivePeerStatus(id, user.uid, "connected");
          } else if (peer.connectionState === "connecting") {
            setStatus("Connecting media…");
          } else if (peer.connectionState === "disconnected") {
            setStatus("Signal interrupted — reconnecting…");
            if (disconnectedTimeout) window.clearTimeout(disconnectedTimeout);
            disconnectedTimeout = window.setTimeout(() => {
              if (peer.connectionState === "disconnected") {
                setStatus("Connection was lost");
                setCanRetry(true);
              }
            }, 7_000);
          } else if (peer.connectionState === "failed") {
            setStatus("Live connection failed");
            setCanRetry(true);
            void setLivePeerStatus(id, user.uid, "failed");
          }
        };
        peer.onconnectionstatechange = updateConnectionState;
        peer.oniceconnectionstatechange = () => {
          if (peer.iceConnectionState === "failed") {
            try { peer.restartIce(); } catch { /* retry button handles unsupported restart */ }
          }
        };

        candidateUnsubscribe = subscribeLiveCandidates(id, user.uid, "host", (candidate) => {
          void queue.add(candidate);
        });
        peerUnsubscribe = subscribeLivePeer(id, user.uid, (data) => {
          const offer = data?.offer;
          if (!offer || cancelled) return;
          void (async () => {
            const offerChanged = peer.remoteDescription?.sdp !== offer.sdp;
            if (!offerChanged) return;
            await peer.setRemoteDescription(new RTCSessionDescription(offer));
            await queue.flush();
            const answer = await peer.createAnswer();
            await peer.setLocalDescription(answer);
            await setLivePeerAnswer(id, user.uid, { type: answer.type, sdp: answer.sdp });
            setStatus("Connecting media…");
          })().catch((error) => {
            console.error("Live negotiation failed", error);
            setStatus("Could not negotiate this live");
            setCanRetry(true);
          });
        });

        connectionTimeout = window.setTimeout(() => {
          if (!connectedRef.current) {
            setStatus("The host did not connect in time");
            setCanRetry(true);
          }
        }, 25_000);
      } catch (error) {
        setStatus(error instanceof Error ? error.message : "Could not join live");
        setCanRetry(true);
      }
    })();

    return () => {
      cancelled = true;
      if (connectionTimeout) window.clearTimeout(connectionTimeout);
      if (disconnectedTimeout) window.clearTimeout(disconnectedTimeout);
      candidateUnsubscribe();
      peerUnsubscribe();
      peerRef.current?.getReceivers().forEach((receiver) => receiver.track?.stop());
      peerRef.current?.close();
      peerRef.current = null;
      if (videoRef.current) videoRef.current.srcObject = null;
      void removeLivePeer(id, user.uid);
    };
  }, [attempt, id, stream?.hostId, stream?.status, user]);

  const retry = () => {
    setCanRetry(false);
    setConnectionState("new");
    setAttempt((value) => value + 1);
  };

  const send = async () => {
    if (!id || !user || !comment.trim()) return;
    try {
      await sendLiveComment(id, user.uid, comment);
      setComment("");
    } catch {
      toast.error("Could not send this comment");
    }
  };

  const react = async () => {
    if (!user || !id) return;
    try { setLiked(await toggleLiveLike(id, user.uid)); }
    catch { toast.error("Could not react right now"); }
  };

  const share = async () => {
    if (!user || !id || !stream) return;
    try {
      if (navigator.share) await navigator.share({ title: stream.title, text: stream.description, url: window.location.href });
      else {
        await navigator.clipboard.writeText(window.location.href);
        toast.success("Live link copied");
      }
      await recordLiveShare(id, user.uid);
    } catch (error) {
      if ((error as DOMException)?.name !== "AbortError") toast.error("Could not share live");
    }
  };

  const startPlayback = async () => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = false;
    await video.play().then(() => {
      setNeedsPlay(false);
      setStatus("Live");
    }).catch(() => toast.error("Your browser blocked playback. Tap the video again."));
  };

  if (!id) return <StatePage icon={AlertTriangle} title="Live link is missing" text="Open a stream from the Flux Live page." />;
  if (!stream) return <StatePage icon={Loader2} title="Loading live" text={status} spinning />;
  if (stream.status === "ended") return <StatePage icon={Radio} title="This live has ended" text={`${stream.uniqueViewers} viewers · ${stream.likesCount} likes · peak ${stream.peakViewers}`} />;
  if (!user) return <StatePage icon={Signal} title="Sign in to watch live" text="Flux uses your signed-in Firebase session to protect the live signaling room." action={`/login?next=${encodeURIComponent(`/live/view?id=${id}`)}`} actionLabel="Sign in and watch" />;
  if (stream.hostId === user.uid) return <StatePage icon={Radio} title="You are hosting this live" text="Use the host studio to control your camera, screen and viewers." action="/live/create" actionLabel="Open host studio" />;

  return (
    <main className="flux-live-stage min-h-screen text-white">
      <div className="grid min-h-[calc(100dvh-53px-env(safe-area-inset-top))] xl:grid-cols-[minmax(0,1fr)_390px]">
        <section className="relative flex min-h-[58vh] items-center justify-center overflow-hidden bg-black">
          <video ref={videoRef} autoPlay playsInline className="h-full max-h-[calc(100dvh-53px)] w-full object-contain" onClick={() => needsPlay && void startPlayback()} />
          <div className="pointer-events-none absolute inset-x-0 top-0 h-36 bg-gradient-to-b from-black/80 to-transparent" />
          <div className="absolute left-4 top-4 flex max-w-[calc(100%-2rem)] flex-wrap items-center gap-2">
            <Link href="/live" className="grid h-10 w-10 place-items-center rounded-full bg-black/60 backdrop-blur-xl"><ArrowLeft className="h-4 w-4" /></Link>
            <span className="flex items-center gap-1.5 rounded-full bg-red-500 px-3 py-1.5 text-[11px] font-black"><span className="flux-live-status-dot h-2 w-2 rounded-full bg-white" />LIVE</span>
            <span className="flex items-center gap-1.5 rounded-full bg-black/60 px-3 py-1.5 text-[11px] font-bold backdrop-blur-xl"><Eye className="h-3.5 w-3.5" />{stream.viewersCount}</span>
            <span className={cn("flex max-w-[220px] items-center gap-1.5 truncate rounded-full px-3 py-1.5 text-[11px] font-bold backdrop-blur-xl", connectionState === "connected" ? "bg-emerald-500/85" : "bg-black/60")}><Signal className="h-3.5 w-3.5" /><span className="truncate">{connectionState === "connected" ? "Connected" : status}</span></span>
          </div>

          {needsPlay ? (
            <button onClick={() => void startPlayback()} className="absolute inset-0 z-20 grid place-items-center bg-black/45 backdrop-blur-[2px]">
              <span className="grid h-20 w-20 place-items-center rounded-full bg-white text-black shadow-2xl"><Play className="ml-1 h-8 w-8 fill-current" /></span>
              <span className="absolute mt-32 rounded-full bg-black/70 px-4 py-2 text-sm font-bold"><Volume2 className="mr-2 inline h-4 w-4" />Tap for live audio</span>
            </button>
          ) : null}

          {canRetry ? (
            <div className="absolute inset-0 z-20 grid place-items-center bg-black/65 p-6 backdrop-blur-sm">
              <div className="max-w-sm text-center">
                <span className="mx-auto grid h-16 w-16 place-items-center rounded-3xl bg-white/10"><WifiOff className="h-7 w-7 text-white/70" /></span>
                <h2 className="mt-4 text-xl font-black">Live signal interrupted</h2>
                <p className="mt-2 text-sm leading-6 text-white/50">{status}. Flux will create a fresh Firebase signaling session.</p>
                <Button onClick={retry} className="mt-5 h-12 rounded-full bg-white px-6 font-black text-black hover:bg-white/90"><RefreshCw className="h-4 w-4" />Reconnect</Button>
              </div>
            </div>
          ) : null}

          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-56 bg-gradient-to-t from-black/90 to-transparent" />
          <div className="absolute bottom-5 left-4 right-4 flex items-end justify-between gap-4">
            <div className="min-w-0 max-w-2xl">
              <div className="flex items-center gap-2"><UserAvatar user={stream.host} size="sm" clickable={false} /><div className="min-w-0"><p className="truncate text-sm font-black">{stream.host?.displayName || "Flux creator"}</p><p className="truncate text-[11px] text-white/55">@{stream.host?.username || "creator"}</p></div></div>
              <h1 className="mt-3 line-clamp-2 text-xl font-black tracking-tight sm:text-2xl">{stream.title}</h1>
              {stream.description ? <p className="mt-1 line-clamp-2 text-xs leading-5 text-white/55">{stream.description}</p> : null}
            </div>
            <div className="flex gap-2"><button onClick={() => void react()} className={cn("grid h-12 w-12 place-items-center rounded-full backdrop-blur-xl", liked ? "bg-rose-500" : "bg-black/55")} aria-label="Like live"><Heart className={cn("h-5 w-5", liked && "fill-white")} /></button><button onClick={() => void share()} className="grid h-12 w-12 place-items-center rounded-full bg-black/55 backdrop-blur-xl" aria-label="Share live"><Share2 className="h-5 w-5" /></button></div>
          </div>
        </section>

        <aside className="flex min-h-[42vh] flex-col border-l border-white/10 bg-[#0d0f12]/95 backdrop-blur-xl">
          <div className="flex items-center gap-3 border-b border-white/10 p-4"><div><p className="font-black">Live chat</p><p className="mt-0.5 text-[11px] text-white/40">{comments.length} comments · {stream.category}</p></div><span className="ml-auto flex items-center gap-1.5 rounded-full bg-white/6 px-3 py-1.5 text-[11px] font-bold text-white/65"><Users className="h-3.5 w-3.5" />{stream.uniqueViewers} reached</span></div>
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
            {comments.length ? comments.map((item) => <div key={item.id} className="flex gap-2.5 text-sm leading-5"><UserAvatar user={item.author} size="xs" clickable={false} /><p><strong className="mr-1.5">{item.author?.displayName || "Viewer"}</strong><span className="text-white/70">{item.text}</span></p></div>) : <div className="grid min-h-48 place-items-center text-center"><div><Sparkles className="mx-auto h-7 w-7 text-white/20" /><p className="mt-3 text-sm font-bold text-white/45">Be the first to comment</p></div></div>}
          </div>
          <div className="border-t border-white/10 p-3 pb-[max(.75rem,env(safe-area-inset-bottom))]"><div className="flex gap-2"><Input value={comment} onChange={(event) => setComment(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void send(); }} placeholder="Add a comment" className="h-11 rounded-full border-white/10 bg-white/5 px-4 text-white" /><Button size="icon" onClick={() => void send()} disabled={!comment.trim()} className="h-11 w-11 rounded-full"><MessageCircle className="h-4 w-4" /></Button></div></div>
        </aside>
      </div>
    </main>
  );
}

function StatePage({ icon: Icon, title, text, spinning, action = "/live", actionLabel = "Browse live streams" }: { icon: typeof Radio; title: string; text: string; spinning?: boolean; action?: string; actionLabel?: string }) {
  return <main className="flux-live-stage grid min-h-[calc(100dvh-53px)] place-items-center p-6 text-center text-white"><div className="max-w-md"><span className="mx-auto grid h-16 w-16 place-items-center rounded-3xl bg-white/8"><Icon className={cn("h-8 w-8 text-white/45", spinning && "animate-spin")} /></span><h1 className="mt-5 text-3xl font-black tracking-tight">{title}</h1><p className="mt-3 text-sm leading-6 text-white/45">{text}</p><Link href={action} className="mt-6 inline-flex h-12 items-center rounded-full bg-white px-6 text-sm font-black text-black">{actionLabel}</Link></div></main>;
}
