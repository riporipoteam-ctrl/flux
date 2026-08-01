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

const sections: Array<{ label: string; items: Array<{ href: string; label: string; icon: LucideIcon; description?: string }> }> = [
  {
    label: "Create and play",
    items: [
      { href: "/ask-ai", label: "AskAI", icon: Sparkles, description: "Agents, files, jobs and creation" },
      { href: "/studio", label: "Flux Studio", icon: Boxes, description: "Build and publish 3D worlds" },
      { href: "/games", label: "Games", icon: Gamepad2, description: "Play community projects" },
      { href: "/stories/create", label: "Create Story", icon: Images },
      { href: "/live/create", label: "Go Live", icon: Radio },
      { href: "/stickers", label: "Sticker Lab", icon: Sticker },
    ],
  },
  {
    label: "Community",
    items: [
      { href: "/stories", label: "Stories", icon: Images },
      { href: "/live", label: "Live", icon: Radio },
      { href: "/groups", label: "Communities", icon: Users },
      { href: "/events", label: "Events", icon: CalendarDays },
      { href: "/bookmarks", label: "Bookmarks", icon: Bookmark },
    ],
  },
  {
    label: "Coins and account",
    items: [
      { href: "/gifts", label: "Gifts", icon: Gift },
      { href: "/premium", label: "Premium", icon: Crown },
      { href: "/rewards", label: "Rewards", icon: WandSparkles },
      { href: "/shop", label: "Shop", icon: ShoppingBag },
      { href: "/notifications", label: "Notifications", icon: Bell },
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
      {open ? <div className="fixed inset-0 z-[2147483000] isolate lg:hidden">
        <motion.button type="button" aria-label="Close menu" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/50" onClick={onClose} />
        <motion.aside role="dialog" aria-modal="true" aria-label="Flux menu" initial={{ x: "-100%" }} animate={{ x: 0 }} exit={{ x: "-100%" }} transition={{ type: "spring", stiffness: 430, damping: 42 }} className="absolute inset-y-0 left-0 flex h-[100dvh] w-[min(88vw,360px)] flex-col overflow-hidden border-r border-[var(--flux-border)] bg-[var(--flux-surface)] shadow-2xl">
          <header className="border-b border-[var(--flux-border)] px-4 pb-4 pt-[max(1rem,env(safe-area-inset-top))]">
            <div className="flex items-center justify-between"><Logo showWordmark size={31} /><button type="button" onClick={onClose} className="grid h-9 w-9 place-items-center rounded-lg hover:bg-[var(--flux-surface-subtle)]" aria-label="Close menu"><X className="h-[18px] w-[18px]" /></button></div>
            {profile ? <Link href={profileHref} onClick={onClose} className="mt-4 grid grid-cols-[44px_minmax(0,1fr)] items-center gap-3 rounded-xl border border-[var(--flux-border)] bg-[var(--flux-surface-subtle)] p-3 text-inherit no-underline"><UserAvatar user={profile} size="md" decorations={profile.decorations} clickable={false} /><div className="min-w-0"><strong className="block truncate text-[13px]">{profile.displayName}</strong><span className="block truncate text-[9px] text-[var(--flux-muted)]">@{profile.username}</span><small className="mt-1 block text-[8px] text-[var(--flux-muted)]">{formatCount(profile.followersCount)} followers · {formatCount(profile.coins)} coins</small></div></Link> : null}
          </header>

          <nav className="min-h-0 flex-1 overflow-y-auto px-2 py-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <DrawerLink href={profileHref} label="Profile" icon={User} active={pathname.startsWith("/profile") || pathname === profileHref} onClose={onClose} />
            {sections.map((section) => <section key={section.label} className="mt-4"><p className="px-3 pb-1.5 text-[8px] font-extrabold uppercase tracking-[.13em] text-[var(--flux-muted)]">{section.label}</p><div className="space-y-0.5">{section.items.map((item) => <DrawerLink key={item.href} {...item} active={isNavPathActive(pathname, item.href)} onClose={onClose} />)}</div></section>)}
            {profile?.isAdmin ? <section className="mt-4"><p className="px-3 pb-1.5 text-[8px] font-extrabold uppercase tracking-[.13em] text-[var(--flux-muted)]">Owner</p><DrawerLink href="/admin" label="Admin" icon={Shield} description="Moderation and platform controls" active={isNavPathActive(pathname, "/admin")} onClose={onClose} /></section> : null}
          </nav>
        </motion.aside>
      </div> : null}
    </AnimatePresence>,
    document.body
  );
}

function DrawerLink({ href, label, icon: Icon, active, onClose, description }: { href: string; label: string; icon: LucideIcon; active: boolean; onClose: () => void; description?: string }) {
  return <Link href={href} onClick={onClose} className={cn("grid min-h-[45px] grid-cols-[34px_minmax(0,1fr)] items-center gap-8 rounded-lg px-2.5 text-inherit no-underline transition-colors", active ? "bg-[var(--flux-brand-soft)] text-[var(--flux-brand)]" : "hover:bg-[var(--flux-surface-subtle)]")}><span className="grid h-8 w-8 place-items-center"><Icon className="h-[18px] w-[18px]" strokeWidth={active ? 2.45 : 2} /></span><span className="min-w-0"><strong className="block truncate text-[11px]">{label}</strong>{description ? <small className="mt-0.5 block truncate text-[8px] font-normal text-[var(--flux-muted)]">{description}</small> : null}</span></Link>;
}
