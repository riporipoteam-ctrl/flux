"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  BadgeCheck,
  Bot,
  Check,
  Coins,
  Crown,
  ImagePlus,
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
import { Reveal, XCard, XHeader, XPage, XSectionTitle } from "@/components/x/x-ui";
import { formatCount } from "@/lib/utils";

const PLAN_ICONS = { free: Zap, basic: Sparkles, premium: Crown } as const;

const BENEFITS = [
  { icon: Bot, title: "More AskAI", text: "Higher weekly creation, search and assistant limits." },
  { icon: Sticker, title: "Custom stickers", text: "Basic and Premium can publish stickers across Flux." },
  { icon: ImagePlus, title: "Animated identity", text: "Animated avatars and banners on paid plans." },
  { icon: Palette, title: "Creator identity", text: "Premium unlocks badges and reward multipliers." },
];

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
    <XPage>
      <XHeader title="Premium" subtitle="Unlock more of Flux with Coins" icon={Crown} hideOnMobile />

      <section className="x-hero">
        <p className="mb-3 text-[11px] font-black uppercase tracking-[0.16em] text-[var(--v8-accent)]">Flux Premium</p>
        <h1>Make Flux work harder for you.</h1>
        <p>
          Spend Flux Coins — never a card — on higher AskAI limits, creator tools, animated identity and
          bigger reward multipliers.
        </p>

        <div className="mt-6 rounded-2xl border border-[var(--v8-line)] bg-[var(--v8-panel)] p-4">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 flex-none place-items-center rounded-full bg-[var(--v8-accent-soft)] text-[var(--v8-accent)]">
              <Coins className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--v8-muted)]">Your balance</p>
              <p className="text-xl font-black">{formatCount(profile?.coins || 0)} Coins</p>
            </div>
          </div>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-[var(--v8-panel-3)]">
            <div
              className="h-full rounded-full bg-[var(--v8-accent)] transition-[width] duration-500"
              style={{ width: `${percent}%` }}
            />
          </div>
          <div className="mt-2 flex justify-between text-[11px] text-[var(--v8-muted)]">
            <span>
              AskAI {profile?.askAIUsage?.used || 0}/{profile?.askAIUsage?.limit || 20}
            </span>
            <span>{100 - percent}% left this week</span>
          </div>
        </div>
      </section>

      <XSectionTitle>Choose a plan</XSectionTitle>

      <div className="grid gap-3 px-4 pb-2">
        {plans.map((plan, index) => {
          const Icon = PLAN_ICONS[plan.id];
          const active = current === plan.id;
          const featured = plan.id === "premium";

          return (
            <Reveal key={plan.id} delay={index * 0.04}>
              <XCard
                className="relative p-5"
                style={featured ? { borderColor: "var(--v8-accent)", boxShadow: "0 0 0 1px var(--v8-accent-soft)" } : undefined}
              >
                {featured ? (
                  <span className="absolute right-4 top-4 rounded-full bg-[var(--v8-accent)] px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-white">
                    Best access
                  </span>
                ) : null}

                <span className="grid h-12 w-12 place-items-center rounded-full bg-[var(--v8-panel-3)] text-[var(--v8-accent)]">
                  <Icon className="h-6 w-6" />
                </span>
                <h2 className="mt-4 text-2xl font-black tracking-[-0.03em]">{plan.name}</h2>
                <p className="mt-1 flex items-end gap-2">
                  <span className="text-3xl font-black tracking-[-0.04em]">{plan.price ? formatCount(plan.price) : "0"}</span>
                  <span className="pb-1 text-xs text-[var(--v8-muted)]">Coins / 30 days</span>
                </p>

                <ul className="mt-5 space-y-2.5">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex gap-3 text-sm leading-5">
                      <span className="mt-0.5 grid h-5 w-5 flex-none place-items-center rounded-full bg-[var(--v8-green-soft)] text-[var(--v8-green)]">
                        <Check className="h-3 w-3" />
                      </span>
                      <span className="text-[var(--v8-muted)]">{feature}</span>
                    </li>
                  ))}
                </ul>

                <div className="mt-6">
                  {active ? (
                    <button type="button" className="x-btn x-btn-block" disabled style={{ background: "var(--v8-green)" }}>
                      <BadgeCheck className="h-4 w-4" /> Current plan
                    </button>
                  ) : plan.id === "free" ? (
                    <button type="button" className="x-btn x-btn-hollow x-btn-block" disabled>
                      Included for everyone
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="x-btn x-btn-block"
                      onClick={() => void purchase(plan.id)}
                      disabled={buying !== null}
                    >
                      {buying === plan.id ? (
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                      ) : (
                        <Coins className="h-4 w-4" />
                      )}
                      Unlock {plan.name}
                    </button>
                  )}
                </div>
              </XCard>
            </Reveal>
          );
        })}
      </div>

      <XSectionTitle>What you get</XSectionTitle>
      <div className="grid grid-cols-2 gap-3 px-4">
        {BENEFITS.map(({ icon: Icon, title, text }, index) => (
          <Reveal key={title} delay={index * 0.04}>
            <XCard className="h-full p-4">
              <Icon className="h-5 w-5 text-[var(--v8-accent)]" />
              <h3 className="mt-3 text-sm font-black">{title}</h3>
              <p className="mt-1.5 text-[13px] leading-5 text-[var(--v8-muted)]">{text}</p>
            </XCard>
          </Reveal>
        ))}
      </div>

      <div className="p-4">
        <XCard className="flex items-center gap-4 p-5">
          <span className="grid h-12 w-12 flex-none place-items-center rounded-full bg-[var(--v8-accent)] text-white">
            <WandSparkles className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-black">Build in Flux Studio</h2>
            <p className="mt-1 text-[13px] leading-5 text-[var(--v8-muted)]">
              Every plan can try Studio. Paid plans get more generation capacity.
            </p>
          </div>
          <Link href="/studio" className="x-btn x-btn-ink x-btn-sm flex-none">
            Open
          </Link>
        </XCard>
      </div>
    </XPage>
  );
}
