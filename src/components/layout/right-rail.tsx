"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { UserAvatar } from "@/components/shared/user-avatar";
import { useAuth } from "@/contexts/auth-context";
import { getSuggestedUsers } from "@/services/users";
import { followUser, isFollowing } from "@/services/follows";
import { getTrendingHashtags, type HashtagInfo } from "@/services/hashtags";
import type { UserProfile } from "@/types";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { profilePath } from "@/lib/routes";

export function RightRail() {
  const { user } = useAuth();
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
    const timer = window.setTimeout(() => getTrendingHashtags(6).then(setTags).catch(() => setTags([])), 70);
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
          <Search className="h-[18px] w-[18px]" />
          <input value={queryText} onChange={(event) => setQueryText(event.target.value)} placeholder="Search" aria-label="Search Flux" />
        </form>

        <section className="flux8-premium-card">
          <strong>Subscribe to Premium</strong>
          <p>Unlock creator tools, longer posts and more ways to customise Flux.</p>
          <Link href="/premium">Subscribe</Link>
        </section>

        <section className="flux8-rail-card">
          <header><strong>What’s happening</strong></header>
          <div className="flux8-trend-list">
            {tags.length ? tags.map((tag, index) => (
              <Link key={tag.tag} href={`/explore?q=${encodeURIComponent(`#${tag.tag}`)}`} className="flux8-trend-row">
                <div><small>{index + 1} · Trending</small><strong>#{tag.tag}</strong><em>{tag.postsCount} {tag.postsCount === 1 ? "post" : "posts"}</em></div>
              </Link>
            )) : <p className="flux8-empty-rail">Post with hashtags to start a trend.</p>}
          </div>
          <Link href="/explore" className="flux8-rail-more">Show more</Link>
        </section>

        <section className="flux8-rail-card">
          <header><strong>Who to follow</strong></header>
          <div className="flux8-follow-list">
            {suggestions.length ? suggestions.map((person) => (
              <div key={person.uid} className="flux8-follow-row">
                <Link href={profilePath(person.username)}><UserAvatar user={person} size="sm" decorations={person.decorations} /></Link>
                <div className="min-w-0"><Link href={profilePath(person.username)}><strong>{person.displayName}</strong><span>@{person.username}</span></Link></div>
                <button type="button" disabled={followingMap[person.uid]} onClick={() => void onFollow(person)}>{followingMap[person.uid] ? "Following" : "Follow"}</button>
              </div>
            )) : <p className="flux8-empty-rail">No suggestions right now.</p>}
          </div>
          <Link href="/explore" className="flux8-rail-more">Show more</Link>
        </section>

        <nav className="flux8-rail-footer">
          <Link href="/help">Terms</Link><Link href="/settings">Privacy</Link><Link href="/help">Help</Link><span>© {new Date().getFullYear()} Ripo Team</span>
        </nav>
      </div>
    </aside>
  );
}
