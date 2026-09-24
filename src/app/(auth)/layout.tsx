"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { LoadingScreen } from "@/components/shared/loading-screen";
import { FluxMark } from "@/components/shared/logo";

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
    <div className="xxauth">
      {/* Left: giant brand mark, X-style */}
      <div className="xxauth-brand" aria-hidden>
        <FluxMark size={320} className="xxauth-giant-mark" />
      </div>

      {/* Right: form column */}
      <div className="xxauth-form-col">
        <div className="xxauth-form-inner">{children}</div>
        <p className="xxauth-footer">© {new Date().getFullYear()} Flux by Ripo Team</p>
      </div>
    </div>
  );
}
