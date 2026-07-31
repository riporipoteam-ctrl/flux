"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { Bell, Home, Mail, PenSquare, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { isNavPathActive } from "@/lib/routes";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ComposeBox } from "@/components/posts/compose-box";
import { useState } from "react";

export function MobileNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const tabs = [
    { href: "/home", icon: Home, label: "Home" },
    { href: "/explore", icon: Search, label: "Explore" },
    { href: "__compose", icon: PenSquare, label: "Post", compose: true },
    { href: "/notifications", icon: Bell, label: "Alerts" },
    { href: "/messages", icon: Mail, label: "Messages" },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-background/96 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden">
      <div className="mx-auto grid h-[58px] max-w-lg grid-cols-5 items-center px-1">
        {tabs.map((tab) => {
          if (tab.compose) {
            return (
              <Dialog key="compose" open={open} onOpenChange={setOpen}>
                <DialogTrigger asChild>
                  <motion.button
                    whileTap={{ scale: 0.9 }}
                    className="mx-auto grid h-11 w-11 place-items-center rounded-full bg-primary text-white shadow-[0_5px_18px_rgba(29,155,240,.3)]"
                    aria-label="Create post"
                  >
                    <PenSquare className="h-[21px] w-[21px]" strokeWidth={2.3} />
                  </motion.button>
                </DialogTrigger>
                <DialogContent className="max-w-lg overflow-hidden p-0 sm:rounded-2xl">
                  <DialogHeader className="border-b border-border px-4 py-3"><DialogTitle>New post</DialogTitle></DialogHeader>
                  <div className="p-3"><ComposeBox onSuccess={() => setOpen(false)} autofocus /></div>
                </DialogContent>
              </Dialog>
            );
          }

          const Icon = tab.icon;
          const active = isNavPathActive(pathname, tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative mx-auto flex h-full w-full flex-col items-center justify-center gap-0.5 text-[9px] font-semibold transition-colors active:scale-95",
                active ? "text-foreground" : "text-muted-foreground"
              )}
            >
              <span className="relative grid h-8 w-10 place-items-center rounded-full">
                {active ? (
                  <motion.span layoutId="mobile-nav-pill" className="absolute inset-0 rounded-full bg-muted" transition={{ type: "spring", stiffness: 420, damping: 34 }} />
                ) : null}
                <Icon className={cn("relative h-[21px] w-[21px]", active && "fill-foreground/10")} strokeWidth={active ? 2.55 : 2.05} />
              </span>
              {tab.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
