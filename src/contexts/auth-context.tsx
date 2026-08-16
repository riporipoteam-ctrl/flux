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
  GoogleAuthProvider,
  signOut as firebaseSignOut,
  updateProfile,
  type User,
} from "firebase/auth";
import { auth, isFirebaseConfigured } from "@/lib/firebase";
import { ensureUserDocument, getUser, touchUserPresence } from "@/services/users";
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
    const fresh = await withTimeout(getUser(user.uid), 8_000, "Profile refresh timed out");
    if (fresh) applyProfile(fresh);
  }, [applyProfile, user]);

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

    // Do not use a timer that marks auth/profile loading as finished. On a slow
    // reload that used to expose an old unfinished cache entry to the route
    // guards, which could bounce an already-onboarded account back to setup.
    const unsub = onAuthStateChanged(auth, async (u) => {
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
        // A completed cached profile is safe to render immediately. An
        // unfinished cache entry is never trusted for navigation until the
        // server confirms it, because it may simply be stale from onboarding.
        if (cachedCompleted) setLoading(false);
      } else {
        setProfile(null);
      }

      try {
        const ensured = await loadProfile(u);
        applyProfile(ensured);
      } catch (error) {
        console.error("Failed to load profile", error);
        // Keep a last-known-good completed profile during transient Firestore
        // failures. Never surface a stale incomplete profile after loading ends.
        if (cachedCompleted && cached) applyProfile(cached);
        else setProfile(null);
      } finally {
        setLoading(false);
      }
    }, (error) => {
      console.error("Firebase auth state failed", error);
      // An auth-state failure is not evidence that onboarding is required.
      // Show the sign-in path only after Firebase itself reports no user.
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
    await updateProfile(cred.user, { displayName });
    await ensureUserDocument(cred.user.uid, email, displayName, null);
  }, []);

  const signInWithGoogle = useCallback(async () => {
    if (!isFirebaseConfigured) throw new Error("Firebase authentication is not configured yet.");
    const result = await signInWithPopup(auth, googleProvider);
    await ensureUserDocument(result.user.uid, result.user.email || "", result.user.displayName, result.user.photoURL);
  }, []);

  const signOut = useCallback(async () => {
    if (user && typeof window !== "undefined") localStorage.removeItem(cacheKey(user.uid));
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
