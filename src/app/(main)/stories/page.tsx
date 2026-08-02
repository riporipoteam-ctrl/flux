"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  BarChart3,
  ChevronRight,
  Eye,
  ImagePlus,
  Layers3,
  Music2,
  Play,
  Plus,
  Sticker,
  Type,
  Users,
  Wand2,
} from "lucide-react";
import { StoryRail } from "@/components/stories/story-rail";
import { useAuth } from "@/contexts/auth-context";
import { getActiveStories, type StoryGroup } from "@/services/stories";
import { Reveal, XCard, XHeader, XPage, XSectionTitle, XStat } from "@/components/x/x-ui";
import { formatCount } from "@/lib/utils";

const TOOLS = [
  { icon: ImagePlus, title: "Photo and video", text: "Upload up to 40 MB with a full-screen preview." },
  { icon: Type, title: "Text studio", text: "Four type styles, colours and free placement." },
  { icon: Sticker, title: "Draggable stickers", text: "Emoji and labels with scale and rotation." },
  { icon: Music2, title: "Music preview", text: "Audition a loop before you publish." },
];

export default function StoriesPage() {
  const { user } = useAuth();
  const [groups, setGroups] = useState<StoryGroup[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getActiveStories(120)
      .then(setGroups)
      .catch(() => setGroups([]))
      .finally(() => setLoading(false));
  }, []);

  const myStories = useMemo(
    () => groups.find((group) => group.authorId === user?.uid)?.stories || [],
    [groups, user?.uid]
  );
  const totalViews = myStories.reduce((sum, story) => sum + story.viewsCount, 0);
  const activeCount = groups.reduce((sum, group) => sum + group.stories.length, 0);

  return (
    <XPage>
      <XHeader
        title="Stories"
        subtitle={loading ? "Loading…" : `${formatCount(activeCount)} active`}
        icon={Play}
        hideOnMobile
        actions={
          <Link href="/stories/create" className="x-btn x-btn-sm" aria-label="Create story">
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Create</span>
          </Link>
        }
      />

      <section className="x-hero">
        <p className="mb-3 text-[11px] font-black uppercase tracking-[0.16em] text-[var(--v8-accent)]">24 hours only</p>
        <h1>Tell it fast. Make it feel alive.</h1>
        <p>
          Photos, video, styled text, draggable stickers and music in one mobile-first editor. Unique viewers are
          counted once, so reopening never fakes the number.
        </p>
        <div className="x-hero-actions">
          <Link href="/stories/create" className="x-btn">
            <Wand2 className="h-4 w-4" /> Open Story editor
          </Link>
          <a href="#active-stories" className="x-btn x-btn-hollow">
            <Eye className="h-4 w-4" /> Watch stories
          </a>
        </div>
      </section>

      <div className="grid grid-cols-3 gap-3 p-4">
        <XStat icon={Layers3} label="Active now" value={loading ? "—" : formatCount(activeCount)} />
        <XStat icon={Eye} label="Your views" value={loading ? "—" : formatCount(totalViews)} tone="var(--v8-green)" />
        <XStat icon={Users} label="Your stories" value={loading ? "—" : formatCount(myStories.length)} tone="var(--v8-pink)" />
      </div>

      <XSectionTitle meta={loading ? "Loading…" : `${groups.length} creators`}>
        <span id="active-stories">Active now</span>
      </XSectionTitle>

      <div className="border-y border-[var(--v8-line)] py-2">
        <StoryRail />
      </div>

      <XSectionTitle>Story toolset</XSectionTitle>
      <div className="grid grid-cols-2 gap-3 px-4">
        {TOOLS.map(({ icon: Icon, title, text }, index) => (
          <Reveal key={title} delay={index * 0.04}>
            <XCard className="h-full p-4">
              <Icon className="h-5 w-5 text-[var(--v8-accent)]" />
              <h3 className="mt-3 text-sm font-black">{title}</h3>
              <p className="mt-1.5 text-[13px] leading-5 text-[var(--v8-muted)]">{text}</p>
            </XCard>
          </Reveal>
        ))}
      </div>

      <XSectionTitle>Viewer analytics</XSectionTitle>
      <div className="px-4 pb-4">
        <XCard className="p-5">
          <span className="grid h-11 w-11 place-items-center rounded-full bg-[var(--v8-green-soft)] text-[var(--v8-green)]">
            <BarChart3 className="h-5 w-5" />
          </span>
          <h2 className="mt-4 text-lg font-black">Who actually watched</h2>
          <p className="mt-2 text-[13px] leading-6 text-[var(--v8-muted)]">
            Every account can see who viewed its Story. Views are stored per viewer, so a rewatch never inflates
            the count.
          </p>
          <div className="mt-4 rounded-2xl bg-[var(--v8-panel-2)] p-4">
            <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[var(--v8-muted)]">Your total</p>
            <p className="mt-1 text-3xl font-black tracking-[-0.04em]">{formatCount(totalViews)} views</p>
          </div>
          <Link href="/stories/create" className="mt-4 flex items-center justify-between rounded-2xl border border-[var(--v8-line)] px-4 py-3 text-sm font-black transition-colors hover:bg-[var(--v8-panel-2)]">
            Create another Story
            <ChevronRight className="h-4 w-4" />
          </Link>
        </XCard>
      </div>
    </XPage>
  );
}
