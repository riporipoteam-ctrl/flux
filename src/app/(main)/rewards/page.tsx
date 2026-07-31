"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { BarChart3, CheckCircle2, Coins, Crown, Eye, Gift, Heart, Loader2, MessageCircle, Sparkles, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/auth-context";
import { activePlan, claimCreatorReward } from "@/services/flux-platform";
import { Button } from "@/components/ui/button";
import { formatCount } from "@/lib/utils";

export default function RewardsPage() {
  const { user, profile, refreshProfile } = useAuth();
  const [claiming, setClaiming] = useState(false);
  const tier = activePlan(profile);
  const today = new Date().toISOString().slice(0, 10);
  const claimed = profile?.lastRewardClaimKey === today;
  const estimate = useMemo(() => {
    const base = 50 + Math.min(500, Number(profile?.postsCount || 0) * 4 + Number(profile?.likesCount || 0));
    return Math.floor(base * (tier === "premium" ? 2 : tier === "basic" ? 1.25 : 1));
  }, [profile?.likesCount, profile?.postsCount, tier]);

  const claim = async () => {
    if (!user) return;
    setClaiming(true);
    try {
      const amount = await claimCreatorReward(user.uid);
      await refreshProfile();
      toast.success(`${amount.toLocaleString()} Flux Coins added`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Reward could not be claimed");
    } finally {
      setClaiming(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#f5f6f8] pb-24 text-[#111216] dark:bg-black dark:text-white">
      <header className="border-b border-black/6 bg-white px-4 py-8 dark:border-white/10 dark:bg-[#0d0e11] sm:py-11">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 sm:flex-row sm:items-end sm:justify-between"><div><span className="grid h-12 w-12 place-items-center rounded-2xl bg-amber-400 text-black"><Gift className="h-6 w-6" /></span><h1 className="mt-5 text-4xl font-black tracking-[-.06em] sm:text-5xl">Flux Rewards</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">Earn coins from healthy creator activity. Your daily reward grows with posts and received likes, while paid plans add a multiplier.</p></div><div className="rounded-2xl border border-black/7 bg-[#f7f7f8] px-5 py-4 dark:border-white/10 dark:bg-white/5"><p className="text-[10px] font-black uppercase tracking-[.13em] text-muted-foreground">Available balance</p><p className="mt-1 flex items-center gap-2 text-2xl font-black"><Coins className="h-5 w-5 text-amber-500" />{formatCount(profile?.coins || 0)}</p></div></div>
      </header>

      <section className="mx-auto max-w-6xl px-3 py-7 sm:px-5 sm:py-10">
        <div className="grid gap-4 lg:grid-cols-[1.2fr_.8fr]">
          <article className="overflow-hidden rounded-[30px] bg-[#111318] p-6 text-white shadow-[0_24px_70px_rgba(0,0,0,.18)] sm:p-8"><div className="flex flex-col gap-7 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-[10px] font-black uppercase tracking-[.16em] text-white/35">Today’s estimated reward</p><p className="mt-3 text-5xl font-black tracking-[-.06em] text-amber-300">{formatCount(estimate)}</p><p className="mt-2 text-sm text-white/45">{tier === "premium" ? "Premium 2× multiplier applied" : tier === "basic" ? "Basic 1.25× multiplier applied" : "Upgrade to increase your multiplier"}</p></div><Button onClick={() => void claim()} disabled={claiming || claimed} className="h-13 rounded-full bg-white px-7 text-base font-black text-black hover:bg-white/90">{claiming ? <Loader2 className="h-5 w-5 animate-spin" /> : claimed ? <CheckCircle2 className="h-5 w-5" /> : <Coins className="h-5 w-5" />}{claimed ? "Claimed today" : "Claim reward"}</Button></div><div className="mt-8 grid grid-cols-3 gap-2"><DarkStat label="Posts" value={profile?.postsCount || 0} icon={MessageCircle} /><DarkStat label="Likes" value={profile?.likesCount || 0} icon={Heart} /><DarkStat label="Plan" value={tier === "premium" ? "2×" : tier === "basic" ? "1.25×" : "1×"} icon={TrendingUp} /></div></article>
          <article className="rounded-[30px] border border-black/7 bg-white p-6 dark:border-white/10 dark:bg-[#101114]"><div className="flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-2xl bg-violet-500/12 text-violet-600 dark:text-violet-300"><Crown className="h-5 w-5" /></span><div><h2 className="font-black">Reward multiplier</h2><p className="text-xs text-muted-foreground">Current plan: {tier}</p></div></div><div className="mt-6 space-y-3"><MultiplierRow label="Free" value="1×" active={tier === "free"} /><MultiplierRow label="Basic" value="1.25×" active={tier === "basic"} /><MultiplierRow label="Premium" value="2×" active={tier === "premium"} /></div><Link href="/premium" className="mt-6 inline-flex h-11 w-full items-center justify-center rounded-full bg-foreground text-sm font-black text-background">View Flux plans</Link></article>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><RewardRule icon={MessageCircle} title="Publish" text="Consistent public posts increase the base reward." /><RewardRule icon={Heart} title="Earn likes" text="Positive engagement adds more coins to the estimate." /><RewardRule icon={Eye} title="Reach viewers" text="Viewer-based reward events are prepared for posts and Stories analytics." /><RewardRule icon={BarChart3} title="Stay authentic" text="Automated abuse and spam do not qualify for creator rewards." /></div>

        <div className="mt-6 rounded-[26px] border border-black/7 bg-white p-6 dark:border-white/10 dark:bg-[#101114]"><div className="flex items-start gap-4"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-emerald-500/12 text-emerald-600"><Sparkles className="h-5 w-5" /></span><div><h2 className="font-black">Rewards are an earn system, not a coin faucet</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">Daily claiming, plan multipliers and moderation limits keep the economy controlled. Future server-side jobs can add verified view and Story milestones without trusting numbers sent by the browser.</p></div></div></div>
      </section>
    </main>
  );
}

function DarkStat({ label, value, icon: Icon }: { label: string; value: number | string; icon: typeof Heart }) { return <div className="rounded-2xl bg-white/6 p-3"><Icon className="h-4 w-4 text-white/35" /><p className="mt-3 text-xl font-black">{typeof value === "number" ? formatCount(value) : value}</p><p className="mt-1 text-[9px] font-black uppercase tracking-wider text-white/30">{label}</p></div>; }
function MultiplierRow({ label, value, active }: { label: string; value: string; active: boolean }) { return <div className={`flex items-center justify-between rounded-2xl border p-3 ${active ? "border-violet-500 bg-violet-500/8" : "border-black/7 dark:border-white/10"}`}><span className="text-sm font-bold">{label}</span><span className="text-sm font-black">{value}</span></div>; }
function RewardRule({ icon: Icon, title, text }: { icon: typeof Heart; title: string; text: string }) { return <div className="rounded-[22px] border border-black/7 bg-white p-5 dark:border-white/10 dark:bg-[#101114]"><Icon className="h-5 w-5 text-violet-500" /><h3 className="mt-4 font-black">{title}</h3><p className="mt-2 text-sm leading-6 text-muted-foreground">{text}</p></div>; }
