"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { isFluxMobileApp, isCapacitorNative, markFluxMobileApp } from "@/lib/mobile-app";
import { assetUrl } from "@/lib/asset-url";

export function MobileBoot() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const root = document.documentElement;
    const syncVisualViewport = () => {
      const viewport = window.visualViewport;
      const covered = viewport
        ? Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop)
        : 0;
      root.style.setProperty("--flux-visual-bottom", `${Math.round(covered)}px`);
      root.style.setProperty("--flux-visual-height", `${Math.round(viewport?.height || window.innerHeight)}px`);
    };
    syncVisualViewport();
    window.visualViewport?.addEventListener("resize", syncVisualViewport);
    window.visualViewport?.addEventListener("scroll", syncVisualViewport);
    window.addEventListener("orientationchange", syncVisualViewport);

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register(assetUrl("/sw.js"), { updateViaCache: "none" })
        .then((registration) => registration.update())
        .catch(() => undefined);
    }
    if ("caches" in window) {
      void caches.keys().then((keys) => Promise.all(
        keys.filter((key) => key.startsWith("flux-shell-") && key !== "flux-shell-v3").map((key) => caches.delete(key))
      )).catch(() => undefined);
    }

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
