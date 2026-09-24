"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { UserAvatar } from "@/components/shared/user-avatar";
import { VerifiedBadge } from "@/components/shared/verified-badge";
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
      getSuggestedUsers(user.uid, 3).then(async (people) => {
        setSuggestions(people);
        const map: Record<string, boolean> = {};
        await Promise.all(people.map(async (person) => { map[person.uid] = await isFollowing(user.uid, person.uid); }));
        setFollowingMap(map);
      }).catch(() => setSuggestions([]));
    }, 100);
    return () => window.clearTimeout(timer);
  }, [user]);

  useEffect(() => {
    const timer = window.setTimeout(() => getTrendingHashtags(4).then(setTags).catch(() => setTags([])), 70);
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
    <div className="xxrail-col">
      <aside className="xxrail" aria-label="Trends and suggestions">
        <div className="xxrail-search">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (queryText.trim()) router.push(`/explore?q=${encodeURIComponent(queryText.trim())}`);
            }}
            role="search"
          >
            <Search aria-hidden />
            <input
              value={queryText}
              onChange={(event) => setQueryText(event.target.value)}
              placeholder="Search"
              aria-label="Search Flux"
            />
          </form>
        </div>

        <section className="xxrail-card xxrail-premium" aria-label="Premium">
          <h2>Subscribe to Premium</h2>
          <p className="xxrail-sub">Subscribe to unlock new features and if eligible, receive a share of revenue.</p>
          <Link href="/premium" className="xxbtn xxbtn-blue">Subscribe</Link>
        </section>

        <section className="xxrail-card" aria-label="What's happening">
          <h2>What&apos;s happening</h2>
          <div>
            {tags.length ? tags.map((tag, index) => (
              <Link key={tag.tag} href={`/explore?q=${encodeURIComponent(`#${tag.tag}`)}`} className="xxrail-row">
                <small>{index + 1} · Trending</small>
                <strong className="xxrail-topic">#{tag.tag}</strong>
                <em>{typeof tag.postsCount === "number" ? `${tag.postsCount} posts` : "Trending now"}</em>
              </Link>
            )) : (
              <p className="xxrail-sub">Post with hashtags to start a trend.</p>
            )}
          </div>
          <Link href="/explore" className="xxrail-more">Show more</Link>
        </section>

        <section className="xxrail-card" aria-label="Who to follow">
          <h2>Who to follow</h2>
          <div>
            {suggestions.length ? suggestions.map((person) => (
              <div key={person.uid} className="xxrail-person">
                <Link href={profilePath(person.username)} aria-label={`${person.displayName} profile`}>
                  <UserAvatar user={person} size="md" decorations={person.decorations} clickable={false} />
                </Link>
                <div className="xxrail-names">
                  <Link href={profilePath(person.username)} style={{ textDecoration: "none", color: "inherit" }}>
                    <strong>
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{person.displayName}</span>
                      {person.isVerified ? <VerifiedBadge className="h-[18px] w-[18px]" /> : null}
                    </strong>
                    <span>@{person.username}</span>
                  </Link>
                </div>
                <button
                  type="button"
                  className="xxbtn xxbtn-black"
                  disabled={followingMap[person.uid]}
                  onClick={() => void onFollow(person)}
                  style={followingMap[person.uid] ? { opacity: 0.55 } : undefined}
                >
                  {followingMap[person.uid] ? "Following" : "Follow"}
                </button>
              </div>
            )) : (
              <p className="xxrail-sub">No suggestions right now.</p>
            )}
          </div>
          <Link href="/explore" className="xxrail-more">Show more</Link>
        </section>

        <nav className="xxrail-footer" aria-label="Footer">
          <Link href="/help">Terms of Service</Link>
          <Link href="/help">Privacy Policy</Link>
          <Link href="/help">Cookie Policy</Link>
          <Link href="/help">Accessibility</Link>
          <Link href="/help">Ads info</Link>
          <Link href="/settings">More ···</Link>
          <span>© {new Date().getFullYear()} Flux</span>
        </nav>
      </aside>
    </div>
  );
}
