"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Search, Settings, Sparkles } from "lucide-react";
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

/**
 * The phone header. Facebook's arrangement — wordmark on the left, a row of
 * round action buttons on the right — with the avatar kept as the way into the
 * navigation drawer. Deeper screens trade the wordmark for their own title so
 * you always know where you are.
 */
export function MobileAppHeader() {
  const pathname = usePathname() || "/home";
  const { profile } = useAuth();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const home = pathname === "/home";

  return (
    <>
      <header className="flux8-mobile-header lg:hidden">
        <div className="flux8-mobile-header-row">
          <button type="button" onClick={() => setDrawerOpen(true)} className="flux8-mobile-avatar" aria-label="Open navigation menu" aria-expanded={drawerOpen}>
            <UserAvatar user={profile} size="sm" clickable={false} decorations={profile?.decorations} />
          </button>

          <Link href="/home" className="flux8-mobile-title" data-home={home ? "true" : undefined} aria-label="Flux home">
            {home ? <Logo showWordmark size={24} /> : <strong>{sectionLabel(pathname)}</strong>}
          </Link>

          <div className="flux8-mobile-header-actions">
            <Link href="/explore" className="flux8-mobile-header-action" aria-label="Search Flux">
              <Search className="h-[19px] w-[19px]" />
            </Link>
            <Link href="/ask-ai" className="flux8-mobile-header-action" aria-label="AskAI">
              <Sparkles className="h-[19px] w-[19px]" />
            </Link>
            <Link href="/settings" className="flux8-mobile-header-action" aria-label="Settings">
              <Settings className="h-[19px] w-[19px]" />
            </Link>
          </div>
        </div>
      </header>
      <MobileDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </>
  );
}
