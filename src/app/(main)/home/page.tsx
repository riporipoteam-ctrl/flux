"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Newspaper, Users } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { ComposeBox } from "@/components/posts/compose-box";
import { PostCard } from "@/components/posts/post-card";
import { EmptyState } from "@/components/shared/empty-state";
import { StoryRail } from "@/components/stories/story-rail";
import { getForYouFeed, getFollowingFeed } from "@/services/posts";
import type { PostWithAuthor } from "@/types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function HomePage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<"foryou" | "following">("foryou");
  const [posts, setPosts] = useState<PostWithAuthor[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const loadingMoreRef = useRef(false);
  const hasMoreRef = useRef(true);
  const postsLenRef = useRef(0);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    hasMoreRef.current = true;
    try {
      if (tab === "following") {
        const data = await getFollowingFeed(user.uid);
        setPosts(data);
        postsLenRef.current = data.length;
        hasMoreRef.current = false;
      } else {
        const { posts: data } = await getForYouFeed(user.uid, 20);
        setPosts(data);
        postsLenRef.current = data.length;
        hasMoreRef.current = data.length >= 20;
      }
    } catch (error) {
      console.error(error);
      setPosts([]);
      postsLenRef.current = 0;
    } finally {
      setLoading(false);
    }
  }, [tab, user]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (tab !== "foryou" || !user) return;
    const onScroll = () => {
      if (loadingMoreRef.current || !hasMoreRef.current) return;
      if (window.innerHeight + window.scrollY < document.documentElement.scrollHeight - 500) return;
      loadingMoreRef.current = true;
      setLoadingMore(true);
      const prevLen = postsLenRef.current;
      getForYouFeed(user.uid, Math.min(prevLen + 20, 60))
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
            return merged;
          });
        })
        .catch(() => {
          hasMoreRef.current = false;
        })
        .finally(() => {
          loadingMoreRef.current = false;
          setLoadingMore(false);
        });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [tab, user]);

  return (
    <main className="social-feed pb-20 lg:pb-4">
      <header className="social-page-header hidden lg:flex">
        <h1 className="text-xl font-bold">Home</h1>
      </header>

      <div className="sticky top-[53px] z-30 grid h-[53px] grid-cols-2 border-b border-border bg-background/94 backdrop-blur-xl lg:top-[53px]">
        <FeedTab active={tab === "foryou"} onClick={() => setTab("foryou")}>For you</FeedTab>
        <FeedTab active={tab === "following"} onClick={() => setTab("following")}>Following</FeedTab>
      </div>

      <StoryRail />

      <section className="social-row hidden p-4 sm:block">
        <ComposeBox onSuccess={() => void load()} />
      </section>

      <FeedList
        loading={loading}
        loadingMore={loadingMore}
        posts={posts}
        emptyTitle={tab === "following" ? "No posts from people you follow" : "Your feed is quiet"}
        emptyDescription={tab === "following" ? "Follow people to build your Following feed." : "Post something or follow people to fill this space."}
        emptyIcon={tab === "following" ? Users : Newspaper}
        onRefresh={() => void load()}
        setPosts={setPosts}
      />
    </main>
  );
}

function FeedTab({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} className="relative grid place-items-center text-sm font-semibold transition-colors hover:bg-muted/45">
      <span className={active ? "text-foreground" : "text-muted-foreground"}>{children}</span>
      {active ? <span className="absolute bottom-0 h-1 w-14 rounded-full bg-primary" /> : null}
    </button>
  );
}

function FeedList({
  loading,
  posts,
  emptyTitle,
  emptyDescription,
  emptyIcon = Newspaper,
  onRefresh,
  setPosts,
  loadingMore = false,
}: {
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
    return (
      <div aria-label="Loading posts">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="social-row flex gap-3 p-4">
            <div className="skeleton h-11 w-11 shrink-0 rounded-full" />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="skeleton h-4 w-40 rounded" />
              <div className="skeleton h-4 w-full rounded" />
              <div className="skeleton h-4 w-4/5 rounded" />
              {index % 2 === 0 ? <div className="skeleton mt-3 aspect-video w-full rounded-xl" /> : null}
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!posts.length) {
    return <EmptyState icon={emptyIcon} title={emptyTitle} description={emptyDescription} action={<Button variant="outline" onClick={onRefresh}>Refresh</Button>} />;
  }

  return (
    <>
      {posts.map((post) => (
        <div key={post.id} className={cn("social-row")}> 
          <PostCard
            post={post}
            onChange={(updated) =>
              setPosts((previous) =>
                updated.isDeleted
                  ? previous.filter((item) => item.id !== updated.id)
                  : previous.map((item) => (item.id === updated.id ? updated : item))
              )
            }
          />
        </div>
      ))}
      {loadingMore ? <div className="social-row py-6 text-center text-xs font-semibold text-muted-foreground">Loading more…</div> : null}
    </>
  );
}
