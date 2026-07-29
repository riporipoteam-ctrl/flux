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
  PenSquare,
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ComposeBox } from "@/components/posts/compose-box";
import { getUnreadCount } from "@/services/notifications";

const items = [
  { href: "/home", label: "Home", icon: Home },
  { href: "/explore", label: "Explore", icon: Search },
  { href: "/games", label: "Flux Plays", icon: Gamepad2, featured: true },
  { href: "/notifications", label: "Notifications", icon: Bell },
  { href: "/messages", label: "Messages", icon: Mail },
  { href: "/groups", label: "Groups", icon: Users },
  { href: "/events", label: "Events", icon: Calendar },
  { href: "/bookmarks", label: "Bookmarks", icon: Bookmark },
  { href: "/activity", label: "Activity", icon: Activity },
  { href: "/lists", label: "Lists", icon: List },
  { href: "/shop", label: "Shop", icon: ShoppingBag },
  { href: "/ask-ai", label: "AskAI", icon: Sparkles },
  { href: "/admin", label: "Admin", icon: Shield, adminOnly: true },
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
    const timer = window.setInterval(() => {
      getUnreadCount(user.uid).then(setUnread).catch(() => undefined);
    }, 45000);
    return () => window.clearInterval(timer);
  }, [pathname, user]);

  return (
    <aside className="sticky top-0 hidden h-[100dvh] w-[82px] shrink-0 flex-col border-r border-border/70 bg-sidebar px-2.5 py-4 backdrop-blur-2xl lg:flex xl:w-[286px] xl:px-4">
      <div className="mb-4 flex items-center justify-between px-2">
        <Logo showWordmark className="hidden xl:flex" size={40} />
        <Logo showWordmark={false} className="xl:hidden" size={40} />
        <span className="hidden rounded-full border border-primary/20 bg-primary/10 px-2 py-1 text-[9px] font-black uppercase tracking-[0.18em] text-primary xl:inline">2.0</span>
      </div>

      <nav className="no-scrollbar flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto py-1">
        {items.map((item) => {
          if ("adminOnly" in item && item.adminOnly && !profile?.isAdmin) return null;
          const active = isNavPathActive(pathname, item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "nav-item group relative flex min-h-11 items-center gap-3 overflow-hidden rounded-[17px] px-3 py-2.5 text-[14px] font-bold",
                active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
                item.featured && !active && "text-primary"
              )}
            >
              {active ? (
                <motion.span
                  layoutId="nav-pill"
                  className="absolute inset-0 rounded-[17px] border border-primary/15 bg-gradient-to-r from-primary/18 via-primary/10 to-cyan-400/8 shadow-[inset_0_1px_0_rgba(255,255,255,.06)]"
                  transition={{ type: "spring", stiffness: 390, damping: 34 }}
                />
              ) : (
                <span className="absolute inset-0 rounded-[17px] opacity-0 transition duration-200 group-hover:bg-muted/70 group-hover:opacity-100" />
              )}
              <span className={cn("relative z-10 grid h-8 w-8 shrink-0 place-items-center rounded-xl transition", active && "bg-primary text-white shadow-[0_8px_24px_rgba(91,77,245,.28)]", item.featured && !active && "bg-primary/10")}>
                <Icon className="h-[18px] w-[18px]" strokeWidth={active ? 2.5 : 2.1} />
              </span>
              <span className="relative z-10 hidden flex-1 xl:inline">{item.label}</span>
              {item.href === "/notifications" && unread > 0 ? (
                <span className="relative z-10 ml-auto hidden h-5 min-w-5 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-cyan-400 px-1.5 text-[10px] font-black text-white xl:flex">{unread > 9 ? "9+" : unread}</span>
              ) : item.featured ? (
                <span className="relative z-10 ml-auto hidden rounded-full bg-primary/10 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-primary xl:inline">New</span>
              ) : null}
            </Link>
          );
        })}

        <Link
          href={profileHref}
          className={cn(
            "nav-item group relative flex min-h-11 items-center gap-3 rounded-[17px] px-3 py-2.5 text-[14px] font-bold",
            pathname.startsWith("/profile") ? "text-foreground" : "text-muted-foreground hover:text-foreground"
          )}
        >
          <span className="absolute inset-0 rounded-[17px] opacity-0 transition group-hover:bg-muted/70 group-hover:opacity-100" />
          <span className="relative z-10 grid h-8 w-8 place-items-center rounded-xl"><User className="h-[18px] w-[18px]" /></span>
          <span className="relative z-10 hidden xl:inline">Profile</span>
        </Link>
      </nav>

      <Dialog open={composeOpen} onOpenChange={setComposeOpen}>
        <DialogTrigger asChild>
          <Button variant="flux" className="mt-3 w-full rounded-[18px]" size="lg">
            <PenSquare className="h-4 w-4" />
            <span className="hidden xl:inline">Create post</span>
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-xl overflow-hidden p-0 sm:rounded-[30px]">
          <DialogHeader className="border-b border-border px-5 py-4"><DialogTitle>Create post</DialogTitle></DialogHeader>
          <div className="p-4"><ComposeBox onSuccess={() => setComposeOpen(false)} autofocus /></div>
        </DialogContent>
      </Dialog>

      {profile ? (
        <Link href={profileHref} className="mt-3 block">
          <motion.div whileHover={{ y: -2 }} className="relative flex items-center gap-3 overflow-hidden rounded-[20px] border border-border/80 bg-card/70 p-2.5 shadow-soft backdrop-blur-xl xl:p-3">
            <span className="absolute -right-8 -top-8 h-20 w-20 rounded-full bg-primary/10 blur-2xl" />
            <UserAvatar user={profile} size="sm" animate ring decorations={profile.decorations} clickable={false} />
            <div className="hidden min-w-0 flex-1 xl:block">
              <p className="truncate text-sm font-black">{profile.displayName}</p>
              <p className="truncate text-[11px] font-medium text-muted-foreground">@{profile.username || "…"}</p>
            </div>
            <div className="relative hidden items-center gap-1 rounded-full border border-primary/15 bg-primary/10 px-2 py-1 text-[10px] font-black text-primary xl:flex"><Coins className="h-3.5 w-3.5" />{formatCount(profile.coins)}</div>
          </motion.div>
        </Link>
      ) : null}
    </aside>
  );
}
