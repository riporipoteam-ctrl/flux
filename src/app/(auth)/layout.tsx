"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import { MessageCircle, Users, Gamepad2, Sparkles } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { LoadingScreen } from "@/components/shared/loading-screen";
import { FluxMark, Logo } from "@/components/shared/logo";
import { APP_TAGLINE } from "@/lib/constants";

const FEATURES = [
  { icon: MessageCircle, text: "Posts, chats, groups & events" },
  { icon: Sparkles, text: "AskAI with web search & images" },
  { icon: Gamepad2, text: "Flux Coins, shop & daily challenges" },
  { icon: Users, text: "Connect your Flux Rec account" },
];

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, profile, loading } = useAuth();
  const router = useRouter();
  const reduceMotion = useReducedMotion();

  // A username is proof of onboarding; the flag alone is not, and trusting it
  // sent people back through setup whenever a profile read came back thin.
  const onboarded = Boolean(
    profile && (profile.onboardingComplete || String(profile.username || "").trim())
  );

  useEffect(() => {
    if (loading) return;
    if (user && onboarded) router.replace("/home");
    else if (user && profile && !onboarded) router.replace("/onboarding");
  }, [user, profile, onboarded, loading, router]);

  if (loading) return <LoadingScreen />;
  if (user && onboarded) return <LoadingScreen />;

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      {/* Brand panel — fixed dark gradient, readable in every theme */}
      <div className="relative hidden overflow-hidden bg-[#0a0f1e] lg:flex lg:flex-col lg:justify-between lg:p-12">
        {/* Ambient glows */}
        <div className="absolute inset-0" aria-hidden>
          <div className="absolute -left-24 top-16 h-80 w-80 rounded-full bg-violet-600/30 blur-3xl" />
          <div className="absolute bottom-0 right-0 h-[28rem] w-[28rem] rounded-full bg-cyan-500/20 blur-3xl" />
          <div className="absolute left-1/2 top-1/2 h-96 w-96 -translate-x-1/2 -translate-y-1/2 rounded-full bg-indigo-600/20 blur-3xl" />
        </div>
        {/* Giant watermark mark, X-style */}
        <FluxMark
          size={560}
          className="pointer-events-none absolute -right-24 top-1/2 -translate-y-1/2 text-white/[0.04]"
        />

        <div className="relative z-10">
          <Logo href="/login" size={44} className="[&_span]:text-white" />
        </div>

        <motion.div
          initial={reduceMotion ? undefined : { opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12, duration: 0.5 }}
          className="relative z-10 max-w-md"
        >
          <h1 className="text-4xl font-extrabold leading-tight tracking-tight text-white xl:text-6xl">
            Happening now.
          </h1>
          <p className="mt-4 text-lg text-white/70">{APP_TAGLINE}</p>
          <ul className="mt-10 space-y-4">
            {FEATURES.map((f, i) => (
              <motion.li
                key={f.text}
                initial={reduceMotion ? undefined : { opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.25 + i * 0.08 }}
                className="flex items-center gap-3 text-[15px] font-medium text-white/85"
              >
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/10 ring-1 ring-white/15">
                  <f.icon className="h-4 w-4 text-cyan-300" />
                </span>
                {f.text}
              </motion.li>
            ))}
          </ul>
        </motion.div>

        <p className="relative z-10 text-sm text-white/50">
          © {new Date().getFullYear()} Flux by Ripo Team
        </p>
      </div>

      {/* Form column */}
      <div className="relative flex flex-col justify-center bg-background px-5 py-10 sm:px-10 lg:px-16">
        <div className="mb-10 flex justify-center lg:hidden">
          <Logo href="/login" size={40} />
        </div>
        <motion.div
          initial={reduceMotion ? undefined : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="mx-auto w-full max-w-sm"
        >
          {children}
        </motion.div>
      </div>
    </div>
  );
}
