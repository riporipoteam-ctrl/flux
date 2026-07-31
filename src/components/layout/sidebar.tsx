"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  Bell,
  Bookmark,
  Calendar,
  Coins,
  Gamepad2,
  Home,
  Images,
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
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const primaryItems = [
  { href: "/home", label: "Home", icon: Home },
  { href: "/explore", label: "Explore", icon: Search },
  { href: "/notifications", label: "Notifications", icon: Bell },
  { href: "/messages", label: "Messages", icon: Mail },
  { href: "/ask-ai", label: "AskAI", icon: Sparkles },
];

const moreSections = [
  {
    label: "Create and watch",
    items: [
      { href: "/stories", label: "Stories", icon: Images },
      { href: "/live", label: "Live", icon: Radio },
      { href: "/games", label: "Games", icon: Gamepad2 },
    ],
  },
  {
    label: "Communities",
    items: [
      { href: "/groups", label: "Groups", icon: Users },
      { href: "/events", label: "Events", icon: Calendar },
    ],
  },
  {
    label: "Your Flux",
    items: [
      { href: "/bookmarks", label: "Bookmarks", icon: Bookmark },
      { href: "/lists", label: "Lists", icon: List },
      { href: "/activity", label: "Activity", icon: Activity },
      { href: "/shop", label: "Shop", icon: ShoppingBag },
      { href: "/settings", label: "Settings", icon: Settings },
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
    const timer = window.setInterval(
      () => getUnreadCount(user.uid).then(setUnread).catch(() => undefined),
      45_000
    );
    return () => window.clearInterval(timer);
  }, [pathname, user]);

  return (
    <aside className="sticky top-0 hidden h-[100dvh] w-[76px] shrink-0 flex-col border-r border-border bg-sidebar px-2 py-3 lg:flex xl:w-[250px] xl:px-3">
      <Link href="/home" className="mb-3 flex h-12 items-center rounded-2xl px-2" aria-label="Flux home">
        <Logo showWordmark className="hidden xl:flex" size={37} />
        <Logo showWordmark={false} className="xl:hidden" size={37} />
      </Link>

      <nav className="no-scrollbar flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto py-1">
        {primaryItems.map((item) => {
          const active = isNavPathActive(pathname, item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "group relative flex min-h-[50px] items-center gap-4 rounded-2xl px-3 text-[15px] font-semibold transition-colors xl:text-[17px]",
                active ? "bg-foreground text-background" : "text-foreground hover:bg-muted"
              )}
            >
              <span className="relative grid h-8 w-8 shrink-0 place-items-center">
                <Icon className="h-[22px] w-[22px]" strokeWidth={active ? 2.5 : 2.05} />
                {item.href === "/notifications" && unread > 0 ? (
                  <span className={cn("absolute -right-1.5 -top-1.5 grid h-[19px] min-w-[19px] place-items-center rounded-full border-2 px-1 text-[9px] font-black", active ? "border-foreground bg-background text-foreground" : "border-sidebar bg-primary text-white")}>
                    {unread > 9 ? "9+" : unread}
                  </span>
                ) : null}
              </span>
              <span className="hidden xl:inline">{item.label}</span>
            </Link>
          );
        })}

        <Link
          href={profileHref}
          className={cn(
            "flex min-h-[50px] items-center gap-4 rounded-2xl px-3 text-[15px] font-semibold transition-colors xl:text-[17px]",
            pathname.startsWith("/profile") ? "bg-foreground text-background" : "hover:bg-muted"
          )}
        >
          <span className="grid h-8 w-8 place-items-center"><User className="h-[22px] w-[22px]" /></span>
          <span className="hidden xl:inline">Profile</span>
        </Link>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" className="flex min-h-[50px] items-center gap-4 rounded-2xl px-3 text-[15px] font-semibold transition-colors hover:bg-muted xl:text-[17px]">
              <span className="grid h-8 w-8 place-items-center"><MoreHorizontal className="h-[22px] w-[22px]" /></span>
              <span className="hidden xl:inline">More</span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="right" align="end" className="max-h-[min(620px,calc(100dvh-24px))] w-[280px] overflow-y-auto rounded-2xl border-border p-2 shadow-[0_20px_70px_rgba(0,0,0,.18)]">
            {moreSections.map((section, sectionIndex) => (
              <div key={section.label}>
                {sectionIndex ? <DropdownMenuSeparator /> : null}
                <DropdownMenuLabel className="px-3 py-2 text-[10px] font-black uppercase tracking-[.14em] text-muted-foreground">{section.label}</DropdownMenuLabel>
                {section.items.map(({ href, label, icon: Icon }) => (
                  <DropdownMenuItem key={href} asChild className="rounded-xl py-2.5 font-semibold">
                    <Link href={href} className="flex items-center gap-3"><Icon className="h-5 w-5" />{label}</Link>
                  </DropdownMenuItem>
                ))}
              </div>
            ))}
            {profile?.isAdmin ? (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild className="rounded-xl py-2.5 font-semibold">
                  <Link href="/admin" className="flex items-center gap-3"><Shield className="h-5 w-5" />Admin</Link>
                </DropdownMenuItem>
              </>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      </nav>

      <Dialog open={composeOpen} onOpenChange={setComposeOpen}>
        <DialogTrigger asChild>
          <Button className="mt-3 h-12 w-full rounded-2xl text-base font-black" size="lg">
            <PenSquare className="h-5 w-5 xl:hidden" />
            <span className="hidden xl:inline">Create post</span>
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-xl overflow-hidden p-0 sm:rounded-2xl">
          <DialogHeader className="border-b border-border px-5 py-4"><DialogTitle>Create post</DialogTitle></DialogHeader>
          <div className="p-4"><ComposeBox onSuccess={() => setComposeOpen(false)} autofocus /></div>
        </DialogContent>
      </Dialog>

      {profile ? (
        <Link href={profileHref} className="mt-3 rounded-2xl p-2 transition-colors hover:bg-muted">
          <div className="flex items-center gap-3">
            <UserAvatar user={profile} size="sm" decorations={profile.decorations} clickable={false} />
            <div className="hidden min-w-0 flex-1 xl:block">
              <p className="truncate text-sm font-black">{profile.displayName}</p>
              <p className="truncate text-xs text-muted-foreground">@{profile.username || "…"}</p>
            </div>
            <div className="hidden items-center gap-1 text-xs font-bold text-muted-foreground xl:flex"><Coins className="h-3.5 w-3.5" />{formatCount(profile.coins)}</div>
          </div>
        </Link>
      ) : null}
    </aside>
  );
}
