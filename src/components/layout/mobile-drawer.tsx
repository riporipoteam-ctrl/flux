"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  Bookmark,
  Boxes,
  Calendar,
  Crown,
  Gamepad2,
  Gift,
  HelpCircle,
  Images,
  List,
  Radio,
  Settings,
  Shield,
  ShoppingBag,
  Sparkles,
  User,
  Users,
  X,
} from "lucide-react";
import { UserAvatar } from "@/components/shared/user-avatar";
import { useAuth } from "@/contexts/auth-context";
import { cn, formatCount } from "@/lib/utils";
import { isNavPathActive, profilePath } from "@/lib/routes";

const primaryLinks = [
  { href: "/studio", label: "Flux Studio", icon: Boxes },
  { href: "/games", label: "Games", icon: Gamepad2 },
  { href: "/stories", label: "Stories", icon: Images },
  { href: "/live", label: "Live", icon: Radio },
  { href: "/groups", label: "Communities", icon: Users },
];

const utilityLinks = [
  { href: "/premium", label: "Flux Premium", icon: Crown },
  { href: "/rewards", label: "Flux Rewards", icon: Gift },
  { href: "/shop", label: "Shop and Gifts", icon: ShoppingBag },
  { href: "/bookmarks", label: "Bookmarks", icon: Bookmark },
  { href: "/lists", label: "Lists", icon: List },
  { href: "/events", label: "Events", icon: Calendar },
  { href: "/ask-ai", label: "AskAI", icon: Sparkles },
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
        <motion.button type="button" aria-label="Close menu" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/45" onClick={onClose} />
        <motion.aside role="dialog" aria-modal="true" aria-label="Account menu" initial={{ x: "-100%" }} animate={{ x: 0 }} exit={{ x: "-100%" }} transition={{ type: "spring", stiffness: 420, damping: 40 }} className="absolute inset-y-0 left-0 flex h-[100dvh] w-[min(88vw,360px)] flex-col overflow-hidden border-r border-border bg-background shadow-2xl">
          <div className="flex items-center justify-between px-5 pb-2 pt-[max(1rem,env(safe-area-inset-top))]"><h2 className="text-xl font-black">Flux</h2><button type="button" onClick={onClose} className="grid h-10 w-10 place-items-center rounded-full hover:bg-muted" aria-label="Close menu"><X className="h-5 w-5" /></button></div>
          {profile ? <div className="px-5 pb-4"><Link href={profileHref} onClick={onClose} className="block"><UserAvatar user={profile} size="lg" decorations={profile.decorations} clickable={false} /><p className="mt-3 truncate text-xl font-black">{profile.displayName}</p><p className="truncate text-sm text-muted-foreground">@{profile.username} · {profile.planTier}</p></Link><div className="mt-3 flex gap-4 text-sm"><span><strong>{formatCount(profile.followingCount)}</strong> <span className="text-muted-foreground">Following</span></span><span><strong>{formatCount(profile.followersCount)}</strong> <span className="text-muted-foreground">Followers</span></span></div></div> : null}
          <div className="h-px bg-border" />
          <nav className="min-h-0 flex-1 overflow-y-auto px-3 py-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <DrawerLink href={profileHref} label="Profile" icon={User} active={pathname.startsWith("/profile")} onClose={onClose} />
            {primaryLinks.map((item) => <DrawerLink key={item.href} {...item} active={isNavPathActive(pathname, item.href)} onClose={onClose} />)}
            <div className="my-3 h-px bg-border" />
            {utilityLinks.map((item) => <DrawerLink key={item.href} {...item} active={isNavPathActive(pathname, item.href)} onClose={onClose} />)}
            <div className="my-3 h-px bg-border" />
            <DrawerLink href="/settings" label="Settings and privacy" icon={Settings} active={isNavPathActive(pathname, "/settings")} onClose={onClose} />
            <DrawerLink href="/help" label="Help Center" icon={HelpCircle} active={false} onClose={onClose} />
            {profile?.isAdmin ? <DrawerLink href="/admin" label="Admin command center" icon={Shield} active={isNavPathActive(pathname, "/admin")} onClose={onClose} /> : null}
          </nav>
        </motion.aside>
      </div> : null}
    </AnimatePresence>,
    document.body
  );
}

function DrawerLink({ href, label, icon: Icon, active, onClose }: { href: string; label: string; icon: typeof User; active: boolean; onClose: () => void }) {
  return <Link href={href} onClick={onClose} className={cn("flex min-h-14 items-center gap-5 rounded-xl px-3 text-[17px] font-semibold transition-colors hover:bg-muted/70", active && "bg-muted font-black")}><Icon className="h-[23px] w-[23px]" strokeWidth={active ? 2.5 : 2} />{label}</Link>;
}