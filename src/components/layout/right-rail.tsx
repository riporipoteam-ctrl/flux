"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Plus } from "lucide-react";
import { UserAvatar } from "@/components/shared/user-avatar";
import { VerifiedBadge } from "@/components/shared/verified-badge";
import { useAuth } from "@/contexts/auth-context";
import { getSuggestedUsers } from "@/services/users";
import { followUser, isFollowing } from "@/services/follows";
import { getTrendingHashtags, type HashtagInfo } from "@/services/hashtags";
import type { UserProfile } from "@/types";
import { toast } from "sonner";

import { profilePath } from "@/lib/routes";

export function RightRail() {
  const { user } = useAuth();
  const [suggestions, setSuggestions] = useState<UserProfile[]>([]);
  const [followingMap, setFollowingMap] = useState<Record<string, boolean>>({});
  const [tags, setTags] = useState<HashtagInfo[]>([]);

  useEffect(() => {
    if (!user) return;
    const timer = window.setTimeout(() => {
      getSuggestedUsers(user.uid, 3)
        .then(async (people) => {
          setSuggestions(people);
          const map: Record<string, boolean> = {};
          await Promise.all(
            people.map(async (person) => {
              map[person.uid] = await isFollowing(user.uid, person.uid);
            }),
          );
          setFollowingMap(map);
        })
        .catch(() => setSuggestions([]));
    }, 100);
    return () => window.clearTimeout(timer);
  }, [user]);

  useEffect(() => {
    const timer = window.setTimeout(
      () =>
        getTrendingHashtags(4)
          .then(setTags)
          .catch(() => setTags([])),
      70,
    );
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
    <aside className="xxrail-col" aria-label="Discover on Flux">
      <div className="xxrail">
        <section className="xxrail-card" aria-label="People to follow">
          <span className="flux-rail-caption">A bigger circle</span>
          <h2>Find your people</h2>
          {suggestions.length ? (
            suggestions.map((person) => (
              <div key={person.uid} className="xxrail-person">
                <Link
                  href={profilePath(person.username)}
                  aria-label={`${person.displayName} profile`}
                >
                  <UserAvatar
                    user={person}
                    size="md"
                    decorations={person.decorations}
                    clickable={false}
                  />
                </Link>
                <div className="xxrail-names">
                  <Link href={profilePath(person.username)}>
                    <strong>
                      {person.displayName}
                      {person.isVerified ? (
                        <VerifiedBadge className="h-3.5 w-3.5" />
                      ) : null}
                    </strong>
                    <span>@{person.username}</span>
                  </Link>
                </div>
                <button
                  type="button"
                  className="flux-follow-button"
                  disabled={followingMap[person.uid]}
                  onClick={() => void onFollow(person)}
                  aria-label={
                    followingMap[person.uid]
                      ? `Following ${person.displayName}`
                      : `Follow ${person.displayName}`
                  }
                >
                  {followingMap[person.uid] ? "Following" : <Plus size={15} />}
                </button>
              </div>
            ))
          ) : (
            <p className="xxrail-sub">
              New connections will appear here as your network grows.
            </p>
          )}
          <Link href="/explore" className="xxrail-more">
            Discover people <ArrowUpRight size={13} />
          </Link>
        </section>
        <section className="xxrail-card" aria-label="Trending conversations">
          <span className="flux-rail-caption">In the conversation</span>
          <h2>Trending on Flux</h2>
          {tags.length ? (
            tags.map((tag, index) => (
              <Link
                key={tag.tag}
                href={`/explore?q=${encodeURIComponent(`#${tag.tag}`)}`}
                className="xxrail-row"
              >
                <small>{String(index + 1).padStart(2, "0")} / Trending</small>
                <strong>#{tag.tag}</strong>
                <em>{tag.postsCount} posts</em>
              </Link>
            ))
          ) : (
            <p className="xxrail-sub">
              Start a conversation with a hashtag. The topics people share show
              up here.
            </p>
          )}
          <Link href="/explore" className="xxrail-more">
            Explore conversations <ArrowUpRight size={13} />
          </Link>
        </section>
        <section className="xxrail-card xxrail-premium">
          <span className="flux-rail-caption">More room to create</span>
          <h2>Make more of Flux.</h2>
          <p className="xxrail-sub">
            Explore creator tools, profile customization, and Premium features.
          </p>
          <Link href="/premium" className="xxbtn xxbtn-blue">
            Explore Premium <ArrowUpRight size={13} />
          </Link>
        </section>
        <nav className="xxrail-footer" aria-label="Legal and help">
          <Link href="/help">About</Link>
          <Link href="/help">Privacy</Link>
          <Link href="/help">Terms</Link>
          <Link href="/help">Help</Link>
          <span>© {new Date().getFullYear()} Flux by Ripo Team</span>
        </nav>
      </div>
    </aside>
  );
}
