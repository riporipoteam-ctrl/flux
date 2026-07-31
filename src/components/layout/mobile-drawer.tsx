"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  Activity,
  Bookmark,
  Boxes,
  Calendar,
  Crown,
  Gamepad2,
  Gift,
  Headphones,
  HelpCircle,
  Images,
  List,
  Plus,
  Radio,
  Settings,
  Shield,
  ShoppingBag,
  Sparkles,
  Sticker,
  User,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { UserAvatar } from "@/components/shared/user-avatar";
import { useAuth } from "@/contexts/auth-context";
import { cn, formatCount } from "@/lib/utils";
import { isNavPathActive, profilePath } from "@/lib/routes";

const sections: Array<{ label: string; items: Array<{ href: string; label: string; icon: LucideIcon; description?: string }> }> = [
  {
    label: "Create",
    items: [
      { href: "/create", label: "Creator launchpad", icon: Plus, description: "Every creation tool" },
      { href: "/studio", label: "Flux Studio", icon: Boxes, description: "Games and websites" },
      { href: "/stories/create", label: "Story Studio", icon: Images, description: "Media, text and music" },
      { href: "/live/create", label: "Live Studio", icon: Radio, description: "Camera and screen share" },
      { href: "/studio/music", label: "Audio Library", icon: Headphones, description: "130 CC0 tracks" },
      { href: "/stickers", label: "Sticker Lab", icon: Sticker, description: "Static and animated" },
    ],
  },
  {
    label: "Discover",
    items: [
      { href: "/games", label: "Games", icon: Gamepad2 },
      { href: "/stories", label: "Stories", icon: Images },
      { href: "/live", label: "Live", icon: Radio },
      { href: "/groups", label: "Groups", icon: Users },
      { href: "/events", label: "Events", icon: Calendar },
      { href: "/ask-ai", label: "AskAI", icon: Sparkles },
    ],
  },
  {
    label: "Coins and rewards",
    items: [
      { href: "/premium", label: "Flux Premium", icon: Crown },
      { href: "/rewards", label: "Flux Rewards", icon: Gift },
      { href: "/gifts", label: "Animated Gifts", icon: Gift },
      { href: "/shop", label: "Shop", icon: ShoppingBag },
    ],
  },
  {
    label: "Account",
    items: [
      { href: "/bookmarks", label: "Bookmarks", icon: Bookmark },
      { href: "/lists", label: "Lists", icon: List },
      { href: "/activity", label: "Activity", icon: Activity },
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
        <motion.aside role="dialog" aria-modal="true" aria-label="Flux menu" initial={{ x: "-100%" }} animate={{ x: 0 }} exit={{ x: "-100%" }} transition={{ type: "spring", stiffness: 430, damping: 42 }} className="absolute inset-y-0 left-0 flex h-[100dvh] w-[min(91vw,390px)] flex-col overflow-hidden border-r border-border bg-background shadow-2xl">
          <header className="border-b border-border/75 bg-[linear-gradient(145deg,rgba(124,92,255,.13),transparent_58%)] px-5 pb-5 pt-[max(1rem,env(safe-area-inset-top))]">
            <div className="flex items-center justify-between"><div><p className="text-[9px] font-black uppercase tracking-[.16em] text-muted-foreground">Navigation</p><h2 className="mt-1 text-2xl font-black tracking-[-.04em]">Flux</h2></div><button type="button" onClick={onClose} className="grid h-11 w-11 place-items-center rounded-2xl border border-border bg-background/70 hover:bg-muted" aria-label="Close menu"><X className="h-5 w-5" /></button></div>
            {profile ? <Link href={profileHref} onClick={onClose} className="mt-5 flex items-center gap-3 rounded-[22px] border border-border/75 bg-background/72 p-3 backdrop-blur"><UserAvatar user={profile} size="md" decorations={profile.decorations} clickable={false} /><div className="min-w-0 flex-1"><p className="truncate text-base font-black">{profile.displayName}</p><p className="truncate text-[11px] text-muted-foreground">@{profile.username} · <span className="capitalize">{profile.planTier}</span></p><p className="mt-1 text-[10px] text-muted-foreground"><strong className="text-foreground">{formatCount(profile.followersCount)}</strong> followers · <strong className="text-foreground">{formatCount(profile.coins)}</strong> coins</p></div></Link> : null}
          </header>

          <nav className="min-h-0 flex-1 overflow-y-auto px-3 py-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <DrawerLink href={profileHref} label="Profile" icon={User} active={pathname.startsWith("/profile")} onClose={onClose} />
            {sections.map((section) => <section key={section.label} className="mt-4 first:mt-2"><p className="px-3 pb-2 text-[9px] font-black uppercase tracking-[.16em] text-muted-foreground">{section.label}</p><div className="space-y-1">{section.items.map((item) => <DrawerLink key={item.href} {...item} active={isNavPathActive(pathname, item.href)} onClose={onClose} featured={item.href === "/create"} />)}</div></section>)}
            {profile?.isAdmin ? <section className="mt-4"><p className="px-3 pb-2 text-[9px] font-black uppercase tracking-[.16em] text-muted-foreground">Owner</p><DrawerLink href="/admin" label="Admin command center" icon={Shield} description="Moderation, plans and resets" active={isNavPathActive(pathname, "/admin")} onClose={onClose} /></section> : null}
          </nav>
        </motion.aside>
      </div> : null}
    </AnimatePresence>,
    document.body
  );
}

function DrawerLink({ href, label, icon: Icon, active, onClose, description, featured = false }: { href: string; label: string; icon: LucideIcon; active: boolean; onClose: () => void; description?: string; featured?: boolean }) {
  return <Link href={href} onClick={onClose} className={cn("flex min-h-[58px] items-center gap-3 rounded-[18px] border border-transparent px-3 transition", active ? "border-border bg-muted font-black" : "hover:bg-muted/65", featured && !active && "border-violet-500/20 bg-[linear-gradient(135deg,rgba(124,92,255,.15),rgba(124,92,255,.04))]")}><span className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-[14px] bg-muted", featured && "bg-violet-500 text-white")}><Icon className="h-5 w-5" strokeWidth={active ? 2.5 : 2} /></span><span className="min-w-0 flex-1"><strong className="block text-[15px]">{label}</strong>{description ? <span className="mt-0.5 block truncate text-[10px] font-normal text-muted-foreground">{description}</span> : null}</span></Link>;
}
