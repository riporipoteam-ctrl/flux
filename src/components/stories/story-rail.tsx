"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertCircle, ChevronRight, Plus, RefreshCw, Video } from "lucide-react";
import { UserAvatar } from "@/components/shared/user-avatar";
import { useAuth } from "@/contexts/auth-context";
import {
  getActiveStories,
  isTextOnlyStory,
  type FluxStory,
  type StoryGroup,
} from "@/services/stories";
import { StoryViewer } from "@/components/stories/story-viewer";
import { assetUrl } from "@/lib/asset-url";
import { cn } from "@/lib/utils";

export function StoryRail({ compact = false }: { compact?: boolean }) {
  const { profile } = useAuth();
  const [groups, setGroups] = useState<StoryGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setGroups(await getActiveStories());
    } catch (loadError) {
      console.error("Stories failed to load", loadError);
      setError("Stories could not load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const onUpdate = () => void load();
    const onVisible = () => {
      if (document.visibilityState === "visible") void load();
    };
    window.addEventListener("flux-stories-updated", onUpdate);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("flux-stories-updated", onUpdate);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [load]);

  const orderedGroups = useMemo(() => {
    if (!profile?.uid) return groups;
    return [...groups].sort((a, b) => {
      if (a.authorId === profile.uid) return -1;
      if (b.authorId === profile.uid) return 1;
      return 0;
    });
  }, [groups, profile?.uid]);

  return (
    <section className="border-b border-border bg-background" aria-label="Stories">
      {!compact ? (
        <div className="flex items-center justify-between px-4 pt-3">
          <div>
            <h2 className="text-sm font-black tracking-tight">Stories</h2>
            <p className="text-[11px] text-muted-foreground">Photos, videos, and text from the last 24 hours</p>
          </div>
          <Link href="/stories" className="flex items-center gap-1 rounded-full px-3 py-2 text-xs font-bold text-primary hover:bg-primary/8">See all<ChevronRight className="h-3.5 w-3.5" /></Link>
        </div>
      ) : null}

      <div className={cn("no-scrollbar flex overflow-x-auto", compact ? "gap-2.5 px-3 py-3" : "gap-3.5 px-4 pb-4 pt-3")}>
        <Link href="/stories/create" className="group w-[72px] shrink-0 text-center">
          <span className="relative mx-auto block h-[64px] w-[64px]">
            <span className="block h-full w-full rounded-full bg-gradient-to-br from-primary/20 to-violet-500/20 p-[2px]">
              <span className="block h-full w-full rounded-full border-2 border-background bg-muted">
                <UserAvatar user={profile} size="lg" clickable={false} className="h-full w-full" />
              </span>
            </span>
            <span className="absolute -bottom-0.5 -right-0.5 grid h-7 w-7 place-items-center rounded-full border-[3px] border-background bg-primary text-white shadow-sm transition group-active:scale-90">
              <Plus className="h-3.5 w-3.5" strokeWidth={3} />
            </span>
          </span>
          <span className="mt-2 block truncate text-[11px] font-bold">Add Story</span>
        </Link>

        {loading
          ? Array.from({ length: compact ? 4 : 6 }).map((_, index) => (
              <div key={index} className="w-[72px] shrink-0 text-center">
                <div className="skeleton mx-auto h-[64px] w-[64px] rounded-full" />
                <div className="skeleton mx-auto mt-2 h-3 w-12 rounded" />
              </div>
            ))
          : error ? (
              <button type="button" onClick={() => { setLoading(true); void load(); }} className="flex h-[84px] min-w-[190px] items-center gap-3 rounded-2xl border border-dashed border-border px-4 text-left hover:bg-muted/45">
                <span className="grid h-10 w-10 place-items-center rounded-full bg-red-500/10 text-red-500"><AlertCircle className="h-5 w-5" /></span>
                <span className="min-w-0 flex-1"><strong className="block text-xs">{error}</strong><span className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground"><RefreshCw className="h-3 w-3" />Tap to retry</span></span>
              </button>
            ) : orderedGroups.length ? orderedGroups.map((group, index) => {
              const lead = group.stories[group.stories.length - 1];
              const own = group.authorId === profile?.uid;
              return (
                <button key={group.authorId} type="button" onClick={() => setViewerIndex(index)} className="group w-[72px] shrink-0 text-center">
                  <span className="story-ring mx-auto block h-[66px] w-[66px] transition group-active:scale-95">
                    <span className="relative block h-full w-full overflow-hidden rounded-full border-[3px] border-background bg-muted">
                      <StoryPreview story={lead} author={group} />
                    </span>
                  </span>
                  <span className="mt-2 block truncate text-[11px] font-bold">{own ? "Your Story" : group.author?.displayName || "Story"}</span>
                </button>
              );
            }) : (
              <Link href="/stories/create" className="flex h-[84px] min-w-[210px] items-center gap-3 rounded-2xl bg-muted/45 px-4 text-left hover:bg-muted">
                <span className="grid h-10 w-10 place-items-center rounded-full bg-primary/10 text-primary"><Plus className="h-5 w-5" /></span>
                <span><strong className="block text-xs">No Stories yet</strong><span className="mt-1 block text-[11px] text-muted-foreground">Share the first one</span></span>
              </Link>
            )}
      </div>

      {viewerIndex !== null && orderedGroups[viewerIndex] ? (
        <StoryViewer groups={orderedGroups} initialGroup={viewerIndex} onClose={() => setViewerIndex(null)} />
      ) : null}
    </section>
  );
}

function StoryPreview({ story, author }: { story: FluxStory; author: StoryGroup }) {
  if (isTextOnlyStory(story)) {
    return (
      <span className={cn("grid h-full w-full place-items-center p-1 text-center", storyDesignClass(story.designId))}>
        <span className="line-clamp-3 text-[8px] font-black leading-[1.05] text-white drop-shadow">{story.text || story.stickers[0]?.value || "Story"}</span>
      </span>
    );
  }

  if (story.mediaType === "image") {
    return <img src={assetUrl(story.mediaUrl)} alt="" className="h-full w-full object-cover" />;
  }

  return (
    <>
      <UserAvatar user={author.author} size="lg" clickable={false} className="h-full w-full" />
      <span className="absolute inset-0 grid place-items-center bg-black/20"><Video className="h-4 w-4 fill-white text-white drop-shadow" /></span>
    </>
  );
}

function storyDesignClass(id: string | null): string {
  if (id === "sunset") return "bg-gradient-to-br from-orange-400 via-rose-500 to-violet-800";
  if (id === "night") return "bg-gradient-to-br from-slate-800 via-violet-950 to-black";
  if (id === "mint") return "bg-gradient-to-br from-emerald-200 via-teal-600 to-cyan-950";
  if (id === "gold") return "bg-gradient-to-br from-amber-200 via-orange-500 to-red-900";
  if (id === "mono") return "bg-gradient-to-br from-zinc-100 via-zinc-500 to-zinc-950";
  return "bg-gradient-to-br from-cyan-300 via-blue-600 to-indigo-950";
}
