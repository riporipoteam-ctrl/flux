"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
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
  const [mounted, setMounted] = useState(false);
  const profileHref = profile?.username
    ? `/${profile.username}`
    : "/settings/profile";

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;

    const scrollY = window.scrollY;
    const previous = {
      position: document.body.style.position,
      top: document.body.style.top,
      left: document.body.style.left,
      right: document.body.style.right,
      width: document.body.style.width,
      overflow: document.body.style.overflow,
    };

    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.left = "0";
    document.body.style.right = "0";
    document.body.style.width = "100%";
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.position = previous.position;
      document.body.style.top = previous.top;
      document.body.style.left = previous.left;
      document.body.style.right = previous.right;
      document.body.style.width = previous.width;
      document.body.style.overflow = previous.overflow;
      window.scrollTo(0, scrollY);
    };
  }, [open, onClose]);

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {open ? (
        <div className="fixed inset-0 z-[2147483000] isolate lg:hidden">
          <motion.button
            type="button"
            aria-label="Close menu"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="absolute inset-0 bg-black/55 backdrop-blur-[1px]"
            onClick={onClose}
          />
          <motion.aside
            role="dialog"
            aria-modal="true"
            aria-label="Navigation menu"
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{ type: "spring", stiffness: 380, damping: 36 }}
            className="absolute inset-y-0 left-0 flex h-[100dvh] w-[min(86vw,320px)] max-w-full flex-col overflow-hidden border-r border-border bg-background shadow-2xl overscroll-contain"
          >
            <div className="flex shrink-0 items-center justify-between border-b border-border px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
              <Logo href="/home" size={34} />
              <button
                type="button"
                onClick={onClose}
                className="rounded-full p-2 hover:bg-muted"
                aria-label="Close menu"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {profile ? (
              <Link
                href={profileHref}
                onClick={onClose}
                className="flex shrink-0 items-center gap-3 border-b border-border px-4 py-3"
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

            <nav className="min-h-0 flex-1 overflow-y-auto overscroll-contain py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] [-webkit-overflow-scrolling:touch]">
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
        </div>
      ) : null}
    </AnimatePresence>,
    document.body
  );
}
