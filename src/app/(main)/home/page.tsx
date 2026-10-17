"use client";

import Link from "next/link";
import { RefreshCw, Compass } from "lucide-react";
import { XEmpty } from "@/components/x/x-ui";
import { useCallback, useEffect, useRef, useState } from "react";
import type { QueryDocumentSnapshot } from "firebase/firestore";
import { useAuth } from "@/contexts/auth-context";
import { ComposeBox } from "@/components/posts/compose-box";
import { PostCard } from "@/components/posts/post-card";
import { getForYouFeed, getFollowingFeed } from "@/services/posts";
import type { PostWithAuthor } from "@/types";
import { cn } from "@/lib/utils";

type FeedTab = "foryou" | "following";
type FeedCache = { posts: PostWithAuthor[]; savedAt: number };

function cacheKey(uid: string, tab: FeedTab): string {
  return `flux-feed-cache-v2-${uid}-${tab}`;
}

function readCache(uid: string, tab: FeedTab): FeedCache | null {
  try {
    return JSON.parse(
      sessionStorage.getItem(cacheKey(uid, tab)) || "null",
    ) as FeedCache | null;
  } catch {
    return null;
  }
}

function saveCache(uid: string, tab: FeedTab, posts: PostWithAuthor[]): void {
  try {
    sessionStorage.setItem(
      cacheKey(uid, tab),
      JSON.stringify({ posts: posts.slice(0, 80), savedAt: Date.now() }),
    );
  } catch {
    /* private browsing */
  }
}

async function withTimeout<T>(
  promise: Promise<T>,
  milliseconds: number,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error("Feed loading timed out")),
          milliseconds,
        );
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
  const [moreError, setMoreError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const cursorRef = useRef<QueryDocumentSnapshot | null>(null);
  const hasMoreRef = useRef(true);
  const loadingMoreRef = useRef(false);
  const moreErrorRef = useRef(false);
  // A slower request from another tab must never replace the active feed.
  const requestIdRef = useRef(0);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const load = useCallback(
    async (force = false) => {
      if (!user) return;
      requestIdRef.current += 1;
      const requestId = requestIdRef.current;
      const isCurrent = () => requestId === requestIdRef.current;
      loadingMoreRef.current = false;
      moreErrorRef.current = false;
      setLoadingMore(false);
      setMoreError(null);
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
          if (!isCurrent()) return;
          setPosts(data);
          saveCache(user.uid, tab, data);
          hasMoreRef.current = false;
        } else {
          const page = await withTimeout(getForYouFeed(user.uid, 20), 12_000);
          if (!isCurrent()) return;
          setPosts(page.posts);
          saveCache(user.uid, tab, page.posts);
          cursorRef.current = page.lastDoc;
          hasMoreRef.current = page.hasMore;
        }
      } catch (cause) {
        if (!isCurrent()) return;
        console.error(cause);
        if (!cached?.posts.length) setPosts([]);
        setError(
          cause instanceof Error
            ? cause.message
            : "Could not load the timeline",
        );
      } finally {
        if (isCurrent()) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [tab, user],
  );

  const loadMore = useCallback(async () => {
    if (
      !user ||
      tab !== "foryou" ||
      loadingMoreRef.current ||
      moreErrorRef.current ||
      !hasMoreRef.current ||
      !cursorRef.current
    )
      return;
    const requestId = requestIdRef.current;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    setMoreError(null);
    try {
      const page = await withTimeout(
        getForYouFeed(user.uid, 20, cursorRef.current),
        12_000,
      );
      if (requestId !== requestIdRef.current) return;
      cursorRef.current = page.lastDoc;
      hasMoreRef.current = page.hasMore;
      setPosts((current) => {
        const known = new Set(current.map((post) => post.id));
        const next = [
          ...current,
          ...page.posts.filter((post) => !known.has(post.id)),
        ];
        saveCache(user.uid, tab, next);
        return next;
      });
    } catch (cause) {
      if (requestId === requestIdRef.current) {
        moreErrorRef.current = true;
        setMoreError(
          cause instanceof Error ? cause.message : "Could not load more posts",
        );
      }
    } finally {
      if (requestId === requestIdRef.current) {
        loadingMoreRef.current = false;
        setLoadingMore(false);
      }
    }
  }, [tab, user]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const target = sentinelRef.current;
    if (!target || tab !== "foryou") return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) void loadMore();
      },
      { rootMargin: "700px 0px" },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [loadMore, tab]);

  const setPostList: React.Dispatch<React.SetStateAction<PostWithAuthor[]>> = (
    update,
  ) =>
    setPosts((previous) => {
      const next =
        typeof update === "function"
          ? (update as (p: PostWithAuthor[]) => PostWithAuthor[])(previous)
          : update;
      if (user) saveCache(user.uid, tab, next);
      return next;
    });

  return (
    <div>
      {/* Sticky X tab header */}
      <header className="xxhead">
        <div className="flux-feed-heading flux-home-heading">
          <div>
            <h1>Home</h1>
          </div>
          <button
            type="button"
            className="flux-icon-button"
            aria-label="Refresh timeline"
            disabled={refreshing || loading}
            onClick={() => void load(true)}
          >
            <RefreshCw size={17} className={refreshing ? "animate-spin" : ""} />
          </button>
        </div>
        <div className="xxtabs" role="tablist" aria-label="Timeline">
          <button
            type="button"
            role="tab"
            aria-selected={tab === "foryou"}
            onClick={() => setTab("foryou")}
            className={cn("xxtab", tab === "foryou" && "is-active")}
          >
            <span className="xxtab-inner">
              <span className="xxtab-label">For you</span>
              <span className="xxtab-bar" aria-hidden="true" />
            </span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "following"}
            onClick={() => setTab("following")}
            className={cn("xxtab", tab === "following" && "is-active")}
          >
            <span className="xxtab-inner">
              <span className="xxtab-label">Following</span>
              <span className="xxtab-bar" aria-hidden="true" />
            </span>
          </button>
        </div>
      </header>

      {/* Composer */}
      <section className="xxcomposer" aria-label="Create a post">
        <ComposeBox
          onSuccess={() => void load(true)}
          placeholder="What's happening?"
        />
      </section>

      {/* Error */}
      {error ? (
        <div role="alert" className="xxerror">
          <span style={{ flex: 1 }}>
            {error}.{" "}
            {posts.length ? "Showing your saved timeline." : "Try again."}
          </span>
          <button
            type="button"
            onClick={() => void load(true)}
            className="xxbtn xxbtn-outline"
            style={{ height: 32, fontSize: 14 }}
          >
            Retry
          </button>
        </div>
      ) : null}

      {/* Feed */}
      {loading ? (
        <div aria-label="Loading posts">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="xxskel" aria-hidden="true">
              <div className="xxskel-ava" />
              <div className="xxskel-main">
                <div className="xxskel-line" style={{ width: "40%" }} />
                <div className="xxskel-line" style={{ width: "100%" }} />
                <div className="xxskel-line" style={{ width: "85%" }} />
              </div>
            </div>
          ))}
        </div>
      ) : posts.length === 0 ? (
        <XEmpty
          icon={Compass}
          title={
            tab === "following"
              ? "Start with a few good follows"
              : "Your next conversation starts here"
          }
          description={
            tab === "following"
              ? "Find people who share your interests. Their posts will fill this timeline."
              : "Share a thought, or explore what people are talking about on Flux."
          }
          action={
            <Link href="/explore" className="x-btn">
              Explore Flux
            </Link>
          }
        />
      ) : (
        <div>
          {posts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              onChange={(updated) =>
                setPostList((previous) =>
                  updated.isDeleted
                    ? previous.filter((item) => item.id !== updated.id)
                    : previous.map((item) =>
                        item.id === updated.id ? updated : item,
                      ),
                )
              }
            />
          ))}
        </div>
      )}

      <div ref={sentinelRef} className="h-1" aria-hidden="true" />
      {loadingMore ? (
        <div
          className="flex items-center justify-center py-6 text-sm"
          style={{ color: "var(--xx-gray)" }}
        >
          Loading more posts&hellip;
        </div>
      ) : null}
      {moreError ? (
        <div className="xxfeed-more-error" role="alert">
          <span>We couldn&apos;t load more posts.</span>
          <button
            type="button"
            onClick={() => {
              moreErrorRef.current = false;
              setMoreError(null);
              void loadMore();
            }}
          >
            Try again
          </button>
        </div>
      ) : null}
      {refreshing && !loading ? (
        <div
          className="flex items-center justify-center py-4 text-[13px]"
          style={{ color: "var(--xx-gray)" }}
        >
          Updating timeline&hellip;
        </div>
      ) : null}
    </div>
  );
}
