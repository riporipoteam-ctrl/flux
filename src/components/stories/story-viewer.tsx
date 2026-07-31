"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Eye,
  Loader2,
  MessageCircle,
  Music2,
  Pause,
  Play,
  Send,
  Share2,
  Users,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { UserAvatar } from "@/components/shared/user-avatar";
import { assetUrl } from "@/lib/asset-url";
import { profilePath } from "@/lib/routes";
import { startStoryMusic, STORY_MUSIC } from "@/lib/story-music";
import {
  getStoryViewers,
  markStoryViewed,
  type StoryGroup,
  type StoryViewerProfile,
} from "@/services/stories";
import { useAuth } from "@/contexts/auth-context";
import { cn } from "@/lib/utils";

export function StoryViewer({
  groups,
  initialGroup,
  onClose,
}: {
  groups: StoryGroup[];
  initialGroup: number;
  onClose: () => void;
}) {
  const { user } = useAuth();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [groupIndex, setGroupIndex] = useState(initialGroup);
  const [storyIndex, setStoryIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const [muted, setMuted] = useState(false);
  const [mediaFailed, setMediaFailed] = useState(false);
  const [viewerPanelOpen, setViewerPanelOpen] = useState(false);
  const [viewersLoading, setViewersLoading] = useState(false);
  const [viewers, setViewers] = useState<StoryViewerProfile[]>([]);
  const videoRef = useRef<HTMLVideoElement>(null);
  const group = groups[groupIndex];
  const story = group?.stories[storyIndex];
  const isOwner = Boolean(user && story && user.uid === story.authorId);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    setMediaFailed(false);
    setViewerPanelOpen(false);
    setViewers([]);
    if (story && user && user.uid !== story.authorId) {
      void markStoryViewed(story.id, user.uid).catch(() => undefined);
    }
  }, [story, user]);

  useEffect(() => {
    if (!story?.musicId || muted || paused || viewerPanelOpen) return;
    return startStoryMusic(story.musicId);
  }, [story?.musicId, muted, paused, viewerPanelOpen]);

  const goNext = () => {
    if (!group) return onClose();
    if (storyIndex < group.stories.length - 1) {
      setStoryIndex((value) => value + 1);
      setProgress(0);
      return;
    }
    if (groupIndex < groups.length - 1) {
      setGroupIndex((value) => value + 1);
      setStoryIndex(0);
      setProgress(0);
      return;
    }
    onClose();
  };

  const goPrevious = () => {
    if (storyIndex > 0) {
      setStoryIndex((value) => value - 1);
      setProgress(0);
      return;
    }
    if (groupIndex > 0) {
      const previousGroup = groups[groupIndex - 1];
      setGroupIndex((value) => value - 1);
      setStoryIndex(Math.max(0, previousGroup.stories.length - 1));
      setProgress(0);
    }
  };

  useEffect(() => {
    if (!story || story.mediaType === "video" || paused || viewerPanelOpen || mediaFailed) return;
    const started = performance.now() - progress * 6000;
    let frame = 0;
    const tick = (now: number) => {
      const next = Math.min(1, (now - started) / 6000);
      setProgress(next);
      if (next >= 1) goNext();
      else frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
    // goNext intentionally follows the active story indexes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [story?.id, story?.mediaType, paused, viewerPanelOpen, mediaFailed]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || story?.mediaType !== "video") return;
    video.muted = muted;
    if (paused || viewerPanelOpen) void video.pause();
    else void video.play().catch(() => undefined);
  }, [muted, paused, viewerPanelOpen, story?.id, story?.mediaType]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (viewerPanelOpen) setViewerPanelOpen(false);
        else onClose();
      }
      if (viewerPanelOpen) return;
      if (event.key === "ArrowRight") goNext();
      if (event.key === "ArrowLeft") goPrevious();
      if (event.key === " ") {
        event.preventDefault();
        setPaused((value) => !value);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupIndex, storyIndex, viewerPanelOpen]);

  const track = useMemo(
    () => STORY_MUSIC.find((item) => item.id === story?.musicId),
    [story?.musicId]
  );

  const openViewers = async () => {
    if (!story || !isOwner) return;
    setViewerPanelOpen(true);
    setPaused(true);
    setViewersLoading(true);
    try {
      setViewers(await getStoryViewers(story.id));
    } catch {
      toast.error("Could not load Story viewers");
    } finally {
      setViewersLoading(false);
    }
  };

  const shareStory = async () => {
    if (!story) return;
    const base = process.env.NEXT_PUBLIC_BASE_PATH || "";
    const url = `${window.location.origin}${base}/stories/?story=${encodeURIComponent(story.id)}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: `${group.author?.displayName || "Flux"} on Flux`, url });
      } else {
        await navigator.clipboard.writeText(url);
        toast.success("Story link copied");
      }
    } catch (error) {
      if ((error as DOMException)?.name !== "AbortError") toast.error("Could not share Story");
    }
  };

  const sendToMessages = () => {
    if (!story) return;
    onClose();
    router.push(`/messages?story=${encodeURIComponent(story.id)}`);
  };

  if (!mounted || !story || !group) return null;

  return createPortal(
    <div className="fixed inset-0 z-[2147483600] overflow-hidden bg-[#050607] text-white">
      <div className="absolute inset-0 opacity-30 blur-3xl" aria-hidden>
        {story.mediaType === "image" ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={assetUrl(story.mediaUrl)} alt="" className="h-full w-full scale-125 object-cover" />
        ) : null}
      </div>
      <div className="absolute inset-0 bg-black/55" />

      <button
        type="button"
        onClick={onClose}
        className="absolute right-3 top-[max(.75rem,env(safe-area-inset-top))] z-50 grid h-11 w-11 place-items-center rounded-full bg-black/45 backdrop-blur-xl transition hover:bg-black/70"
        aria-label="Close Stories"
      >
        <X className="h-5 w-5" />
      </button>

      <div className="relative mx-auto flex h-full w-full max-w-[540px] flex-col overflow-hidden bg-[#101114] shadow-[0_0_120px_rgba(0,0,0,.65)] sm:my-3 sm:h-[calc(100%-1.5rem)] sm:rounded-[28px]">
        <div className="absolute inset-x-0 top-0 z-40 bg-gradient-to-b from-black/85 via-black/35 to-transparent px-3 pb-16 pt-[max(.75rem,env(safe-area-inset-top))]">
          <div className="flex gap-1.5">
            {group.stories.map((item, index) => (
              <span key={item.id} className="h-[3px] flex-1 overflow-hidden rounded-full bg-white/30">
                <span
                  className="block h-full rounded-full bg-white transition-[width] duration-75"
                  style={{ width: `${index < storyIndex ? 100 : index === storyIndex ? progress * 100 : 0}%` }}
                />
              </span>
            ))}
          </div>

          <div className="mt-3 flex items-center gap-2 pr-12">
            <button
              type="button"
              onClick={() => {
                onClose();
                router.push(profilePath(group.author?.username));
              }}
              className="flex min-w-0 flex-1 items-center gap-2 text-left"
            >
              <UserAvatar user={group.author} size="sm" clickable={false} />
              <span className="min-w-0">
                <span className="block truncate text-sm font-black">{group.author?.displayName || "Flux user"}</span>
                <span className="block truncate text-[11px] text-white/60">{storyTimeLabel(story.createdAt)}</span>
              </span>
            </button>
            <button type="button" onClick={() => void shareStory()} className="story-control" aria-label="Share Story"><Share2 className="h-4 w-4" /></button>
            <button type="button" onClick={() => setPaused((value) => !value)} className="story-control" aria-label={paused ? "Play" : "Pause"}>{paused ? <Play className="h-4 w-4 fill-white" /> : <Pause className="h-4 w-4 fill-white" />}</button>
            <button type="button" onClick={() => setMuted((value) => !value)} className="story-control" aria-label={muted ? "Unmute" : "Mute"}>{muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}</button>
          </div>
        </div>

        <div className={cn("relative flex flex-1 items-center justify-center overflow-hidden", designClass(story.designId))}>
          {story.mediaType === "image" ? (
            <>
              <div className="absolute inset-0 overflow-hidden opacity-55" aria-hidden>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={assetUrl(story.mediaUrl)} alt="" className="h-full w-full scale-110 object-cover blur-2xl" />
              </div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={assetUrl(story.mediaUrl)}
                alt="Story"
                className="relative z-10 max-h-full w-full object-contain"
                onError={() => setMediaFailed(true)}
              />
            </>
          ) : (
            <video
              ref={videoRef}
              src={assetUrl(story.mediaUrl)}
              className="relative z-10 h-full w-full object-contain"
              playsInline
              autoPlay
              muted={muted}
              onLoadedMetadata={() => setMediaFailed(false)}
              onError={() => setMediaFailed(true)}
              onTimeUpdate={(event) => {
                const video = event.currentTarget;
                if (video.duration) setProgress(video.currentTime / video.duration);
              }}
              onEnded={goNext}
            />
          )}

          {mediaFailed ? (
            <div className="absolute inset-0 z-20 grid place-items-center bg-[#111] p-8 text-center">
              <div>
                <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-white/8"><X className="h-6 w-6 text-white/45" /></span>
                <p className="mt-4 font-black">This Story media could not load</p>
                <p className="mt-1 text-xs text-white/40">The upload may have expired or its Storage permissions need updating.</p>
                <button type="button" onClick={goNext} className="mt-4 rounded-full bg-white px-4 py-2 text-xs font-black text-black">Next Story</button>
              </div>
            </div>
          ) : null}

          {story.text ? (
            <div className={cn("pointer-events-none absolute inset-x-5 z-30 flex", positionClass(story.textPosition))}>
              <p className={cn("max-w-full whitespace-pre-wrap rounded-2xl bg-black/30 px-4 py-2.5 text-center text-2xl leading-tight shadow-xl backdrop-blur-[3px]", textStyleClass(story.textStyle))} style={{ color: story.textColor }}>{story.text}</p>
            </div>
          ) : null}

          {story.stickers.map((item) => (
            <span
              key={item.id}
              className="pointer-events-none absolute z-30 -translate-x-1/2 -translate-y-1/2 select-none"
              style={{ left: `${item.x}%`, top: `${item.y}%`, transform: `translate(-50%, -50%) scale(${item.scale}) rotate(${item.rotation}deg)` }}
            >
              {item.kind === "emoji" ? <span className="text-5xl drop-shadow-xl">{item.value}</span> : <span className="rounded-xl bg-white px-3 py-1.5 text-sm font-black tracking-wide text-black shadow-xl">{item.value}</span>}
            </span>
          ))}

          {track ? (
            <div className="absolute bottom-[max(4.5rem,calc(env(safe-area-inset-bottom)+4rem))] left-4 z-30 flex items-center gap-2 rounded-full bg-black/60 px-3 py-2 text-xs font-bold backdrop-blur-xl">
              <Music2 className="h-4 w-4" /><span>{track.title}</span>
            </div>
          ) : null}

          {!viewerPanelOpen ? (
            <>
              <button type="button" onClick={goPrevious} className="absolute inset-y-20 left-0 z-20 w-[34%]" aria-label="Previous Story" />
              <button type="button" onClick={goNext} className="absolute inset-y-20 right-0 z-20 w-[34%]" aria-label="Next Story" />
              <button type="button" onClick={goPrevious} className="absolute left-3 top-1/2 z-40 hidden h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-black/45 backdrop-blur-xl sm:grid" aria-label="Previous Story"><ChevronLeft className="h-6 w-6" /></button>
              <button type="button" onClick={goNext} className="absolute right-3 top-1/2 z-40 hidden h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-black/45 backdrop-blur-xl sm:grid" aria-label="Next Story"><ChevronRight className="h-6 w-6" /></button>
            </>
          ) : null}
        </div>

        <div className="absolute inset-x-0 bottom-0 z-40 flex items-center gap-2 bg-gradient-to-t from-black/85 via-black/55 to-transparent px-3 pb-[max(.8rem,env(safe-area-inset-bottom))] pt-12">
          {isOwner ? (
            <button type="button" onClick={() => void openViewers()} className="flex h-11 min-w-0 flex-1 items-center justify-center gap-2 rounded-full bg-black/50 px-4 text-sm font-black backdrop-blur-xl hover:bg-black/70"><Eye className="h-4 w-4" />{story.viewsCount} viewers<ChevronDown className="h-4 w-4" /></button>
          ) : (
            <button type="button" onClick={sendToMessages} className="flex h-11 min-w-0 flex-1 items-center justify-center gap-2 rounded-full border border-white/30 bg-black/35 px-4 text-sm font-black backdrop-blur-xl hover:bg-black/60"><MessageCircle className="h-4 w-4" />Reply in Messages</button>
          )}
          <button type="button" onClick={sendToMessages} className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white text-black" aria-label="Send Story"><Send className="h-4 w-4" /></button>
        </div>

        {viewerPanelOpen ? (
          <div className="absolute inset-0 z-50 flex items-end bg-black/50 backdrop-blur-[2px]" onClick={() => { setViewerPanelOpen(false); setPaused(false); }}>
            <section className="max-h-[72%] w-full overflow-hidden rounded-t-[28px] bg-[#15171b] shadow-2xl" onClick={(event) => event.stopPropagation()}>
              <div className="flex items-center gap-3 border-b border-white/10 p-4">
                <span className="grid h-11 w-11 place-items-center rounded-2xl bg-blue-500/15 text-blue-300"><Users className="h-5 w-5" /></span>
                <div className="min-w-0 flex-1"><h2 className="font-black">Story viewers</h2><p className="text-xs text-white/40">Only you can see this list</p></div>
                <button type="button" onClick={() => { setViewerPanelOpen(false); setPaused(false); }} className="grid h-10 w-10 place-items-center rounded-full bg-white/7"><X className="h-4 w-4" /></button>
              </div>
              <div className="max-h-[calc(72dvh-76px)] overflow-y-auto p-3 story-safe-bottom">
                {viewersLoading ? <div className="grid min-h-40 place-items-center"><Loader2 className="h-6 w-6 animate-spin text-blue-400" /></div> : viewers.length ? viewers.map((viewer) => (
                  <button key={viewer.uid} type="button" onClick={() => { onClose(); router.push(profilePath(viewer.profile?.username)); }} className="flex w-full items-center gap-3 rounded-2xl p-3 text-left hover:bg-white/6">
                    <UserAvatar user={viewer.profile} size="md" clickable={false} />
                    <span className="min-w-0 flex-1"><span className="block truncate text-sm font-black">{viewer.profile?.displayName || "Flux user"}</span><span className="block truncate text-xs text-white/40">@{viewer.profile?.username || "user"}</span></span>
                    <Eye className="h-4 w-4 text-white/25" />
                  </button>
                )) : <div className="grid min-h-44 place-items-center text-center"><div><Eye className="mx-auto h-7 w-7 text-white/20" /><p className="mt-3 text-sm font-black text-white/55">No viewers yet</p><p className="mt-1 text-xs text-white/30">Share your Story to get it moving.</p></div></div>}
              </div>
            </section>
          </div>
        ) : null}
      </div>
    </div>,
    document.body
  );
}

function designClass(id: string | null): string {
  if (id === "sunset") return "bg-gradient-to-br from-orange-400 via-rose-500 to-violet-800";
  if (id === "ocean") return "bg-gradient-to-br from-cyan-300 via-blue-600 to-indigo-950";
  if (id === "night") return "bg-gradient-to-br from-slate-800 via-violet-950 to-black";
  if (id === "mint") return "bg-gradient-to-br from-emerald-200 via-teal-600 to-cyan-950";
  if (id === "gold") return "bg-gradient-to-br from-amber-200 via-orange-500 to-red-900";
  if (id === "mono") return "bg-gradient-to-br from-zinc-100 via-zinc-500 to-zinc-950";
  return "bg-black";
}

function positionClass(position: "top" | "center" | "bottom"): string {
  if (position === "top") return "top-28 justify-center";
  if (position === "bottom") return "bottom-28 justify-center";
  return "top-1/2 -translate-y-1/2 justify-center";
}

function textStyleClass(style: "clean" | "bold" | "serif" | "mono"): string {
  if (style === "bold") return "font-black uppercase tracking-tight";
  if (style === "serif") return "font-serif italic";
  if (style === "mono") return "font-mono text-xl";
  return "font-bold";
}

function storyTimeLabel(createdAt: { toMillis?: () => number } | null): string {
  const created = createdAt?.toMillis?.() || Date.now();
  const minutes = Math.max(0, Math.floor((Date.now() - created) / 60_000));
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  return hours < 24 ? `${hours}h` : `${Math.floor(hours / 24)}d`;
}
