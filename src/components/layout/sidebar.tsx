"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Bell,
  Bookmark,
  CalendarDays,
  ChevronDown,
  Coins,
  Compass,
  Gamepad2,
  Gift,
  Home,
  Images,
  LogOut,
  Mail,
  MoreHorizontal,
  PenLine,
  Radio,
  Settings,
  ShoppingBag,
  Sparkles,
  UserRound,
  Users,
  Boxes,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { UserAvatar } from "@/components/shared/user-avatar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ComposeBox } from "@/components/posts/compose-box";
import { getUnreadCount } from "@/services/notifications";
import { isNavPathActive, profilePath } from "@/lib/routes";
import { cn } from "@/lib/utils";

type Destination = { href: string; label: string; icon: LucideIcon };
const network: Destination[] = [
  { href: "/home", label: "Home", icon: Home },
  { href: "/explore", label: "Explore", icon: Compass },
  { href: "/notifications", label: "Notifications", icon: Bell },
  { href: "/messages", label: "Messages", icon: Mail },
  { href: "/bookmarks", label: "Saved posts", icon: Bookmark },
];
const spaces: Destination[] = [
  { href: "/groups", label: "Communities", icon: Users },
  { href: "/stories", label: "Stories", icon: Images },
  { href: "/live", label: "Live", icon: Radio },
  { href: "/events", label: "Events", icon: CalendarDays },
  { href: "/flux-rec", label: "Flux Rec", icon: Gamepad2 },
  { href: "/studio", label: "Studio", icon: Boxes },
  { href: "/ask-ai", label: "AskAI", icon: Sparkles },
];

export function Sidebar() {
  const pathname = usePathname();
  const { profile, user, signOut } = useAuth();
  const [unread, setUnread] = useState(0);
  const [composeOpen, setComposeOpen] = useState(false);
  useEffect(() => {
    if (!user) return;
    const refresh = () =>
      getUnreadCount(user.uid)
        .then(setUnread)
        .catch(() => undefined);
    void refresh();
    const timer = window.setInterval(refresh, 45000);
    return () => window.clearInterval(timer);
  }, [user, pathname]);
  const renderLink = ({ href, label, icon: Icon }: Destination) => (
    <Link
      key={href}
      href={href}
      className={cn(
        "flux-nav-item",
        isNavPathActive(pathname, href) && "is-active",
      )}
      aria-current={isNavPathActive(pathname, href) ? "page" : undefined}
    >
      <Icon size={20} strokeWidth={1.8} />
      <span>{label}</span>
      {href === "/notifications" && unread > 0 ? (
        <em>{unread > 99 ? "99+" : unread}</em>
      ) : null}
    </Link>
  );
  return (
    <aside className="xxnav-col flux-navigation" aria-label="Main navigation">
      <div className="flux-navigation-scroll">
        <Dialog open={composeOpen} onOpenChange={setComposeOpen}>
          <DialogTrigger asChild>
            <button type="button" className="flux-new-post">
              <PenLine size={19} />
              <span>Create a post</span>
              <span aria-hidden="true">+</span>
            </button>
          </DialogTrigger>
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <DialogTitle>Create a post</DialogTitle>
            </DialogHeader>
            <ComposeBox onSuccess={() => setComposeOpen(false)} autofocus />
          </DialogContent>
        </Dialog>
        <nav aria-label="Your network">
          <p className="flux-nav-caption">Your network</p>
          {network.map(renderLink)}
          {renderLink({
            href: profilePath(profile?.username),
            label: "Profile",
            icon: UserRound,
          })}
        </nav>
        <nav aria-label="Your spaces">
          <p className="flux-nav-caption">Your spaces</p>
          {spaces.map(renderLink)}
        </nav>
        <details className="flux-nav-more">
          <summary>
            <MoreHorizontal size={20} />
            <span>More from Flux</span>
            <ChevronDown size={15} />
          </summary>
          <div>
            {[
              { href: "/shop", label: "Shop", icon: ShoppingBag },
              { href: "/gifts", label: "Gifts", icon: Gift },
              { href: "/rewards", label: "Rewards", icon: Coins },
              { href: "/settings", label: "Settings", icon: Settings },
            ].map(renderLink)}
            <Link className="flux-nav-item" href="/premium">
              Explore Premium
            </Link>
            <Link className="flux-nav-item" href="/help">
              Help & support
            </Link>
            {profile?.isAdmin ? (
              <Link className="flux-nav-item" href="/admin">
                Admin controls
              </Link>
            ) : null}
          </div>
        </details>
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="flux-nav-account" type="button">
            <UserAvatar user={profile} size="sm" clickable={false} />
            <span>
              <strong>{profile?.displayName || "Your account"}</strong>
              <small>@{profile?.username || "flux"}</small>
            </span>
            <MoreHorizontal size={18} />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="top" align="start">
          <DropdownMenuItem asChild>
            <Link href="/settings/accounts">Manage accounts</Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/settings">Settings & privacy</Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => void signOut()}>
            <LogOut size={16} />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </aside>
  );
}
