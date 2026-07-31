"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import {
  Activity,
  Bell,
  Bookmark,
  Calendar,
  Coins,
  Gamepad2,
  Home,
  List,
  Mail,
  MoreHorizontal,
  PenSquare,
  Radio,
  Search,
  Settings,
  Shield,
  ShoppingBag,
  Sparkles,
  User,
  Users,
  Images,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Logo } from "@/components/shared/logo";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Button } from "@/components/ui/button";
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const primaryItems = [
  { href: "/home", label: "Home", icon: Home },
  { href: "/explore", label: "Explore", icon: Search },
  { href: "/notifications", label: "Notifications", icon: Bell },
  { href: "/messages", label: "Messages", icon: Mail },
  { href: "/stories", label: "Stories", icon: Images },
  { href: "/live", label: "Live", icon: Radio },
  { href: "/games", label: "Games", icon: Gamepad2 },
];

const moreItems = [
  { href: "/groups", label: "Groups", icon: Users },
  { href: "/events", label: "Events", icon: Calendar },
  { href: "/bookmarks", label: "Bookmarks", icon: Bookmark },
  { href: "/lists", label: "Lists", icon: List },
  { href: "/activity", label: "Activity", icon: Activity },
  { href: "/shop", label: "Shop", icon: ShoppingBag },
  { href: "/ask-ai", label: "AskAI", icon: Sparkles },
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
    <aside className="sticky top-0 hidden h-[100dvh] w-[78px] shrink-0 flex-col border-r border-border bg-sidebar px-2 py-3 lg:flex xl:w-[270px] xl:px-4">
      <Link href="/home" className="mb-3 flex h-12 items-center px-2" aria-label="Flux home">
        <Logo showWordmark className="hidden xl:flex" size={38} />
        <Logo showWordmark={false} className="xl:hidden" size={38} />
      </Link>

      <nav className="no-scrollbar flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto py-1">
        {primaryItems.map((item) => {
          const active = isNavPathActive(pathname, item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "group relative flex min-h-12 items-center gap-4 rounded-full px-3 text-[15px] font-medium transition-colors hover:bg-muted/75 xl:text-[18px]",
                active ? "font-bold text-foreground" : "text-foreground"
              )}
            >
              <span className="relative grid h-8 w-8 shrink-0 place-items-center">
                <Icon className={cn("h-[23px] w-[23px]", active && "fill-foreground/10")} strokeWidth={active ? 2.55 : 2.05} />
                {item.href === "/notifications" && unread > 0 ? (
                  <span className="absolute -right-1 -top-1 grid h-[18px] min-w-[18px] place-items-center rounded-full border-2 border-sidebar bg-primary px-1 text-[9px] font-bold text-white">
                    {unread > 9 ? "9+" : unread}
                  </span>
                ) : null}
              </span>
              <span className="hidden xl:inline">{item.label}</span>
              {active ? (
                <motion.span layoutId="sidebar-active-dot" className="absolute right-3 hidden h-1.5 w-1.5 rounded-full bg-primary xl:block" />
              ) : null}
            </Link>
          );
        })}

        <Link
          href={profileHref}
          className={cn(
            "flex min-h-12 items-center gap-4 rounded-full px-3 text-[15px] font-medium transition-colors hover:bg-muted/75 xl:text-[18px]",
            pathname.startsWith("/profile") && "font-bold"
          )}
        >
          <span className="grid h-8 w-8 place-items-center"><User className="h-[23px] w-[23px]" /></span>
          <span className="hidden xl:inline">Profile</span>
        </Link>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" className="flex min-h-12 items-center gap-4 rounded-full px-3 text-[15px] font-medium transition-colors hover:bg-muted/75 xl:text-[18px]">
              <span className="grid h-8 w-8 place-items-center"><MoreHorizontal className="h-[23px] w-[23px]" /></span>
              <span className="hidden xl:inline">More</span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="right" align="end" className="w-60 rounded-2xl p-2 shadow-xl">
            {moreItems.map(({ href, label, icon: Icon }) => (
              <DropdownMenuItem key={href} asChild className="rounded-xl py-2.5">
                <Link href={href} className="flex items-center gap-3"><Icon className="h-5 w-5" />{label}</Link>
              </DropdownMenuItem>
            ))}
            {profile?.isAdmin ? (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild className="rounded-xl py-2.5">
                  <Link href="/admin" className="flex items-center gap-3"><Shield className="h-5 w-5" />Admin</Link>
                </DropdownMenuItem>
              </>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      </nav>

      <Dialog open={composeOpen} onOpenChange={setComposeOpen}>
        <DialogTrigger asChild>
          <Button className="mt-3 h-12 w-full rounded-full text-base font-bold" size="lg">
            <PenSquare className="h-5 w-5 xl:hidden" />
            <span className="hidden xl:inline">Post</span>
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-xl overflow-hidden p-0 sm:rounded-2xl">
          <DialogHeader className="border-b border-border px-5 py-4"><DialogTitle>Create post</DialogTitle></DialogHeader>
          <div className="p-4"><ComposeBox onSuccess={() => setComposeOpen(false)} autofocus /></div>
        </DialogContent>
      </Dialog>

      {profile ? (
        <Link href={profileHref} className="mt-3 rounded-full p-2 transition-colors hover:bg-muted/75">
          <div className="flex items-center gap-3">
            <UserAvatar user={profile} size="sm" decorations={profile.decorations} clickable={false} />
            <div className="hidden min-w-0 flex-1 xl:block">
              <p className="truncate text-sm font-bold">{profile.displayName}</p>
              <p className="truncate text-xs text-muted-foreground">@{profile.username || "…"}</p>
            </div>
            <div className="hidden items-center gap-1 text-xs font-semibold text-muted-foreground xl:flex"><Coins className="h-3.5 w-3.5" />{formatCount(profile.coins)}</div>
          </div>
        </Link>
      ) : null}
    </aside>
  );
}
