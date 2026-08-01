"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Coins, Crown, Gamepad2, Hash, Search, Sparkles, UserPlus } from "lucide-react";
import { UserAvatar } from "@/components/shared/user-avatar";
import { useAuth } from "@/contexts/auth-context";
import { getSuggestedUsers } from "@/services/users";
import { followUser, isFollowing } from "@/services/follows";
import { getTrendingHashtags, type HashtagInfo } from "@/services/hashtags";
import type { UserProfile } from "@/types";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { profilePath } from "@/lib/routes";
import { formatCount } from "@/lib/utils";

export function RightRail() {
  const { user, profile } = useAuth();
  const router = useRouter();
  const [suggestions, setSuggestions] = useState<UserProfile[]>([]);
  const [followingMap, setFollowingMap] = useState<Record<string, boolean>>({});
  const [tags, setTags] = useState<HashtagInfo[]>([]);
  const [queryText, setQueryText] = useState("");

  useEffect(() => {
    if (!user) return;
    const timer = window.setTimeout(() => {
      getSuggestedUsers(user.uid, 4).then(async (people) => {
        setSuggestions(people);
        const map: Record<string, boolean> = {};
        await Promise.all(people.map(async (person) => { map[person.uid] = await isFollowing(user.uid, person.uid); }));
        setFollowingMap(map);
      }).catch(() => setSuggestions([]));
    }, 100);
    return () => window.clearTimeout(timer);
  }, [user]);

  useEffect(() => {
    const timer = window.setTimeout(() => getTrendingHashtags(5).then(setTags).catch(() => setTags([])), 70);
    return () => window.clearTimeout(timer);
  }, []);

  const onFollow = async (target: UserProfile) => {
    if (!user) return;
    try {
      await followUser(user.uid, target.uid);
      setFollowingMap((current) => ({ ...current, [target.uid]: true }));
      toast.success(`Following @${target.username}`);
    } catch {
      toast.error("Could not follow this person");
    }
  };

  return (
    <aside className="flux8-right-rail hidden xl:block no-scrollbar">
      <div className="flux8-right-stack">
        <form onSubmit={(event) => { event.preventDefault(); if (queryText.trim()) router.push(`/explore?q=${encodeURIComponent(queryText.trim())}`); }} className="flux8-rail-search">
          <Search className="h-[17px] w-[17px]" />
          <input value={queryText} onChange={(event) => setQueryText(event.target.value)} placeholder="Search Flux" aria-label="Search Flux" />
        </form>

        {profile ? (
          <section className="flux8-balance-card">
            <div className="flux8-balance-icon"><Coins className="h-5 w-5" /></div>
            <div><span>Your balance</span><strong>{formatCount(profile.coins)} Flux Coins</strong></div>
            <Link href="/shop" aria-label="Open shop"><ArrowRight className="h-4 w-4" /></Link>
          </section>
        ) : null}

        <Link href="/premium" className="flux8-premium-card">
          <span className="flux8-premium-icon"><Crown className="h-5 w-5" /></span>
          <div><strong>Flux Premium</strong><small>More creator tools and customisation</small></div>
          <ArrowRight className="h-4 w-4" />
        </Link>

        <section className="flux8-rail-card">
          <header><div><Hash className="h-4 w-4" /><strong>Explore</strong></div><Link href="/explore">Show all</Link></header>
          <div className="flux8-trend-list">
            {tags.length ? tags.map((tag, index) => (
              <Link key={tag.tag} href={`/explore?q=${encodeURIComponent(`#${tag.tag}`)}`} className="flux8-trend-row">
                <span>{index + 1}</span>
                <div><small>Trending now</small><strong>#{tag.tag}</strong><em>{tag.postsCount} {tag.postsCount === 1 ? "post" : "posts"}</em></div>
              </Link>
            )) : <p className="flux8-empty-rail">Post with hashtags to start a trend.</p>}
          </div>
        </section>

        <section className="flux8-rail-card">
          <header><div><Gamepad2 className="h-4 w-4" /><strong>Games</strong></div><Link href="/games">See all</Link></header>
          <div className="flux8-game-links">
            <Link href="/games"><span>Discover</span><small>Community games</small></Link>
            <Link href="/studio"><span>Build</span><small>Open Flux Studio</small></Link>
          </div>
        </section>

        <section className="flux8-rail-card">
          <header><div><UserPlus className="h-4 w-4" /><strong>People to follow</strong></div><Link href="/explore">See all</Link></header>
          <div className="flux8-follow-list">
            {suggestions.length ? suggestions.map((person) => (
              <div key={person.uid} className="flux8-follow-row">
                <Link href={profilePath(person.username)}><UserAvatar user={person} size="sm" decorations={person.decorations} /></Link>
                <div className="min-w-0"><Link href={profilePath(person.username)}><strong>{person.displayName}</strong><span>@{person.username}</span></Link></div>
                <button type="button" disabled={followingMap[person.uid]} onClick={() => void onFollow(person)}>{followingMap[person.uid] ? "Following" : "Follow"}</button>
              </div>
            )) : <p className="flux8-empty-rail">No suggestions right now.</p>}
          </div>
        </section>

        <Link href="/ask-ai" className="flux8-askai-promo">
          <div><Sparkles className="h-5 w-5" /><strong>Create with AskAI</strong></div>
          <p>Research, write, plan and build without leaving Flux.</p>
          <span>Open AskAI <ArrowRight className="h-4 w-4" /></span>
        </Link>

        <nav className="flux8-rail-footer">
          <Link href="/help">Help</Link><Link href="/settings">Settings</Link><Link href="/premium">Premium</Link><span>© {new Date().getFullYear()} Ripo Team</span>
        </nav>
      </div>
    </aside>
  );
}
