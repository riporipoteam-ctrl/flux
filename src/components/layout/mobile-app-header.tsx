"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Settings } from "lucide-react";
import { useState } from "react";
import { MobileDrawer } from "@/components/layout/mobile-drawer";
import { Logo } from "@/components/shared/logo";
import { UserAvatar } from "@/components/shared/user-avatar";
import { useAuth } from "@/contexts/auth-context";

function sectionLabel(pathname: string): string {
  if (pathname.startsWith("/messages")) return "Messages";
  if (pathname.startsWith("/notifications")) return "Notifications";
  if (pathname.startsWith("/explore")) return "Explore";
  if (pathname.startsWith("/stories")) return "Stories";
  if (pathname.startsWith("/live")) return "Live";
  if (pathname.startsWith("/bookmarks")) return "Bookmarks";
  if (pathname.startsWith("/groups") || pathname.startsWith("/group")) return "Communities";
  if (pathname.startsWith("/games")) return "Games";
  if (pathname.startsWith("/shop")) return "Shop";
  if (pathname.startsWith("/settings")) return "Settings";
  if (pathname.startsWith("/post")) return "Post";
  if (pathname.startsWith("/profile") || /^\/(?!home$)[^/]+$/.test(pathname)) return "Profile";
  return "Home";
}

export function MobileAppHeader() {
  const pathname = usePathname() || "/home";
  const { profile } = useAuth();
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <>
      <header className="flux8-mobile-header lg:hidden">
        <div className="flux8-mobile-header-row">
          <button type="button" onClick={() => setDrawerOpen(true)} className="flux8-mobile-avatar" aria-label="Open navigation menu" aria-expanded={drawerOpen}>
            <UserAvatar user={profile} size="sm" clickable={false} decorations={profile?.decorations} />
          </button>

          <Link href="/home" className="flux8-mobile-title" aria-label="Flux home">
            {pathname === "/home" ? <Logo showWordmark={false} size={26} /> : <strong>{sectionLabel(pathname)}</strong>}
          </Link>

          <Link href="/settings" className="flux8-mobile-header-action" aria-label="Settings">
            <Settings className="h-5 w-5" />
          </Link>
        </div>
      </header>
      <MobileDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </>
  );
}
