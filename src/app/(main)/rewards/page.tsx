"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  BarChart3,
  CheckCircle2,
  Coins,
  Crown,
  Eye,
  Gift,
  Heart,
  MessageCircle,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/auth-context";
import { activePlan, claimCreatorReward } from "@/services/flux-platform";
import { Reveal, XCard, XHeader, XPage, XSectionTitle, XStat } from "@/components/x/x-ui";
import { formatCount } from "@/lib/utils";

const RULES = [
  { icon: MessageCircle, title: "Publish", text: "Consistent public posts raise the base reward." },
  { icon: Heart, title: "Earn likes", text: "Positive engagement adds coins to the estimate." },
  { icon: Eye, title: "Reach viewers", text: "Post and Story reach feeds into future reward events." },
  { icon: BarChart3, title: "Stay authentic", text: "Spam and automated abuse never qualify." },
];

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

  const multiplier = tier === "premium" ? "2×" : tier === "basic" ? "1.25×" : "1×";

  return (
    <XPage>
      <XHeader
        title="Rewards"
        subtitle={`${formatCount(profile?.coins || 0)} Coins available`}
        icon={Gift}
        hideOnMobile
      />

      <section className="x-hero">
        <p className="mb-3 text-[11px] font-black uppercase tracking-[0.16em] text-[var(--v8-accent)]">Daily claim</p>
        <h1>{formatCount(estimate)} Coins</h1>
        <p>
          {tier === "premium"
            ? "Premium 2× multiplier applied to today's estimate."
            : tier === "basic"
              ? "Basic 1.25× multiplier applied to today's estimate."
              : "Upgrade your plan to raise the multiplier on every claim."}
        </p>
        <div className="x-hero-actions">
          <button type="button" className="x-btn x-btn-lg" onClick={() => void claim()} disabled={claiming || claimed}>
            {claiming ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            ) : claimed ? (
              <CheckCircle2 className="h-4 w-4" />
            ) : (
              <Coins className="h-4 w-4" />
            )}
            {claimed ? "Claimed today" : "Claim reward"}
          </button>
          <Link href="/premium" className="x-btn x-btn-hollow x-btn-lg">
            <Crown className="h-4 w-4" /> Raise multiplier
          </Link>
        </div>
      </section>

      <div className="grid grid-cols-3 gap-3 p-4">
        <XStat icon={MessageCircle} label="Posts" value={formatCount(profile?.postsCount || 0)} />
        <XStat icon={Heart} label="Likes" value={formatCount(profile?.likesCount || 0)} tone="var(--v8-pink)" />
        <XStat icon={TrendingUp} label="Multiplier" value={multiplier} tone="var(--v8-green)" />
      </div>

      <XSectionTitle>Plan multipliers</XSectionTitle>
      <div className="px-4">
        <XCard>
          {([
            ["Free", "1×", "free"],
            ["Basic", "1.25×", "basic"],
            ["Premium", "2×", "premium"],
          ] as const).map(([label, value, id]) => (
            <div
              key={id}
              className="flex items-center justify-between border-b border-[var(--v8-line)] px-4 py-3.5 last:border-b-0"
              style={tier === id ? { background: "var(--v8-accent-soft)" } : undefined}
            >
              <span className="flex items-center gap-2 text-sm font-bold">
                {label}
                {tier === id ? (
                  <em className="not-italic rounded-full bg-[var(--v8-accent)] px-2 py-0.5 text-[10px] font-black text-white">
                    Current
                  </em>
                ) : null}
              </span>
              <span className="text-sm font-black">{value}</span>
            </div>
          ))}
        </XCard>
      </div>

      <XSectionTitle>How the reward is calculated</XSectionTitle>
      <div className="grid grid-cols-2 gap-3 px-4">
        {RULES.map(({ icon: Icon, title, text }, index) => (
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
        <XCard className="flex gap-3 p-4">
          <Sparkles className="h-5 w-5 flex-none text-[var(--v8-green)]" />
          <p className="text-[13px] leading-5 text-[var(--v8-muted)]">
            <b className="text-[var(--v8-text)]">Rewards are an earn system, not a faucet.</b> Daily claiming, plan
            multipliers and moderation limits keep the coin economy stable.
          </p>
        </XCard>
      </div>
    </XPage>
  );
}
