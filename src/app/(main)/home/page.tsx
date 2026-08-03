"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { QueryDocumentSnapshot } from "firebase/firestore";
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
  return `flux-feed-cache-v2-${uid}-${tab}`;
}

function readCache(uid: string, tab: FeedTab): FeedCache | null {
  try { return JSON.parse(sessionStorage.getItem(cacheKey(uid, tab)) || "null") as FeedCache | null; }
  catch { return null; }
}

function saveCache(uid: string, tab: FeedTab, posts: PostWithAuthor[]): void {
  try { sessionStorage.setItem(cacheKey(uid, tab), JSON.stringify({ posts: posts.slice(0, 80), savedAt: Date.now() })); }
  catch { /* private browsing */ }
}

async function withTimeout<T>(promise: Promise<T>, milliseconds: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => { timer = setTimeout(() => reject(new Error("Feed loading timed out")), milliseconds); }),
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
  const cursorRef = useRef<QueryDocumentSnapshot | null>(null);
  const hasMoreRef = useRef(true);
  const loadingMoreRef = useRef(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async (force = false) => {
    if (!user) return;
    const cached = readCache(user.uid, tab);
    if (cached?.posts.length && !force) {
      setPosts(cached.posts);
      setLoading(false);
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);
    hasMoreRef.current = true;
    cursorRef.current = null;

    try {
      if (tab === "following") {
        const data = await withTimeout(getFollowingFeed(user.uid), 12_000);
        setPosts(data);
        saveCache(user.uid, tab, data);
        hasMoreRef.current = false;
      } else {
        const page = await withTimeout(getForYouFeed(user.uid, 20), 12_000);
        setPosts(page.posts);
        saveCache(user.uid, tab, page.posts);
        cursorRef.current = page.lastDoc;
        hasMoreRef.current = Boolean(page.lastDoc) && page.posts.length >= 20;
      }
    } catch (cause) {
      console.error(cause);
      if (!cached?.posts.length) setPosts([]);
      setError(cause instanceof Error ? cause.message : "Could not load the timeline");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [tab, user]);

  const loadMore = useCallback(async () => {
    if (!user || tab !== "foryou" || loadingMoreRef.current || !hasMoreRef.current || !cursorRef.current) return;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    try {
      const page = await withTimeout(getForYouFeed(user.uid, 20, cursorRef.current), 12_000);
      cursorRef.current = page.lastDoc;
      hasMoreRef.current = Boolean(page.lastDoc) && page.posts.length >= 20;
      setPosts((current) => {
        const known = new Set(current.map((post) => post.id));
        const next = [...current, ...page.posts.filter((post) => !known.has(post.id))];
        saveCache(user.uid, tab, next);
        return next;
      });
    } catch {
      hasMoreRef.current = false;
    } finally {
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }
  }, [tab, user]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    const target = sentinelRef.current;
    if (!target || tab !== "foryou") return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) void loadMore();
    }, { rootMargin: "700px 0px" });
    observer.observe(target);
    return () => observer.disconnect();
  }, [loadMore, tab]);

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

      <section className="flux8-composer-card"><ComposeBox onSuccess={() => void load(true)} placeholder="What is happening?" /></section>
      <section className="flux8-story-card"><StoryRail compact /></section>

      <FeedList
        loading={loading}
        posts={posts}
        emptyTitle={tab === "following" ? "No posts from people you follow" : "Your timeline is quiet"}
        emptyDescription={tab === "following" ? "Follow people to build your Following timeline." : "Post something or follow people to fill this timeline."}
        emptyIcon={tab === "following" ? Users : Newspaper}
        onRefresh={() => void load(true)}
        setPosts={(update) => setPosts((previous) => {
          const next = typeof update === "function" ? update(previous) : update;
          if (user) saveCache(user.uid, tab, next);
          return next;
        })}
      />
      <div ref={sentinelRef} className="h-1" aria-hidden="true" />
      {loadingMore ? <div className="flux8-loading-more">Loading more posts…</div> : null}
    </main>
  );
}

function FeedTabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button type="button" onClick={onClick} className={active ? "is-active" : ""}><span>{children}</span></button>;
}

function FeedList({ loading, posts, emptyTitle, emptyDescription, emptyIcon = Newspaper, onRefresh, setPosts }: {
  loading: boolean;
  posts: PostWithAuthor[];
  emptyTitle: string;
  emptyDescription: string;
  emptyIcon?: typeof Newspaper;
  onRefresh: () => void;
  setPosts: React.Dispatch<React.SetStateAction<PostWithAuthor[]>>;
}) {
  if (loading) return <div aria-label="Loading posts">{Array.from({ length: 4 }).map((_, index) => <div key={index} className="flux8-post-skeleton"><div className="skeleton h-10 w-10 shrink-0 rounded-full" /><div className="min-w-0 flex-1 space-y-2"><div className="skeleton h-4 w-40 rounded" /><div className="skeleton h-4 w-full rounded" /><div className="skeleton h-4 w-4/5 rounded" />{index % 2 === 0 ? <div className="skeleton mt-3 aspect-video w-full rounded-2xl" /> : null}</div></div>)}</div>;
  if (!posts.length) return <EmptyState icon={emptyIcon} title={emptyTitle} description={emptyDescription} action={<Button variant="outline" onClick={onRefresh}>Refresh</Button>} />;
  return <>{posts.map((post) => <div key={post.id} className="flux8-post-wrap"><PostCard post={post} onChange={(updated) => setPosts((previous) => updated.isDeleted ? previous.filter((item) => item.id !== updated.id) : previous.map((item) => item.id === updated.id ? updated : item))} /></div>)}</>;
}
