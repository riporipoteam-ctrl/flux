"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Search } from "lucide-react";
import { useState } from "react";
import { MobileDrawer } from "@/components/layout/mobile-drawer";

import { UserAvatar } from "@/components/shared/user-avatar";
import { useAuth } from "@/contexts/auth-context";

function sectionLabel(pathname: string): string {
  const section = pathname.split("/")[1];
  const labels: Record<string, string> = {
    home: "Home",
    messages: "Messages",
    notifications: "Notifications",
    explore: "Explore",
    stories: "Stories",
    live: "Live",
    bookmarks: "Saved posts",
    groups: "Communities",
    group: "Community",
    events: "Events",
    "flux-rec": "Flux Rec",
    shop: "Shop",
    settings: "Settings",
    post: "Conversation",
    profile: "Profile",
    create: "Create",
    gifts: "Gifts",
    rewards: "Rewards",
    premium: "Premium",
    games: "Games",
    help: "Help",
    lists: "Lists",
    stickers: "Sticker Lab",
    activity: "Activity",
  };
  return labels[section] || "Profile";
}

export function MobileAppHeader() {
  const pathname = (usePathname() || "/home").replace(/\/+$/, "") || "/home";
  const { profile } = useAuth();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const home = pathname === "/home";

  return (
    <>
      <header className="flux8-mobile-header lg:hidden">
        <div className="flux8-mobile-header-row">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="flux8-mobile-avatar"
            aria-label="Open navigation menu"
            aria-expanded={drawerOpen}
          >
            <UserAvatar
              user={profile}
              size="sm"
              clickable={false}
              decorations={profile?.decorations}
            />
          </button>
          <Link
            href="/home"
            className="flux8-mobile-title"
            aria-label="Flux home"
          >
            {home ? (
              <>
                <span className="flux-brand-symbol" aria-hidden="true">
                  f<span />
                </span>
                <strong className="ml-2">flux</strong>
              </>
            ) : (
              <strong>{sectionLabel(pathname)}</strong>
            )}
          </Link>
          <div className="flux8-mobile-header-actions">
            <Link
              href="/explore"
              className="flux8-mobile-header-action"
              aria-label="Search Flux"
            >
              <Search className="h-[21px] w-[21px]" />
            </Link>
          </div>
        </div>
      </header>
      <MobileDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </>
  );
}
