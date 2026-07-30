"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { useState } from "react";
import { MobileDrawer } from "@/components/layout/mobile-drawer";
import { Logo } from "@/components/shared/logo";
import { UserAvatar } from "@/components/shared/user-avatar";
import { useAuth } from "@/contexts/auth-context";
import { profilePath } from "@/lib/routes";

function sectionLabel(pathname: string): string {
  if (pathname.startsWith("/ask-ai")) return "AskAI";
  if (pathname.startsWith("/messages")) return "Messages";
  if (pathname.startsWith("/notifications")) return "Alerts";
  if (pathname.startsWith("/explore")) return "Explore";
  if (pathname.startsWith("/bookmarks")) return "Bookmarks";
  if (pathname.startsWith("/activity")) return "Activity";
  if (pathname.startsWith("/lists")) return "Lists";
  if (pathname.startsWith("/groups") || pathname.startsWith("/group")) return "Groups";
  if (pathname.startsWith("/events") || pathname.startsWith("/event")) return "Events";
  if (pathname.startsWith("/games/flux-farm")) return "Flux Farm";
  if (pathname.startsWith("/games")) return "Games";
  if (pathname.startsWith("/shop")) return "Shop";
  if (pathname.startsWith("/settings")) return "Settings";
  if (pathname.startsWith("/admin")) return "Admin";
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
      <header className="sticky top-0 z-50 shrink-0 border-b border-border/70 bg-card/88 pt-[env(safe-area-inset-top)] shadow-[0_8px_30px_rgba(34,32,74,.06)] backdrop-blur-2xl lg:hidden">
        <div className="flex h-14 items-center gap-2 px-3">
          <button type="button" onClick={() => setOpen(true)} className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-border/70 bg-muted/45 transition hover:bg-muted active:scale-95" aria-label="Open navigation menu" aria-expanded={open}><Menu className="h-5 w-5" /></button>
          <div className="flex min-w-0 flex-1 items-center gap-2 px-1 py-1">
            <Logo showWordmark={false} size={31} />
            <div className="min-w-0 leading-tight"><p className="truncate text-[15px] font-black tracking-[-0.03em]">Flux <span className="text-gradient-brand">2.0</span></p><p className="truncate text-[11px] font-medium text-muted-foreground">{sectionLabel(pathname)}</p></div>
          </div>
          <Link href={profilePath(profile?.username)} className="grid h-11 w-11 shrink-0 place-items-center rounded-full transition hover:bg-muted active:scale-95" aria-label="Open your profile"><UserAvatar user={profile} size="sm" ring clickable={false} decorations={profile?.decorations} /></Link>
        </div>
      </header>
      <MobileDrawer open={open} onClose={() => setOpen(false)} />
    </>
  );
}
