"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/auth-context";
import { Separator } from "@/components/ui/separator";
import { FluxMark } from "@/components/shared/logo";
import { cn } from "@/lib/utils";

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const { signIn, signUp, signInWithGoogle } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
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

  const isSignup = mode === "signup";

  return (
    <div className="w-full">
      {/* Brand mark (mobile already shows one in layout; keep this subtle on desktop) */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.35 }}
        className="mb-6 hidden lg:block"
      >
        <FluxMark size={48} className="text-primary" />
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.05 }}
      >
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
          {isSignup ? "Join Flux today" : "Welcome back"}
        </h1>
        <p className="mt-2 text-[15px] text-muted-foreground">
          {isSignup
            ? "Create your account and start posting in seconds."
            : "Sign in to see what's happening."}
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.12 }}
        className="mt-8"
      >
        <Button
          type="button"
          variant="outline"
          size="lg"
          className="w-full rounded-full border-border bg-card font-bold shadow-sm hover:bg-muted"
          disabled={googleLoading || loading}
          onClick={onGoogle}
        >
          {googleLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <GoogleIcon />
          )}
          Continue with Google
        </Button>

        <div className="my-6 flex items-center gap-3">
          <Separator className="flex-1" />
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            or
          </span>
          <Separator className="flex-1" />
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          {isSignup ? (
            <div>
              <Input
                id="name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Display name"
                autoComplete="name"
                required
                disabled={loading}
                className="h-13 rounded-2xl px-5 py-3.5 text-[15px]"
              />
            </div>
          ) : null}
          <div>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email address"
              required
              disabled={loading}
              className="h-13 rounded-2xl px-5 py-3.5 text-[15px]"
            />
          </div>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete={isSignup ? "new-password" : "current-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              minLength={6}
              required
              disabled={loading}
              className="h-13 rounded-2xl px-5 py-3.5 pr-12 text-[15px]"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              disabled={loading}
              aria-label={showPassword ? "Hide password" : "Show password"}
              className={cn(
                "absolute right-4 top-1/2 -translate-y-1/2 rounded-full p-1",
                "text-muted-foreground transition-colors hover:text-foreground",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              )}
            >
              {showPassword ? (
                <EyeOff className="h-4.5 w-4.5" />
              ) : (
                <Eye className="h-4.5 w-4.5" />
              )}
            </button>
          </div>

          <Button
            type="submit"
            variant="flux"
            size="lg"
            className="w-full rounded-full text-base"
            loading={loading}
            disabled={loading || googleLoading}
          >
            {isSignup ? "Create account" : "Sign in"}
          </Button>
        </form>

        <p className="mt-8 text-center text-sm text-muted-foreground">
          {isSignup ? (
            <>
              Already have an account?{" "}
              <Link
                href="/login"
                className="font-bold text-primary hover:underline"
              >
                Sign in
              </Link>
            </>
          ) : (
            <>
              New to Flux?{" "}
              <Link
                href="/signup"
                className="font-bold text-primary hover:underline"
              >
                Sign up
              </Link>
            </>
          )}
        </p>

        {isSignup ? (
          <p className="mt-6 text-center text-xs leading-relaxed text-muted-foreground">
            By signing up, you agree to the Terms of Service and Privacy
            Policy.
          </p>
        ) : null}
      </motion.div>
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
