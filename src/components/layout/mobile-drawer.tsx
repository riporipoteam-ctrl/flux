"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  Bell,
  Bookmark,
  Boxes,
  CalendarDays,
  Crown,
  Gamepad2,
  Gift,
  HelpCircle,
  Images,
  Mail,
  Radio,
  Settings,
  Shield,
  ShoppingBag,
  Sparkles,
  Sticker,
  User,
  Users,
  WandSparkles,
  X,
  type LucideIcon,
} from "lucide-react";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Logo } from "@/components/shared/logo";
import { useAuth } from "@/contexts/auth-context";
import { cn, formatCount } from "@/lib/utils";
import { isNavPathActive, profilePath } from "@/lib/routes";

const release = process.env.NEXT_PUBLIC_RELEASE_SHA?.slice(0, 7) || "local";

const sections: Array<{ label: string; items: Array<{ href: string; label: string; icon: LucideIcon; description?: string }> }> = [
  {
    label: "Create and play",
    items: [
      { href: "/ask-ai", label: "AskAI", icon: Sparkles, description: "Ask, search and create" },
      { href: "/studio", label: "Flux Studio", icon: Boxes, description: "Build and publish games" },
      { href: "/games", label: "Games", icon: Gamepad2, description: "Play the Flux catalog" },
      { href: "/stories/create", label: "Create Story", icon: Images },
      { href: "/live/create", label: "Go Live", icon: Radio },
      { href: "/stickers", label: "Sticker Lab", icon: Sticker },
    ],
  },
  {
    label: "Community",
    items: [
      { href: "/messages", label: "Messages", icon: Mail, description: "Chats, groups and calls" },
      { href: "/stories", label: "Stories", icon: Images },
      { href: "/live", label: "Live", icon: Radio },
      { href: "/groups", label: "Communities", icon: Users },
      { href: "/events", label: "Events", icon: CalendarDays },
      { href: "/bookmarks", label: "Bookmarks", icon: Bookmark },
    ],
  },
  {
    label: "Account",
    items: [
      { href: "/notifications", label: "Notifications", icon: Bell },
      { href: "/gifts", label: "Gifts", icon: Gift },
      { href: "/premium", label: "Premium", icon: Crown },
      { href: "/rewards", label: "Rewards", icon: WandSparkles },
      { href: "/shop", label: "Shop", icon: ShoppingBag },
      { href: "/settings", label: "Settings and privacy", icon: Settings },
      { href: "/help", label: "Help Center", icon: HelpCircle },
    ],
  },
];

export function MobileDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const pathname = usePathname();
  const { profile } = useAuth();
  const [mounted, setMounted] = useState(false);
  const profileHref = profilePath(profile?.username);

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (!open) return;
    const scrollY = window.scrollY;
    const previous = document.body.style.cssText;
    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.insetInline = "0";
    document.body.style.width = "100%";
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.cssText = previous;
      window.scrollTo(0, scrollY);
    };
  }, [open, onClose]);

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {open ? (
        <div className="fixed inset-0 z-[2147483000] isolate lg:hidden">
          <motion.button type="button" aria-label="Close menu" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/45 backdrop-blur-[2px]" onClick={onClose} />
          <motion.aside
            role="dialog"
            aria-modal="true"
            aria-label="Flux menu"
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{ type: "spring", stiffness: 420, damping: 42 }}
            className="absolute inset-y-0 left-0 flex h-[100dvh] w-[min(88vw,360px)] flex-col overflow-hidden border-r border-border bg-background text-foreground shadow-2xl"
          >
            <header className="border-b border-border px-4 pb-4 pt-[max(1rem,env(safe-area-inset-top))]">
              <div className="flex items-center justify-between">
                <Logo showWordmark size={32} />
                <button type="button" onClick={onClose} className="grid h-10 w-10 place-items-center rounded-full transition hover:bg-muted" aria-label="Close menu"><X className="h-5 w-5" /></button>
              </div>
              {profile ? (
                <Link href={profileHref} onClick={onClose} className="mt-5 grid grid-cols-[48px_minmax(0,1fr)] items-center gap-3 text-inherit no-underline">
                  <UserAvatar user={profile} size="md" decorations={profile.decorations} clickable={false} />
                  <div className="min-w-0"><strong className="block truncate text-[15px]">{profile.displayName}</strong><span className="block truncate text-xs text-muted-foreground">@{profile.username}</span><small className="mt-1 block text-[10px] text-muted-foreground">{formatCount(profile.followersCount)} followers · {formatCount(profile.coins)} coins</small></div>
                </Link>
              ) : null}
            </header>

            <nav className="min-h-0 flex-1 overflow-y-auto px-2 py-3">
              <DrawerLink href={profileHref} label="Profile" icon={User} active={pathname.startsWith("/profile") || pathname === profileHref} onClose={onClose} />
              {sections.map((section) => (
                <section key={section.label} className="mt-5">
                  <p className="px-4 pb-2 text-[10px] font-black uppercase tracking-[.16em] text-muted-foreground">{section.label}</p>
                  <div>{section.items.map((item) => <DrawerLink key={item.href} {...item} active={isNavPathActive(pathname, item.href)} onClose={onClose} />)}</div>
                </section>
              ))}
              {profile?.isAdmin ? <section className="mt-5"><p className="px-4 pb-2 text-[10px] font-black uppercase tracking-[.16em] text-muted-foreground">Owner</p><DrawerLink href="/admin" label="Admin" icon={Shield} description="Moderation and platform controls" active={isNavPathActive(pathname, "/admin")} onClose={onClose} /></section> : null}
            </nav>
            <footer className="border-t border-border px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 text-[10px] font-bold uppercase tracking-[.16em] text-muted-foreground">Flux Aurora · {release}</footer>
          </motion.aside>
        </div>
      ) : null}
    </AnimatePresence>,
    document.body
  );
}

function DrawerLink({ href, label, icon: Icon, active, onClose, description }: { href: string; label: string; icon: LucideIcon; active: boolean; onClose: () => void; description?: string }) {
  return (
    <Link href={href} onClick={onClose} className={cn("grid min-h-[52px] grid-cols-[40px_minmax(0,1fr)] items-center gap-3 rounded-full px-3 text-inherit no-underline transition hover:bg-muted", active && "bg-muted font-black")}>
      <span className="grid h-9 w-9 place-items-center"><Icon className="h-[21px] w-[21px]" strokeWidth={active ? 2.55 : 2} /></span>
      <span className="min-w-0"><strong className="block truncate text-[14px]">{label}</strong>{description ? <small className="mt-0.5 block truncate text-[10px] font-normal text-muted-foreground">{description}</small> : null}</span>
    </Link>
  );
}
