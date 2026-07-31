"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Search } from "lucide-react";
import { useState } from "react";
import { MobileDrawer } from "@/components/layout/mobile-drawer";
import { Logo } from "@/components/shared/logo";
import { UserAvatar } from "@/components/shared/user-avatar";
import { useAuth } from "@/contexts/auth-context";

function sectionLabel(pathname: string): string {
  if (pathname.startsWith("/ask-ai")) return "AskAI";
  if (pathname.startsWith("/messages")) return "Messages";
  if (pathname.startsWith("/notifications")) return "Notifications";
  if (pathname.startsWith("/explore")) return "Explore";
  if (pathname.startsWith("/stories")) return "Stories";
  if (pathname.startsWith("/live")) return "Live";
  if (pathname.startsWith("/bookmarks")) return "Bookmarks";
  if (pathname.startsWith("/groups") || pathname.startsWith("/group")) return "Groups";
  if (pathname.startsWith("/events") || pathname.startsWith("/event")) return "Events";
  if (pathname.startsWith("/games/flux-farm")) return "Flux Farm";
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
  const [open, setOpen] = useState(false);

  return (
    <>
      <header className="sticky top-0 z-50 shrink-0 border-b border-border bg-background/94 pt-[env(safe-area-inset-top)] backdrop-blur-xl lg:hidden">
        <div className="grid h-[53px] grid-cols-[44px_1fr_44px] items-center px-2.5">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="grid h-10 w-10 place-items-center rounded-full transition-colors hover:bg-muted active:scale-95"
            aria-label="Open navigation menu"
            aria-expanded={open}
          >
            <UserAvatar user={profile} size="sm" clickable={false} decorations={profile?.decorations} />
          </button>

          <Link href="/home" className="mx-auto flex min-w-0 items-center gap-2" aria-label="Flux home">
            <Logo showWordmark={false} size={27} />
            <span className="truncate text-[15px] font-bold">{sectionLabel(pathname)}</span>
          </Link>

          <Link href="/explore" className="grid h-10 w-10 place-items-center rounded-full transition-colors hover:bg-muted active:scale-95" aria-label="Search Flux">
            <Search className="h-5 w-5" />
          </Link>
        </div>
      </header>
      <MobileDrawer open={open} onClose={() => setOpen(false)} />
    </>
  );
}
