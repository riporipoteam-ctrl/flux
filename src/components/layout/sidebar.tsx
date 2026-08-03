"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  Bookmark,
  Boxes,
  Crown,
  Gamepad2,
  Gift,
  Home,
  Mail,
  Menu,
  MoreHorizontal,
  Palette,
  PenSquare,
  Radio,
  Search,
  Settings,
  Shield,
  Sparkles,
  User,
  Users,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Logo } from "@/components/shared/logo";
import { UserAvatar } from "@/components/shared/user-avatar";
import { useAuth } from "@/contexts/auth-context";
import { cn } from "@/lib/utils";
import { isNavPathActive, profilePath } from "@/lib/routes";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ComposeBox } from "@/components/posts/compose-box";
import { getUnreadCount } from "@/services/notifications";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const mainItems: Array<{ href: string; label: string; icon: LucideIcon; badge?: "notifications" }> = [
  { href: "/home", label: "Home", icon: Home },
  { href: "/explore", label: "Explore", icon: Search },
  { href: "/notifications", label: "Notifications", icon: Bell, badge: "notifications" },
  { href: "/messages", label: "Messages", icon: Mail },
  { href: "/ask-ai", label: "AskAI", icon: Sparkles },
  { href: "/bookmarks", label: "Bookmarks", icon: Bookmark },
  { href: "/groups", label: "Communities", icon: Users },
  { href: "/premium", label: "Premium", icon: Crown },
];

const moreItems: Array<{ href: string; label: string; icon: LucideIcon }> = [
  { href: "/stories", label: "Stories", icon: Radio },
  { href: "/live", label: "Live", icon: Radio },
  { href: "/games", label: "Games", icon: Gamepad2 },
  { href: "/studio", label: "Studio", icon: Boxes },
  { href: "/gifts", label: "Gifts", icon: Gift },
  { href: "/settings/display", label: "Display", icon: Palette },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const { profile, user } = useAuth();
  const [composeOpen, setComposeOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const profileHref = profilePath(profile?.username);

  useEffect(() => {
    if (!user) return;
    getUnreadCount(user.uid).then(setUnread).catch(() => setUnread(0));
    const timer = window.setInterval(() => getUnreadCount(user.uid).then(setUnread).catch(() => undefined), 45_000);
    return () => window.clearInterval(timer);
  }, [pathname, user]);

  return (
    <aside className="flux8-sidebar hidden lg:flex">
      <Link href="/home" className="flux8-sidebar-brand" aria-label="Flux home">
        <Logo showWordmark={false} size={34} />
      </Link>

      <nav className="flux8-sidebar-nav no-scrollbar" aria-label="Primary navigation">
        {mainItems.map((item) => {
          const active = isNavPathActive(pathname, item.href);
          const Icon = item.icon;
          const badge = item.badge === "notifications" ? unread : 0;
          return (
            <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined} className={cn("flux8-sidebar-link", active && "is-active")}>
              <span className="flux8-sidebar-icon"><Icon className="h-[25px] w-[25px]" strokeWidth={active ? 2.45 : 2} />{badge > 0 ? <em>{badge > 99 ? "99+" : badge}</em> : null}</span>
              <strong>{item.label}</strong>
            </Link>
          );
        })}

        <Link href={profileHref} className={cn("flux8-sidebar-link", (pathname.startsWith("/profile") || pathname === profileHref) && "is-active")}>
          <span className="flux8-sidebar-icon"><User className="h-[25px] w-[25px]" /></span>
          <strong>Profile</strong>
        </Link>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" className="flux8-sidebar-link w-full">
              <span className="flux8-sidebar-icon"><MoreHorizontal className="h-[25px] w-[25px]" /></span>
              <strong>More</strong>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="right" align="end" className="flux8-more-menu w-[290px] p-2">
            {moreItems.map(({ href, label, icon: Icon }) => (
              <DropdownMenuItem key={href} asChild>
                <Link href={href} className="flux8-more-item"><Icon className="h-5 w-5" /><strong>{label}</strong></Link>
              </DropdownMenuItem>
            ))}
            {profile?.isAdmin ? <><DropdownMenuSeparator /><DropdownMenuItem asChild><Link href="/admin" className="flux8-more-item text-red-600"><Shield className="h-5 w-5" /><strong>Admin</strong></Link></DropdownMenuItem></> : null}
          </DropdownMenuContent>
        </DropdownMenu>
      </nav>

      <Dialog open={composeOpen} onOpenChange={setComposeOpen}>
        <DialogTrigger asChild><button type="button" className="flux8-sidebar-create"><PenSquare className="h-5 w-5" /><span>Post</span></button></DialogTrigger>
        <DialogContent className="flux8-dialog max-w-xl overflow-hidden p-0"><DialogHeader className="border-b border-border px-5 py-4"><DialogTitle>Create post</DialogTitle></DialogHeader><div className="p-4"><ComposeBox onSuccess={() => setComposeOpen(false)} autofocus /></div></DialogContent>
      </Dialog>

      {profile ? <Link href={profileHref} className="flux8-sidebar-profile"><UserAvatar user={profile} size="sm" decorations={profile.decorations} clickable={false} /><div><strong>{profile.displayName}</strong><span>@{profile.username || "…"}</span></div><Menu className="h-4 w-4" /></Link> : null}
    </aside>
  );
}
