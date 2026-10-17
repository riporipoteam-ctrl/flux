"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { LogOut, MoreHorizontal, Settings } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Logo } from "@/components/shared/logo";
import { NavIcon, type NavIconName } from "@/components/navigation/nav-icon";
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
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ComposeBox } from "@/components/posts/compose-box";
import { getUnreadCount } from "@/services/notifications";
import { isNavPathActive, profilePath } from "@/lib/routes";
import { fluxDestinations } from "@/lib/flux-navigation";
import { cn } from "@/lib/utils";
const primary: { href: string; label: string; icon: NavIconName }[] = [
  { href: "/home", label: "Home", icon: "home" },
  { href: "/explore", label: "Explore", icon: "explore" },
  { href: "/notifications", label: "Notifications", icon: "notifications" },
  { href: "/messages", label: "Messages", icon: "messages" },
  { href: "/bookmarks", label: "Bookmarks", icon: "bookmarks" },
  { href: "/groups", label: "Communities", icon: "communities" },
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
  const links = [
    ...primary,
    {
      href: profilePath(profile?.username),
      label: "Profile",
      icon: "profile" as const,
    },
  ];
  return (
    <aside
      className="xxnav-col flux-navigation flux-sidebar"
      aria-label="Main navigation"
    >
      <div className="flux-sidebar-brand">
        <Logo size={44} />
      </div>
      <nav className="flux-sidebar-links" aria-label="Primary navigation">
        {links.map((item) => {
          const active = isNavPathActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn("flux-sidebar-link", active && "is-active")}
              aria-current={active ? "page" : undefined}
            >
              <span className="flux-sidebar-icon">
                <NavIcon name={item.icon} active={active} />
                {item.href === "/notifications" && unread > 0 ? (
                  <em>{unread > 99 ? "99+" : unread}</em>
                ) : null}
              </span>
              <span>{item.label}</span>
            </Link>
          );
        })}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="flux-sidebar-link"
              type="button"
              aria-label="More on Flux"
            >
              <NavIcon name="more" />
              <span>More</span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="flux-more-menu"
            collisionPadding={16}
            side="right"
            align="end"
            sideOffset={12}
          >
            <DropdownMenuLabel className="flux-more-menu-title">
              Explore Flux
            </DropdownMenuLabel>
            {fluxDestinations
              .filter((item) => item.href !== "/groups")
              .map(({ href, label, icon: Icon }) => (
                <DropdownMenuItem key={href} asChild>
                  <Link href={href}>
                    <Icon size={20} />
                    {label}
                  </Link>
                </DropdownMenuItem>
              ))}
            {profile?.isAdmin ? (
              <DropdownMenuItem asChild>
                <Link href="/admin">Admin controls</Link>
              </DropdownMenuItem>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      </nav>
      <Dialog open={composeOpen} onOpenChange={setComposeOpen}>
        <DialogTrigger asChild>
          <button
            type="button"
            className="flux-sidebar-post"
            aria-label="Create a post"
          >
            <NavIcon name="create" />
            <span>Post</span>
          </button>
        </DialogTrigger>
        <DialogContent
          className="flux-compose-dialog"
          aria-describedby={undefined}
        >
          <DialogHeader>
            <DialogTitle>Create post</DialogTitle>
          </DialogHeader>
          <ComposeBox onSuccess={() => setComposeOpen(false)} autofocus />
        </DialogContent>
      </Dialog>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="flux-sidebar-account"
            aria-label="Account menu"
          >
            <UserAvatar user={profile} size="md" clickable={false} />
            <span>
              <strong>{profile?.displayName || "Your account"}</strong>
              <small>@{profile?.username || "flux"}</small>
            </span>
            <MoreHorizontal size={20} />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          side="top"
          align="start"
          className="flux-account-menu"
        >
          <DropdownMenuItem asChild>
            <Link href="/settings/accounts">Switch or add account</Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/settings">
              <Settings size={18} />
              Settings & privacy
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => void signOut()}>
            <LogOut size={18} />
            Log out @{profile?.username}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </aside>
  );
}
