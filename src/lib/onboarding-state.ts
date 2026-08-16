const ONBOARDING_COMPLETE_PREFIX = "flux-onboarding-complete-v1-";

function key(uid: string): string {
  return `${ONBOARDING_COMPLETE_PREFIX}${uid}`;
}

export function hasStickyOnboardingComplete(uid: string): boolean {
  if (!uid || typeof window === "undefined") return false;
  try {
    return localStorage.getItem(key(uid)) === "1";
  } catch {
    return false;
  }
}

export function markStickyOnboardingComplete(uid: string): void {
  if (!uid || typeof window === "undefined") return;
  try {
    localStorage.setItem(key(uid), "1");
  } catch {
    // Storage can be unavailable in private browsing. The server profile remains
    // the source of truth; this marker is only a downgrade-prevention guard.
  }
}

export function clearStickyOnboardingComplete(uid: string): void {
  if (!uid || typeof window === "undefined") return;
  try {
    localStorage.removeItem(key(uid));
  } catch {
    // Ignore storage failures during sign out.
  }
}
