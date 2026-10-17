"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { LoadingScreen } from "@/components/shared/loading-screen";
import { ArrowUpRight, MessageCircle, Users, PenLine } from "lucide-react";

/** Shared account entry layout for the Flux platform. */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, profile, loading } = useAuth();
  const router = useRouter();

  const onboarded = Boolean(
    profile &&
      (profile.onboardingComplete || String(profile.username || "").trim()),
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
          <span className="flux-brand-symbol" aria-hidden="true">
            f<span />
          </span>
          <span className="flux-auth-wordmark">flux</span>
          <span className="flux-auth-brand-caption">
            A little more connected.
          </span>
        </div>

        <div className="flux-auth-hero-copy">
          <span className="flux-auth-overline">
            Your people. Your perspective.
          </span>
          <h2>
            Life happens.
            <br />
            <em>Talk about it.</em>
          </h2>
          <p>
            A home for the thoughts, photos, and conversations that bring your
            world a little closer.
          </p>
        </div>

        <div className="flux-auth-feature-list">
          <div>
            <MessageCircle size={20} />
            <span>Find your next conversation.</span>
            <ArrowUpRight size={16} />
          </div>
          <div>
            <Users size={20} />
            <span>A community for your interests.</span>
            <ArrowUpRight size={16} />
          </div>
          <div>
            <PenLine size={20} />
            <span>Make room for your perspective.</span>
            <ArrowUpRight size={16} />
          </div>
        </div>

        <div className="flux-auth-hero-footer">
          <span>© {new Date().getFullYear()} Ripo Team</span>
          <b>·</b>
          <span>Built for connection.</span>
        </div>
      </section>

      <section
        className="xxauth-form-col flux-auth-panel"
        aria-label="Sign in to Flux"
      >
        <div className="flux-auth-mobile-brand">
          <span className="flux-brand-symbol" aria-hidden="true">
            f<span />
          </span>
          <span>Flux</span>
        </div>
        <div className="xxauth-form-inner">{children}</div>
        <p className="xxauth-footer">
          © {new Date().getFullYear()} Flux by Ripo Team{" "}
          <span>Made for your people.</span>
        </p>
      </section>
    </main>
  );
}
