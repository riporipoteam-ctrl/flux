"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { LoadingScreen } from "@/components/shared/loading-screen";
import { Sidebar } from "@/components/layout/sidebar";
import { MobileNav } from "@/components/layout/mobile-nav";
import { MobileAppHeader } from "@/components/layout/mobile-app-header";
import { RightRail } from "@/components/layout/right-rail";
import { DesktopTopbar } from "@/components/layout/desktop-topbar";
import { IncomingCallBanner } from "@/components/messages/incoming-call-banner";

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const { user, profile, loading, refreshProfile, signOut } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const isAskAI = pathname?.startsWith("/ask-ai");
  const isMessages = pathname?.startsWith("/messages");
  const isCall = pathname?.startsWith("/messages/call");
  const isGames = pathname?.startsWith("/games");
  const isLive = pathname?.startsWith("/live");
  const isStudio = pathname?.startsWith("/studio");
  const isLiveRoom = pathname?.startsWith("/live/create") || pathname?.startsWith("/live/view");
  const isImmersive = isAskAI || isCall || isLiveRoom;
  const hideRail = isMessages || isGames || isLive;

  useEffect(() => {
    if (loading) return;
    if (!user) router.replace("/login");
    else if (profile && !profile.onboardingComplete) router.replace("/onboarding");
  }, [user, profile, loading, router]);

  if (loading) return <LoadingScreen label="Loading Flux" />;
  if (!user) return <LoadingScreen label="Opening sign in" />;

  if (!profile) {
    return (
      <div className="flux8-auth-fallback grid min-h-[100dvh] place-items-center px-5">
        <div className="w-full max-w-sm rounded-3xl border border-border bg-card p-7 text-center shadow-2xl">
          <h1 className="text-xl font-black">We couldn&apos;t load your profile</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">Your session is safe. Retry the connection, or return to sign in.</p>
          <button onClick={() => void refreshProfile()} className="mt-5 h-11 w-full rounded-xl bg-primary text-sm font-black text-white">Try again</button>
          <button onClick={() => void signOut()} className="mt-2 h-10 w-full rounded-xl text-sm font-semibold text-muted-foreground hover:bg-muted">Return to sign in</button>
        </div>
      </div>
    );
  }

  if (!profile.onboardingComplete) return <LoadingScreen label="Continuing setup" />;

  if (isStudio) {
    return (
      <div className="h-[100dvh] w-full overflow-hidden bg-[#07080c]">
        <IncomingCallBanner />
        {children}
      </div>
    );
  }

  if (isImmersive) {
    return (
      <div className="h-[100dvh] w-full overflow-hidden bg-background">
        <IncomingCallBanner />
        {children}
      </div>
    );
  }

  return (
    <div className="flux8-app-shell min-h-[100dvh] overflow-x-clip">
      <IncomingCallBanner />
      <Sidebar />
      <section className="flux8-workspace min-w-0">
        <DesktopTopbar />
        <MobileAppHeader />
        <div className="flux8-content-grid">
          <main className="flux8-main-column min-w-0 pb-[calc(70px+env(safe-area-inset-bottom))] lg:pb-0">
            {children}
          </main>
          {!hideRail ? <RightRail /> : null}
        </div>
      </section>
      <MobileNav />
    </div>
  );
}
