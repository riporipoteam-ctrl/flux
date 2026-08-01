"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Bell, Mail, PenSquare, Search, Sparkles } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { UserAvatar } from "@/components/shared/user-avatar";
import { ComposeBox } from "@/components/posts/compose-box";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { getUnreadCount } from "@/services/notifications";
import { profilePath } from "@/lib/routes";

function pageTitle(pathname: string): string {
  if (pathname.startsWith("/explore")) return "Explore";
  if (pathname.startsWith("/stories")) return "Stories";
  if (pathname.startsWith("/groups") || pathname.startsWith("/group")) return "Communities";
  if (pathname.startsWith("/games")) return "Games";
  if (pathname.startsWith("/messages")) return "Messages";
  if (pathname.startsWith("/notifications")) return "Notifications";
  if (pathname.startsWith("/live")) return "Live";
  if (pathname.startsWith("/premium")) return "Premium";
  if (pathname.startsWith("/rewards")) return "Rewards";
  if (pathname.startsWith("/shop")) return "Shop";
  if (pathname.startsWith("/settings")) return "Settings";
  if (pathname.startsWith("/profile") || /^\/(?!home$)[^/]+$/.test(pathname)) return "Profile";
  return "Home";
}

export function DesktopTopbar() {
  const pathname = usePathname() || "/home";
  const router = useRouter();
  const { user, profile } = useAuth();
  const [query, setQuery] = useState("");
  const [composeOpen, setComposeOpen] = useState(false);
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (!user) return;
    getUnreadCount(user.uid).then(setUnread).catch(() => setUnread(0));
    const timer = window.setInterval(() => getUnreadCount(user.uid).then(setUnread).catch(() => undefined), 45_000);
    return () => window.clearInterval(timer);
  }, [user, pathname]);

  return (
    <header className="flux8-topbar hidden lg:flex">
      <div className="flux8-topbar-page">
        <span>{pageTitle(pathname)}</span>
      </div>

      <form
        className="flux8-global-search"
        onSubmit={(event) => {
          event.preventDefault();
          if (query.trim()) router.push(`/explore?q=${encodeURIComponent(query.trim())}`);
        }}
      >
        <Search className="h-[18px] w-[18px]" />
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search people, posts and communities" aria-label="Search Flux" />
        <kbd>/</kbd>
      </form>

      <div className="flux8-topbar-actions">
        <Link href="/ask-ai" className="flux8-topbar-icon" aria-label="Open AskAI"><Sparkles className="h-[19px] w-[19px]" /></Link>
        <Link href="/notifications" className="flux8-topbar-icon" aria-label="Notifications">
          <Bell className="h-[19px] w-[19px]" />
          {unread > 0 ? <em>{unread > 99 ? "99+" : unread}</em> : null}
        </Link>
        <Link href="/messages" className="flux8-topbar-icon" aria-label="Messages"><Mail className="h-[19px] w-[19px]" /></Link>
        <Dialog open={composeOpen} onOpenChange={setComposeOpen}>
          <DialogTrigger asChild>
            <button type="button" className="flux8-create-button"><PenSquare className="h-[18px] w-[18px]" /><span>Create</span></button>
          </DialogTrigger>
          <DialogContent className="flux8-dialog max-w-xl overflow-hidden p-0">
            <DialogHeader className="border-b border-border px-5 py-4"><DialogTitle>Create post</DialogTitle></DialogHeader>
            <div className="p-4"><ComposeBox onSuccess={() => setComposeOpen(false)} autofocus /></div>
          </DialogContent>
        </Dialog>
        <Link href={profilePath(profile?.username)} className="flux8-topbar-avatar" aria-label="Open profile">
          <UserAvatar user={profile} size="sm" decorations={profile?.decorations} clickable={false} />
        </Link>
      </div>
    </header>
  );
}
