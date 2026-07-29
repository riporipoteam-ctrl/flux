"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import {
  Home,
  Search,
  Bell,
  Mail,
  Users,
  Calendar,
  ShoppingBag,
  Sparkles,
  Settings,
  User,
  PenSquare,
  Coins,
  Shield,
  Bookmark,
  Activity,
  List,
} from "lucide-react";
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
import { useEffect, useState } from "react";
import { getUnreadCount } from "@/services/notifications";

const items = [
  { href: "/home", label: "Home", icon: Home },
  { href: "/explore", label: "Explore", icon: Search },
  { href: "/notifications", label: "Notifications", icon: Bell },
  { href: "/messages", label: "Messages", icon: Mail },
  { href: "/bookmarks", label: "Bookmarks", icon: Bookmark },
  { href: "/activity", label: "Activity", icon: Activity },
  { href: "/lists", label: "Lists", icon: List },
  { href: "/groups", label: "Groups", icon: Users },
  { href: "/events", label: "Events", icon: Calendar },
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
    getUnreadCount(user.uid)
      .then(setUnread)
      .catch(() => setUnread(0));
    const t = setInterval(() => {
      getUnreadCount(user.uid)
        .then(setUnread)
        .catch(() => undefined);
    }, 45000);
    return () => clearInterval(t);
  }, [user, pathname]);

  return (
    <aside className="sticky top-0 hidden h-screen w-[76px] shrink-0 flex-col border-r border-border/70 bg-sidebar px-2 py-4 backdrop-blur-xl lg:flex xl:w-[272px] xl:px-4">
      <div className="mb-5 px-2">
        <Logo showWordmark className="hidden xl:flex" size={40} />
        <Logo showWordmark={false} className="xl:hidden" size={40} />
      </div>

      <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto no-scrollbar">
        {items.map((item) => {
          if ("adminOnly" in item && item.adminOnly && !profile?.isAdmin) {
            return null;
          }
          const active = isNavPathActive(pathname, item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "nav-item group relative flex items-center gap-3 rounded-2xl px-3 py-2.5 text-[15px] font-semibold",
                active
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {active ? (
                <motion.span
                  layoutId="nav-pill"
                  className="absolute inset-0 rounded-2xl bg-accent shadow-sm"
                  transition={{ type: "spring", stiffness: 380, damping: 32 }}
                />
              ) : (
                <span className="absolute inset-0 rounded-2xl opacity-0 transition group-hover:bg-muted/70 group-hover:opacity-100" />
              )}
              <Icon
                className={cn(
                  "relative z-10 h-5 w-5 shrink-0 transition-transform duration-200 group-hover:scale-110",
                  active && "text-primary"
                )}
                strokeWidth={active ? 2.4 : 2}
              />
              <span className="relative z-10 hidden xl:inline">{item.label}</span>
              {item.href === "/notifications" && unread > 0 ? (
                <span className="relative z-10 ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                  {unread > 9 ? "9+" : unread}
                </span>
              ) : active ? (
                <motion.span
                  layoutId="nav-dot"
                  className="relative z-10 ml-auto hidden h-1.5 w-1.5 rounded-full bg-primary xl:block"
                />
              ) : null}
            </Link>
          );
        })}

        <Link
          href={profileHref}
          className={cn(
            "nav-item group relative flex items-center gap-3 rounded-2xl px-3 py-2.5 text-[15px] font-semibold",
            pathname.startsWith("/profile")
              ? "text-foreground"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <span className="absolute inset-0 rounded-2xl opacity-0 transition group-hover:bg-muted/70 group-hover:opacity-100" />
          <User className="relative z-10 h-5 w-5 shrink-0 transition-transform group-hover:scale-110" />
          <span className="relative z-10 hidden xl:inline">Profile</span>
        </Link>
      </nav>

      <Dialog open={composeOpen} onOpenChange={setComposeOpen}>
        <DialogTrigger asChild>
          <Button className="mt-3 w-full shadow-glow" size="lg">
            <PenSquare className="h-4 w-4" />
            <span className="hidden xl:inline">Post</span>
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-xl overflow-hidden p-0 sm:rounded-3xl">
          <DialogHeader className="border-b border-border px-5 py-4">
            <DialogTitle>Create post</DialogTitle>
          </DialogHeader>
          <div className="p-4">
            <ComposeBox onSuccess={() => setComposeOpen(false)} autofocus />
          </div>
        </DialogContent>
      </Dialog>

      {profile ? (
        <motion.div
          whileHover={{ y: -2 }}
          className="mt-4 flex items-center gap-3 rounded-2xl border border-border/80 bg-card/90 p-2.5 shadow-soft xl:p-3"
        >
          <UserAvatar
            user={profile}
            size="sm"
            animate
            ring
            decorations={profile.decorations}
          />
          <div className="hidden min-w-0 flex-1 xl:block">
            <p className="truncate text-sm font-semibold">{profile.displayName}</p>
            <p className="truncate text-xs text-muted-foreground">
              @{profile.username || "…"}
            </p>
          </div>
          <div className="hidden items-center gap-1 rounded-full bg-accent px-2 py-1 text-xs font-bold text-primary xl:flex">
            <Coins className="h-3.5 w-3.5" />
            {formatCount(profile.coins)}
          </div>
        </motion.div>
      ) : null}
    </aside>
  );
}
