"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { Search, Hash, Users, FileText, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PostCard } from "@/components/posts/post-card";
import { UserAvatar } from "@/components/shared/user-avatar";
import { EmptyState } from "@/components/shared/empty-state";
import { useAuth } from "@/contexts/auth-context";
import { searchUsers } from "@/services/users";
import { searchPosts } from "@/services/posts";
import { getGroups } from "@/services/groups";
import type { PostWithAuthor, UserProfile, Group } from "@/types";
import Link from "next/link";
import { getTrendingHashtags } from "@/services/hashtags";

export default function ExplorePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      }
    >
      <ExploreInner />
    </Suspense>
  );
}

function ExploreInner() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const initial = (searchParams.get("q") || "").replace(/^#/, "");
  const [q, setQ] = useState(initial);
  const [tab, setTab] = useState("posts");
  const [posts, setPosts] = useState<PostWithAuthor[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [tags, setTags] = useState<{ tag: string; postsCount: number }[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getTrendingHashtags(12)
      .then((list) =>
        setTags(
          list
            .filter((t) => t.postsCount > 0 || t.trendingScore > 0)
            .map((t) => ({ tag: t.tag, postsCount: t.postsCount }))
        )
      )
      .catch(() => setTags([]));
  }, []);

  useEffect(() => {
    const term = q.trim();
    if (!term) {
      setPosts([]);
      setUsers([]);
      setGroups([]);
      return;
    }
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const [p, u, g] = await Promise.all([
          searchPosts(term, user?.uid),
          searchUsers(term),
          getGroups(30).then((all) =>
            all.filter(
              (x) =>
                x.name.toLowerCase().includes(term.toLowerCase()) ||
                x.description.toLowerCase().includes(term.toLowerCase())
            )
          ),
        ]);
        setPosts(p);
        setUsers(u);
        setGroups(g);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [q, user?.uid]);

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 space-y-3 glass border-b border-border px-4 py-3">
        <h1 className="text-lg font-bold">Explore</h1>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search posts, people, hashtags, groups…"
            className="h-11 rounded-full bg-muted/60 pl-10"
          />
        </div>
      </header>

      {!q.trim() ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-4">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <Hash className="h-4 w-4 text-primary" /> Trending hashtags
          </h2>
          {tags.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No real hashtags yet. Use #words in a post — they show up here once used.
            </p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {tags.map((t, i) => (
                <button
                  key={t.tag}
                  type="button"
                  onClick={() => setQ(t.tag)}
                  className="rounded-2xl border border-border bg-card p-3 text-left shadow-soft transition hover:border-primary/30 hover:bg-muted/40"
                >
                  <p className="text-xs text-muted-foreground">#{i + 1} Trending</p>
                  <p className="font-semibold">#{t.tag}</p>
                  <p className="text-xs text-muted-foreground">{t.postsCount} posts</p>
                </button>
              ))}
            </div>
          )}
        </motion.div>
      ) : (
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="posts">Posts</TabsTrigger>
            <TabsTrigger value="people">People</TabsTrigger>
            <TabsTrigger value="groups">Groups</TabsTrigger>
          </TabsList>
          <TabsContent value="posts">
            {loading ? (
              <FeedSkeleton />
            ) : posts.length === 0 ? (
              <EmptyState
                icon={FileText}
                title="No posts found"
                description="Try another keyword or hashtag."
              />
            ) : (
              posts.map((p) => <PostCard key={p.id} post={p} />)
            )}
          </TabsContent>
          <TabsContent value="people">
            {users.length === 0 ? (
              <EmptyState icon={Users} title="No people found" description="Try a different name." />
            ) : (
              <ul className="divide-y divide-border">
                {users.map((u) => (
                  <li key={u.uid}>
                    <Link
                      href={`/${u.username}`}
                      className="flex items-center gap-3 px-4 py-3 transition hover:bg-muted/40"
                    >
                      <UserAvatar user={u} />
                      <div>
                        <p className="font-semibold">{u.displayName}</p>
                        <p className="text-sm text-muted-foreground">@{u.username}</p>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </TabsContent>
          <TabsContent value="groups">
            {groups.length === 0 ? (
              <EmptyState icon={Users} title="No groups found" description="Create one from Groups." />
            ) : (
              <ul className="divide-y divide-border">
                {groups.map((g) => (
                  <li key={g.id}>
                    <Link
                      href={`/groups/${g.id}`}
                      className="block px-4 py-3 transition hover:bg-muted/40"
                    >
                      <p className="font-semibold">{g.name}</p>
                      <p className="line-clamp-1 text-sm text-muted-foreground">
                        {g.description || "No description"}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {g.memberCount} members · {g.isPrivate ? "Private" : "Public"}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

function FeedSkeleton() {
  return (
    <div className="space-y-0">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex gap-3 border-b border-border p-4">
          <div className="skeleton h-10 w-10 rounded-full" />
          <div className="flex-1 space-y-2">
            <div className="skeleton h-4 w-1/3" />
            <div className="skeleton h-4 w-full" />
          </div>
        </div>
      ))}
    </div>
  );
}
