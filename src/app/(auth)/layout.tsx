"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useAuth } from "@/contexts/auth-context";
import { LoadingScreen } from "@/components/shared/loading-screen";
import { Logo } from "@/components/shared/logo";
import { APP_TAGLINE } from "@/lib/constants";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, profile, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (user && profile?.onboardingComplete) router.replace("/home");
    else if (user && profile && !profile.onboardingComplete)
      router.replace("/onboarding");
  }, [user, profile, loading, router]);

  if (loading) return <LoadingScreen />;
  if (user && profile?.onboardingComplete) return <LoadingScreen />;

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-[#eaf6ff] lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div className="absolute inset-0 opacity-60">
          <div className="absolute -left-20 top-20 h-72 w-72 rounded-full bg-[#1d9bf0]/20 blur-3xl" />
          <div className="absolute bottom-10 right-10 h-96 w-96 rounded-full bg-white/80 blur-3xl" />
        </div>
        <Logo href="/login" className="relative z-10" size={44} />
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12, duration: 0.5 }}
          className="relative z-10 max-w-md text-[#0f1419]"
        >
          <h1 className="text-4xl font-extrabold leading-tight tracking-tight xl:text-5xl">
            Happening now.
          </h1>
          <p className="mt-4 text-lg text-[#536471]">{APP_TAGLINE}</p>
          <ul className="mt-8 space-y-3 text-sm text-[#0f1419]/80">
            {[
              "Posts, chats, groups & events",
              "AskAI with web search & images",
              "Flux Coins, shop & daily challenges",
              "Clean, responsive UI — built for every device",
            ].map((line, i) => (
              <motion.li
                key={line}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.25 + i * 0.08 }}
                className="flex items-center gap-2"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-[#1d9bf0]" />
                {line}
              </motion.li>
            ))}
          </ul>
        </motion.div>
        <p className="relative z-10 text-sm text-[#536471]">
          © {new Date().getFullYear()} Flux by Ripo Team
        </p>
      </div>

      <div className="flex flex-col justify-center px-5 py-10 sm:px-10">
        <div className="mb-8 lg:hidden">
          <Logo href="/login" />
        </div>
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="mx-auto w-full max-w-md"
        >
          {children}
        </motion.div>
      </div>
    </div>
  );
}
