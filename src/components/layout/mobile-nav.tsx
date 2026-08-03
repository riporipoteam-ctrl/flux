"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Gamepad2, Home, Plus, Search, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";
import { isNavPathActive, profilePath } from "@/lib/routes";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ComposeBox } from "@/components/posts/compose-box";
import { useAuth } from "@/contexts/auth-context";

function backToTop(event: React.MouseEvent) {
  event.preventDefault();
  window.scrollTo({ top: 0, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
}

export function MobileNav() {
  const pathname = usePathname();
  const { profile } = useAuth();
  const [composeOpen, setComposeOpen] = useState(false);
  const profileHref = profile?.username ? profilePath(profile.username) : "/profile";
  const tabs = [
    { href: "/home", icon: Home, label: "Home" },
    { href: "/explore", icon: Search, label: "Explore" },
    { href: "#compose", icon: Plus, label: "Create", create: true },
    { href: "/games", icon: Gamepad2, label: "Games" },
    { href: profileHref, icon: UserRound, label: "Profile" },
  ];

  return (
    <>
      <nav className="flux8-mobile-nav lg:hidden" aria-label="Primary navigation">
        <div className="flux8-mobile-nav-grid">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const active = !tab.create && isNavPathActive(pathname, tab.href);
            if (tab.create) {
              return (
                <button key={tab.label} type="button" onClick={() => setComposeOpen(true)} aria-label="Create post" className="flux8-mobile-tab flux8-mobile-tab-create">
                  <Icon className="h-[25px] w-[25px]" strokeWidth={2.7} />
                </button>
              );
            }
            return (
              <Link key={tab.href} href={tab.href} aria-label={tab.label} aria-current={active ? "page" : undefined} onClick={active ? backToTop : undefined} className={cn("flux8-mobile-tab", active && "is-active")}>
                <Icon className="h-[24px] w-[24px]" strokeWidth={active ? 2.6 : 2.05} />
              </Link>
            );
          })}
        </div>
      </nav>

      <Dialog open={composeOpen} onOpenChange={setComposeOpen}>
        <DialogContent className="flux8-dialog max-w-lg overflow-hidden p-0">
          <DialogHeader className="border-b border-border px-4 py-3"><DialogTitle>Create post</DialogTitle></DialogHeader>
          <div className="p-4"><ComposeBox onSuccess={() => setComposeOpen(false)} autofocus /></div>
        </DialogContent>
      </Dialog>
    </>
  );
}
