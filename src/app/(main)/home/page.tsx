"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Newspaper, Sparkles, Users } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ComposeBox } from "@/components/posts/compose-box";
import { PostCard } from "@/components/posts/post-card";
import { EmptyState } from "@/components/shared/empty-state";
import { getForYouFeed, getFollowingFeed } from "@/services/posts";
import type { PostWithAuthor } from "@/types";
import { Button } from "@/components/ui/button";
import { PageTransition, StaggerItem, StaggerList } from "@/components/shared/page-transition";

export default function HomePage() {
  const { user } = useAuth();
  const [tab, setTab] = useState("foryou");
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

  useEffect(() => { void load(); }, [load]);

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
          setPosts((prev) => {
            const ids = new Set(prev.map((post) => post.id));
            const merged = [...prev];
            let added = 0;
            for (const post of data) if (!ids.has(post.id)) { merged.push(post); added++; }
            postsLenRef.current = merged.length;
            if (added === 0) hasMoreRef.current = false;
            return merged;
          });
        })
        .catch(() => { hasMoreRef.current = false; })
        .finally(() => { loadingMoreRef.current = false; setLoadingMore(false); });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [tab, user]);

  return (
    <div className="min-h-screen pb-3">
      <header className="relative z-20 hidden border-b border-border/70 px-5 py-3 lg:sticky lg:top-0 lg:z-30 lg:block glass-strong">
        <div className="flex items-center justify-between"><div><h1 className="text-xl font-black tracking-[-0.04em]">Home</h1><p className="text-xs text-muted-foreground">Posts from your people and the wider Flux community.</p></div><div className="flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-black text-muted-foreground"><Sparkles className="h-3.5 w-3.5" /> Live feed</div></div>
      </header>

      <PageTransition>
        <div className="mx-3 mt-3 hidden sm:block sm:mx-4 sm:mt-4"><div className="surface-card p-4"><ComposeBox onSuccess={() => load()} /></div></div>
        <Tabs value={tab} onValueChange={(value) => { setPosts([]); setTab(value); }} className="mt-3 w-full">
          <div className="sticky top-0 z-20 mx-3 rounded-2xl border border-border/70 bg-card/92 px-1 shadow-sm backdrop-blur-xl sm:mx-4 lg:top-[69px]"><TabsList className="border-b-0"><TabsTrigger value="foryou">For You</TabsTrigger><TabsTrigger value="following">Following</TabsTrigger></TabsList></div>
          <TabsContent value="foryou"><FeedList loading={loading} loadingMore={loadingMore} posts={posts} emptyTitle="Your For You feed is quiet" emptyDescription="Post something or follow people to fill this space." onRefresh={() => load()} setPosts={setPosts} /></TabsContent>
          <TabsContent value="following"><FeedList loading={loading} posts={posts} emptyTitle="No posts from people you follow" emptyDescription="Follow creators to build your Following feed." emptyIcon={Users} onRefresh={() => load()} setPosts={setPosts} /></TabsContent>
        </Tabs>
      </PageTransition>
    </div>
  );
}

function FeedList({ loading, posts, emptyTitle, emptyDescription, emptyIcon = Newspaper, onRefresh, setPosts, loadingMore = false }: { loading: boolean; posts: PostWithAuthor[]; emptyTitle: string; emptyDescription: string; emptyIcon?: typeof Newspaper; onRefresh: () => void; setPosts: React.Dispatch<React.SetStateAction<PostWithAuthor[]>>; loadingMore?: boolean }) {
  if (loading) return <div className="space-y-2 px-2 py-2">{Array.from({ length: 4 }).map((_, index) => <div key={index} className="flex gap-3 rounded-[22px] border border-border/70 bg-card p-4 shadow-sm"><div className="skeleton h-11 w-11 rounded-full" /><div className="flex-1 space-y-2"><div className="skeleton h-4 w-1/3" /><div className="skeleton h-4 w-full" /><div className="skeleton h-4 w-2/3" /></div></div>)}</div>;
  if (!posts.length) return <EmptyState icon={emptyIcon} title={emptyTitle} description={emptyDescription} action={<Button variant="outline" onClick={onRefresh}>Refresh</Button>} />;
  return <><StaggerList>{posts.map((post) => <StaggerItem key={post.id}><PostCard post={post} onChange={(updated) => setPosts((prev) => updated.isDeleted ? prev.filter((item) => item.id !== updated.id) : prev.map((item) => item.id === updated.id ? updated : item))} /></StaggerItem>)}</StaggerList>{loadingMore ? <p className="py-6 text-center text-xs font-bold text-muted-foreground">Loading more…</p> : null}</>;
}
