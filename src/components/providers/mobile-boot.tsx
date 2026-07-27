"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  isFluxMobileApp,
  isCapacitorNative,
  markFluxMobileApp,
} from "@/lib/mobile-app";

/**
 * When Flux is installed as APK/IPA/PWA, mark app mode and optionally
 * Keep installed Flux apps on the social home screen.
 */
export function MobileBoot() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // Register PWA SW
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").then((registration) => registration.update()).catch(() => undefined);
    }
    if ("caches" in window) {
      void caches.keys().then((keys) => Promise.all(
        keys.filter((key) => key === "flux-shell-v1").map((key) => caches.delete(key))
      )).catch(() => undefined);
    }

    const appMode = isFluxMobileApp() || isCapacitorNative();
    if (!appMode) return;

    markFluxMobileApp();

    // Capacitor plugins (optional — ignore if not present)
    void (async () => {
      try {
        const { StatusBar, Style } = await import("@capacitor/status-bar");
        await StatusBar.setStyle({ style: Style.Dark });
        await StatusBar.setBackgroundColor({ color: "#0a0a0c" });
      } catch {
        /* web */
      }
      try {
        const { SplashScreen } = await import("@capacitor/splash-screen");
        await SplashScreen.hide();
      } catch {
        /* web */
      }
      try {
        const { App } = await import("@capacitor/app");
        App.addListener("backButton", ({ canGoBack }) => {
          if (canGoBack) window.history.back();
          else App.exitApp();
        });
      } catch {
        /* web */
      }
    })();

    // First open of installed app → land on the social home screen.
    try {
      const seen = sessionStorage.getItem("flux-mobile-booted");
      if (!seen && pathname === "/") {
        sessionStorage.setItem("flux-mobile-booted", "1");
        router.replace("/home?app=1");
      }
    } catch {
      /* ignore */
    }
  }, [pathname, router]);

  return null;
}
