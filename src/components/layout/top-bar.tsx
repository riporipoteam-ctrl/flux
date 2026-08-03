"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Bell,
  Compass,
  Gamepad2,
  Home,
  Mail,
  PenSquare,
  Search,
  Settings,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { Logo } from "@/components/shared/logo";
import { UserAvatar } from "@/components/shared/user-avatar";
import { useAuth } from "@/contexts/auth-context";
import { getUnreadCount } from "@/services/notifications";
import { isNavPathActive, profilePath } from "@/lib/routes";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ComposeBox } from "@/components/posts/compose-box";

const TABS: Array<{ href: string; label: string; icon: LucideIcon }> = [
  { href: "/home", label: "Home", icon: Home },
  { href: "/explore", label: "Explore", icon: Compass },
  { href: "/games", label: "Games", icon: Gamepad2 },
  { href: "/messages", label: "Messages", icon: Mail },
  { href: "/notifications", label: "Notifications", icon: Bell },
];

/**
 * The global bar across the top of Flux.
 *
 * Facebook's shape — brand and search on the left, the primary destinations as
 * big icon tabs in the middle, actions and account on the right — carrying X's
 * palette, weight and motion. Desktop and tablet only; phones keep the compact
 * header and the bottom bar, which is what a thumb expects.
 */
export function TopBar() {
  const pathname = usePathname();
  const router = useRouter();
  const { profile, user } = useAuth();
  const [unread, setUnread] = useState(0);
  const [term, setTerm] = useState("");
  const [composeOpen, setComposeOpen] = useState(false);

  useEffect(() => {
    if (!user) return;
    let alive = true;
    const read = () => {
      void getUnreadCount(user.uid)
        .then((count) => { if (alive) setUnread(count); })
        .catch(() => undefined);
    };
    read();
    const timer = window.setInterval(read, 60_000);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, [user]);

  const search = (event: React.FormEvent) => {
    event.preventDefault();
    const query = term.trim();
    if (query) router.push(`/explore?q=${encodeURIComponent(query)}`);
  };

  return (
    <header className="flux9-topbar">
      <div className="flux9-topbar-lead">
        <Link href="/home" aria-label="Flux home" className="flux9-topbar-brand">
          <Logo className="h-7 w-7" />
        </Link>
        <form className="flux9-topbar-search" onSubmit={search} role="search">
          <Search className="h-[18px] w-[18px] flex-none" aria-hidden />
          <input
            value={term}
            onChange={(event) => setTerm(event.target.value)}
            placeholder="Search Flux"
            aria-label="Search Flux"
          />
        </form>
      </div>

      <nav className="flux9-topbar-tabs" aria-label="Primary">
        {TABS.map(({ href, label, icon: Icon }) => {
          const active = isNavPathActive(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              aria-label={label}
              title={label}
              aria-current={active ? "page" : undefined}
              className={cn("flux9-topbar-tab", active && "is-active")}
            >
              <Icon className="h-[22px] w-[22px]" strokeWidth={active ? 2.5 : 2} />
              {href === "/notifications" && unread > 0 ? <em>{unread > 99 ? "99+" : unread}</em> : null}
            </Link>
          );
        })}
      </nav>

      <div className="flux9-topbar-actions">
        <Dialog open={composeOpen} onOpenChange={setComposeOpen}>
          <DialogTrigger asChild>
            <button type="button" className="flux9-topbar-action is-primary" aria-label="Create post">
              <PenSquare className="h-[19px] w-[19px]" />
              <span>Post</span>
            </button>
          </DialogTrigger>
          <DialogContent className="flux8-dialog max-w-xl overflow-hidden p-0">
            <DialogHeader className="border-b border-border px-5 py-4"><DialogTitle>Create post</DialogTitle></DialogHeader>
            <div className="p-4"><ComposeBox onSuccess={() => setComposeOpen(false)} autofocus /></div>
          </DialogContent>
        </Dialog>

        <Link href="/ask-ai" className="flux9-topbar-action" aria-label="AskAI" title="AskAI">
          <Sparkles className="h-[19px] w-[19px]" />
        </Link>
        <Link href="/settings" className="flux9-topbar-action" aria-label="Settings" title="Settings">
          <Settings className="h-[19px] w-[19px]" />
        </Link>
        {profile ? (
          <Link href={profilePath(profile.username)} className="flux9-topbar-avatar" aria-label="Your profile">
            <UserAvatar user={profile} size="sm" decorations={profile.decorations} clickable={false} />
          </Link>
        ) : null}
      </div>
    </header>
  );
}
