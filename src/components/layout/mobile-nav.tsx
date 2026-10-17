"use client";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { isNavPathActive, profilePath } from "@/lib/routes";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ComposeBox } from "@/components/posts/compose-box";
import { NavIcon, type NavIconName } from "@/components/navigation/nav-icon";
import { useAuth } from "@/contexts/auth-context";
function backToTop(event: React.MouseEvent) {
  event.preventDefault();
  window.scrollTo({
    top: 0,
    behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ? "auto"
      : "smooth",
  });
}
export function MobileNav() {
  const pathname = usePathname() || "/home";
  const { profile } = useAuth();
  const [mounted, setMounted] = useState(false);
  const [composeOpen, setComposeOpen] = useState(false);
  const profileHref = profile?.username
    ? profilePath(profile.username)
    : "/profile";
  useEffect(() => setMounted(true), []);
  const tabs = useMemo<
    { href: string; icon: NavIconName; label: string; short?: string }[]
  >(
    () => [
      { href: "/home", icon: "home", label: "Home" },
      { href: "/explore", icon: "explore", label: "Explore" },
      {
        href: "/notifications",
        icon: "notifications",
        label: "Notifications",
        short: "Alerts",
      },
      { href: "/messages", icon: "messages", label: "Messages" },
      { href: profileHref, icon: "profile", label: "Profile" },
    ],
    [profileHref],
  );
  return (
    <>
      {mounted
        ? createPortal(
            <>
              <nav
                className="flux-mobile-dock-portal flux-phone-nav"
                aria-label="Primary navigation"
                data-flux-mobile-dock="identity-2026"
              >
                <div className="flux-phone-links">
                  {tabs.map((tab) => {
                    const active = isNavPathActive(pathname, tab.href);
                    return (
                      <Link
                        key={tab.href}
                        href={tab.href}
                        aria-label={tab.label}
                        aria-current={active ? "page" : undefined}
                        onClick={active ? backToTop : undefined}
                        className={cn("flux-phone-link", active && "is-active")}
                      >
                        <NavIcon name={tab.icon} active={active} />
                        <span>{tab.short || tab.label}</span>
                      </Link>
                    );
                  })}
                </div>
              </nav>
              <button
                type="button"
                className="flux-mobile-compose-fab flux-phone-compose"
                id="flux-phone-compose"
                aria-haspopup="dialog"
                aria-expanded={composeOpen}
                aria-label="Create post"
                onClick={() => setComposeOpen(true)}
              >
                <NavIcon name="create" />
              </button>
            </>,
            document.body,
          )
        : null}
      <Dialog open={composeOpen} onOpenChange={setComposeOpen}>
        <DialogContent
          className="flux-compose-dialog"
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            document
              .getElementById("flux-phone-compose")
              ?.focus({ preventScroll: true });
          }}
          aria-describedby={undefined}
        >
          <DialogHeader>
            <DialogTitle>Create post</DialogTitle>
          </DialogHeader>
          <ComposeBox onSuccess={() => setComposeOpen(false)} autofocus />
        </DialogContent>
      </Dialog>
    </>
  );
}
