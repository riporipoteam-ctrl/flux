"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { FileText, Hash, Search, Users, X } from "lucide-react";
import { toast } from "sonner";
import { PostCard } from "@/components/posts/post-card";
import { UserAvatar } from "@/components/shared/user-avatar";
import { groupPath, profilePath } from "@/lib/routes";
import { useAuth } from "@/contexts/auth-context";
import { getSuggestedUsers, searchUsers } from "@/services/users";
import { followUser, isFollowing, unfollowUser } from "@/services/follows";
import { getForYouFeed, searchPosts } from "@/services/posts";
import { getGroups } from "@/services/groups";
import { getTrendingHashtags } from "@/services/hashtags";
import type { Group, PostWithAuthor, UserProfile } from "@/types";
import { XEmpty, XPage, XRowSkeleton, XSectionTitle, XSwitch, XTabs } from "@/components/x/x-ui";
import { cn, formatCount } from "@/lib/utils";

type Tab = "posts" | "people" | "groups";

export default function ExplorePage() {
  return (
    <Suspense fallback={<XRowSkeleton rows={6} />}>
      <ExploreInner />
    </Suspense>
  );
}

function FollowButton({
  target,
  following,
  onToggle,
}: {
  target: UserProfile;
  following: boolean;
  onToggle: (target: UserProfile) => void;
}) {
  return (
    <button
      type="button"
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onToggle(target);
      }}
      className={cn("x-btn x-btn-sm flex-none", following ? "x-btn-hollow" : "x-btn-ink")}
      aria-label={following ? `Unfollow @${target.username}` : `Follow @${target.username}`}
    >
      {following ? "Following" : "Follow"}
    </button>
  );
}

function PersonRow({
  person,
  following,
  onToggle,
}: {
  person: UserProfile;
  following: boolean;
  onToggle: (target: UserProfile) => void;
}) {
  return (
    <div className="follow-row">
      <Link href={profilePath(person.username)} className="flex-none" aria-label={`@${person.username}`}>
        <UserAvatar user={person} size="sm" decorations={person.decorations} />
      </Link>
      <Link href={profilePath(person.username)} className="follow-main">
        <span className="follow-name">{person.displayName}</span>
        <span className="follow-handle">@{person.username}</span>
        {person.bio ? <span className="follow-bio">{person.bio}</span> : null}
      </Link>
      <FollowButton target={person} following={following} onToggle={onToggle} />
    </div>
  );
}

function ExploreInner() {
  const { user } = useAuth();
  const uid = user?.uid;
  const searchParams = useSearchParams();
  const initial = (searchParams.get("q") || "").replace(/^#/, "");
  const [term, setTerm] = useState(initial);
  const [tab, setTab] = useState<Tab>("posts");
  const [posts, setPosts] = useState<PostWithAuthor[]>([]);
  const [people, setPeople] = useState<UserProfile[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [tags, setTags] = useState<Array<{ tag: string; postsCount: number }>>([]);
  const [suggestions, setSuggestions] = useState<UserProfile[]>([]);
  const [latest, setLatest] = useState<PostWithAuthor[]>([]);
  const [followingMap, setFollowingMap] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [discoverLoading, setDiscoverLoading] = useState(true);

  // Trending hashtags — the backbone of the default explore view.
  useEffect(() => {
    getTrendingHashtags(12)
      .then((list) =>
        setTags(
          list
            .filter((item) => item.postsCount > 0 || item.trendingScore > 0)
            .map((item) => ({ tag: item.tag, postsCount: item.postsCount }))
        )
      )
      .catch(() => setTags([]));
  }, []);

  // Discover view: who to follow + latest posts.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setDiscoverLoading(true);
      try {
        const [suggested, feed] = await Promise.all([
          uid ? getSuggestedUsers(uid, 5).catch(() => [] as UserProfile[]) : Promise.resolve([] as UserProfile[]),
          getForYouFeed(uid, 5)
            .then((result) => result.posts)
            .catch(() => [] as PostWithAuthor[]),
        ]);
        if (cancelled) return;
        setSuggestions(suggested);
        setLatest(feed);
        if (uid && suggested.length) {
          const map: Record<string, boolean> = {};
          await Promise.all(
            suggested.map(async (person) => {
              map[person.uid] = await isFollowing(uid, person.uid).catch(() => false);
            })
          );
          if (!cancelled) setFollowingMap((previous) => ({ ...previous, ...map }));
        }
      } finally {
        if (!cancelled) setDiscoverLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [uid]);

  // Live search across posts, people and communities.
  useEffect(() => {
    const needle = term.trim();
    if (!needle) {
      setPosts([]);
      setPeople([]);
      setGroups([]);
      return;
    }
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const [foundPosts, foundPeople, allGroups] = await Promise.all([
          searchPosts(needle, uid),
          searchUsers(needle),
          getGroups(30),
        ]);
        const lower = needle.toLowerCase();
        setPosts(foundPosts);
        setPeople(foundPeople);
        setGroups(
          allGroups.filter(
            (group) =>
              group.name.toLowerCase().includes(lower) || group.description.toLowerCase().includes(lower)
          )
        );
        if (uid && foundPeople.length) {
          const map: Record<string, boolean> = {};
          await Promise.all(
            foundPeople.map(async (person) => {
              map[person.uid] = await isFollowing(uid, person.uid).catch(() => false);
            })
          );
          setFollowingMap((previous) => ({ ...previous, ...map }));
        }
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => window.clearTimeout(timer);
  }, [term, uid]);

  const toggleFollow = useCallback(
    async (target: UserProfile) => {
      if (!user) return;
      const currently = Boolean(followingMap[target.uid]);
      setFollowingMap((previous) => ({ ...previous, [target.uid]: !currently }));
      try {
        if (currently) {
          await unfollowUser(user.uid, target.uid);
        } else {
          await followUser(user.uid, target.uid);
          toast.success(`Following @${target.username}`);
        }
      } catch {
        setFollowingMap((previous) => ({ ...previous, [target.uid]: currently }));
        toast.error("Could not update follow");
      }
    },
    [user, followingMap]
  );

  const searching = Boolean(term.trim());

  return (
    <XPage>
      {/* The search field lives in the sticky header itself, the way X does. */}
      <header className="x-header x-header-search">
        <label className="flux8-rail-search !static">
          <Search className="h-[18px] w-[18px] flex-none" />
          <input
            value={term}
            onChange={(event) => setTerm(event.target.value)}
            placeholder="Search Flux"
            aria-label="Search Flux"
          />
          {term ? (
            <button
              type="button"
              onClick={() => setTerm("")}
              aria-label="Clear search"
              className="x-press grid h-8 w-8 flex-none place-items-center rounded-full hover:bg-[var(--v8-panel-3)]"
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </label>
      </header>

      {!searching ? (
        <>
          <XSectionTitle>Trends for you</XSectionTitle>
          {tags.length === 0 ? (
            <XEmpty
              icon={Hash}
              title="No trends yet"
              description="Use #hashtags in a post — the ones people actually use show up here."
            />
          ) : (
            <ul>
              {tags.map((entry, index) => (
                <li key={entry.tag}>
                  <button type="button" onClick={() => setTerm(entry.tag)} className="trend-row">
                    <span className="trend-meta">
                      {index + 1} · Trending
                    </span>
                    <strong className="trend-topic">#{entry.tag}</strong>
                    <span className="trend-count">
                      {formatCount(entry.postsCount)} {entry.postsCount === 1 ? "post" : "posts"}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {user && suggestions.length > 0 ? (
            <>
              <XSectionTitle>Who to follow</XSectionTitle>
              <div>
                {suggestions.map((person) => (
                  <PersonRow
                    key={person.uid}
                    person={person}
                    following={Boolean(followingMap[person.uid])}
                    onToggle={toggleFollow}
                  />
                ))}
              </div>
            </>
          ) : null}

          <XSectionTitle>Latest posts</XSectionTitle>
          {discoverLoading ? (
            <XRowSkeleton rows={4} />
          ) : latest.length === 0 ? (
            <XEmpty
              icon={FileText}
              title="Nothing posted yet"
              description="Be the first to post something on Flux."
            />
          ) : (
            <div>
              {latest.map((post) => (
                <div key={post.id} className="flux8-post-wrap">
                  <PostCard post={post} />
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        <>
          <XTabs
            value={tab}
            onChange={setTab}
            tabs={[
              { id: "posts", label: "Posts" },
              { id: "people", label: "People" },
              { id: "groups", label: "Communities" },
            ]}
          />

          <XSwitch id={tab}>
            {loading ? (
              <XRowSkeleton rows={5} />
            ) : tab === "posts" ? (
              posts.length === 0 ? (
                <XEmpty icon={FileText} title="No posts found" description="Try another keyword or hashtag." />
              ) : (
                <div>
                  {posts.map((post) => (
                    <div key={post.id} className="flux8-post-wrap">
                      <PostCard post={post} />
                    </div>
                  ))}
                </div>
              )
            ) : tab === "people" ? (
              people.length === 0 ? (
                <XEmpty icon={Users} title="No people found" description="Try a different name or @handle." />
              ) : (
                <div>
                  {people.map((person) => (
                    <PersonRow
                      key={person.uid}
                      person={person}
                      following={Boolean(followingMap[person.uid])}
                      onToggle={toggleFollow}
                    />
                  ))}
                </div>
              )
            ) : groups.length === 0 ? (
              <XEmpty icon={Users} title="No communities found" description="Create one from the Communities tab." />
            ) : (
              <ul>
                {groups.map((group) => (
                  <li key={group.id}>
                    <Link href={groupPath(group.id)} className="x-row">
                      <span className="x-row-icon">
                        <Users className="h-[18px] w-[18px]" />
                      </span>
                      <span className="x-row-main">
                        <strong>{group.name}</strong>
                        <span className="line-clamp-1">{group.description || "No description"}</span>
                        <span>
                          {formatCount(group.memberCount)} members · {group.isPrivate ? "Private" : "Public"}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </XSwitch>
        </>
      )}
    </XPage>
  );
}
