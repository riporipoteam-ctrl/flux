"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  BarChart3,
  ChevronRight,
  Eye,
  ImagePlus,
  Layers3,
  Loader2,
  Music2,
  Play,
  Plus,
  Sparkles,
  Sticker,
  Type,
  Users,
  Wand2,
} from "lucide-react";
import { StoryRail } from "@/components/stories/story-rail";
import { useAuth } from "@/contexts/auth-context";
import { getActiveStories, type StoryGroup } from "@/services/stories";
import { formatCount } from "@/lib/utils";

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

  const myStories = useMemo(() => groups.find((group) => group.authorId === user?.uid)?.stories || [], [groups, user?.uid]);
  const totalViews = myStories.reduce((sum, story) => sum + story.viewsCount, 0);
  const activeCount = groups.reduce((sum, group) => sum + group.stories.length, 0);

  return (
    <main className="min-h-screen bg-[#f5f6f8] pb-24 text-[#111216] dark:bg-black dark:text-white">
      <header className="sticky top-0 z-40 border-b border-black/6 bg-white/90 px-4 py-3 backdrop-blur-xl dark:border-white/10 dark:bg-black/88">
        <div className="mx-auto flex max-w-6xl items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-2xl bg-gradient-to-br from-fuchsia-500 to-orange-400 text-white"><Play className="h-5 w-5 fill-current" /></span>
          <div className="min-w-0 flex-1"><h1 className="font-black tracking-tight">Stories</h1><p className="text-[11px] text-muted-foreground">Create, watch and understand your audience</p></div>
          <Link href="/stories/create" className="inline-flex h-10 items-center gap-2 rounded-full bg-foreground px-4 text-sm font-black text-background"><Plus className="h-4 w-4" />Create Story</Link>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-3 py-4 sm:px-5 sm:py-6">
        <section className="overflow-hidden rounded-[30px] border border-black/6 bg-[#111318] text-white shadow-[0_25px_70px_rgba(0,0,0,.16)] dark:border-white/10">
          <div className="grid min-h-[320px] lg:grid-cols-[1.15fr_.85fr]">
            <div className="flex flex-col justify-center p-6 sm:p-9">
              <span className="grid h-13 w-13 place-items-center rounded-2xl bg-white/10"><Sparkles className="h-6 w-6 text-fuchsia-300" /></span>
              <h2 className="mt-6 max-w-xl text-4xl font-black leading-[.95] tracking-[-.06em] sm:text-5xl">Tell it fast. Make it feel alive.</h2>
              <p className="mt-4 max-w-xl text-sm leading-7 text-white/55">Photos, videos, styled text, draggable stickers and music previews in one mobile-first editor. Stories disappear after 24 hours and unique viewers are counted once.</p>
              <div className="mt-6 flex flex-wrap gap-3"><Link href="/stories/create" className="inline-flex h-12 items-center gap-2 rounded-full bg-white px-6 text-sm font-black text-black"><Wand2 className="h-4 w-4" />Open Story editor</Link><a href="#active-stories" className="inline-flex h-12 items-center gap-2 rounded-full border border-white/14 bg-white/6 px-5 text-sm font-black text-white"><Eye className="h-4 w-4" />Watch stories</a></div>
            </div>
            <div className="relative min-h-[280px] overflow-hidden bg-[radial-gradient(circle_at_30%_30%,rgba(217,70,239,.55),transparent_35%),radial-gradient(circle_at_72%_65%,rgba(251,146,60,.55),transparent_32%),#090a0d]">
              <div className="absolute left-[12%] top-[14%] h-[68%] w-[38%] rotate-[-8deg] rounded-[34px] border border-white/18 bg-white/8 p-3 shadow-2xl backdrop-blur-xl"><div className="h-full rounded-[25px] bg-gradient-to-b from-violet-500 via-fuchsia-500 to-orange-400 p-4"><p className="text-[10px] font-black uppercase tracking-widest text-white/65">Moment</p><p className="mt-10 text-3xl font-black leading-none tracking-tight">Build.<br />Share.<br />Repeat.</p><Sticker className="absolute bottom-9 right-8 h-9 w-9 rotate-12 text-yellow-200" /></div></div>
              <div className="absolute bottom-[10%] right-[9%] h-[58%] w-[34%] rotate-[9deg] rounded-[30px] border border-white/18 bg-black/28 p-3 shadow-2xl backdrop-blur-xl"><div className="flex h-full flex-col justify-between rounded-[22px] bg-white/8 p-4"><Music2 className="h-7 w-7 text-cyan-300" /><div><p className="text-xl font-black">Now playing</p><p className="mt-1 text-xs text-white/45">Flux original loop</p></div></div></div>
            </div>
          </div>
        </section>

        <section className="mt-5 grid grid-cols-3 gap-2 sm:gap-4">
          <StoryStat icon={Layers3} label="Active stories" value={loading ? "—" : formatCount(activeCount)} />
          <StoryStat icon={Eye} label="Your views" value={loading ? "—" : formatCount(totalViews)} />
          <StoryStat icon={Users} label="Your stories" value={loading ? "—" : formatCount(myStories.length)} />
        </section>

        <section id="active-stories" className="mt-7 overflow-hidden rounded-[26px] border border-black/6 bg-white dark:border-white/10 dark:bg-[#101114]">
          <div className="flex items-center gap-3 border-b border-black/6 px-5 py-4 dark:border-white/10"><div><h2 className="text-xl font-black tracking-tight">Active now</h2><p className="mt-1 text-xs text-muted-foreground">Tap a profile to open the full-screen viewer.</p></div>{loading ? <Loader2 className="ml-auto h-4 w-4 animate-spin text-muted-foreground" /> : <span className="ml-auto rounded-full bg-muted px-3 py-1.5 text-[10px] font-black">{groups.length} creators</span>}</div>
          <StoryRail />
        </section>

        <section className="mt-7 grid gap-4 lg:grid-cols-[1.2fr_.8fr]">
          <div className="rounded-[28px] border border-black/6 bg-white p-5 dark:border-white/10 dark:bg-[#101114] sm:p-7"><div className="flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-2xl bg-violet-500/12 text-violet-600 dark:text-violet-300"><Wand2 className="h-5 w-5" /></span><div><h2 className="text-xl font-black">Story toolset</h2><p className="text-xs text-muted-foreground">Everything in one focused editor</p></div></div><div className="mt-6 grid gap-3 sm:grid-cols-2"><Feature icon={ImagePlus} title="Photo and video" text="Upload up to 40 MB with full-screen preview." /><Feature icon={Type} title="Text studio" text="Four type styles, colors and flexible placement." /><Feature icon={Sticker} title="Draggable stickers" text="Emoji and labels with scale and rotation controls." /><Feature icon={Music2} title="Music preview" text="Audition a loop before publishing the Story." /></div></div>
          <div className="rounded-[28px] border border-black/6 bg-white p-5 dark:border-white/10 dark:bg-[#101114] sm:p-7"><span className="grid h-11 w-11 place-items-center rounded-2xl bg-emerald-500/12 text-emerald-600"><BarChart3 className="h-5 w-5" /></span><h2 className="mt-5 text-xl font-black">Viewer analytics</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">Every account can see who viewed its Story. Unique views are stored per viewer, so reopening a Story does not fake the count.</p><div className="mt-5 rounded-2xl bg-muted/60 p-4"><p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Your current total</p><p className="mt-2 text-3xl font-black">{formatCount(totalViews)} views</p></div><Link href="/stories/create" className="mt-5 flex items-center justify-between rounded-2xl border border-border px-4 py-3 text-sm font-black hover:bg-muted">Create another Story<ChevronRight className="h-4 w-4" /></Link></div>
        </section>
      </div>
    </main>
  );
}

function StoryStat({ icon: Icon, label, value }: { icon: typeof Eye; label: string; value: string }) { return <div className="rounded-[20px] border border-black/6 bg-white p-4 dark:border-white/10 dark:bg-[#101114]"><Icon className="h-4 w-4 text-violet-500" /><p className="mt-3 text-2xl font-black tracking-tight">{value}</p><p className="mt-1 text-[9px] font-black uppercase tracking-wider text-muted-foreground">{label}</p></div>; }
function Feature({ icon: Icon, title, text }: { icon: typeof ImagePlus; title: string; text: string }) { return <div className="rounded-2xl border border-border/70 p-4"><Icon className="h-5 w-5 text-violet-500" /><h3 className="mt-4 font-black">{title}</h3><p className="mt-1 text-sm leading-6 text-muted-foreground">{text}</p></div>; }
