"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
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
  Bookmark,
  Activity,
  List,
  X,
  User,
  Shield,
} from "lucide-react";
import { Logo } from "@/components/shared/logo";
import { UserAvatar } from "@/components/shared/user-avatar";
import { useAuth } from "@/contexts/auth-context";
import { cn, formatCount } from "@/lib/utils";

const links = [
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
  { href: "/settings", label: "Settings", icon: Settings },
];

export function MobileDrawer({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const pathname = usePathname();
  const { profile } = useAuth();
  const profileHref = profile?.username
    ? `/${profile.username}`
    : "/settings/profile";

  return (
    <AnimatePresence>
      {open ? (
        <>
          <motion.button
            type="button"
            aria-label="Close menu"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-black/50 lg:hidden"
            onClick={onClose}
          />
          <motion.aside
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{ type: "spring", stiffness: 380, damping: 36 }}
            className="fixed bottom-0 left-0 top-0 z-[70] flex w-[min(86vw,320px)] flex-col border-r border-border bg-background lg:hidden"
          >
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <Logo href="/home" size={34} />
              <button
                type="button"
                onClick={onClose}
                className="rounded-full p-2 hover:bg-muted"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {profile ? (
              <Link
                href={profileHref}
                onClick={onClose}
                className="flex items-center gap-3 border-b border-border px-4 py-3"
              >
                <UserAvatar user={profile} decorations={profile.decorations} />
                <div className="min-w-0">
                  <p className="truncate font-bold">{profile.displayName}</p>
                  <p className="truncate text-sm text-muted-foreground">
                    @{profile.username}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    <span className="font-bold text-foreground">
                      {formatCount(profile.followingCount)}
                    </span>{" "}
                    Following ·{" "}
                    <span className="font-bold text-foreground">
                      {formatCount(profile.followersCount)}
                    </span>{" "}
                    Followers
                  </p>
                </div>
              </Link>
            ) : null}

            <nav className="flex-1 overflow-y-auto py-2">
              {links.map((item) => {
                const Icon = item.icon;
                const active =
                  pathname === item.href ||
                  pathname.startsWith(item.href + "/");
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onClose}
                    className={cn(
                      "flex items-center gap-4 px-5 py-3 text-[17px] font-bold transition",
                      active ? "bg-muted" : "hover:bg-muted/70"
                    )}
                  >
                    <Icon className="h-6 w-6" strokeWidth={active ? 2.4 : 2} />
                    {item.label}
                  </Link>
                );
              })}
              <Link
                href={profileHref}
                onClick={onClose}
                className="flex items-center gap-4 px-5 py-3 text-[17px] font-bold hover:bg-muted/70"
              >
                <User className="h-6 w-6" />
                Profile
              </Link>
              {profile?.isAdmin ? (
                <Link
                  href="/admin"
                  onClick={onClose}
                  className="flex items-center gap-4 px-5 py-3 text-[17px] font-bold hover:bg-muted/70"
                >
                  <Shield className="h-6 w-6" />
                  Admin
                </Link>
              ) : null}
            </nav>
          </motion.aside>
        </>
      ) : null}
    </AnimatePresence>
  );
}
