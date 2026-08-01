"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PenSquare, Search } from "lucide-react";
import { useState } from "react";
import { MobileDrawer } from "@/components/layout/mobile-drawer";
import { Logo } from "@/components/shared/logo";
import { UserAvatar } from "@/components/shared/user-avatar";
import { useAuth } from "@/contexts/auth-context";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ComposeBox } from "@/components/posts/compose-box";

function sectionLabel(pathname: string): string {
  if (pathname.startsWith("/messages")) return "Messages";
  if (pathname.startsWith("/notifications")) return "Notifications";
  if (pathname.startsWith("/explore")) return "Explore";
  if (pathname.startsWith("/stories")) return "Stories";
  if (pathname.startsWith("/live")) return "Live";
  if (pathname.startsWith("/bookmarks")) return "Bookmarks";
  if (pathname.startsWith("/groups") || pathname.startsWith("/group")) return "Communities";
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
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [composeOpen, setComposeOpen] = useState(false);

  return (
    <>
      <header className="flux-mobile-header sticky top-0 z-50 shrink-0 pt-[env(safe-area-inset-top)] lg:hidden">
        <div className="flux-mobile-header-row">
          <button type="button" onClick={() => setDrawerOpen(true)} className="flux-mobile-header-action" aria-label="Open navigation menu" aria-expanded={drawerOpen}>
            <UserAvatar user={profile} size="sm" clickable={false} decorations={profile?.decorations} />
          </button>

          <Link href="/home" className="flux-mobile-header-title" aria-label="Flux home">
            <Logo showWordmark={false} size={25} />
            <strong>{sectionLabel(pathname)}</strong>
          </Link>

          <div className="flux-mobile-header-actions">
            <Link href="/explore" className="flux-mobile-header-action" aria-label="Search Flux"><Search className="h-[19px] w-[19px]" /></Link>
            <Dialog open={composeOpen} onOpenChange={setComposeOpen}>
              <DialogTrigger asChild><button type="button" className="flux-mobile-header-action" aria-label="Create post"><PenSquare className="h-[19px] w-[19px]" /></button></DialogTrigger>
              <DialogContent className="max-w-lg overflow-hidden p-0 sm:rounded-2xl"><DialogHeader className="border-b border-border px-4 py-3"><DialogTitle>New post</DialogTitle></DialogHeader><div className="p-3"><ComposeBox onSuccess={() => setComposeOpen(false)} autofocus /></div></DialogContent>
            </Dialog>
          </div>
        </div>
      </header>
      <MobileDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </>
  );
}
