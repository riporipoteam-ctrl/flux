const ONBOARDING_COMPLETE_PREFIX = "flux-onboarding-complete-v1-";
const ONBOARDING_PENDING_PREFIX = "flux-onboarding-pending-v2-";

function key(uid: string): string {
  return `${ONBOARDING_COMPLETE_PREFIX}${uid}`;
}

function pendingKey(uid: string): string {
  return `${ONBOARDING_PENDING_PREFIX}${uid}`;
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

/**
 * Only an auth flow that explicitly created a new account may set this flag.
 * Existing accounts are deliberately not inferred into onboarding from a
 * missing/stale profile field.
 */
export function markOnboardingPending(uid: string): void {
  if (!uid || typeof window === "undefined") return;
  try {
    localStorage.setItem(pendingKey(uid), "1");
  } catch {
    // Auth remains usable when storage is unavailable.
  }
}

export function hasOnboardingPending(uid: string): boolean {
  if (!uid || typeof window === "undefined") return false;
  try {
    return localStorage.getItem(pendingKey(uid)) === "1";
  } catch {
    return false;
  }
}

export function clearOnboardingPending(uid: string): void {
  if (!uid || typeof window === "undefined") return;
  try {
    localStorage.removeItem(pendingKey(uid));
  } catch {
    // Ignore storage failures during setup completion.
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
