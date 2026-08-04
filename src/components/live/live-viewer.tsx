"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  ArrowLeft,
  Eye,
  Gift,
  Heart,
  Loader2,
  MessageCircle,
  MoreHorizontal,
  Play,
  Radio,
  RefreshCw,
  Send,
  Share2,
  Signal,
  Sparkles,
  UserPlus,
  Users,
  Volume2,
  WifiOff,
  X,
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
import { cn } from "@/lib/utils";

type FloatingHeart = { id: string; x: number; scale: number; rotate: number };

export default function LiveViewer() {
  const { user } = useAuth();
  const videoRef = useRef<HTMLVideoElement>(null);
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const joinedAtRef = useRef<number | null>(null);
  const connectedRef = useRef(false);
  const commentsEndRef = useRef<HTMLDivElement>(null);
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
  const [chatOpen, setChatOpen] = useState(false);
  const [hearts, setHearts] = useState<FloatingHeart[]>([]);

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
    commentsEndRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [comments.length, chatOpen]);

  useEffect(() => {
    if (!id || !user || stream?.status !== "live" || stream.hostId === user.uid) return;
    joinedAtRef.current = Date.now();
    void joinLiveStream(id, user.uid);
    const heartbeat = window.setInterval(() => void heartbeatLiveViewer(id, user.uid), 20_000);
    const leave = () => {
      const watched = joinedAtRef.current ? Math.max(0, Math.floor((Date.now() - joinedAtRef.current) / 1000)) : 0;
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

        peer.onconnectionstatechange = () => {
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

        peer.oniceconnectionstatechange = () => {
          if (peer.iceConnectionState === "failed") {
            try { peer.restartIce(); } catch { /* retry creates a fresh session */ }
          }
        };

        candidateUnsubscribe = subscribeLiveCandidates(id, user.uid, "host", (candidate) => void queue.add(candidate));
        peerUnsubscribe = subscribeLivePeer(id, user.uid, (data) => {
          const offer = data?.offer;
          if (!offer || cancelled || peer.remoteDescription?.sdp === offer.sdp) return;
          void (async () => {
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

  const spawnHeart = () => {
    const heart: FloatingHeart = {
      id: crypto.randomUUID(),
      x: Math.round(Math.random() * 34 - 17),
      scale: 0.8 + Math.random() * 0.75,
      rotate: Math.round(Math.random() * 28 - 14),
    };
    setHearts((current) => [...current.slice(-10), heart]);
    window.setTimeout(() => setHearts((current) => current.filter((item) => item.id !== heart.id)), 1_900);
  };

  const react = async () => {
    if (!user || !id) return;
    spawnHeart();
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

  const mention = (item: LiveComment) => {
    const username = item.author?.username || item.author?.displayName || "viewer";
    setComment(`@${username} `);
  };

  const latestComments = useMemo(() => comments.slice(-5), [comments]);

  if (!id) return <StatePage icon={AlertTriangle} title="Live link is missing" text="Open a stream from the Flux Live page." />;
  if (!stream) return <StatePage icon={Loader2} title="Loading live" text={status} spinning />;
  if (stream.status === "ended") return <StatePage icon={Radio} title="This live has ended" text={`${stream.uniqueViewers} viewers · ${stream.likesCount} likes · peak ${stream.peakViewers}`} />;
  if (!user) return <StatePage icon={Signal} title="Sign in to watch live" text="Flux uses your signed-in Firebase session to protect the live signaling room." action={`/login?next=${encodeURIComponent(`/live/view?id=${id}`)}`} actionLabel="Sign in and watch" />;
  if (stream.hostId === user.uid) return <StatePage icon={Radio} title="You are hosting this live" text="Use the host studio to control your camera, screen and viewers." action="/live/create" actionLabel="Open host studio" />;

  return (
    <main className="min-h-[100dvh] bg-black text-white">
      <div className="grid min-h-[100dvh] xl:grid-cols-[minmax(0,1fr)_390px]">
        <section className="relative flex h-[100dvh] min-h-[640px] items-center justify-center overflow-hidden bg-black xl:h-[100dvh]">
          <video ref={videoRef} autoPlay playsInline className="absolute inset-0 h-full w-full object-contain xl:relative" onClick={() => needsPlay && void startPlayback()} />
          <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-40 bg-gradient-to-b from-black/85 via-black/25 to-transparent" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-[55%] bg-gradient-to-t from-black/95 via-black/35 to-transparent" />

          <header className="absolute inset-x-0 top-0 z-30 flex items-center gap-2 px-3 pb-4 pt-[max(.75rem,env(safe-area-inset-top))] sm:px-5">
            <Link href="/live" className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-black/45 backdrop-blur-xl"><ArrowLeft className="h-5 w-5" /></Link>
            <UserAvatar user={stream.host} size="sm" clickable={false} />
            <div className="min-w-0"><p className="truncate text-sm font-black drop-shadow">{stream.host?.displayName || "Flux creator"}</p><p className="truncate text-[10px] text-white/65">@{stream.host?.username || "creator"}</p></div>
            <button type="button" className="ml-1 flex h-8 items-center gap-1 rounded-full bg-white px-3 text-[10px] font-black text-black"><UserPlus className="h-3.5 w-3.5" />Follow</button>
            <span className="ml-auto flex items-center gap-1.5 rounded-full bg-red-500 px-2.5 py-1.5 text-[10px] font-black"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />LIVE</span>
            <span className="flex items-center gap-1 rounded-full bg-black/45 px-2.5 py-1.5 text-[10px] font-black backdrop-blur-xl"><Eye className="h-3.5 w-3.5" />{stream.viewersCount}</span>
            <button type="button" className="grid h-9 w-9 place-items-center rounded-full bg-black/45 backdrop-blur-xl" aria-label="More"><MoreHorizontal className="h-5 w-5" /></button>
          </header>

          {needsPlay ? <button onClick={() => void startPlayback()} className="absolute inset-0 z-40 grid place-items-center bg-black/45 backdrop-blur-[2px]"><span className="grid h-20 w-20 place-items-center rounded-full bg-white text-black shadow-2xl"><Play className="ml-1 h-8 w-8 fill-current" /></span><span className="absolute mt-32 rounded-full bg-black/70 px-4 py-2 text-sm font-bold"><Volume2 className="mr-2 inline h-4 w-4" />Tap for live audio</span></button> : null}

          {canRetry ? <div className="absolute inset-0 z-40 grid place-items-center bg-black/75 p-6 backdrop-blur-sm"><div className="max-w-sm text-center"><span className="mx-auto grid h-16 w-16 place-items-center rounded-3xl bg-white/10"><WifiOff className="h-7 w-7 text-white/70" /></span><h2 className="mt-4 text-xl font-black">Live signal interrupted</h2><p className="mt-2 text-sm leading-6 text-white/50">{status}. Flux will create a fresh Firebase signaling session.</p><button onClick={retry} className="mt-5 inline-flex h-12 items-center gap-2 rounded-full bg-white px-6 font-black text-black"><RefreshCw className="h-4 w-4" />Reconnect</button></div></div> : null}

          <div className="absolute bottom-[calc(74px+env(safe-area-inset-bottom))] left-3 right-[82px] z-30 xl:bottom-5 xl:right-4">
            <div className="mb-3 space-y-2 xl:hidden">
              <AnimatePresence initial={false}>{latestComments.map((item) => <motion.button key={item.id} type="button" onClick={() => mention(item)} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex max-w-[94%] items-start gap-2 text-left drop-shadow-[0_2px_4px_rgba(0,0,0,.9)]"><UserAvatar user={item.author} size="xs" clickable={false} /><span className="rounded-2xl bg-black/28 px-2.5 py-1.5 text-[12px] leading-4 backdrop-blur-sm"><strong className="mr-1.5">{item.author?.displayName || "Viewer"}</strong><span className="text-white/90">{item.text}</span></span></motion.button>)}</AnimatePresence>
              {!latestComments.length ? <p className="flex items-center gap-2 text-xs font-bold text-white/65"><Sparkles className="h-4 w-4" />Be the first to comment</p> : null}
            </div>
            <div className="max-w-2xl"><h1 className="line-clamp-2 text-base font-black tracking-tight drop-shadow sm:text-xl">{stream.title}</h1>{stream.description ? <p className="mt-1 line-clamp-2 text-xs leading-5 text-white/70 drop-shadow">{stream.description}</p> : null}<p className="mt-2 text-[10px] font-black uppercase tracking-[.14em] text-white/55">{stream.category} · {connectionState === "connected" ? "Connected" : status}</p></div>
          </div>

          <div className="absolute bottom-[calc(88px+env(safe-area-inset-bottom))] right-3 z-30 flex flex-col items-center gap-4 xl:bottom-5 xl:right-5 xl:flex-row">
            <ActionButton label={String(stream.likesCount)} active={liked} onClick={() => void react()} icon={<Heart className={cn("h-6 w-6", liked && "fill-current")} />} />
            <ActionButton label={String(comments.length)} onClick={() => setChatOpen(true)} icon={<MessageCircle className="h-6 w-6" />} />
            <Link href="/gifts" className="flex flex-col items-center gap-1 text-white"><span className="grid h-12 w-12 place-items-center rounded-full bg-black/45 backdrop-blur-xl"><Gift className="h-6 w-6" /></span><small className="text-[10px] font-black drop-shadow">Gift</small></Link>
            <ActionButton label="Share" onClick={() => void share()} icon={<Share2 className="h-6 w-6" />} />
          </div>

          <AnimatePresence>{hearts.map((heart) => <motion.div key={heart.id} className="pointer-events-none absolute bottom-32 right-8 z-50 text-rose-500" initial={{ opacity: 0, y: 0, x: heart.x, scale: .35, rotate: 0 }} animate={{ opacity: [0, 1, 1, 0], y: -220, x: heart.x * 2, scale: heart.scale, rotate: heart.rotate }} exit={{ opacity: 0 }} transition={{ duration: 1.8, ease: "easeOut" }}><Heart className="h-10 w-10 fill-current drop-shadow-[0_4px_15px_rgba(244,63,94,.55)]" /></motion.div>)}</AnimatePresence>

          <form onSubmit={(event) => { event.preventDefault(); void send(); }} className="absolute inset-x-3 bottom-[max(.65rem,env(safe-area-inset-bottom))] z-30 flex h-12 items-center gap-2 xl:hidden">
            <div className="flex min-w-0 flex-1 items-center rounded-full border border-white/15 bg-black/42 px-4 backdrop-blur-xl"><input value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Add comment…" maxLength={300} className="h-11 min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/55" /><button type="submit" disabled={!comment.trim()} className="grid h-9 w-9 place-items-center text-white disabled:opacity-30"><Send className="h-4 w-4" /></button></div><button type="button" onClick={spawnHeart} className="grid h-12 w-12 place-items-center rounded-full bg-white text-rose-500 shadow-xl" aria-label="Send heart"><Heart className="h-5 w-5 fill-current" /></button>
          </form>
        </section>

        <aside className="hidden min-h-[100dvh] flex-col border-l border-white/10 bg-[#0d0f12] xl:flex">
          <ChatHeader stream={stream} comments={comments} />
          <CommentList comments={comments} onMention={mention} endRef={commentsEndRef} />
          <ChatComposer value={comment} onChange={setComment} onSend={() => void send()} />
        </aside>
      </div>

      <AnimatePresence>{chatOpen ? <motion.div className="fixed inset-0 z-[2147482500] xl:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}><button type="button" aria-label="Close comments" className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setChatOpen(false)} /><motion.section role="dialog" aria-modal="true" aria-label="Live comments" initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", stiffness: 420, damping: 38 }} className="absolute inset-x-0 bottom-0 flex h-[72dvh] flex-col overflow-hidden rounded-t-[28px] bg-[#111318] shadow-2xl"><div className="mx-auto mt-2 h-1 w-10 rounded-full bg-white/20" /><div className="flex items-center border-b border-white/10 px-4 py-3"><div className="text-center"><p className="font-black">Comments</p><p className="text-[10px] text-white/40">{comments.length} messages</p></div><button type="button" onClick={() => setChatOpen(false)} className="ml-auto grid h-10 w-10 place-items-center rounded-full bg-white/8"><X className="h-5 w-5" /></button></div><CommentList comments={comments} onMention={mention} endRef={commentsEndRef} /><ChatComposer value={comment} onChange={setComment} onSend={() => void send()} /></motion.section></motion.div> : null}</AnimatePresence>
    </main>
  );
}

function ActionButton({ label, active, icon, onClick }: { label: string; active?: boolean; icon: React.ReactNode; onClick: () => void }) {
  return <button type="button" onClick={onClick} className={cn("flex flex-col items-center gap-1 text-white", active && "text-rose-400")}><span className={cn("grid h-12 w-12 place-items-center rounded-full backdrop-blur-xl", active ? "bg-rose-500 text-white" : "bg-black/45")}>{icon}</span><small className="max-w-14 truncate text-[10px] font-black drop-shadow">{label}</small></button>;
}

function ChatHeader({ stream, comments }: { stream: FluxLiveStream; comments: LiveComment[] }) {
  return <div className="flex items-center gap-3 border-b border-white/10 p-4"><div><p className="font-black">Live comments</p><p className="mt-0.5 text-[11px] text-white/40">{comments.length} comments · {stream.category}</p></div><span className="ml-auto flex items-center gap-1.5 rounded-full bg-white/6 px-3 py-1.5 text-[11px] font-bold text-white/65"><Users className="h-3.5 w-3.5" />{stream.uniqueViewers} reached</span></div>;
}

function CommentList({ comments, onMention, endRef }: { comments: LiveComment[]; onMention: (item: LiveComment) => void; endRef: React.RefObject<HTMLDivElement | null> }) {
  return <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">{comments.length ? comments.map((item) => <button key={item.id} type="button" onClick={() => onMention(item)} className="flex w-full gap-2.5 text-left text-sm leading-5"><UserAvatar user={item.author} size="xs" clickable={false} /><p><strong className="mr-1.5">{item.author?.displayName || "Viewer"}</strong><span className="text-white/70">{item.text}</span></p></button>) : <div className="grid min-h-48 place-items-center text-center"><div><Sparkles className="mx-auto h-7 w-7 text-white/20" /><p className="mt-3 text-sm font-bold text-white/45">Be the first to comment</p></div></div>}<div ref={endRef} /></div>;
}

function ChatComposer({ value, onChange, onSend }: { value: string; onChange: (value: string) => void; onSend: () => void }) {
  return <form onSubmit={(event) => { event.preventDefault(); onSend(); }} className="border-t border-white/10 p-3 pb-[max(.75rem,env(safe-area-inset-bottom))]"><div className="flex gap-2"><input value={value} onChange={(event) => onChange(event.target.value)} placeholder="Add a comment" maxLength={300} className="h-11 min-w-0 flex-1 rounded-full border border-white/10 bg-white/5 px-4 text-sm text-white outline-none placeholder:text-white/35" /><button type="submit" disabled={!value.trim()} className="grid h-11 w-11 place-items-center rounded-full bg-white text-black disabled:opacity-35"><Send className="h-4 w-4" /></button></div></form>;
}

function StatePage({ icon: Icon, title, text, spinning, action = "/live", actionLabel = "Browse live streams" }: { icon: typeof Radio; title: string; text: string; spinning?: boolean; action?: string; actionLabel?: string }) {
  return <main className="grid min-h-[100dvh] place-items-center bg-[#05070a] p-6 text-center text-white"><div className="max-w-md"><span className="mx-auto grid h-16 w-16 place-items-center rounded-3xl bg-white/8"><Icon className={cn("h-8 w-8 text-white/45", spinning && "animate-spin")} /></span><h1 className="mt-5 text-3xl font-black tracking-tight">{title}</h1><p className="mt-3 text-sm leading-6 text-white/45">{text}</p><Link href={action} className="mt-6 inline-flex h-12 items-center rounded-full bg-white px-6 text-sm font-black text-black">{actionLabel}</Link></div></main>;
}
