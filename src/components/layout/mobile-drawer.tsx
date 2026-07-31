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
  Calendar,
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
import { useAuth } from "@/contexts/auth-context";
import { cn, formatCount } from "@/lib/utils";
import { isNavPathActive, profilePath } from "@/lib/routes";

const sections: Array<{ label: string; items: Array<{ href: string; label: string; icon: LucideIcon; description?: string }> }> = [
  {
    label: "Core",
    items: [
      { href: "/ask-ai", label: "AskAI", icon: Sparkles, description: "One input for answers, search and creation" },
      { href: "/studio", label: "Studio", icon: Boxes, description: "Manually build games and websites" },
      { href: "/games", label: "Games", icon: Gamepad2, description: "Play and publish Flux projects" },
    ],
  },
  {
    label: "Create",
    items: [
      { href: "/stories/create", label: "Create Story", icon: Images, description: "Move, resize and rotate layers" },
      { href: "/live/create", label: "Go Live", icon: Radio, description: "Camera or supported desktop screen capture" },
      { href: "/stickers", label: "Sticker Lab", icon: Sticker },
    ],
  },
  {
    label: "Community",
    items: [
      { href: "/stories", label: "Stories", icon: Images },
      { href: "/live", label: "Live", icon: Radio },
      { href: "/groups", label: "Groups", icon: Users },
      { href: "/events", label: "Events", icon: Calendar },
    ],
  },
  {
    label: "Coins",
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
      { href: "/notifications", label: "Notifications", icon: Bell },
      { href: "/bookmarks", label: "Bookmarks", icon: Bookmark },
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
        <motion.button type="button" aria-label="Close menu" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/52 backdrop-blur-[2px]" onClick={onClose} />
        <motion.aside role="dialog" aria-modal="true" aria-label="Flux menu" initial={{ x: "-100%" }} animate={{ x: 0 }} exit={{ x: "-100%" }} transition={{ type: "spring", stiffness: 430, damping: 42 }} className="absolute inset-y-0 left-0 flex h-[100dvh] w-[min(91vw,380px)] flex-col overflow-hidden border-r border-border bg-background shadow-2xl">
          <header className="border-b border-border/75 px-5 pb-5 pt-[max(1rem,env(safe-area-inset-top))]">
            <div className="flex items-center justify-between"><div><p className="text-[9px] font-black uppercase tracking-[.16em] text-muted-foreground">Menu</p><h2 className="mt-1 text-2xl font-black tracking-[-.04em]">Flux</h2></div><button type="button" onClick={onClose} className="grid h-11 w-11 place-items-center rounded-full border border-border hover:bg-muted" aria-label="Close menu"><X className="h-5 w-5" /></button></div>
            {profile ? <Link href={profileHref} onClick={onClose} className="mt-5 flex items-center gap-3 rounded-2xl border border-border p-3"><UserAvatar user={profile} size="md" decorations={profile.decorations} clickable={false} /><div className="min-w-0 flex-1"><p className="truncate text-base font-black">{profile.displayName}</p><p className="truncate text-[11px] text-muted-foreground">@{profile.username}</p><p className="mt-1 text-[10px] text-muted-foreground"><strong className="text-foreground">{formatCount(profile.followersCount)}</strong> followers · <strong className="text-foreground">{formatCount(profile.coins)}</strong> coins</p></div></Link> : null}
          </header>

          <nav className="min-h-0 flex-1 overflow-y-auto px-3 py-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <DrawerLink href={profileHref} label="Profile" icon={User} active={pathname.startsWith("/profile")} onClose={onClose} />
            {sections.map((section) => <section key={section.label} className="mt-4"><p className="px-3 pb-2 text-[9px] font-black uppercase tracking-[.16em] text-muted-foreground">{section.label}</p><div className="space-y-1">{section.items.map((item) => <DrawerLink key={item.href} {...item} active={isNavPathActive(pathname, item.href)} onClose={onClose} />)}</div></section>)}
            {profile?.isAdmin ? <section className="mt-4"><p className="px-3 pb-2 text-[9px] font-black uppercase tracking-[.16em] text-muted-foreground">Owner</p><DrawerLink href="/admin" label="Admin" icon={Shield} description="Moderation and platform controls" active={isNavPathActive(pathname, "/admin")} onClose={onClose} /></section> : null}
          </nav>
        </motion.aside>
      </div> : null}
    </AnimatePresence>,
    document.body
  );
}

function DrawerLink({ href, label, icon: Icon, active, onClose, description }: { href: string; label: string; icon: LucideIcon; active: boolean; onClose: () => void; description?: string }) {
  return <Link href={href} onClick={onClose} className={cn("flex min-h-[56px] items-center gap-3 rounded-[18px] border border-transparent px-3 transition", active ? "border-border bg-muted font-black" : "hover:bg-muted/65")}><span className="grid h-10 w-10 shrink-0 place-items-center rounded-[14px] bg-muted"><Icon className="h-5 w-5" strokeWidth={active ? 2.5 : 2} /></span><span className="min-w-0 flex-1"><strong className="block text-[15px]">{label}</strong>{description ? <span className="mt-0.5 block truncate text-[10px] font-normal text-muted-foreground">{description}</span> : null}</span></Link>;
}
