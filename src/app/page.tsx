"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { LoadingScreen } from "@/components/shared/loading-screen";

export default function RootPage() {
  const { user, profile, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    if (profile && !profile.onboardingComplete) {
      router.replace("/onboarding");
      return;
    }
    router.replace("/home");
  }, [user, profile, loading, router]);

  return <LoadingScreen />;
}
