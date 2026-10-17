"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { LoadingScreen } from "@/components/shared/loading-screen";
import { FluxMark } from "@/components/shared/logo";
import { ArrowUpRight, Heart, MessageCircle, Repeat2 } from "lucide-react";

/**
 * X-style auth layout: clean white split — giant brand mark on the left,
 * form on the right. No gradients, no glows, flat like X's login.
 */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, profile, loading } = useAuth();
  const router = useRouter();

  const onboarded = Boolean(
    profile && (profile.onboardingComplete || String(profile.username || "").trim())
  );

  useEffect(() => {
    if (loading) return;
    if (user && onboarded) router.replace("/home");
    else if (user && profile && !onboarded) router.replace("/onboarding");
  }, [user, profile, onboarded, loading, router]);

  if (loading) return <LoadingScreen />;
  if (user && onboarded) return <LoadingScreen />;

  return (
    <main className="xxauth flux-auth-layout">
      <section className="flux-auth-hero" aria-label="About Flux">
        <div className="flux-auth-hero-grid" aria-hidden="true" />
        <div className="flux-auth-brandline">
          <FluxMark size={38} className="flux-auth-mark" />
          <span className="flux-auth-wordmark">Flux</span>
          <span className="flux-auth-brand-caption">SOCIAL, IN MOTION</span>
        </div>

        <div className="flux-auth-hero-copy">
          <span className="flux-auth-overline"><i /> YOUR WORLD, IN MOTION</span>
          <h2>Find your people.<br /><em>Keep the signal.</em></h2>
          <p>Good conversations, new ideas, and the people who make your corner of the internet feel like yours.</p>
        </div>

        <div className="flux-auth-preview" aria-hidden="true">
          <div className="flux-auth-preview-head">
            <span className="flux-auth-preview-mark"><FluxMark size={18} className="flux-auth-mark" /></span>
            <span><strong>Flux / Social</strong><small>A place for the things you follow</small></span>
            <span className="flux-auth-preview-live"><i /> LIVE</span>
          </div>
          <div className="flux-auth-preview-body">
            <span className="flux-auth-preview-avatar">F</span>
            <span><strong>Make something worth sharing.</strong><small>Find the people who get it.</small></span>
            <ArrowUpRight className="flux-auth-preview-arrow" />
          </div>
          <div className="flux-auth-preview-actions">
            <span><MessageCircle /> Conversations</span>
            <span><Repeat2 /> Communities</span>
            <span><Heart /> Your interests</span>
          </div>
        </div>

        <div className="flux-auth-hero-footer"><span>CONNECT</span><b>·</b><span>CREATE</span><b>·</b><span>KEEP UP</span></div>
      </section>

      <section className="xxauth-form-col flux-auth-panel" aria-label="Sign in to Flux">
        <div className="flux-auth-mobile-brand">
          <FluxMark size={30} className="flux-auth-mark" />
          <span>Flux</span>
        </div>
        <div className="xxauth-form-inner">{children}</div>
        <p className="xxauth-footer">© {new Date().getFullYear()} Flux by Ripo Team <span>Made for your people.</span></p>
      </section>
    </main>
  );
}
