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
  { href: "/stories", label: "Stories", icon: Images },
  { href: "/groups", label: "Communities", icon: Users },
  { href: "/games", label: "Games", icon: Gamepad2 },
  { href: "/ask-ai", label: "AskAI", icon: Sparkles },
  { href: "/studio", label: "Studio", icon: Boxes },
  { href: "/messages", label: "Messages", icon: Mail },
  { href: "/notifications", label: "Notifications", icon: Bell, badge: "notifications" },
];

const menuSections: Array<{ label: string; items: Array<{ href: string; label: string; icon: LucideIcon; description?: string }> }> = [
  {
    label: "Create",
    items: [
      { href: "/stories/create", label: "Create Story", icon: Images, description: "Media, text, stickers and music" },
      { href: "/live/create", label: "Go Live", icon: Radio, description: "Camera or desktop screen capture" },
      { href: "/stickers", label: "Sticker Lab", icon: Sticker, description: "Reusable Flux stickers" },
    ],
  },
  {
    label: "Discover",
    items: [
      { href: "/live", label: "Live", icon: Radio },
      { href: "/events", label: "Events", icon: CalendarDays },
      { href: "/bookmarks", label: "Bookmarks", icon: Bookmark },
    ],
  },
  {
    label: "Coins and rewards",
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
    <aside className="flux-sidebar sticky top-0 hidden h-[100dvh] w-[82px] shrink-0 flex-col lg:flex xl:w-[256px]">
      <Link href="/home" className="flux-sidebar-brand" aria-label="Flux home">
        <Logo showWordmark className="hidden xl:flex" size={36} />
        <Logo showWordmark={false} className="xl:hidden" size={36} />
      </Link>

      <nav className="flux-sidebar-nav no-scrollbar">
        {primaryItems.map((item) => {
          const active = isNavPathActive(pathname, item.href);
          const Icon = item.icon;
          const badge = item.badge === "notifications" ? unread : 0;
          return (
            <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined} className={cn("flux-nav-link", active && "is-active")}>
              <span><Icon className="h-[21px] w-[21px]" strokeWidth={active ? 2.45 : 2} />{badge > 0 ? <em>{badge > 99 ? "99+" : badge}</em> : null}</span>
              <strong>{item.label}</strong>
            </Link>
          );
        })}

        <Link href={profileHref} className={cn("flux-nav-link", (pathname.startsWith("/profile") || pathname === profileHref) && "is-active")}>
          <span><User className="h-[21px] w-[21px]" /></span><strong>Profile</strong>
        </Link>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" className="flux-nav-link w-full">
              <span><Menu className="h-[21px] w-[21px]" /></span><strong>More</strong>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="right" align="end" className="flux-more-menu max-h-[min(720px,calc(100dvh-24px))] w-[310px] overflow-y-auto p-2">
            <div className="flux-more-intro"><Logo showWordmark={false} size={29} /><div><strong>Flux menu</strong><span>Creation, rewards and account tools</span></div></div>
            {menuSections.map((section, sectionIndex) => <div key={section.label}>{sectionIndex ? <DropdownMenuSeparator /> : null}<DropdownMenuLabel>{section.label}</DropdownMenuLabel>{section.items.map(({ href, label, icon: Icon, description }) => <DropdownMenuItem key={href} asChild><Link href={href} className="flux-more-item"><span><Icon className="h-4 w-4" /></span><div><strong>{label}</strong>{description ? <small>{description}</small> : null}</div></Link></DropdownMenuItem>)}</div>)}
            {profile?.isAdmin ? <><DropdownMenuSeparator /><DropdownMenuItem asChild><Link href="/admin" className="flux-more-item"><span className="danger"><Shield className="h-4 w-4" /></span><div><strong>Admin</strong><small>Moderation and platform controls</small></div></Link></DropdownMenuItem></> : null}
          </DropdownMenuContent>
        </DropdownMenu>
      </nav>

      <Dialog open={composeOpen} onOpenChange={setComposeOpen}>
        <DialogTrigger asChild><button type="button" className="flux-compose-button"><PenSquare className="h-5 w-5" /><span>Post</span></button></DialogTrigger>
        <DialogContent className="max-w-xl overflow-hidden p-0 sm:rounded-2xl"><DialogHeader className="border-b border-border px-5 py-4"><DialogTitle>Create post</DialogTitle></DialogHeader><div className="p-4"><ComposeBox onSuccess={() => setComposeOpen(false)} autofocus /></div></DialogContent>
      </Dialog>

      {profile ? <Link href={profileHref} className="flux-sidebar-profile"><UserAvatar user={profile} size="sm" decorations={profile.decorations} clickable={false} /><div><strong>{profile.displayName}</strong><span>@{profile.username || "…"}</span></div><em><Coins className="h-3.5 w-3.5" />{formatCount(profile.coins)}</em></Link> : null}
    </aside>
  );
}
