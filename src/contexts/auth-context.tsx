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
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, displayName: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);
const googleProvider = new GoogleAuthProvider();

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async (u: User) => {
    const p = await ensureUserDocument(
      u.uid,
      u.email || "",
      u.displayName,
      u.photoURL
    );
    // re-fetch for freshest
    const fresh = await getUser(u.uid);
    setProfile(fresh ?? p);
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!user) return;
    const fresh = await getUser(user.uid);
    setProfile(fresh);
  }, [user]);

  useEffect(() => {
    if (!isFirebaseConfigured) {
      setLoading(false);
      return;
    }

    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        try {
          await loadProfile(u);
        } catch (e) {
          console.error("Failed to load profile", e);
          setProfile(null);
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
    }, (error) => {
      // Do not leave every auth route stuck on the loading screen when a
      // browser has a stale session or Firebase briefly rejects initialization.
      console.error("Firebase auth state failed", error);
      setUser(null);
      setProfile(null);
      setLoading(false);
    });
    return () => unsub();
  }, [loadProfile]);

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
    if (!isFirebaseConfigured) {
      throw new Error("Firebase authentication is not configured yet.");
    }
    await signInWithEmailAndPassword(auth, email, password);
  }, []);

  const signUp = useCallback(
    async (email: string, password: string, displayName: string) => {
      if (!isFirebaseConfigured) {
        throw new Error("Firebase authentication is not configured yet.");
      }
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(cred.user, { displayName });
      await ensureUserDocument(cred.user.uid, email, displayName, null);
    },
    []
  );

  const signInWithGoogle = useCallback(async () => {
    if (!isFirebaseConfigured) {
      throw new Error("Firebase authentication is not configured yet.");
    }
    const result = await signInWithPopup(auth, googleProvider);
    await ensureUserDocument(
      result.user.uid,
      result.user.email || "",
      result.user.displayName,
      result.user.photoURL
    );
  }, []);

  const signOut = useCallback(async () => {
    if (!isFirebaseConfigured) {
      setProfile(null);
      setUser(null);
      return;
    }
    await firebaseSignOut(auth);
    setProfile(null);
  }, []);

  const value = useMemo(
    () => ({
      user,
      profile,
      loading,
      refreshProfile,
      signIn,
      signUp,
      signInWithGoogle,
      signOut,
    }),
    [
      user,
      profile,
      loading,
      refreshProfile,
      signIn,
      signUp,
      signInWithGoogle,
      signOut,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
