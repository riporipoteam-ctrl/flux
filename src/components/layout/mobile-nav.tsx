"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
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
  window.scrollTo({
    top: 0,
    behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
  });
}

/**
 * The phone dock is rendered through document.body on purpose.
 * RouteMotion animates the page with CSS transforms; Safari treats fixed
 * children inside a transformed ancestor as locally positioned and can clip
 * them behind the browser toolbar. A body portal keeps the dock in the real
 * visual viewport and outside every page overflow/transform context.
 */
export function MobileNav() {
  const pathname = usePathname() || "/home";
  const { profile } = useAuth();
  const [mounted, setMounted] = useState(false);
  const [composeOpen, setComposeOpen] = useState(false);
  const profileHref = profile?.username ? profilePath(profile.username) : "/profile";

  useEffect(() => setMounted(true), []);

  const tabs = useMemo(() => [
    { href: "/home", icon: Home, label: "Home" },
    { href: "/explore", icon: Search, label: "Explore" },
    { href: "#compose", icon: Plus, label: "Create", create: true },
    { href: "/games", icon: Gamepad2, label: "Games" },
    { href: profileHref, icon: UserRound, label: "Profile" },
  ], [profileHref]);

  const dock = (
    <nav
      className="flux8-mobile-nav flux-mobile-dock-portal"
      aria-label="Primary navigation"
      data-flux-mobile-dock="portal-v1"
    >
      <div className="flux8-mobile-nav-grid">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = !tab.create && isNavPathActive(pathname, tab.href);
          if (tab.create) {
            return (
              <button
                key={tab.label}
                type="button"
                onClick={() => setComposeOpen(true)}
                aria-label="Create post"
                className="flux8-mobile-tab flux8-mobile-tab-create"
              >
                <Icon className="h-[25px] w-[25px]" strokeWidth={2.7} />
                <span className="flux-mobile-dock-label">Create</span>
              </button>
            );
          }
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-label={tab.label}
              aria-current={active ? "page" : undefined}
              onClick={active ? backToTop : undefined}
              className={cn("flux8-mobile-tab", active && "is-active")}
            >
              <Icon className="h-[24px] w-[24px]" strokeWidth={active ? 2.6 : 2.05} />
              <span className="flux-mobile-dock-label">{tab.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );

  return (
    <>
      {mounted ? createPortal(dock, document.body) : null}
      <Dialog open={composeOpen} onOpenChange={setComposeOpen}>
        <DialogContent className="flux8-dialog max-w-lg overflow-hidden p-0">
          <DialogHeader className="border-b border-border px-4 py-3">
            <DialogTitle>Create post</DialogTitle>
          </DialogHeader>
          <div className="p-4">
            <ComposeBox onSuccess={() => setComposeOpen(false)} autofocus />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
