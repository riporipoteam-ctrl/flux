"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/auth-context";
import { Separator } from "@/components/ui/separator";

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const { signIn, signUp, signInWithGoogle } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "login") {
        await signIn(email, password);
      } else {
        if (!displayName.trim()) {
          toast.error("Please enter your name");
          setLoading(false);
          return;
        }
        await signUp(email, password, displayName.trim());
      }
      toast.success(mode === "login" ? "Welcome back" : "Account created");
      router.push("/");
    } catch (err: unknown) {
      toast.error(friendlyAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  const onGoogle = async () => {
    setGoogleLoading(true);
    try {
      await signInWithGoogle();
      toast.success("Signed in with Google");
      router.push("/");
    } catch (err: unknown) {
      toast.error(friendlyAuthError(err));
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <div>
      <h2 className="text-3xl font-bold tracking-tight">
        {mode === "login" ? "Welcome back" : "Join Flux"}
      </h2>
      <p className="mt-2 text-sm text-muted-foreground">
        {mode === "login"
          ? "Sign in to continue your feed."
          : "Create your account in seconds."}
      </p>

      <Button
        type="button"
        variant="outline"
        className="mt-8 w-full"
        loading={googleLoading}
        onClick={onGoogle}
      >
        <GoogleIcon />
        Continue with Google
      </Button>

      <div className="my-6 flex items-center gap-3">
        <Separator className="flex-1" />
        <span className="text-xs text-muted-foreground">or email</span>
        <Separator className="flex-1" />
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        {mode === "signup" ? (
          <div className="space-y-2">
            <Label htmlFor="name">Display name</Label>
            <Input
              id="name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Alex Rivera"
              required
            />
          </div>
        ) : null}
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            minLength={6}
            required
          />
        </div>
        <Button type="submit" className="w-full" size="lg" loading={loading}>
          {mode === "login" ? "Sign in" : "Create account"}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        {mode === "login" ? (
          <>
            New to Flux?{" "}
            <Link href="/signup" className="font-semibold text-primary hover:underline">
              Sign up
            </Link>
          </>
        ) : (
          <>
            Already have an account?{" "}
            <Link href="/login" className="font-semibold text-primary hover:underline">
              Sign in
            </Link>
          </>
        )}
      </p>
    </div>
  );
}

function friendlyAuthError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  if (raw.includes("auth/invalid-credential") || raw.includes("wrong-password"))
    return "Wrong email or password.";
  if (raw.includes("auth/operation-not-allowed"))
    return "Email/password sign-in is disabled in Firebase. Enable the Email/Password provider in Firebase Authentication.";
  if (raw.includes("auth/invalid-api-key"))
    return "Firebase authentication is misconfigured. Redeploy the latest Flux folder so its public Firebase settings are included.";
  if (raw.includes("auth/invalid-email"))
    return "Enter a valid email address.";
  if (raw.includes("auth/too-many-requests"))
    return "Too many attempts. Wait a moment and try again.";
  if (raw.includes("auth/email-already-in-use"))
    return "That email is already registered. Try signing in.";
  if (raw.includes("auth/weak-password"))
    return "Password should be at least 6 characters.";
  if (raw.includes("auth/popup-closed-by-user"))
    return "Google sign-in was cancelled.";
  if (raw.includes("auth/network-request-failed"))
    return "Network error. Check your connection.";
  return raw.replace("Firebase: ", "").split("(")[0].trim() || "Auth failed";
}

function GoogleIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#EA4335"
        d="M12 10.2v3.9h5.5c-.2 1.3-1.6 3.9-5.5 3.9-3.3 0-6-2.7-6-6s2.7-6 6-6c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.9 3.4 14.7 2.4 12 2.4 6.9 2.4 2.8 6.5 2.8 11.6S6.9 20.8 12 20.8c6.9 0 8.4-4.8 8.4-7.3 0-.5 0-.8-.1-1.2H12z"
      />
    </svg>
  );
}
