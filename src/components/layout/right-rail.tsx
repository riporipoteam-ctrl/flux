"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Hash, Search, UserPlus } from "lucide-react";
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
  const { user, profile } = useAuth();
  const router = useRouter();
  const [suggestions, setSuggestions] = useState<UserProfile[]>([]);
  const [followingMap, setFollowingMap] = useState<Record<string, boolean>>({});
  const [tags, setTags] = useState<HashtagInfo[]>([]);
  const [queryText, setQueryText] = useState("");

  useEffect(() => {
    if (!user) return;
    const timer = window.setTimeout(() => {
      getSuggestedUsers(user.uid, 5).then(async (people) => {
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
    <aside className="flux-right-rail sticky top-0 hidden h-[100dvh] shrink-0 overflow-y-auto no-scrollbar xl:block">
      <div className="space-y-3">
        <form onSubmit={(event) => { event.preventDefault(); if (queryText.trim()) router.push(`/explore?q=${encodeURIComponent(queryText.trim())}`); }} className="flux-search-box">
          <Search className="h-4 w-4" />
          <input value={queryText} onChange={(event) => setQueryText(event.target.value)} placeholder="Search Flux" aria-label="Search Flux" />
        </form>

        {profile ? <section className="flux-rail-card"><div className="flux-rail-profile"><UserAvatar user={profile} size="md" decorations={profile.decorations} /><div><strong>{profile.displayName}</strong><span>@{profile.username}</span></div><Link href={profilePath(profile.username)}>View</Link></div></section> : null}

        <section className="flux-rail-card">
          <header><Hash className="h-4 w-4" /><strong>What’s happening</strong></header>
          <div className="flux-rail-list">
            {tags.length ? tags.map((tag, index) => <Link key={tag.tag} href={`/explore?q=${encodeURIComponent(`#${tag.tag}`)}`} className="flux-rail-row"><div><span>Trending in Flux · {index + 1}</span><strong>#{tag.tag}</strong><small>{tag.postsCount} {tag.postsCount === 1 ? "post" : "posts"}</small></div></Link>) : <p className="px-4 py-5 text-[10px] text-muted-foreground">Post with hashtags to start a trend.</p>}
          </div>
        </section>

        <section className="flux-rail-card">
          <header><UserPlus className="h-4 w-4" /><strong>People to follow</strong></header>
          <div>
            {suggestions.length ? suggestions.map((person) => <div key={person.uid} className="flux-follow-row"><Link href={profilePath(person.username)}><UserAvatar user={person} size="sm" decorations={person.decorations} /></Link><div className="min-w-0"><Link href={profilePath(person.username)} className="block text-inherit no-underline"><strong>{person.displayName}</strong><span>@{person.username}</span></Link></div><button type="button" disabled={followingMap[person.uid]} onClick={() => void onFollow(person)}>{followingMap[person.uid] ? "Following" : "Follow"}</button></div>) : <p className="px-4 py-5 text-[10px] text-muted-foreground">No suggestions right now.</p>}
          </div>
        </section>

        <nav className="flex flex-wrap gap-x-3 gap-y-1 px-2 text-[9px] text-muted-foreground">
          <Link href="/help">Help</Link><Link href="/settings">Settings</Link><Link href="/premium">Premium</Link><span>© {new Date().getFullYear()} Ripo Team</span>
        </nav>
      </div>
    </aside>
  );
}
