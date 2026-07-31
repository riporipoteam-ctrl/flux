"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { UserAvatar } from "@/components/shared/user-avatar";
import { useAuth } from "@/contexts/auth-context";
import { getActiveStories, type StoryGroup } from "@/services/stories";
import { StoryViewer } from "@/components/stories/story-viewer";
import { assetUrl } from "@/lib/asset-url";

export function StoryRail({ compact = false }: { compact?: boolean }) {
  const { profile } = useAuth();
  const [groups, setGroups] = useState<StoryGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      setGroups(await getActiveStories());
    } catch (error) {
      console.error("Stories failed to load", error);
      setGroups([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const onUpdate = () => void load();
    window.addEventListener("flux-stories-updated", onUpdate);
    return () => window.removeEventListener("flux-stories-updated", onUpdate);
  }, [load]);

  return (
    <section className="social-row overflow-hidden" aria-label="Stories">
      <div className="no-scrollbar flex gap-3 overflow-x-auto px-3 py-3 sm:px-4">
        <Link href="/stories/create" className="group w-[76px] shrink-0 text-center">
          <span className="relative mx-auto block h-[62px] w-[62px]">
            <UserAvatar user={profile} size="lg" clickable={false} className="h-[62px] w-[62px]" />
            <span className="absolute -bottom-1 -right-1 grid h-6 w-6 place-items-center rounded-full border-[3px] border-background bg-primary text-white">
              <Plus className="h-3.5 w-3.5" strokeWidth={3} />
            </span>
          </span>
          <span className="mt-2 block truncate text-[11px] font-semibold">Add story</span>
        </Link>

        {loading
          ? Array.from({ length: compact ? 4 : 6 }).map((_, index) => (
              <div key={index} className="w-[76px] shrink-0 text-center">
                <div className="skeleton mx-auto h-[62px] w-[62px] rounded-full" />
                <div className="skeleton mx-auto mt-2 h-3 w-12 rounded" />
              </div>
            ))
          : groups.map((group, index) => {
              const lead = group.stories[0];
              return (
                <button key={group.authorId} type="button" onClick={() => setViewerIndex(index)} className="w-[76px] shrink-0 text-center">
                  <span className="story-ring mx-auto block h-[64px] w-[64px]">
                    <span className="relative block h-full w-full overflow-hidden rounded-full border-[2px] border-background bg-muted">
                      {lead?.mediaType === "image" ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={assetUrl(lead.mediaUrl)} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <UserAvatar user={group.author} size="lg" clickable={false} className="h-full w-full" />
                      )}
                    </span>
                  </span>
                  <span className="mt-2 block truncate text-[11px] font-semibold">{group.author?.displayName || "Story"}</span>
                </button>
              );
            })}
      </div>

      {viewerIndex !== null ? (
        <StoryViewer groups={groups} initialGroup={viewerIndex} onClose={() => setViewerIndex(null)} />
      ) : null}
    </section>
  );
}
