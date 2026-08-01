"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  Bookmark,
  Boxes,
  CalendarDays,
  Coins,
  Crown,
  Gamepad2,
  Gift,
  HelpCircle,
  Home,
  Images,
  Mail,
  Menu,
  PenSquare,
  Radio,
  Search,
  Settings,
  Shield,
  ShoppingBag,
  Sparkles,
  Sticker,
  User,
  Users,
  WandSparkles,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Logo } from "@/components/shared/logo";
import { UserAvatar } from "@/components/shared/user-avatar";
import { useAuth } from "@/contexts/auth-context";
import { cn, formatCount } from "@/lib/utils";
import { isNavPathActive, profilePath } from "@/lib/routes";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ComposeBox } from "@/components/posts/compose-box";
import { getUnreadCount } from "@/services/notifications";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const primaryItems: Array<{ href: string; label: string; icon: LucideIcon; badge?: "notifications" }> = [
  { href: "/home", label: "Home", icon: Home },
  { href: "/explore", label: "Explore", icon: Search },
  { href: "/notifications", label: "Notifications", icon: Bell, badge: "notifications" },
  { href: "/messages", label: "Messages", icon: Mail },
  { href: "/stories", label: "Stories", icon: Images },
  { href: "/groups", label: "Communities", icon: Users },
  { href: "/live", label: "Live", icon: Radio },
  { href: "/games", label: "Games", icon: Gamepad2 },
  { href: "/studio", label: "Studio", icon: Boxes },
  { href: "/ask-ai", label: "AskAI", icon: Sparkles },
];

const menuSections: Array<{ label: string; items: Array<{ href: string; label: string; icon: LucideIcon; description?: string }> }> = [
  {
    label: "Create",
    items: [
      { href: "/stories/create", label: "Story Studio", icon: Images, description: "Create layered photo and video stories" },
      { href: "/live/create", label: "Go live", icon: Radio, description: "Camera and desktop broadcasting" },
      { href: "/stickers", label: "Sticker Lab", icon: Sticker, description: "Create reusable stickers" },
    ],
  },
  {
    label: "Discover",
    items: [
      { href: "/events", label: "Events", icon: CalendarDays },
      { href: "/bookmarks", label: "Bookmarks", icon: Bookmark },
    ],
  },
  {
    label: "Flux Coins",
    items: [
      { href: "/gifts", label: "Gifts", icon: Gift },
      { href: "/premium", label: "Premium", icon: Crown },
      { href: "/rewards", label: "Rewards", icon: WandSparkles },
      { href: "/shop", label: "Shop", icon: ShoppingBag },
    ],
  },
  {
    label: "Account",
    items: [
      { href: "/settings", label: "Settings", icon: Settings },
      { href: "/help", label: "Help Center", icon: HelpCircle },
    ],
  },
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
        <Logo showWordmark className="hidden 2xl:flex" size={35} />
        <Logo showWordmark={false} className="2xl:hidden" size={35} />
      </Link>

      <nav className="flux8-sidebar-nav no-scrollbar" aria-label="Primary navigation">
        {primaryItems.map((item) => {
          const active = isNavPathActive(pathname, item.href);
          const Icon = item.icon;
          const badge = item.badge === "notifications" ? unread : 0;
          return (
            <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined} className={cn("flux8-sidebar-link", active && "is-active")}>
              <span className="flux8-sidebar-icon"><Icon className="h-[20px] w-[20px]" strokeWidth={active ? 2.45 : 2} />{badge > 0 ? <em>{badge > 99 ? "99+" : badge}</em> : null}</span>
              <strong>{item.label}</strong>
              {item.href === "/studio" ? <small>NEW</small> : null}
              {item.href === "/ask-ai" ? <small>AI</small> : null}
            </Link>
          );
        })}

        <Link href={profileHref} className={cn("flux8-sidebar-link", (pathname.startsWith("/profile") || pathname === profileHref) && "is-active")}>
          <span className="flux8-sidebar-icon"><User className="h-[20px] w-[20px]" /></span>
          <strong>Profile</strong>
        </Link>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" className="flux8-sidebar-link w-full">
              <span className="flux8-sidebar-icon"><Menu className="h-[20px] w-[20px]" /></span><strong>More</strong>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="right" align="end" className="flux8-more-menu max-h-[min(760px,calc(100dvh-24px))] w-[320px] overflow-y-auto p-2">
            <div className="flux8-more-intro"><Logo showWordmark={false} size={31} /><div><strong>Everything in Flux</strong><span>Creation, communities, coins and account tools</span></div></div>
            {menuSections.map((section, sectionIndex) => <div key={section.label}>{sectionIndex ? <DropdownMenuSeparator /> : null}<DropdownMenuLabel>{section.label}</DropdownMenuLabel>{section.items.map(({ href, label, icon: Icon, description }) => <DropdownMenuItem key={href} asChild><Link href={href} className="flux8-more-item"><span><Icon className="h-4 w-4" /></span><div><strong>{label}</strong>{description ? <small>{description}</small> : null}</div></Link></DropdownMenuItem>)}</div>)}
            {profile?.isAdmin ? <><DropdownMenuSeparator /><DropdownMenuItem asChild><Link href="/admin" className="flux8-more-item"><span className="danger"><Shield className="h-4 w-4" /></span><div><strong>Admin</strong><small>Moderation and platform controls</small></div></Link></DropdownMenuItem></> : null}
          </DropdownMenuContent>
        </DropdownMenu>
      </nav>

      <Dialog open={composeOpen} onOpenChange={setComposeOpen}>
        <DialogTrigger asChild><button type="button" className="flux8-sidebar-create"><PenSquare className="h-[19px] w-[19px]" /><span>Create post</span></button></DialogTrigger>
        <DialogContent className="flux8-dialog max-w-xl overflow-hidden p-0"><DialogHeader className="border-b border-border px-5 py-4"><DialogTitle>Create post</DialogTitle></DialogHeader><div className="p-4"><ComposeBox onSuccess={() => setComposeOpen(false)} autofocus /></div></DialogContent>
      </Dialog>

      {profile ? <Link href={profileHref} className="flux8-sidebar-profile"><UserAvatar user={profile} size="sm" decorations={profile.decorations} clickable={false} /><div><strong>{profile.displayName}</strong><span>@{profile.username || "…"}</span></div><em><Coins className="h-3.5 w-3.5" />{formatCount(profile.coins)}</em></Link> : null}
    </aside>
  );
}
