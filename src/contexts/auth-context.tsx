"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  getAdditionalUserInfo,
  GoogleAuthProvider,
  signOut as firebaseSignOut,
  updateProfile,
  type User,
} from "firebase/auth";
import { auth, isFirebaseConfigured } from "@/lib/firebase";
import {
  clearOnboardingPending,
  markOnboardingPending,
  markStickyOnboardingComplete,
} from "@/lib/onboarding-state";
import { ensureUserDocument, touchUserPresence } from "@/services/users";
import type { UserProfile } from "@/types";

interface AuthContextValue {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  refreshProfile: () => Promise<void>;
  updateProfileOptimistic: (patch: Partial<UserProfile>) => void;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, displayName: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);
const googleProvider = new GoogleAuthProvider();
const PROFILE_CACHE_PREFIX = "flux-profile-cache-v1-";

function cacheKey(uid: string): string {
  return `${PROFILE_CACHE_PREFIX}${uid}`;
}

function isCompletedProfile(profile: UserProfile | null): boolean {
  return Boolean(profile && (profile.onboardingComplete || String(profile.username || "").trim()));
}

function readCachedProfile(uid: string): UserProfile | null {
  if (typeof window === "undefined") return null;
  try {
    const parsed = JSON.parse(localStorage.getItem(cacheKey(uid)) || "null") as UserProfile | null;
    return parsed?.uid === uid ? parsed : null;
  } catch {
    return null;
  }
}

function writeCachedProfile(profile: UserProfile | null): void {
  if (typeof window === "undefined" || !profile) return;
  try {
    localStorage.setItem(cacheKey(profile.uid), JSON.stringify(profile));
  } catch {
    // Private browsing and full storage should not break authentication.
  }
  // Completion is monotonic. Once Flux has ever observed this UID as fully
  // onboarded, no stale Firebase/local cache may downgrade it back to setup.
  if (isCompletedProfile(profile)) markStickyOnboardingComplete(profile.uid);
}

async function withTimeout<T>(promise: Promise<T>, milliseconds: number, message: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error(message)), milliseconds);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const applyProfile = useCallback((next: UserProfile | null) => {
    setProfile(next);
    writeCachedProfile(next);
  }, []);

  const loadProfile = useCallback(async (u: User) => {
    return await withTimeout(
      ensureUserDocument(u.uid, u.email || "", u.displayName, u.photoURL),
      8_000,
      "Profile loading timed out"
    );
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!user) return;
    const fresh = await loadProfile(user);
    applyProfile(fresh);
  }, [applyProfile, loadProfile, user]);

  const updateProfileOptimistic = useCallback((patch: Partial<UserProfile>) => {
    setProfile((current) => {
      if (!current) return current;
      const next = { ...current, ...patch };
      writeCachedProfile(next);
      return next;
    });
  }, []);

  useEffect(() => {
    if (!isFirebaseConfigured) {
      setLoading(false);
      return;
    }

    const unsub = onAuthStateChanged(auth, async (u) => {
      // Rakazo's public workspace may use an invisible anonymous Firebase
      // token for rate-limited AskAI calls. It is not a Flux account and must
      // never create a profile or trigger onboarding.
      if (u?.isAnonymous) {
        setUser(null);
        setProfile(null);
        setLoading(false);
        return;
      }
      setUser(u);
      if (!u) {
        setProfile(null);
        setLoading(false);
        return;
      }

      const cached = readCachedProfile(u.uid);
      const cachedCompleted = isCompletedProfile(cached);

      if (cached) {
        applyProfile(cached);
        if (cachedCompleted) setLoading(false);
      } else {
        setProfile(null);
      }

      try {
        const ensured = await loadProfile(u);
        applyProfile(ensured);
        if (isCompletedProfile(ensured)) clearOnboardingPending(u.uid);
      } catch (error) {
        console.error("Failed to load profile", error);
        if (cachedCompleted && cached) applyProfile(cached);
        else setProfile(null);
      } finally {
        setLoading(false);
      }
    }, (error) => {
      console.error("Firebase auth state failed", error);
      setLoading(false);
    });

    return () => unsub();
  }, [applyProfile, loadProfile]);

  useEffect(() => {
    if (!user) return;
    const touch = () => {
      if (document.visibilityState === "visible") void touchUserPresence(user.uid).catch(() => undefined);
    };
    touch();
    const interval = window.setInterval(touch, 60_000);
    document.addEventListener("visibilitychange", touch);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", touch);
    };
  }, [user]);

  const signIn = useCallback(async (email: string, password: string) => {
    if (!isFirebaseConfigured) throw new Error("Firebase authentication is not configured yet.");
    await signInWithEmailAndPassword(auth, email, password);
  }, []);

  const signUp = useCallback(async (email: string, password: string, displayName: string) => {
    if (!isFirebaseConfigured) throw new Error("Firebase authentication is not configured yet.");
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    // This is the only email flow allowed to opt an account into onboarding.
    // A missing Firestore document on a later sign-in must never recreate this
    // intent for an existing user.
    markOnboardingPending(cred.user.uid);
    await updateProfile(cred.user, { displayName });
    await ensureUserDocument(cred.user.uid, email, displayName, null);
  }, []);

  const signInWithGoogle = useCallback(async () => {
    if (!isFirebaseConfigured) throw new Error("Firebase authentication is not configured yet.");
    const result = await signInWithPopup(auth, googleProvider);
    if (getAdditionalUserInfo(result)?.isNewUser) markOnboardingPending(result.user.uid);
    await ensureUserDocument(result.user.uid, result.user.email || "", result.user.displayName, result.user.photoURL);
  }, []);

  const signOut = useCallback(async () => {
    if (user && typeof window !== "undefined") localStorage.removeItem(cacheKey(user.uid));
    // Deliberately keep the UID-specific completion marker. Signing out does not
    // turn an existing account into a new account on the next sign-in.
    if (!isFirebaseConfigured) {
      setProfile(null);
      setUser(null);
      return;
    }
    await firebaseSignOut(auth);
    setProfile(null);
  }, [user]);

  const value = useMemo(() => ({
    user,
    profile,
    loading,
    refreshProfile,
    updateProfileOptimistic,
    signIn,
    signUp,
    signInWithGoogle,
    signOut,
  }), [user, profile, loading, refreshProfile, updateProfileOptimistic, signIn, signUp, signInWithGoogle, signOut]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
