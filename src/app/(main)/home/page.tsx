"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AlertCircle, Newspaper, RefreshCw, Users } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { ComposeBox } from "@/components/posts/compose-box";
import { PostCard } from "@/components/posts/post-card";
import { EmptyState } from "@/components/shared/empty-state";
import { StoryRail } from "@/components/stories/story-rail";
import { getForYouFeed, getFollowingFeed } from "@/services/posts";
import type { PostWithAuthor } from "@/types";
import { Button } from "@/components/ui/button";

type FeedTab = "foryou" | "following";
type FeedCache = { posts: PostWithAuthor[]; savedAt: number };

function cacheKey(uid: string, tab: FeedTab): string {
  return `flux-feed-cache-v1-${uid}-${tab}`;
}

function readCache(uid: string, tab: FeedTab): FeedCache | null {
  try {
    return JSON.parse(sessionStorage.getItem(cacheKey(uid, tab)) || "null") as FeedCache | null;
  } catch {
    return null;
  }
}

function saveCache(uid: string, tab: FeedTab, posts: PostWithAuthor[]): void {
  try {
    sessionStorage.setItem(cacheKey(uid, tab), JSON.stringify({ posts: posts.slice(0, 60), savedAt: Date.now() }));
  } catch {
    // Storage can be unavailable in private browsing; the live feed still works.
  }
}

async function withTimeout<T>(promise: Promise<T>, milliseconds: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error("Feed loading timed out")), milliseconds);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export default function HomePage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<FeedTab>("foryou");
  const [posts, setPosts] = useState<PostWithAuthor[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loadingMoreRef = useRef(false);
  const hasMoreRef = useRef(true);
  const postsLenRef = useRef(0);

  const load = useCallback(async (force = false) => {
    if (!user) return;
    const cached = readCache(user.uid, tab);
    if (cached?.posts.length && !force) {
      setPosts(cached.posts);
      postsLenRef.current = cached.posts.length;
      setLoading(false);
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);
    hasMoreRef.current = true;

    try {
      const data = tab === "following"
        ? await withTimeout(getFollowingFeed(user.uid), 12_000)
        : (await withTimeout(getForYouFeed(user.uid, 20), 12_000)).posts;
      setPosts(data);
      saveCache(user.uid, tab, data);
      postsLenRef.current = data.length;
      hasMoreRef.current = tab === "foryou" && data.length >= 20;
    } catch (cause) {
      console.error(cause);
      if (!cached?.posts.length) setPosts([]);
      setError(cause instanceof Error ? cause.message : "Could not load the timeline");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [tab, user]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (tab !== "foryou" || !user) return;
    const onScroll = () => {
      if (loadingMoreRef.current || !hasMoreRef.current) return;
      if (window.innerHeight + window.scrollY < document.documentElement.scrollHeight - 500) return;
      loadingMoreRef.current = true;
      setLoadingMore(true);
      const previousLength = postsLenRef.current;
      withTimeout(getForYouFeed(user.uid, Math.min(previousLength + 20, 60)), 12_000)
        .then(({ posts: data }) => {
          setPosts((previous) => {
            const ids = new Set(previous.map((post) => post.id));
            const merged = [...previous];
            let added = 0;
            for (const post of data) {
              if (!ids.has(post.id)) {
                merged.push(post);
                added += 1;
              }
            }
            postsLenRef.current = merged.length;
            if (added === 0) hasMoreRef.current = false;
            saveCache(user.uid, tab, merged);
            return merged;
          });
        })
        .catch(() => { hasMoreRef.current = false; })
        .finally(() => {
          loadingMoreRef.current = false;
          setLoadingMore(false);
        });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [tab, user]);

  return (
    <main className="flux8-feed">
      <header className="flux8-timeline-header hidden lg:flex">
        <strong>Home</strong>
        <button type="button" onClick={() => void load(true)} aria-label="Refresh feed"><RefreshCw className={refreshing ? "h-[18px] w-[18px] animate-spin" : "h-[18px] w-[18px]"} /></button>
      </header>

      <div className="flux8-feed-tabs">
        <FeedTabButton active={tab === "foryou"} onClick={() => setTab("foryou")}>For you</FeedTabButton>
        <FeedTabButton active={tab === "following"} onClick={() => setTab("following")}>Following</FeedTabButton>
      </div>

      {error ? <div className="flex items-center gap-3 border-b border-border bg-amber-500/8 px-4 py-3 text-sm"><AlertCircle className="h-4 w-4 text-amber-600" /><span className="min-w-0 flex-1">{error}. {posts.length ? "Showing your saved timeline." : "Try again."}</span><button type="button" onClick={() => void load(true)} className="font-bold text-primary">Retry</button></div> : null}

      <section className="flux8-composer-card">
        <ComposeBox onSuccess={() => void load(true)} placeholder="What is happening?!" />
      </section>

      <section className="flux8-story-card"><StoryRail /></section>

      <FeedList
        loading={loading}
        loadingMore={loadingMore}
        posts={posts}
        emptyTitle={tab === "following" ? "No posts from people you follow" : "Your timeline is quiet"}
        emptyDescription={tab === "following" ? "Follow people to build your Following timeline." : "Post something or follow people to fill this timeline."}
        emptyIcon={tab === "following" ? Users : Newspaper}
        onRefresh={() => void load(true)}
        setPosts={(update) => {
          setPosts((previous) => {
            const next = typeof update === "function" ? update(previous) : update;
            if (user) saveCache(user.uid, tab, next);
            return next;
          });
        }}
      />
    </main>
  );
}

function FeedTabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button type="button" onClick={onClick} className={active ? "is-active" : ""}><span>{children}</span></button>;
}

function FeedList({ loading, posts, emptyTitle, emptyDescription, emptyIcon = Newspaper, onRefresh, setPosts, loadingMore = false }: {
  loading: boolean;
  posts: PostWithAuthor[];
  emptyTitle: string;
  emptyDescription: string;
  emptyIcon?: typeof Newspaper;
  onRefresh: () => void;
  setPosts: React.Dispatch<React.SetStateAction<PostWithAuthor[]>>;
  loadingMore?: boolean;
}) {
  if (loading) {
    return <div aria-label="Loading posts">{Array.from({ length: 4 }).map((_, index) => <div key={index} className="flux8-post-skeleton"><div className="skeleton h-10 w-10 shrink-0 rounded-full" /><div className="min-w-0 flex-1 space-y-2"><div className="skeleton h-4 w-40 rounded" /><div className="skeleton h-4 w-full rounded" /><div className="skeleton h-4 w-4/5 rounded" />{index % 2 === 0 ? <div className="skeleton mt-3 aspect-video w-full rounded-2xl" /> : null}</div></div>)}</div>;
  }

  if (!posts.length) return <EmptyState icon={emptyIcon} title={emptyTitle} description={emptyDescription} action={<Button variant="outline" onClick={onRefresh}>Refresh</Button>} />;

  return <>{posts.map((post) => <div key={post.id} className="flux8-post-wrap"><PostCard post={post} onChange={(updated) => setPosts((previous) => updated.isDeleted ? previous.filter((item) => item.id !== updated.id) : previous.map((item) => item.id === updated.id ? updated : item))} /></div>)}{loadingMore ? <div className="flux8-loading-more">Loading more…</div> : null}</>;
}
