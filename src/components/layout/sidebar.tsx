"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  Bookmark,
  Boxes,
  Crown,
  Gamepad2,
  Gift,
  Home,
  Mail,
  MoreHorizontal,
  Palette,
  PenLine,
  Radio,
  Search,
  Settings,
  Shield,
  Sparkles,
  User,
  Users,
  LogOut,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useState } from "react";
import { UserAvatar } from "@/components/shared/user-avatar";
import { useAuth } from "@/contexts/auth-context";
import { cn } from "@/lib/utils";
import { isNavPathActive, profilePath } from "@/lib/routes";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { ComposeBox } from "@/components/posts/compose-box";
import { getUnreadCount } from "@/services/notifications";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

function FluxLogo() {
  return (
    <img src="/flux-logo.png" alt="Flux" className="h-8 w-8 object-contain" />
  );
}

const mainItems: Array<{ href: string; label: string; icon: LucideIcon; badge?: "notifications" }> = [
  { href: "/home", label: "Home", icon: Home },
  { href: "/explore", label: "Explore", icon: Search },
  { href: "/notifications", label: "Notifications", icon: Bell, badge: "notifications" },
  { href: "/messages", label: "Messages", icon: Mail },
];

const moreItems: Array<{ href: string; label: string; icon: LucideIcon }> = [
  { href: "/ask-ai", label: "AskAI", icon: Sparkles },
  { href: "/flux-rec", label: "Flux Rec", icon: Gamepad2 },
  { href: "/groups", label: "Communities", icon: Users },
  { href: "/bookmarks", label: "Bookmarks", icon: Bookmark },
  { href: "/stories", label: "Stories", icon: Radio },
  { href: "/live", label: "Live", icon: Radio },
  { href: "/studio", label: "Studio", icon: Boxes },
  { href: "/gifts", label: "Gifts", icon: Gift },
  { href: "/premium", label: "Premium", icon: Crown },
  { href: "/settings/display", label: "Display", icon: Palette },
  { href: "/settings", label: "Settings", icon: Settings },
];

function backToTop(event: React.MouseEvent) {
  event.preventDefault();
  window.scrollTo({ top: 0, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
}

export function Sidebar() {
  const pathname = usePathname();
  const { profile, user, signOut } = useAuth();
  const [composeOpen, setComposeOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const profileHref = profilePath(profile?.username);
  const profileActive = pathname.startsWith("/profile") || pathname === profileHref || (profile?.username ? pathname === `/${profile.username}` : false);

  useEffect(() => {
    if (!user) return;
    getUnreadCount(user.uid).then(setUnread).catch(() => setUnread(0));
    const timer = window.setInterval(() => getUnreadCount(user.uid).then(setUnread).catch(() => undefined), 45_000);
    return () => window.clearInterval(timer);
  }, [pathname, user]);

  return (
    <div className="xxnav-col">
      <aside className="xxnav" aria-label="Primary">
        <Link href="/home" className="xxnav-logo" aria-label="Flux home">
          <FluxLogo />
        </Link>

        <nav className="xxnav-links" aria-label="Primary navigation">
          {mainItems.map((item) => {
            const active = isNavPathActive(pathname, item.href);
            const Icon = item.icon;
            const badge = item.badge === "notifications" ? unread : 0;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                onClick={active ? backToTop : undefined}
                className={cn("xxnav-link", active && "is-active")}
              >
                <span className="xxnav-icon">
                  <Icon strokeWidth={active ? 2.6 : 1.9} />
                  {badge > 0 ? <em className="xxnav-badge">{badge > 99 ? "99+" : badge}</em> : null}
                </span>
                <span className="xxnav-label">{item.label}</span>
              </Link>
            );
          })}

          <Link
            href={profileHref}
            aria-current={profileActive ? "page" : undefined}
            className={cn("xxnav-link", profileActive && "is-active")}
          >
            <span className="xxnav-icon"><User strokeWidth={profileActive ? 2.6 : 1.9} /></span>
            <span className="xxnav-label">Profile</span>
          </Link>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button type="button" className="xxnav-link" aria-label="More">
                <span className="xxnav-icon"><MoreHorizontal strokeWidth={1.9} /></span>
                <span className="xxnav-label">More</span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="right" align="end" className="w-[290px] p-2">
              {moreItems.map(({ href, label, icon: Icon }) => (
                <DropdownMenuItem key={href} asChild>
                  <Link href={href} className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] font-bold">
                    <Icon className="h-5 w-5" strokeWidth={1.9} />
                    {label}
                  </Link>
                </DropdownMenuItem>
              ))}
              {profile?.isAdmin ? (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href="/admin" className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] font-bold text-red-600">
                      <Shield className="h-5 w-5" strokeWidth={1.9} />
                      Admin
                    </Link>
                  </DropdownMenuItem>
                </>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        </nav>

        <Dialog open={composeOpen} onOpenChange={setComposeOpen}>
          <DialogTrigger asChild>
            <button type="button" className="xxnav-post" aria-label="Post">
              <PenLine strokeWidth={2.4} />
              <span className="xxnav-post-label">Post</span>
            </button>
          </DialogTrigger>
          <DialogContent className="max-w-xl overflow-hidden rounded-2xl p-0">
            <div className="p-4"><ComposeBox onSuccess={() => setComposeOpen(false)} autofocus /></div>
          </DialogContent>
        </Dialog>

        <div className="xxnav-spacer" />

        {profile ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button type="button" className="xxnav-me" aria-label="Account menu">
                <UserAvatar user={profile} size="md" decorations={profile.decorations} clickable={false} />
                <span className="xxnav-me-names">
                  <strong>{profile.displayName}</strong>
                  <span>@{profile.username || "…"}</span>
                </span>
                <span className="xxnav-me-dots"><MoreHorizontal className="h-5 w-5" /></span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="top" align="end" className="w-[260px] p-2">
              <DropdownMenuItem asChild>
                <Link href={profileHref} className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] font-bold">
                  <User className="h-5 w-5" strokeWidth={1.9} />
                  View profile
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => void signOut()}
                className="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] font-bold"
              >
                <LogOut className="h-5 w-5" strokeWidth={1.9} />
                Log out @{profile.username}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </aside>
    </div>
  );
}
