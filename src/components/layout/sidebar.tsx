"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  Bell,
  Bookmark,
  Boxes,
  Calendar,
  Coins,
  Crown,
  Gamepad2,
  Gift,
  Headphones,
  HelpCircle,
  Home,
  Images,
  List,
  Mail,
  MoreHorizontal,
  PenSquare,
  Plus,
  Radio,
  Search,
  Settings,
  Shield,
  ShoppingBag,
  Sparkles,
  Sticker,
  User,
  Users,
  WandSparkles,
  type LucideIcon,
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

const primaryItems: Array<{ href: string; label: string; icon: LucideIcon; accent?: boolean }> = [
  { href: "/home", label: "Home", icon: Home },
  { href: "/explore", label: "Explore", icon: Search },
  { href: "/create", label: "Create", icon: Plus, accent: true },
  { href: "/studio", label: "Studio", icon: Boxes },
  { href: "/games", label: "Games", icon: Gamepad2 },
  { href: "/ask-ai", label: "AskAI", icon: Sparkles },
  { href: "/notifications", label: "Notifications", icon: Bell },
  { href: "/messages", label: "Messages", icon: Mail },
];

const moreSections: Array<{ label: string; items: Array<{ href: string; label: string; icon: LucideIcon; description?: string }> }> = [
  {
    label: "Creator tools",
    items: [
      { href: "/stories/create", label: "Story Studio", icon: Images, description: "Photos, text, stickers and music" },
      { href: "/live/create", label: "Live Studio", icon: Radio, description: "Camera, microphone and screen share" },
      { href: "/studio/music", label: "Audio Library", icon: Headphones, description: "130 CC0 tracks" },
      { href: "/stickers", label: "Sticker Lab", icon: Sticker, description: "Publish static and animated stickers" },
      { href: "/gifts", label: "Gift Studio", icon: Gift, description: "Send animated creator gifts" },
    ],
  },
  {
    label: "Social spaces",
    items: [
      { href: "/stories", label: "Stories", icon: Images },
      { href: "/live", label: "Live", icon: Radio },
      { href: "/groups", label: "Groups", icon: Users },
      { href: "/events", label: "Events", icon: Calendar },
    ],
  },
  {
    label: "Coins and access",
    items: [
      { href: "/premium", label: "Flux Premium", icon: Crown },
      { href: "/rewards", label: "Flux Rewards", icon: WandSparkles },
      { href: "/shop", label: "Shop", icon: ShoppingBag },
    ],
  },
  {
    label: "Your Flux",
    items: [
      { href: "/bookmarks", label: "Bookmarks", icon: Bookmark },
      { href: "/lists", label: "Lists", icon: List },
      { href: "/activity", label: "Activity", icon: Activity },
      { href: "/settings", label: "Settings", icon: Settings },
      { href: "/help", label: "Help Center", icon: HelpCircle },
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
    const timer = window.setInterval(() => getUnreadCount(user.uid).then(setUnread).catch(() => undefined), 45_000);
    return () => window.clearInterval(timer);
  }, [pathname, user]);

  return (
    <aside className="sticky top-0 hidden h-[100dvh] w-[78px] shrink-0 flex-col border-r border-border/75 bg-sidebar px-2 py-3 lg:flex xl:w-[264px] xl:px-3">
      <Link href="/home" className="mb-2 flex h-12 items-center rounded-2xl px-2" aria-label="Flux home">
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
                "group relative flex min-h-[48px] items-center gap-4 rounded-2xl px-3 text-[15px] font-semibold transition-all xl:text-[16px]",
                active && !item.accent ? "bg-foreground text-background shadow-sm" : "text-foreground hover:bg-muted",
                item.accent && !active && "my-1 bg-[linear-gradient(135deg,#7c5cff,#5b4eea)] text-white shadow-[0_8px_24px_rgba(91,78,234,.22)] hover:-translate-y-px hover:bg-[linear-gradient(135deg,#8c6cff,#6858f4)]",
                item.accent && active && "my-1 bg-white text-black ring-2 ring-violet-500/55 dark:bg-white dark:text-black"
              )}
            >
              <span className="relative grid h-8 w-8 shrink-0 place-items-center">
                <Icon className="h-[21px] w-[21px]" strokeWidth={active ? 2.5 : 2.05} />
                {item.href === "/notifications" && unread > 0 ? <span className={cn("absolute -right-1.5 -top-1.5 grid h-[19px] min-w-[19px] place-items-center rounded-full border-2 px-1 text-[9px] font-black", active ? "border-foreground bg-background text-foreground" : "border-sidebar bg-primary text-white")}>{unread > 9 ? "9+" : unread}</span> : null}
              </span>
              <span className="hidden xl:inline">{item.label}</span>
              {item.href === "/studio" ? <span className="ml-auto hidden rounded-full bg-violet-500/10 px-2 py-1 text-[8px] font-black uppercase tracking-wider text-violet-600 dark:text-violet-300 xl:inline">New</span> : null}
            </Link>
          );
        })}

        <Link href={profileHref} className={cn("flex min-h-[48px] items-center gap-4 rounded-2xl px-3 text-[15px] font-semibold transition-colors xl:text-[16px]", pathname.startsWith("/profile") ? "bg-foreground text-background" : "hover:bg-muted")}>
          <span className="grid h-8 w-8 place-items-center"><User className="h-[21px] w-[21px]" /></span>
          <span className="hidden xl:inline">Profile</span>
        </Link>

        <DropdownMenu>
          <DropdownMenuTrigger asChild><button type="button" className="flex min-h-[48px] items-center gap-4 rounded-2xl px-3 text-[15px] font-semibold transition-colors hover:bg-muted xl:text-[16px]"><span className="grid h-8 w-8 place-items-center"><MoreHorizontal className="h-[21px] w-[21px]" /></span><span className="hidden xl:inline">All pages</span></button></DropdownMenuTrigger>
          <DropdownMenuContent side="right" align="end" className="max-h-[min(760px,calc(100dvh-24px))] w-[320px] overflow-y-auto rounded-[22px] border-border p-2 shadow-[0_24px_80px_rgba(0,0,0,.2)]">
            <div className="mb-2 rounded-[18px] bg-[#101216] p-4 text-white"><p className="text-[9px] font-black uppercase tracking-[.15em] text-white/32">Flux directory</p><p className="mt-2 text-lg font-black">Every page, one menu.</p><Link href="/create" className="mt-3 flex h-9 items-center justify-center gap-2 rounded-xl bg-white text-[10px] font-black text-black"><Plus className="h-3.5 w-3.5" />Open Create launchpad</Link></div>
            {moreSections.map((section, sectionIndex) => <div key={section.label}>{sectionIndex ? <DropdownMenuSeparator /> : null}<DropdownMenuLabel className="px-3 py-2 text-[9px] font-black uppercase tracking-[.15em] text-muted-foreground">{section.label}</DropdownMenuLabel>{section.items.map(({ href, label, icon: Icon, description }) => <DropdownMenuItem key={href} asChild className="rounded-xl py-2.5"><Link href={href} className="flex items-center gap-3"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-muted"><Icon className="h-4.5 w-4.5" /></span><span className="min-w-0"><strong className="block text-sm font-semibold">{label}</strong>{description ? <span className="block truncate text-[9px] text-muted-foreground">{description}</span> : null}</span></Link></DropdownMenuItem>)}</div>)}
            {profile?.isAdmin ? <><DropdownMenuSeparator /><DropdownMenuItem asChild className="rounded-xl py-2.5 font-semibold"><Link href="/admin" className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-xl bg-red-500/10 text-red-500"><Shield className="h-4.5 w-4.5" /></span>Admin command center</Link></DropdownMenuItem></> : null}
          </DropdownMenuContent>
        </DropdownMenu>
      </nav>

      <Dialog open={composeOpen} onOpenChange={setComposeOpen}>
        <DialogTrigger asChild><Button className="mt-3 h-12 w-full rounded-2xl text-base font-black" size="lg"><PenSquare className="h-5 w-5 xl:hidden" /><span className="hidden xl:inline">Create post</span></Button></DialogTrigger>
        <DialogContent className="max-w-xl overflow-hidden p-0 sm:rounded-2xl"><DialogHeader className="border-b border-border px-5 py-4"><DialogTitle>Create post</DialogTitle></DialogHeader><div className="p-4"><ComposeBox onSuccess={() => setComposeOpen(false)} autofocus /></div></DialogContent>
      </Dialog>

      {profile ? <Link href={profileHref} className="mt-3 rounded-2xl border border-transparent p-2 transition-colors hover:border-border hover:bg-muted"><div className="flex items-center gap-3"><UserAvatar user={profile} size="sm" decorations={profile.decorations} clickable={false} /><div className="hidden min-w-0 flex-1 xl:block"><p className="truncate text-sm font-black">{profile.displayName}</p><p className="truncate text-[10px] text-muted-foreground">@{profile.username || "…"} · <span className="capitalize">{profile.planTier}</span></p></div><div className="hidden items-center gap-1 text-xs font-bold text-muted-foreground xl:flex"><Coins className="h-3.5 w-3.5" />{formatCount(profile.coins)}</div></div></Link> : null}
    </aside>
  );
}
