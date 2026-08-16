"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { isFluxMobileApp, isCapacitorNative, markFluxMobileApp } from "@/lib/mobile-app";
import { assetUrl } from "@/lib/asset-url";

const release = process.env.NEXT_PUBLIC_RELEASE_SHA?.slice(0, 12) || "x2";

export function MobileBoot() {
  const router = useRouter();
  const pathname = usePathname();

  // Register the service worker once for this page lifetime. A new deployment
  // must never force-refresh or take over an already-open Flux session. The
  // browser can activate the new worker naturally after the current tab closes.
  useEffect(() => {
    if ("caches" in window) {
      void caches.keys()
        .then((keys) => Promise.all(
          keys
            .filter((key) => key.startsWith("flux-shell-") && key !== "flux-shell-v4")
            .map((key) => caches.delete(key))
        ))
        .catch(() => undefined);
    }

    if ("serviceWorker" in navigator) {
      void navigator.serviceWorker
        .register(`${assetUrl("/sw.js")}?release=${encodeURIComponent(release)}`, { updateViaCache: "none" })
        .then(() => {
          // Remember which UI bundle this page actually loaded, but do not
          // broadcast an update event and do not call registration.update().
          // Both can cause update churn while a user is in the middle of Flux.
          try {
            localStorage.setItem("flux-active-release", release);
          } catch {
            // Storage may be unavailable in private browsing.
          }
        })
        .catch(() => undefined);
    }
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    const syncVisualViewport = () => {
      const viewport = window.visualViewport;
      const covered = viewport ? Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop) : 0;
      root.style.setProperty("--flux-visual-bottom", `${Math.round(covered)}px`);
      root.style.setProperty("--flux-visual-height", `${Math.round(viewport?.height || window.innerHeight)}px`);
    };
    syncVisualViewport();
    window.visualViewport?.addEventListener("resize", syncVisualViewport);
    window.visualViewport?.addEventListener("scroll", syncVisualViewport);
    window.addEventListener("orientationchange", syncVisualViewport);

    const appMode = isFluxMobileApp() || isCapacitorNative();
    if (appMode) {
      markFluxMobileApp();
      void (async () => {
        try {
          const { StatusBar, Style } = await import("@capacitor/status-bar");
          await StatusBar.setStyle({ style: Style.Dark });
          await StatusBar.setBackgroundColor({ color: "#0a0a0c" });
        } catch { /* web */ }
        try {
          const { SplashScreen } = await import("@capacitor/splash-screen");
          await SplashScreen.hide();
        } catch { /* web */ }
        try {
          const { App } = await import("@capacitor/app");
          App.addListener("backButton", ({ canGoBack }) => {
            if (canGoBack) window.history.back();
            else App.exitApp();
          });
        } catch { /* web */ }
      })();

      try {
        const seen = sessionStorage.getItem("flux-mobile-booted");
        if (!seen && pathname === "/") {
          sessionStorage.setItem("flux-mobile-booted", "1");
          router.replace("/home?app=1");
        }
      } catch { /* ignore */ }
    }

    return () => {
      window.visualViewport?.removeEventListener("resize", syncVisualViewport);
      window.visualViewport?.removeEventListener("scroll", syncVisualViewport);
      window.removeEventListener("orientationchange", syncVisualViewport);
    };
  }, [pathname, router]);

  return null;
}
