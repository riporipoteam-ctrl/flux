"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { LoadingScreen } from "@/components/shared/loading-screen";

export default function RootPage() {
  const { user, profile, loading } = useAuth();
  const router = useRouter();

  // A username is proof of onboarding; the flag alone is not, and trusting it
  // sent people back through setup whenever a profile read came back thin.
  const onboarded = Boolean(
    profile && (profile.onboardingComplete || String(profile.username || "").trim())
  );

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    if (profile && !onboarded) {
      router.replace("/onboarding");
      return;
    }
    router.replace("/home");
  }, [user, profile, onboarded, loading, router]);

  return <LoadingScreen />;
}
