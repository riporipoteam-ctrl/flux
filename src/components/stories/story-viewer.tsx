"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, Music2, Pause, Play, Volume2, VolumeX, X } from "lucide-react";
import { UserAvatar } from "@/components/shared/user-avatar";
import { assetUrl } from "@/lib/asset-url";
import { startStoryMusic, STORY_MUSIC } from "@/lib/story-music";
import { markStoryViewed, type StoryGroup } from "@/services/stories";
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
  const [mounted, setMounted] = useState(false);
  const [groupIndex, setGroupIndex] = useState(initialGroup);
  const [storyIndex, setStoryIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const [muted, setMuted] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const group = groups[groupIndex];
  const story = group?.stories[storyIndex];

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!story || !user) return;
    void markStoryViewed(story.id, user.uid);
  }, [story, user]);

  useEffect(() => {
    if (!story?.musicId || muted || paused) return;
    return startStoryMusic(story.musicId);
  }, [story?.musicId, muted, paused]);

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
      const nextGroup = groups[groupIndex - 1];
      setGroupIndex((value) => value - 1);
      setStoryIndex(Math.max(0, nextGroup.stories.length - 1));
      setProgress(0);
    }
  };

  useEffect(() => {
    if (!story || story.mediaType === "video" || paused) return;
    const started = performance.now() - progress * 5000;
    let frame = 0;
    const tick = (now: number) => {
      const next = Math.min(1, (now - started) / 5000);
      setProgress(next);
      if (next >= 1) goNext();
      else frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
    // goNext is intentionally derived from current indexes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [story?.id, story?.mediaType, paused]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || story?.mediaType !== "video") return;
    video.muted = muted;
    if (paused) void video.pause();
    else void video.play().catch(() => undefined);
  }, [muted, paused, story?.id, story?.mediaType]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowRight") goNext();
      if (event.key === "ArrowLeft") goPrevious();
      if (event.key === " ") setPaused((value) => !value);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupIndex, storyIndex]);

  const track = useMemo(() => STORY_MUSIC.find((item) => item.id === story?.musicId), [story?.musicId]);

  if (!mounted || !story || !group) return null;

  return createPortal(
    <div className="fixed inset-0 z-[2147483600] flex bg-black text-white">
      <button type="button" onClick={onClose} className="absolute right-3 top-[max(0.75rem,env(safe-area-inset-top))] z-30 grid h-11 w-11 place-items-center rounded-full bg-black/45 backdrop-blur-md" aria-label="Close Stories">
        <X className="h-5 w-5" />
      </button>

      <div className="relative mx-auto flex h-full w-full max-w-[520px] flex-col overflow-hidden bg-[#111] sm:my-4 sm:h-[calc(100%-2rem)] sm:rounded-2xl">
        <div className="absolute inset-x-0 top-0 z-20 bg-gradient-to-b from-black/75 to-transparent px-3 pb-12 pt-[max(0.7rem,env(safe-area-inset-top))]">
          <div className="flex gap-1">
            {group.stories.map((item, index) => (
              <span key={item.id} className="h-0.5 flex-1 overflow-hidden rounded-full bg-white/35">
                <span
                  className="block h-full bg-white transition-[width] duration-75"
                  style={{ width: `${index < storyIndex ? 100 : index === storyIndex ? progress * 100 : 0}%` }}
                />
              </span>
            ))}
          </div>
          <div className="mt-3 flex items-center gap-2 pr-12">
            <UserAvatar user={group.author} size="sm" clickable={false} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold">{group.author?.displayName || "Flux user"}</p>
              <p className="truncate text-[11px] text-white/70">@{group.author?.username || "user"}</p>
            </div>
            <button type="button" onClick={() => setPaused((value) => !value)} className="grid h-9 w-9 place-items-center rounded-full hover:bg-white/15" aria-label={paused ? "Play" : "Pause"}>
              {paused ? <Play className="h-4 w-4 fill-white" /> : <Pause className="h-4 w-4 fill-white" />}
            </button>
            <button type="button" onClick={() => setMuted((value) => !value)} className="grid h-9 w-9 place-items-center rounded-full hover:bg-white/15" aria-label={muted ? "Unmute" : "Mute"}>
              {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <div className={cn("relative flex flex-1 items-center justify-center overflow-hidden", designClass(story.designId))}>
          {story.mediaType === "video" ? (
            <video
              ref={videoRef}
              src={assetUrl(story.mediaUrl)}
              className="h-full w-full object-contain"
              playsInline
              autoPlay
              muted={muted}
              onTimeUpdate={(event) => {
                const video = event.currentTarget;
                if (video.duration) setProgress(video.currentTime / video.duration);
              }}
              onEnded={goNext}
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={assetUrl(story.mediaUrl)} alt="Story" className="h-full w-full object-contain" />
          )}

          {story.text ? (
            <div className={cn("pointer-events-none absolute inset-x-5 flex", positionClass(story.textPosition))}>
              <p className={cn("max-w-full whitespace-pre-wrap rounded-xl bg-black/25 px-4 py-2 text-center text-2xl leading-tight shadow-lg backdrop-blur-[2px]", textStyleClass(story.textStyle))} style={{ color: story.textColor }}>
                {story.text}
              </p>
            </div>
          ) : null}

          {track ? (
            <div className="absolute bottom-[max(1.5rem,env(safe-area-inset-bottom))] left-4 flex items-center gap-2 rounded-full bg-black/55 px-3 py-2 text-xs font-semibold backdrop-blur-md">
              <Music2 className="h-4 w-4" />
              <span>{track.title}</span>
            </div>
          ) : null}

          <button type="button" onClick={goPrevious} className="absolute inset-y-20 left-0 w-1/3" aria-label="Previous story" />
          <button type="button" onClick={goNext} className="absolute inset-y-20 right-0 w-1/3" aria-label="Next story" />
          <button type="button" onClick={goPrevious} className="absolute left-3 top-1/2 z-20 hidden h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-black/40 sm:grid" aria-label="Previous story"><ChevronLeft className="h-6 w-6" /></button>
          <button type="button" onClick={goNext} className="absolute right-3 top-1/2 z-20 hidden h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-black/40 sm:grid" aria-label="Next story"><ChevronRight className="h-6 w-6" /></button>
        </div>
      </div>
    </div>,
    document.body
  );
}

function designClass(id: string | null): string {
  if (id === "sunset") return "bg-gradient-to-br from-orange-500 via-rose-500 to-violet-700";
  if (id === "ocean") return "bg-gradient-to-br from-cyan-400 via-blue-600 to-indigo-900";
  if (id === "night") return "bg-gradient-to-br from-slate-900 via-violet-950 to-black";
  if (id === "mint") return "bg-gradient-to-br from-emerald-300 via-teal-600 to-cyan-950";
  return "bg-black";
}

function positionClass(position: "top" | "center" | "bottom"): string {
  if (position === "top") return "top-28 justify-center";
  if (position === "bottom") return "bottom-24 justify-center";
  return "top-1/2 -translate-y-1/2 justify-center";
}

function textStyleClass(style: "clean" | "bold" | "serif" | "mono"): string {
  if (style === "bold") return "font-black uppercase tracking-tight";
  if (style === "serif") return "font-serif italic";
  if (style === "mono") return "font-mono text-xl";
  return "font-bold";
}
