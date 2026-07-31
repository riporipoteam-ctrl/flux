"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  BadgeCheck,
  Bot,
  Check,
  Coins,
  Crown,
  Gauge,
  ImagePlus,
  Loader2,
  Palette,
  Sparkles,
  Sticker,
  WandSparkles,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/auth-context";
import { FLUX_PLANS, activePlan, purchaseFluxPlan, usagePercent } from "@/services/flux-platform";
import type { FluxPlanTier } from "@/types";
import { Button } from "@/components/ui/button";
import { formatCount } from "@/lib/utils";

const PLAN_ICONS = { free: Zap, basic: Sparkles, premium: Crown } as const;

export default function PremiumPage() {
  const { user, profile, refreshProfile } = useAuth();
  const [buying, setBuying] = useState<FluxPlanTier | null>(null);
  const current = activePlan(profile);
  const percent = usagePercent(profile);
  const plans = useMemo(() => [FLUX_PLANS.free, FLUX_PLANS.basic, FLUX_PLANS.premium], []);

  const purchase = async (tier: FluxPlanTier) => {
    if (!user || tier === "free") return;
    setBuying(tier);
    try {
      await purchaseFluxPlan(user.uid, tier);
      await refreshProfile?.();
      toast.success(`${FLUX_PLANS[tier].name} unlocked for 30 days`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not purchase plan");
    } finally {
      setBuying(null);
    }
  };

  return (
    <main className="min-h-screen bg-[#f4f5f8] pb-24 text-[#111216] dark:bg-black dark:text-white">
      <section className="overflow-hidden border-b border-black/6 bg-[#0b0c10] px-4 py-12 text-white dark:border-white/10 sm:py-16">
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-400 text-black"><Crown className="h-6 w-6" /></span>
              <h1 className="mt-6 text-4xl font-black leading-[.94] tracking-[-.065em] sm:text-6xl">Make Flux work harder for you.</h1>
              <p className="mt-5 max-w-2xl text-base leading-7 text-white/58">Use Flux Coins to unlock more AskAI, creator tools, animated identity features and premium rewards. No card checkout is required.</p>
            </div>
            <div className="min-w-[280px] rounded-[26px] border border-white/10 bg-white/6 p-5 backdrop-blur-xl">
              <div className="flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-2xl bg-amber-400/15 text-amber-300"><Coins className="h-5 w-5" /></span><div><p className="text-[10px] font-black uppercase tracking-[.14em] text-white/35">Your balance</p><p className="mt-1 text-2xl font-black">{formatCount(profile?.coins || 0)} Coins</p></div></div>
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/8"><div className="h-full rounded-full bg-violet-400 transition-all" style={{ width: `${percent}%` }} /></div>
              <div className="mt-2 flex justify-between text-[10px] text-white/38"><span>AskAI {profile?.askAIUsage?.used || 0}/{profile?.askAIUsage?.limit || 20}</span><span>{100 - percent}% left</span></div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-3 py-8 sm:px-5 sm:py-12">
        <div className="grid gap-4 lg:grid-cols-3">
          {plans.map((plan) => {
            const Icon = PLAN_ICONS[plan.id];
            const active = current === plan.id;
            const highlighted = plan.id === "premium";
            return (
              <article key={plan.id} className={`relative overflow-hidden rounded-[28px] border p-5 sm:p-7 ${highlighted ? "border-amber-400/40 bg-[#15120b] text-white shadow-[0_25px_80px_rgba(245,158,11,.16)]" : "border-black/7 bg-white dark:border-white/10 dark:bg-[#101114]"}`}>
                {highlighted ? <div className="absolute right-0 top-0 rounded-bl-2xl bg-amber-400 px-4 py-2 text-[9px] font-black uppercase tracking-[.14em] text-black">Best access</div> : null}
                <span className={`grid h-12 w-12 place-items-center rounded-2xl ${highlighted ? "bg-amber-400 text-black" : "bg-black/[.055] text-violet-600 dark:bg-white/8 dark:text-violet-300"}`}><Icon className="h-6 w-6" /></span>
                <h2 className="mt-5 text-2xl font-black tracking-[-.04em]">{plan.name}</h2>
                <div className="mt-2 flex items-end gap-2"><p className="text-3xl font-black">{plan.price ? formatCount(plan.price) : "0"}</p><p className={`pb-1 text-xs ${highlighted ? "text-white/45" : "text-muted-foreground"}`}>Flux Coins / 30 days</p></div>
                <ul className="mt-6 space-y-3">{plan.features.map((feature) => <li key={feature} className="flex gap-3 text-sm leading-5"><span className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full ${highlighted ? "bg-amber-400 text-black" : "bg-emerald-500/12 text-emerald-600"}`}><Check className="h-3 w-3" /></span><span className={highlighted ? "text-white/66" : "text-muted-foreground"}>{feature}</span></li>)}</ul>
                <div className="mt-7">
                  {active ? <Button disabled className="h-12 w-full rounded-full bg-emerald-500 text-white"><BadgeCheck className="h-5 w-5" />Current plan</Button> : plan.id === "free" ? <Button variant="outline" disabled className="h-12 w-full rounded-full">Included</Button> : <Button onClick={() => void purchase(plan.id)} disabled={buying !== null} className={`h-12 w-full rounded-full font-black ${highlighted ? "bg-amber-400 text-black hover:bg-amber-300" : ""}`}>{buying === plan.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Coins className="h-4 w-4" />}Unlock {plan.name}</Button>}
                </div>
              </article>
            );
          })}
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Benefit icon={Bot} title="More AskAI" text="Higher weekly creation, search and assistant limits." />
          <Benefit icon={Sticker} title="Custom stickers" text="Basic and Premium users can create stickers for Flux surfaces." />
          <Benefit icon={ImagePlus} title="Animated identity" text="Use animated profile pictures and banners with paid plans." />
          <Benefit icon={Palette} title="Creator identity" text="Premium unlocks custom profile badges and reward multipliers." />
        </div>

        <div className="mt-8 flex flex-col gap-4 rounded-[28px] border border-black/7 bg-white p-6 dark:border-white/10 dark:bg-[#101114] sm:flex-row sm:items-center"><span className="grid h-13 w-13 place-items-center rounded-2xl bg-violet-500 text-white"><WandSparkles className="h-6 w-6" /></span><div className="min-w-0 flex-1"><h2 className="text-xl font-black tracking-tight">Build games and websites in Flux Studio</h2><p className="mt-1 text-sm text-muted-foreground">Every plan can try Studio. Higher plans get more AskAI generation and agent capacity.</p></div><Link href="/studio" className="inline-flex h-11 items-center justify-center rounded-full bg-foreground px-5 text-sm font-black text-background">Open Studio</Link></div>
      </section>
    </main>
  );
}

function Benefit({ icon: Icon, title, text }: { icon: typeof Gauge; title: string; text: string }) {
  return <div className="rounded-[22px] border border-black/7 bg-white p-5 dark:border-white/10 dark:bg-[#101114]"><Icon className="h-5 w-5 text-violet-500" /><h3 className="mt-4 font-black">{title}</h3><p className="mt-2 text-sm leading-6 text-muted-foreground">{text}</p></div>;
}
