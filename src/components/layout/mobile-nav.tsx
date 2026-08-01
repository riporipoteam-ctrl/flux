"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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
    { href: "__compose", icon: PenSquare, label: "Create", compose: true },
    { href: "/notifications", icon: Bell, label: "Alerts" },
    { href: "/messages", icon: Mail, label: "Messages" },
  ];

  return (
    <nav className="flux-mobile-nav fixed bottom-0 left-0 right-0 z-50 pb-[env(safe-area-inset-bottom)] lg:hidden" aria-label="Primary navigation">
      <div className="flux-mobile-nav-grid">
        {tabs.map((tab) => {
          if (tab.compose) {
            return (
              <Dialog key="compose" open={open} onOpenChange={setOpen}>
                <DialogTrigger asChild>
                  <button type="button" className="flux-mobile-tab flux-mobile-compose" aria-label="Create post">
                    <span><PenSquare className="h-[19px] w-[19px]" strokeWidth={2.2} /></span>
                    {tab.label}
                  </button>
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
            <Link key={tab.href} href={tab.href} aria-current={active ? "page" : undefined} className={cn("flux-mobile-tab", active && "is-active")}>
              <span><Icon className={cn("h-[19px] w-[19px]", active && "fill-current/10")} strokeWidth={active ? 2.45 : 2.05} /></span>
              {tab.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
