"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { LoadingScreen } from "@/components/shared/loading-screen";
import { Sidebar } from "@/components/layout/sidebar";
import { MobileNav } from "@/components/layout/mobile-nav";
import { RightRail } from "@/components/layout/right-rail";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, profile, loading, refreshProfile, signOut } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const isAskAI = pathname?.startsWith("/ask-ai");
  const isMessages = pathname?.startsWith("/messages");
  const hideRail = isAskAI || isMessages;

  useEffect(() => {
    if (loading) return;
    if (!user) router.replace("/login");
    else if (profile && !profile.onboardingComplete)
      router.replace("/onboarding");
  }, [user, profile, loading, router]);

  // Fast path: only full-block while auth resolves; lighter spinner
  if (loading) {
    return <LoadingScreen label="Loading…" />;
  }
  if (!user) {
    return <LoadingScreen label="Redirecting…" />;
  }
  // Profile still hydrating after auth
  if (!profile) {
    return (
      <div className="grid min-h-screen place-items-center bg-background px-5">
        <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 text-center shadow-xl">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-muted text-xl">F</div>
          <h1 className="mt-4 text-lg font-bold">We couldn&apos;t load your profile</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">Your session is still safe. Retry the connection, or return to sign in if this account changed.</p>
          <button onClick={() => void refreshProfile()} className="mt-5 h-11 w-full rounded-full bg-foreground text-sm font-bold text-background">Try again</button>
          <button onClick={() => void signOut()} className="mt-2 h-10 w-full rounded-full text-sm font-semibold text-muted-foreground hover:bg-muted">Return to sign in</button>
        </div>
      </div>
    );
  }
  if (!profile.onboardingComplete) {
    return <LoadingScreen label="Continuing setup…" />;
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-[1280px]">
      <Sidebar />
      <main
        className={
          isAskAI
            ? "min-w-0 flex-1 bg-background pb-0 lg:border-x lg:border-border"
            : "min-w-0 flex-1 border-x border-border bg-background pb-24 lg:pb-0"
        }
      >
        {children}
      </main>
      {!hideRail ? <RightRail /> : null}
      {!isAskAI ? <MobileNav /> : null}
    </div>
  );
}
