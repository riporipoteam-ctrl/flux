"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, Home, Mail, PenLine, Search, UserRound } from "lucide-react";
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

export function MobileNav() {
  const pathname = usePathname() || "/home";
  const { profile } = useAuth();
  const [mounted, setMounted] = useState(false);
  const [composeOpen, setComposeOpen] = useState(false);
  const profileHref = profile?.username ? profilePath(profile.username) : "/profile";

  useEffect(() => setMounted(true), []);

  // Mirror X's essential mobile destinations. AskAI and the other Flux
  // experiences remain available from the slide-out navigation drawer.
  const tabs = useMemo(() => [
    { href: "/home", icon: Home, label: "Home" },
    { href: "/explore", icon: Search, label: "Explore" },
    { href: "/notifications", icon: Bell, label: "Notifications" },
    { href: "/messages", icon: Mail, label: "Messages" },
    { href: profileHref, icon: UserRound, label: "Profile" },
  ], [profileHref]);

  const dock = (
    <nav className="flux8-mobile-nav flux-mobile-dock-portal" aria-label="Primary navigation" data-flux-mobile-dock="v12">
      <div className="flux8-mobile-nav-grid">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = isNavPathActive(pathname, tab.href);
          return (
            <Link key={tab.href} href={tab.href} aria-label={tab.label} aria-current={active ? "page" : undefined} onClick={active ? backToTop : undefined} className={cn("flux8-mobile-tab", active && "is-active")}>
              <Icon className="h-[23px] w-[23px]" strokeWidth={active ? 2.7 : 2.05} />
              <span className="flux-mobile-dock-label">{tab.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );

  return (
    <>
      {mounted ? createPortal(
        <>
          {dock}
          <button
            type="button"
            className="flux-mobile-compose-fab"
            aria-label="Create post"
            title="Create post"
            onClick={() => setComposeOpen(true)}
          >
            <PenLine aria-hidden="true" />
          </button>
        </>,
        document.body
      ) : null}
      <Dialog open={composeOpen} onOpenChange={setComposeOpen}>
        <DialogContent className="flux8-dialog max-w-lg overflow-hidden p-0">
          <DialogHeader className="border-b border-border px-4 py-3"><DialogTitle>Create post</DialogTitle></DialogHeader>
          <div className="p-4"><ComposeBox onSuccess={() => setComposeOpen(false)} autofocus /></div>
        </DialogContent>
      </Dialog>
    </>
  );
}
