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
import {
  FLUX_PLANS,
  activePlan,
  purchaseFluxPlan,
  usagePercent,
} from "@/services/flux-platform";
import type { FluxPlanTier } from "@/types";
import { XHeader, XPage, XSectionTitle } from "@/components/x/x-ui";
import { formatCount } from "@/lib/utils";

const PLAN_ICONS = { free: Zap, basic: Sparkles, premium: Crown } as const;

const BENEFITS = [
  {
    icon: Bot,
    title: "More AskAI",
    text: "Higher weekly creation, search and assistant limits.",
  },
  {
    icon: Sticker,
    title: "Custom stickers",
    text: "Basic and Premium can publish stickers across Flux.",
  },
  {
    icon: ImagePlus,
    title: "Animated identity",
    text: "Animated avatars and banners on paid plans.",
  },
  {
    icon: Palette,
    title: "Creator identity",
    text: "Premium unlocks badges and reward multipliers.",
  },
];

export default function PremiumPage() {
  const { user, profile, refreshProfile } = useAuth();
  const [buying, setBuying] = useState<FluxPlanTier | null>(null);
  const current = activePlan(profile);
  const percent = usagePercent(profile);
  const plans = useMemo(
    () => [FLUX_PLANS.free, FLUX_PLANS.basic, FLUX_PLANS.premium],
    [],
  );

  const purchase = async (tier: FluxPlanTier) => {
    if (!user || tier === "free") return;
    setBuying(tier);
    try {
      await purchaseFluxPlan(user.uid, tier);
      await refreshProfile?.();
      toast.success(`${FLUX_PLANS[tier].name} unlocked for 30 days`);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not purchase plan",
      );
    } finally {
      setBuying(null);
    }
  };

  return (
    <XPage className="flux-premium-page">
      <XHeader
        title="A little more Flux."
        subtitle="Choose how you create, connect, and express yourself."
      />
      <div className="flux-plan-balance">
        <Coins size={25} />
        <div>
          <span>Your balance</span>
          <strong>
            {formatCount(profile?.coins || 0)} <small>Flux Coins</small>
          </strong>
        </div>
        <div className="flux-plan-usage">
          <span>AskAI this week</span>
          <strong>
            {profile?.askAIUsage?.used || 0} /{" "}
            {profile?.askAIUsage?.limit || 20}
          </strong>
          <progress max="100" value={percent} aria-label="Weekly AskAI usage" />
        </div>
      </div>
      <div className="flux-plan-list">
        {plans.map((plan) => {
          const Icon = PLAN_ICONS[plan.id];
          const active = current === plan.id;
          return (
            <article
              key={plan.id}
              className="flux-plan-row"
              data-featured={plan.id === "premium" || undefined}
            >
              <div className="flux-plan-summary">
                <span className="flux-plan-icon">
                  <Icon size={22} />
                </span>
                <h2>{plan.name}</h2>
                <p>
                  <strong>{formatCount(plan.price)}</strong>
                  <span>Coins / 30 days</span>
                </p>
                {active ? (
                  <span className="flux-plan-current">
                    <BadgeCheck size={14} />
                    Your current plan
                  </span>
                ) : null}
              </div>
              <ul>
                {plan.features.map((feature) => (
                  <li key={feature}>
                    <Check size={15} />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
              <div>
                {active ? (
                  <button type="button" className="x-btn x-btn-hollow" disabled>
                    Current plan
                  </button>
                ) : plan.id === "free" ? (
                  <span className="flux-plan-free">Always included</span>
                ) : (
                  <button
                    type="button"
                    className="x-btn"
                    disabled={buying !== null}
                    onClick={() => void purchase(plan.id)}
                  >
                    {buying === plan.id ? "Unlocking…" : `Unlock ${plan.name}`}
                    <Coins size={14} />
                  </button>
                )}
              </div>
            </article>
          );
        })}
      </div>
      <XSectionTitle>More ways to make it yours</XSectionTitle>
      <div className="flux-plan-benefits">
        {BENEFITS.map(({ icon: Icon, title, text }) => (
          <div key={title}>
            <Icon size={21} />
            <h3>{title}</h3>
            <p>{text}</p>
          </div>
        ))}
      </div>
      <div className="flux-create-access">
        <WandSparkles size={25} />
        <span>
          <strong>Your next project starts in Studio.</strong>
          <small>Every plan can explore Flux creator tools.</small>
        </span>
        <Link href="/studio" className="x-btn x-btn-outline">
          Open Studio
        </Link>
      </div>
    </XPage>
  );
}
