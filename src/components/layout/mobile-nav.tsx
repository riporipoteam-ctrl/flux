"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { Home, Search, Bell, User, PenSquare } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ComposeBox } from "@/components/posts/compose-box";
import { useState } from "react";

export function MobileNav() {
  const pathname = usePathname();
  const { profile } = useAuth();
  const [open, setOpen] = useState(false);
  const profileHref = profile?.username
    ? `/${profile.username}`
    : "/settings/profile";

  const tabs = [
    { href: "/home", icon: Home, label: "Home" },
    { href: "/explore", icon: Search, label: "Explore" },
    { href: "__compose", icon: PenSquare, label: "Post", compose: true },
    { href: "/notifications", icon: Bell, label: "Alerts" },
    { href: profileHref, icon: User, label: "Profile" },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-border/70 bg-card/85 pb-[env(safe-area-inset-bottom)] backdrop-blur-2xl lg:hidden">
      <div className="mx-auto flex h-[68px] max-w-lg items-center justify-around px-2">
        {tabs.map((tab) => {
          if (tab.compose) {
            return (
              <Dialog key="compose" open={open} onOpenChange={setOpen}>
                <DialogTrigger asChild>
                  <motion.button
                    whileHover={{ scale: 1.06 }}
                    whileTap={{ scale: 0.94 }}
                    className="-mt-6 flex h-14 w-14 items-center justify-center rounded-full bg-[#1d9bf0] text-white shadow-lg"
                    aria-label="Compose"
                  >
                    <PenSquare className="h-5 w-5" />
                  </motion.button>
                </DialogTrigger>
                <DialogContent className="max-w-lg overflow-hidden p-0 sm:rounded-3xl">
                  <DialogHeader className="border-b border-border px-4 py-3">
                    <DialogTitle>New post</DialogTitle>
                  </DialogHeader>
                  <div className="p-3">
                    <ComposeBox onSuccess={() => setOpen(false)} autofocus />
                  </div>
                </DialogContent>
              </Dialog>
            );
          }

          const Icon = tab.icon;
          const active =
            pathname === tab.href || pathname.startsWith(tab.href + "/");
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "relative flex flex-col items-center gap-0.5 rounded-xl px-3 py-1.5 text-[10px] font-semibold transition-colors",
                active ? "text-primary" : "text-muted-foreground"
              )}
            >
              {active ? (
                <motion.span
                  layoutId="mobile-nav-indicator"
                  className="absolute -top-0.5 h-1 w-5 rounded-full bg-primary"
                  transition={{ type: "spring", stiffness: 400, damping: 28 }}
                />
              ) : null}
              <motion.span whileTap={{ scale: 0.9 }}>
                <Icon className={cn("h-5 w-5", active && "fill-primary/15")} />
              </motion.span>
              {tab.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
