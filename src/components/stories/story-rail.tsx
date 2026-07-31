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

  if (compact) {
    return (
      <section className="border-b border-border bg-background" aria-label="Stories">
        <div className="no-scrollbar flex gap-3 overflow-x-auto px-3 py-3">
          <Link href="/stories/create" className="w-[70px] shrink-0 text-center">
            <span className="relative mx-auto block h-16 w-16">
              <UserAvatar user={profile} size="lg" clickable={false} className="h-16 w-16" />
              <span className="absolute -bottom-1 -right-1 grid h-7 w-7 place-items-center rounded-full border-[3px] border-background bg-primary text-white"><Plus className="h-3.5 w-3.5" strokeWidth={3} /></span>
            </span>
            <span className="mt-2 block truncate text-[11px] font-bold">Add Story</span>
          </Link>
          {orderedGroups.map((group, index) => {
            const lead = group.stories[group.stories.length - 1];
            return (
              <button key={group.authorId} type="button" onClick={() => setViewerIndex(index)} className="w-[70px] shrink-0 text-center">
                <span className="story-ring mx-auto block h-[66px] w-[66px]"><span className="relative block h-full w-full overflow-hidden rounded-full border-[3px] border-background bg-muted"><CompactPreview story={lead} group={group} /></span></span>
                <span className="mt-2 block truncate text-[11px] font-bold">{group.authorId === profile?.uid ? "Your Story" : group.author?.displayName || "Story"}</span>
              </button>
            );
          })}
        </div>
        {viewerIndex !== null && orderedGroups[viewerIndex] ? <StoryViewer groups={orderedGroups} initialGroup={viewerIndex} onClose={() => setViewerIndex(null)} /> : null}
      </section>
    );
  }

  return (
    <section className="border-b border-border bg-background py-3" aria-label="Stories">
      <div className="flex items-center justify-between px-3 pb-3 sm:px-4">
        <div>
          <h2 className="text-[15px] font-extrabold tracking-[-.02em]">Stories</h2>
          <p className="text-[11px] text-muted-foreground">Updates that disappear after 24 hours</p>
        </div>
        <Link href="/stories" className="flex items-center gap-1 px-2 py-2 text-xs font-bold text-primary">See all<ChevronRight className="h-3.5 w-3.5" /></Link>
      </div>

      <div className="no-scrollbar flex gap-2 overflow-x-auto px-3 sm:gap-3 sm:px-4">
        <Link href="/stories/create" className="relative h-[184px] w-[112px] shrink-0 overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition active:scale-[.98] sm:h-[198px] sm:w-[122px]">
          <div className="relative h-[126px] overflow-hidden bg-muted sm:h-[138px]">
            <UserAvatar user={profile} size="xl" clickable={false} className="h-full w-full rounded-none object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/18 to-transparent" />
          </div>
          <span className="absolute left-1/2 top-[109px] grid h-9 w-9 -translate-x-1/2 place-items-center rounded-full border-4 border-card bg-primary text-white sm:top-[121px]"><Plus className="h-4 w-4" strokeWidth={3} /></span>
          <span className="absolute inset-x-2 bottom-3 text-center text-[11px] font-extrabold leading-tight">Create Story</span>
        </Link>

        {loading ? Array.from({ length: 5 }).map((_, index) => <div key={index} className="skeleton h-[184px] w-[112px] shrink-0 rounded-2xl sm:h-[198px] sm:w-[122px]" />) : null}

        {!loading && error ? (
          <button type="button" onClick={() => { setLoading(true); void load(); }} className="flex h-[184px] w-[190px] shrink-0 flex-col items-center justify-center rounded-2xl border border-dashed border-border px-4 text-center sm:h-[198px]">
            <span className="grid h-10 w-10 place-items-center rounded-full bg-red-500/10 text-red-500"><AlertCircle className="h-5 w-5" /></span>
            <strong className="mt-3 text-xs">{error}</strong><span className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground"><RefreshCw className="h-3 w-3" />Retry</span>
          </button>
        ) : null}

        {!loading && !error && orderedGroups.map((group, index) => {
          const lead = group.stories[group.stories.length - 1];
          return (
            <button key={group.authorId} type="button" onClick={() => setViewerIndex(index)} className="group relative h-[184px] w-[112px] shrink-0 overflow-hidden rounded-2xl bg-[#111] text-left shadow-sm ring-1 ring-black/5 transition active:scale-[.98] dark:ring-white/10 sm:h-[198px] sm:w-[122px]">
              <CardPreview story={lead} group={group} />
              <span className="absolute left-2 top-2 rounded-full bg-primary p-[2px] shadow-md"><span className="block rounded-full border-2 border-[#111]"><UserAvatar user={group.author} size="sm" clickable={false} className="h-8 w-8" /></span></span>
              {lead.mediaType === "video" ? <span className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full bg-black/55 text-white backdrop-blur"><Video className="h-3.5 w-3.5 fill-white" /></span> : null}
              <span className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/88 via-black/42 to-transparent" />
              <span className="absolute inset-x-2 bottom-3 line-clamp-2 text-[11px] font-extrabold leading-[1.15] text-white drop-shadow">{group.authorId === profile?.uid ? "Your Story" : group.author?.displayName || "Flux Story"}</span>
            </button>
          );
        })}

        {!loading && !error && !orderedGroups.length ? (
          <Link href="/stories/create" className="flex h-[184px] w-[190px] shrink-0 flex-col items-center justify-center rounded-2xl border border-dashed border-border px-4 text-center sm:h-[198px]"><span className="grid h-10 w-10 place-items-center rounded-full bg-primary/10 text-primary"><Plus className="h-5 w-5" /></span><strong className="mt-3 text-xs">No Stories yet</strong><span className="mt-1 text-[11px] text-muted-foreground">Share the first one</span></Link>
        ) : null}
      </div>

      {viewerIndex !== null && orderedGroups[viewerIndex] ? <StoryViewer groups={orderedGroups} initialGroup={viewerIndex} onClose={() => setViewerIndex(null)} /> : null}
    </section>
  );
}

function CardPreview({ story, group }: { story: FluxStory; group: StoryGroup }) {
  if (isTextOnlyStory(story)) {
    return <span className={cn("absolute inset-0 flex items-center justify-center p-4 text-center", storyDesignClass(story.designId))}><span className="line-clamp-6 text-base font-black leading-tight text-white drop-shadow-md">{story.text || story.stickers[0]?.value || "Story"}</span></span>;
  }
  if (story.mediaType === "image") return <img src={assetUrl(story.mediaUrl)} alt="" className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]" />;
  return <><UserAvatar user={group.author} size="xl" clickable={false} className="h-full w-full rounded-none object-cover" /><span className="absolute inset-0 bg-gradient-to-br from-black/5 to-black/35" /></>;
}

function CompactPreview({ story, group }: { story: FluxStory; group: StoryGroup }) {
  if (isTextOnlyStory(story)) return <span className={cn("grid h-full w-full place-items-center p-1 text-center", storyDesignClass(story.designId))}><span className="line-clamp-3 text-[8px] font-black leading-none text-white">{story.text || story.stickers[0]?.value || "Story"}</span></span>;
  if (story.mediaType === "image") return <img src={assetUrl(story.mediaUrl)} alt="" className="h-full w-full object-cover" />;
  return <UserAvatar user={group.author} size="lg" clickable={false} className="h-full w-full" />;
}

function storyDesignClass(id: string | null): string {
  if (id === "sunset") return "bg-gradient-to-br from-orange-400 via-rose-500 to-violet-800";
  if (id === "night") return "bg-gradient-to-br from-slate-800 via-violet-950 to-black";
  if (id === "mint") return "bg-gradient-to-br from-emerald-200 via-teal-600 to-cyan-950";
  if (id === "gold") return "bg-gradient-to-br from-amber-200 via-orange-500 to-red-900";
  if (id === "mono") return "bg-gradient-to-br from-zinc-100 via-zinc-500 to-zinc-950";
  return "bg-gradient-to-br from-cyan-300 via-blue-600 to-indigo-950";
}
