/**
 * Detect installable / native Flux mobile shell (Capacitor or PWA standalone).
 * When true, product mode = full mobile client with Firebase (no Windows PC).
 */

export function isCapacitorNative(): boolean {
  if (typeof window === "undefined") return false;
  // Capacitor injects this
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const c = (window as any).Capacitor;
  return Boolean(c?.isNativePlatform?.() || c?.getPlatform?.() === "ios" || c?.getPlatform?.() === "android");
}

export function isPwaStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const mq = window.matchMedia?.("(display-mode: standalone)")?.matches;
  // iOS Safari home screen
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const iosStandalone = Boolean((navigator as any).standalone);
  return Boolean(mq || iosStandalone);
}

/** True if launched as installed app (APK/IPA shell or Add-to-Home-Screen). */
export function isFluxMobileApp(): boolean {
  if (typeof window === "undefined") return false;
  if (isCapacitorNative() || isPwaStandalone()) return true;
  try {
    const q = new URLSearchParams(window.location.search);
    if (q.get("app") === "1" || q.get("mobile") === "1") return true;
    if (localStorage.getItem("flux-mobile-app") === "1") return true;
  } catch {
    /* ignore */
  }
  return false;
}

export function markFluxMobileApp() {
  try {
    localStorage.setItem("flux-mobile-app", "1");
  } catch {
    /* ignore */
  }
}

export function isPhoneUa(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
}
