"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { MobileDrawer } from "@/components/layout/mobile-drawer";
import { NavIcon } from "@/components/navigation/nav-icon";
import { Logo } from "@/components/shared/logo";
import { UserAvatar } from "@/components/shared/user-avatar";
import { useAuth } from "@/contexts/auth-context";
import { profilePath } from "@/lib/routes";
export function MobileAppHeader() {
  const { profile } = useAuth();
  const [drawerOpen, setDrawerOpen] = useState(false);
  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 1024px)");
    const closeOnDesktop = () => {
      if (desktop.matches) setDrawerOpen(false);
    };
    desktop.addEventListener("change", closeOnDesktop);
    return () => desktop.removeEventListener("change", closeOnDesktop);
  }, []);
  return (
    <>
      <header className="flux-mobile-header">
        <div className="flux-mobile-header-inner">
          <button
            type="button"
            className="flux-header-menu"
            id="flux-open-menu"
            aria-haspopup="dialog"
            aria-controls="flux-navigation-panel"
            aria-label="Open navigation menu"
            aria-expanded={drawerOpen}
            onClick={() => setDrawerOpen(true)}
          >
            <NavIcon name="menu" />
          </button>
          <Logo size={30} />
          <Link
            href={profilePath(profile?.username)}
            className="flux-header-profile"
            aria-label="Your profile"
          >
            <UserAvatar
              user={profile}
              size="sm"
              clickable={false}
              decorations={profile?.decorations}
            />
          </Link>
        </div>
      </header>
      <MobileDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </>
  );
}
