"use client";

import { FluxMark, Logo } from "@/components/shared/logo";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { LoadingScreen } from "@/components/shared/loading-screen";
import { safeInternalPath } from "@/lib/routes";

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
    if (user && onboarded) {
      const next = new URLSearchParams(window.location.search).get("next");
      router.replace(safeInternalPath(next) || "/home");
    }
    else if (user && profile && !onboarded) {
      const next = safeInternalPath(
        new URLSearchParams(window.location.search).get("next"),
      );
      router.replace(next ? `/onboarding?next=${encodeURIComponent(next)}` : "/onboarding");
    }
  }, [user, profile, onboarded, loading, router]);

  if (loading) return <LoadingScreen />;
  if (user && onboarded) return <LoadingScreen />;

  return (
    <main className="xxauth flux-auth-layout">
      <section
        className="flux-auth-hero flux-identity-auth"
        aria-label="About Flux"
      >
        <Logo size={44} />
        <div className="flux-auth-identity-art">
          <FluxMark size={240} />
          <h2>
            Stay in the
            <br />
            conversation.
          </h2>
        </div>
        <p className="flux-auth-identity-footer">
          © {new Date().getFullYear()} Ripo Team
        </p>
      </section>

      <section
        className="xxauth-form-col flux-auth-panel"
        aria-label="Sign in to Flux"
      >
        <div className="xxauth-form-inner">{children}</div>
        <p className="xxauth-footer">
          © {new Date().getFullYear()} Flux by Ripo Team{" "}
          <span>Your conversations start here.</span>
        </p>
      </section>
    </main>
  );
}
