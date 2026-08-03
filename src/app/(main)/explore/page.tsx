"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { FileText, Hash, Search, TrendingUp, Users, X } from "lucide-react";
import { PostCard } from "@/components/posts/post-card";
import { UserAvatar } from "@/components/shared/user-avatar";
import { groupPath, profilePath } from "@/lib/routes";
import { useAuth } from "@/contexts/auth-context";
import { searchUsers } from "@/services/users";
import { searchPosts } from "@/services/posts";
import { getGroups } from "@/services/groups";
import { getTrendingHashtags } from "@/services/hashtags";
import type { Group, PostWithAuthor, UserProfile } from "@/types";
import { XEmpty, XPage, XRowSkeleton, XSwitch, XTabs } from "@/components/x/x-ui";
import { formatCount } from "@/lib/utils";

type Tab = "posts" | "people" | "groups";

export default function ExplorePage() {
  return (
    <Suspense fallback={<XRowSkeleton rows={6} />}>
      <ExploreInner />
    </Suspense>
  );
}

function ExploreInner() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const initial = (searchParams.get("q") || "").replace(/^#/, "");
  const [term, setTerm] = useState(initial);
  const [tab, setTab] = useState<Tab>("posts");
  const [posts, setPosts] = useState<PostWithAuthor[]>([]);
  const [people, setPeople] = useState<UserProfile[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [tags, setTags] = useState<Array<{ tag: string; postsCount: number }>>([]);
  const [loading, setLoading] = useState(false);

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
          searchPosts(needle, user?.uid),
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
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => window.clearTimeout(timer);
  }, [term, user?.uid]);

  const searching = Boolean(term.trim());

  return (
    <XPage>
      {/* Explore puts the search field in the header itself, the way X does,
          instead of stacking a title row on top of a search row. */}
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
            <button type="button" onClick={() => setTerm("")} aria-label="Clear search" className="x-press flex-none">
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </label>
      </header>

      {!searching ? (
        <>
          <h2 className="x-section-title">
            <TrendingUp className="h-[18px] w-[18px] text-[var(--v8-accent)]" /> Trends for you
          </h2>
          {tags.length === 0 ? (
            <XEmpty
              icon={Hash}
              title="No trends yet"
              description="Use #hashtags in a post — the ones people actually use show up here."
            />
          ) : (
            <ul className="x-stagger">
              {tags.map((entry, index) => (
                <li key={entry.tag} style={{ ["--i" as string]: Math.min(index, 12) }}>
                  <button type="button" onClick={() => setTerm(entry.tag)} className="x-row">
                    <span className="x-row-main">
                      <span className="block text-[13px] text-[var(--v8-muted)]">#{index + 1} · Trending</span>
                      <strong className="text-[15px]">#{entry.tag}</strong>
                      <span>{formatCount(entry.postsCount)} posts</span>
                    </span>
                    <Hash className="h-[18px] w-[18px] flex-none text-[var(--v8-muted)]" />
                  </button>
                </li>
              ))}
            </ul>
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
                <div className="x-stagger">
                  {posts.map((post, index) => (
                    <div key={post.id} className="flux8-post-wrap" style={{ ["--i" as string]: Math.min(index, 12) }}>
                      <PostCard post={post} />
                    </div>
                  ))}
                </div>
              )
            ) : tab === "people" ? (
              people.length === 0 ? (
                <XEmpty icon={Users} title="No people found" description="Try a different name or @handle." />
              ) : (
                <ul className="x-stagger">
                  {people.map((person, index) => (
                    <li key={person.uid} style={{ ["--i" as string]: Math.min(index, 12) }}>
                      <Link href={profilePath(person.username)} className="x-row">
                        <UserAvatar user={person} />
                        <span className="x-row-main">
                          <strong>{person.displayName}</strong>
                          <span>@{person.username}</span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )
            ) : groups.length === 0 ? (
              <XEmpty icon={Users} title="No communities found" description="Create one from the Communities tab." />
            ) : (
              <ul className="x-stagger">
                {groups.map((group, index) => (
                  <li key={group.id} style={{ ["--i" as string]: Math.min(index, 12) }}>
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
