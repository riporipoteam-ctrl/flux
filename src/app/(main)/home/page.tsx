"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { QueryDocumentSnapshot } from "firebase/firestore";
import {
  AlertCircle,
  ChevronRight,
  Gamepad2,
  Loader2,
  Newspaper,
  Radio,
  RefreshCw,
  Sparkles,
  Users,
} from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { ComposeBox } from "@/components/posts/compose-box";
import { PostCard } from "@/components/posts/post-card";
import { EmptyState } from "@/components/shared/empty-state";
import { StoryRail } from "@/components/stories/story-rail";
import { getForYouFeed, getFollowingFeed } from "@/services/posts";
import type { PostWithAuthor } from "@/types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type FeedTab = "foryou" | "following";
type FeedCache = { posts: PostWithAuthor[]; savedAt: number };

/**
 * Scoped overrides that turn the v12 pill tabs into an X-style tab bar
 * (underline indicator, no inverted pill). Specificity is kept above the
 * global `.flux8-feed-tabs button` rules on purpose.
 */
const TAB_CSS = `
.flux8-feed-tabs.fh-tabs { display: flex !important; padding: 4px 6px 0 !important; }
.flux8-feed-tabs.fh-tabs .fh-tab {
  position: relative !important;
  flex: 1 1 0% !important;
  min-height: 53px !important;
  border-radius: 12px !important;
  background: transparent !important;
  box-shadow: none !important;
  display: flex !important;
  align-items: stretch !important;
  justify-content: center !important;
  cursor: pointer;
  transition: background-color .15s ease !important;
}
.flux8-feed-tabs.fh-tabs .fh-tab:hover { background: var(--flux-v12-surface-2) !important; }
.flux8-feed-tabs.fh-tabs .fh-tab .fh-tab-inner {
  position: relative;
  display: flex;
  align-items: center;
  padding: 0 6px;
}
.flux8-feed-tabs.fh-tabs .fh-tab .fh-tab-label {
  font-size: 15px;
  font-weight: 500;
  letter-spacing: -0.01em;
  color: var(--muted-foreground);
  transition: color .15s ease, font-weight .15s ease;
  white-space: nowrap;
}
.flux8-feed-tabs.fh-tabs .fh-tab.is-active { background: transparent !important; }
.flux8-feed-tabs.fh-tabs .fh-tab.is-active:hover { background: var(--flux-v12-surface-2) !important; }
.flux8-feed-tabs.fh-tabs .fh-tab.is-active .fh-tab-label { font-weight: 800; color: var(--foreground); }
.flux8-feed-tabs.fh-tabs .fh-tab .fh-tab-bar {
  position: absolute;
  left: 50%;
  bottom: 0;
  width: 58px;
  height: 4px;
  border-radius: 999px;
  background: var(--primary);
  transform: translateX(-50%) scaleX(0);
  transition: transform .22s cubic-bezier(.32,.72,.35,1);
}
.flux8-feed-tabs.fh-tabs .fh-tab.is-active .fh-tab-bar { transform: translateX(-50%) scaleX(1); }
.flux8-timeline-header.fh-head strong { font-size: 20px !important; letter-spacing: -0.02em; }
`;

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
      <style>{TAB_CSS}</style>

      {/* Sticky desktop header */}
      <header className="flux8-timeline-header fh-head hidden items-center justify-between lg:flex">
        <div className="flex min-w-0 flex-col">
          <strong className="font-extrabold">Home</strong>
          <span className="mt-0.5 text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
            Your Flux timeline
          </span>
        </div>
        <button
          type="button"
          onClick={() => void load(true)}
          aria-label="Refresh feed"
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-muted-foreground transition hover:bg-foreground/[0.06] hover:text-foreground active:scale-95"
        >
          <RefreshCw className={cn("h-[18px] w-[18px]", refreshing && "animate-spin")} />
        </button>
      </header>

      {/* X-style tab bar */}
      <div className="flux8-feed-tabs fh-tabs" role="tablist" aria-label="Timeline">
        <FeedTabButton active={tab === "foryou"} onClick={() => setTab("foryou")} label="For you" />
        <FeedTabButton active={tab === "following"} onClick={() => setTab("following")} label="Following" />
      </div>

      {/* Composer */}
      <section className="flux8-composer-card" aria-label="Create a post">
        <ComposeBox onSuccess={() => void load(true)} placeholder="What's happening?" />
      </section>

      {/* Stories */}
      <section className="flux8-story-card" aria-label="Stories">
        <StoryRail compact />
      </section>

      {/* Quick actions */}
      <nav className="grid grid-cols-3" aria-label="Flux quick actions">
        <QuickLaunch
          href="/ask-ai"
          icon={Sparkles}
          title="Ask AI"
          subtitle="Ripo local AI"
          gradient="bg-gradient-to-br from-violet-500 to-fuchsia-600 shadow-violet-500/25"
        />
        <QuickLaunch
          href="/live"
          icon={Radio}
          title="Live"
          subtitle="Watch now"
          gradient="bg-gradient-to-br from-rose-500 to-red-600 shadow-rose-500/25"
        />
        <QuickLaunch
          href="/flux-rec"
          icon={Gamepad2}
          title="Flux Rec"
          subtitle="Rooms and photos"
          gradient="bg-gradient-to-br from-emerald-500 to-teal-600 shadow-emerald-500/25"
        />
      </nav>

      {/* Error banner */}
      {error ? (
        <div
          role="alert"
          className="mx-3 mb-3 flex items-center gap-3 rounded-2xl border border-amber-500/25 bg-amber-500/[0.07] px-4 py-3"
        >
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400">
            <AlertCircle className="h-[18px] w-[18px]" />
          </span>
          <span className="min-w-0 flex-1 text-[13px] font-medium leading-snug text-foreground/90">
            {error}. {posts.length ? "Showing your saved timeline." : "Try again."}
          </span>
          <button
            type="button"
            onClick={() => void load(true)}
            className="shrink-0 rounded-full bg-amber-500/15 px-4 py-2 text-[13px] font-extrabold text-amber-700 transition hover:bg-amber-500/25 active:scale-95 dark:text-amber-300"
          >
            Retry
          </button>
        </div>
      ) : null}

      {/* Feed */}
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
      {loadingMore ? (
        <div className="flex items-center justify-center gap-2.5 py-7 text-sm font-semibold text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          Loading more posts&hellip;
        </div>
      ) : null}
    </main>
  );
}

function FeedTabButton({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn("fh-tab", active && "is-active")}
    >
      <span className="fh-tab-inner">
        <span className="fh-tab-label">{label}</span>
        <span className="fh-tab-bar" aria-hidden="true" />
      </span>
    </button>
  );
}

function QuickLaunch({ href, icon: Icon, title, subtitle, gradient }: {
  href: string;
  icon: typeof Sparkles;
  title: string;
  subtitle: string;
  gradient: string;
}) {
  return (
    <Link
      href={href}
      className="group flex min-w-0 items-center gap-2.5 px-3 py-2 transition active:scale-[0.98]"
    >
      <span className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-xl text-white shadow-md transition duration-200 group-hover:scale-105", gradient)}>
        <Icon className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1">
        <strong className="block truncate text-[13px] font-extrabold tracking-tight">{title}</strong>
        <small className="mt-0.5 block truncate text-[10px] font-semibold text-muted-foreground">{subtitle}</small>
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/40 transition duration-200 group-hover:translate-x-0.5 group-hover:text-muted-foreground" />
    </Link>
  );
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
  if (loading) {
    return (
      <div aria-label="Loading posts">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="flux8-post-wrap">
            <div className="flex animate-pulse gap-3 p-4">
              <div className="h-10 w-10 shrink-0 rounded-full bg-muted" />
              <div className="min-w-0 flex-1 space-y-2.5 pt-1">
                <div className="h-3.5 w-36 rounded-full bg-muted" />
                <div className="h-3.5 w-full rounded-full bg-muted" />
                <div className="h-3.5 w-5/6 rounded-full bg-muted" />
                {index % 2 === 0 ? <div className="mt-3 aspect-[16/9] w-full rounded-2xl bg-muted" /> : null}
                <div className="flex items-center justify-between px-1 pt-2">
                  <div className="h-6 w-14 rounded-full bg-muted" />
                  <div className="h-6 w-14 rounded-full bg-muted" />
                  <div className="h-6 w-14 rounded-full bg-muted" />
                  <div className="h-6 w-14 rounded-full bg-muted" />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }
  if (!posts.length) {
    return (
      <div className="px-3 pb-6">
        <EmptyState
          icon={emptyIcon}
          title={emptyTitle}
          description={emptyDescription}
          action={<Button variant="outline" onClick={onRefresh} className="rounded-full font-bold">Refresh</Button>}
        />
      </div>
    );
  }
  return (
    <>
      {posts.map((post) => (
        <div key={post.id} className="flux8-post-wrap">
          <PostCard
            post={post}
            onChange={(updated) => setPosts((previous) =>
              updated.isDeleted
                ? previous.filter((item) => item.id !== updated.id)
                : previous.map((item) => item.id === updated.id ? updated : item)
            )}
          />
        </div>
      ))}
    </>
  );
}
