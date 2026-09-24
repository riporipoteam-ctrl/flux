"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import {
  hasOnboardingPending,
  hasStickyOnboardingComplete,
  markStickyOnboardingComplete,
} from "@/lib/onboarding-state";
import { LoadingScreen } from "@/components/shared/loading-screen";
import { Sidebar } from "@/components/layout/sidebar";
import { MobileNav } from "@/components/layout/mobile-nav";
import { MobileAppHeader } from "@/components/layout/mobile-app-header";
import { RightRail } from "@/components/layout/right-rail";
import { IncomingCallBanner } from "@/components/messages/incoming-call-banner";
import { RouteProgress } from "@/components/layout/route-progress";

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const { user, profile, loading, refreshProfile, signOut } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [stickyResolved, setStickyResolved] = useState(false);
  const [stickyComplete, setStickyComplete] = useState(false);
  const routePath = pathname?.replace(/\/+$/, "") || "/";
  const isPublicLiveViewer = routePath === "/live/view" || routePath.endsWith("/live/view");
  const isAskAI = routePath === "/ask-ai" || routePath.endsWith("/ask-ai");
  const isPublicAskAI = isAskAI;
  const isMessages = pathname?.startsWith("/messages");
  const isCall = pathname?.startsWith("/messages/call");
  const isFluxRec = pathname?.startsWith("/flux-rec");
  const isArcade = pathname?.startsWith("/games/arcade");
  const isLive = pathname?.startsWith("/live");
  const isStudio = pathname?.startsWith("/studio");
  const isLiveRoom = pathname?.startsWith("/live/create") || isPublicLiveViewer;
  const isImmersive = isAskAI || isCall || isLiveRoom || isArcade;
  const hideRail = isMessages || isFluxRec || isLive;
  const profileCompleted = Boolean(profile && (profile.onboardingComplete || String(profile.username || "").trim()));

  useEffect(() => {
    if (!user) {
      setStickyComplete(false);
      setStickyResolved(true);
      return;
    }
    if (profileCompleted) markStickyOnboardingComplete(user.uid);
    setStickyComplete(profileCompleted || hasStickyOnboardingComplete(user.uid));
    setStickyResolved(true);
  }, [user, profileCompleted]);

  const needsOnboarding = Boolean(
    stickyResolved &&
    profile &&
    hasOnboardingPending(user?.uid || "") &&
    !stickyComplete &&
    !profile.onboardingComplete &&
    !String(profile.username || "").trim()
  );

  useEffect(() => {
    if (loading || !stickyResolved || isPublicLiveViewer || isPublicAskAI) return;
    if (!user) router.replace("/login");
    else if (needsOnboarding) router.replace("/onboarding");
  }, [user, needsOnboarding, loading, stickyResolved, router, isPublicLiveViewer, isPublicAskAI]);

  if (isPublicLiveViewer) {
    return <div className="h-[100dvh] w-full overflow-hidden bg-black">{children}</div>;
  }

  if (isPublicAskAI) {
    return <div className="h-[100dvh] w-full overflow-auto bg-background">{children}</div>;
  }

  if (loading || !stickyResolved) return <LoadingScreen label="Loading Flux" />;
  if (!user) return <LoadingScreen label="Opening sign in" />;

  if (!profile) {
    return <div className="grid min-h-[100dvh] place-items-center px-5" style={{ background: "var(--xx-bg)" }}><div className="w-full max-w-sm rounded-2xl p-7 text-center" style={{ border: "1px solid var(--xx-line)" }}><h1 className="text-xl font-black">We couldn&apos;t load your profile</h1><p className="mt-2 text-sm leading-6" style={{ color: "var(--xx-gray)" }}>Your session is safe. Retry the connection, or return to sign in.</p><button onClick={() => void refreshProfile()} className="xxbtn xxbtn-blue mt-5 h-11 w-full">Try again</button><button onClick={() => void signOut()} className="mt-2 h-10 w-full rounded-full text-sm font-semibold" style={{ color: "var(--xx-gray)" }}>Return to sign in</button></div></div>;
  }

  if (needsOnboarding) return <LoadingScreen label="Continuing setup" />;

  if (isStudio) return <div className="h-[100dvh] w-full overflow-hidden bg-black"><RouteProgress /><IncomingCallBanner />{children}</div>;
  if (isImmersive) return <div className="h-[100dvh] w-full overflow-auto bg-background"><RouteProgress /><IncomingCallBanner />{children}</div>;

  return (
    <div className="xxshell">
      <RouteProgress />
      <IncomingCallBanner />
      <div className="xxshell-inner">
        <Sidebar />
        <main className="xxmain-col">
          <MobileAppHeader />
          {children}
        </main>
        {!hideRail ? <RightRail /> : null}
      </div>
      <MobileNav />
    </div>
  );
}
