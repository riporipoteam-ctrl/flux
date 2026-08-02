"use client";

import Link from "next/link";
import {
  ArrowRight,
  Bot,
  Boxes,
  Crown,
  Gamepad2,
  Gift,
  Globe2,
  Headphones,
  Images,
  Radio,
  Shield,
  Sparkles,
  Sticker,
  Users,
  WandSparkles,
  Zap,
} from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { cn } from "@/lib/utils";

const creatorTools = [
  {
    href: "/studio",
    title: "Flux Studio",
    eyebrow: "Games + websites",
    description: "Generate, code, preview and publish interactive browser projects on phones, tablets and desktops.",
    icon: Boxes,
    accent: "from-violet-500 to-indigo-700",
    wide: true,
  },
  {
    href: "/stories/create",
    title: "Story Studio",
    eyebrow: "24-hour canvas",
    description: "Create photo, video and text Stories with draggable stickers and 130 public-domain tracks.",
    icon: Images,
    accent: "from-fuchsia-500 to-rose-600",
  },
  {
    href: "/live/create",
    title: "Go Live",
    eyebrow: "Camera + screen",
    description: "Broadcast your camera, microphone or screen with screen audio and live analytics.",
    icon: Radio,
    accent: "from-red-500 to-orange-600",
  },
  {
    href: "/studio/music",
    title: "Audio Library",
    eyebrow: "130 CC0 tracks",
    description: "Preview real MP3 music and attach it to a Studio project.",
    icon: Headphones,
    accent: "from-cyan-500 to-blue-700",
  },
  {
    href: "/ask-ai",
    title: "AskAI Create",
    eyebrow: "Prompt to project",
    description: "Create games, websites, agents and your one owned Flux group from a conversation.",
    icon: WandSparkles,
    accent: "from-emerald-500 to-teal-700",
    wide: true,
  },
  {
    href: "/stickers",
    title: "Sticker Lab",
    eyebrow: "Static + animated",
    description: "Basic and Premium creators can publish reusable PNG, WebP and GIF stickers.",
    icon: Sticker,
    accent: "from-amber-400 to-orange-600",
  },
  {
    href: "/gifts",
    title: "Gift Studio",
    eyebrow: "Animated support",
    description: "Send animated Flux gifts to users and creators using Flux Coins.",
    icon: Gift,
    accent: "from-pink-500 to-violet-700",
  },
  {
    href: "/groups",
    title: "Create a Group",
    eyebrow: "Community space",
    description: "Build and manage your Flux community. Each user can own one group.",
    icon: Users,
    accent: "from-sky-500 to-cyan-700",
  },
];

const destinations = [
  { href: "/games", label: "Flux Games", icon: Gamepad2, description: "Play and discover published creator games" },
  { href: "/stories", label: "Stories", icon: Images, description: "Watch active Stories and view analytics" },
  { href: "/live", label: "Live", icon: Radio, description: "Discover broadcasts happening now" },
  { href: "/premium", label: "Premium", icon: Crown, description: "Unlock creator limits, rewards and verification" },
];

export default function CreatePage() {
  const { profile } = useAuth();

  return (
    <main className="min-h-screen bg-[#f3f4f7] pb-24 text-[#101114] dark:bg-black dark:text-white">
      <header className="overflow-hidden border-b border-[var(--v8-line)] bg-[#0a0b0e] text-white dark:border-white/8">
        <div className="relative mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-20">
          <div className="pointer-events-none absolute -left-24 -top-28 h-80 w-80 rounded-full bg-violet-600/28 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-44 right-0 h-96 w-96 rounded-full bg-cyan-500/18 blur-3xl" />
          <div className="relative grid gap-10 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-end">
            <div className="max-w-4xl">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/6 px-3 py-1.5 text-[10px] font-black uppercase tracking-[.16em] text-white/60"><Sparkles className="h-3.5 w-3.5 text-violet-300" />Flux creator launchpad</span>
              <h1 className="mt-6 max-w-4xl text-5xl font-black leading-[.9] tracking-[-.075em] sm:text-7xl lg:text-8xl">Make something people can use.</h1>
              <p className="mt-6 max-w-2xl text-sm leading-7 text-white/48 sm:text-base">Every major creation surface is here. Build a game, launch a website, design a Story, start a Live, publish stickers, create agents or grow a community.</p>
            </div>
            <div className="grid grid-cols-3 gap-2 rounded-[28px] border border-white/10 bg-white/5 p-3 backdrop-blur-xl">
              <Metric value="130" label="Music tracks" />
              <Metric value="250+" label="Studio assets" />
              <Metric value="10" label="Creator tools" />
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-3 py-6 sm:px-6 sm:py-9">
        <section>
          <div className="flex items-end justify-between gap-4 px-1"><div><p className="text-[10px] font-black uppercase tracking-[.16em] text-black/35 dark:text-white/30">Start creating</p><h2 className="mt-2 text-3xl font-black tracking-[-.045em]">Creator tools</h2></div><Link href="/studio" className="hidden items-center gap-2 text-xs font-black text-violet-600 dark:text-violet-300 sm:flex">Open Studio <ArrowRight className="h-4 w-4" /></Link></div>
          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {creatorTools.map((tool) => {
              const Icon = tool.icon;
              return (
                <Link key={tool.href} href={tool.href} className={cn("group relative min-h-[250px] overflow-hidden rounded-[28px] border border-[var(--v8-line)] bg-white p-5 shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-[0_24px_60px_rgba(0,0,0,.12)] dark:border-white/9 dark:bg-[#101114]", tool.wide && "xl:col-span-2")}>
                  <div className={cn("absolute inset-x-0 top-0 h-1 bg-gradient-to-r", tool.accent)} />
                  <div className={cn("grid h-13 w-13 place-items-center rounded-[18px] bg-gradient-to-br text-white shadow-lg", tool.accent)}><Icon className="h-6 w-6" /></div>
                  <p className="mt-7 text-[9px] font-black uppercase tracking-[.16em] text-black/32 dark:text-white/28">{tool.eyebrow}</p>
                  <h3 className="mt-2 text-2xl font-black tracking-[-.045em]">{tool.title}</h3>
                  <p className="mt-3 max-w-xl text-sm leading-6 text-black/48 dark:text-white/42">{tool.description}</p>
                  <span className="absolute bottom-5 right-5 grid h-10 w-10 place-items-center rounded-full border border-black/8 text-black/45 transition group-hover:bg-black group-hover:text-white dark:border-white/10 dark:text-white/45 dark:group-hover:bg-white dark:group-hover:text-black"><ArrowRight className="h-4 w-4" /></span>
                </Link>
              );
            })}
          </div>
        </section>

        <section className="mt-10 grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="rounded-[30px] border border-[var(--v8-line)] bg-white p-5 shadow-sm dark:border-white/9 dark:bg-[#101114] sm:p-7">
            <div className="flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-2xl bg-black text-white dark:bg-white dark:text-black"><Zap className="h-5 w-5" /></span><div><h2 className="text-xl font-black">Explore Flux</h2><p className="text-xs text-muted-foreground">Creation and discovery work together</p></div></div>
            <div className="mt-5 grid gap-2 sm:grid-cols-2">{destinations.map((item) => { const Icon = item.icon; return <Link key={item.href} href={item.href} className="flex items-center gap-3 rounded-2xl border border-[var(--v8-line)] p-3 transition hover:bg-black/[.025] dark:border-white/8 dark:hover:bg-white/[.035]"><span className="grid h-11 w-11 place-items-center rounded-xl bg-black/[.045] dark:bg-white/6"><Icon className="h-5 w-5" /></span><span className="min-w-0 flex-1"><strong className="block text-sm">{item.label}</strong><span className="mt-1 block text-[10px] leading-4 text-muted-foreground">{item.description}</span></span><ArrowRight className="h-4 w-4 text-muted-foreground" /></Link>; })}</div>
          </div>

          <aside className="rounded-[30px] border border-[var(--v8-line)] bg-[#101216] p-6 text-white shadow-sm dark:border-white/9">
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-violet-500"><Bot className="h-5 w-5" /></span>
            <p className="mt-6 text-[9px] font-black uppercase tracking-[.16em] text-white/32">Your creator access</p>
            <h2 className="mt-2 text-3xl font-black capitalize tracking-[-.045em]">{profile?.planTier || "free"}</h2>
            <p className="mt-3 text-sm leading-6 text-white/42">Use AskAI and Studio with your current limits, or unlock more projects, agents, stickers and rewards.</p>
            <Link href="/premium" className="mt-6 flex h-12 items-center justify-center gap-2 rounded-2xl bg-white text-sm font-black text-black"><Crown className="h-4 w-4" />View creator plans</Link>
            {profile?.isAdmin ? <Link href="/admin" className="mt-2 flex h-11 items-center justify-center gap-2 rounded-2xl border border-white/10 text-xs font-black text-white/65 hover:bg-white/7"><Shield className="h-4 w-4" />Admin command center</Link> : null}
          </aside>
        </section>
      </div>
    </main>
  );
}

function Metric({ value, label }: { value: string; label: string }) {
  return <div className="rounded-2xl bg-black/22 p-3 text-center"><strong className="block text-xl font-black">{value}</strong><span className="mt-1 block text-[8px] font-black uppercase tracking-wider text-white/32">{label}</span></div>;
}
