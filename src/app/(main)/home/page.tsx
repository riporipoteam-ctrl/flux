"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowRight, Gamepad2, Newspaper, ShieldCheck, Sparkles, Smartphone, Users, Zap } from "lucide-react";
import { useRouter } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import { useAuth } from "@/contexts/auth-context";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ComposeBox } from "@/components/posts/compose-box";
import { PostCard } from "@/components/posts/post-card";
import { EmptyState } from "@/components/shared/empty-state";
import { getForYouFeed, getFollowingFeed } from "@/services/posts";
import type { PostWithAuthor } from "@/types";
import { Button } from "@/components/ui/button";
import { PageTransition, StaggerItem, StaggerList } from "@/components/shared/page-transition";
import { FEATURED_GAMES } from "@/data/browser-games";

export default function HomePage() {
  const router = useRouter();
  const reduceMotion = useReducedMotion();
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

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (tab !== "foryou" || !user) return;
    const onScroll = () => {
      if (loadingMoreRef.current || !hasMoreRef.current) return;
      const nearBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 500;
      if (!nearBottom) return;
      loadingMoreRef.current = true;
      setLoadingMore(true);
      const prevLen = postsLenRef.current;
      getForYouFeed(user.uid, Math.min(prevLen + 20, 60))
        .then(({ posts: data }) => {
          setPosts((prev) => {
            const ids = new Set(prev.map((post) => post.id));
            const merged = [...prev];
            let added = 0;
            for (const post of data) {
              if (!ids.has(post.id)) {
                merged.push(post);
                added++;
              }
            }
            postsLenRef.current = merged.length;
            if (added === 0) hasMoreRef.current = false;
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
    <div className="min-h-screen pb-3">
      <header className="relative z-20 hidden border-b border-border/70 px-5 py-3 lg:sticky lg:top-0 lg:z-30 lg:block glass-strong">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-black tracking-[-0.04em]">Home</h1>
            <p className="text-xs text-muted-foreground">Your world, upgraded.</p>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-primary/15 bg-primary/8 px-3 py-1.5 text-xs font-black text-primary">
            <Sparkles className="h-3.5 w-3.5" /> Flux 2.0
          </div>
        </div>
      </header>

      <PageTransition>
        <section className="mx-3 mt-3 overflow-hidden rounded-[26px] border border-border/70 bg-card/78 shadow-soft backdrop-blur-xl sm:mx-4 sm:mt-4 sm:rounded-[30px]">
          <div className="relative overflow-hidden p-5 sm:p-6">
            <motion.div
              className="pointer-events-none absolute -right-16 -top-20 h-52 w-52 rounded-full bg-cyan-400/18 blur-3xl"
              animate={reduceMotion ? undefined : { x: [0, -18, 0], y: [0, 16, 0], scale: [1, 1.08, 1] }}
              transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
            />
            <motion.div
              className="pointer-events-none absolute -bottom-20 left-1/3 h-44 w-44 rounded-full bg-violet-500/14 blur-3xl"
              animate={reduceMotion ? undefined : { x: [0, 14, 0], y: [0, -10, 0] }}
              transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
            />
            <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div className="max-w-lg">
                <div className="mb-2 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-cyan-500"><Zap className="h-3.5 w-3.5" /> Games hub live</div>
                <h2 className="text-2xl font-black leading-tight tracking-[-0.05em] sm:text-3xl">Real browser games for <span className="text-gradient-brand">every screen.</span></h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">Launch open-source racing, simulation, strategy, story, horror and puzzle games from mobile, tablet or PC—without a Flux VPS.</p>
                <div className="mt-4 flex flex-wrap gap-2 text-[10px] font-black text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background/65 px-3 py-1.5"><Smartphone className="h-3.5 w-3.5 text-cyan-500" /> Touch controls</span>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background/65 px-3 py-1.5"><ShieldCheck className="h-3.5 w-3.5 text-emerald-500" /> Free + source available</span>
                </div>
              </div>
              <Button variant="flux" size="lg" className="shrink-0 rounded-full" onClick={() => router.push("/games")}><Gamepad2 className="h-5 w-5" /> Explore games <ArrowRight className="h-4 w-4" /></Button>
            </div>

            <div className="relative mt-5 grid grid-cols-3 gap-2">
              {FEATURED_GAMES.slice(0, 3).map((game, index) => (
                <motion.button
                  key={game.slug}
                  type="button"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: reduceMotion ? 0 : 0.08 * index }}
                  whileHover={reduceMotion ? undefined : { y: -3, scale: 1.01 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => router.push(`/games/play?game=${game.slug}`)}
                  className="group relative min-h-24 overflow-hidden rounded-[20px] border border-white/10 p-3 text-left text-white shadow-lg sm:min-h-28 sm:p-4"
                  style={{ background: `linear-gradient(140deg, ${game.palette[0]}, ${game.palette[1]})` }}
                >
                  <span className="absolute -right-3 -top-4 text-5xl opacity-35 transition group-hover:scale-110 group-hover:opacity-55 sm:text-6xl">{game.symbol}</span>
                  <div className="relative flex h-full flex-col justify-end"><p className="truncate text-xs font-black sm:text-sm">{game.title}</p><p className="mt-1 hidden truncate text-[9px] font-bold text-white/55 sm:block">{game.categories.slice(0, 2).join(" · ")}</p></div>
                </motion.button>
              ))}
            </div>
          </div>
          <motion.button
            type="button"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            whileHover={reduceMotion ? undefined : { y: -2 }}
            onClick={() => router.push("/games")}
            className="flex w-full items-center gap-4 border-t border-border/70 bg-[linear-gradient(90deg,rgba(6,182,212,.08),transparent)] px-5 py-4 text-left transition hover:bg-cyan-500/10"
          >
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-cyan-500/15 text-cyan-600"><Gamepad2 className="h-5 w-5" /></span>
            <div className="min-w-0 flex-1"><p className="font-black">Open Flux Games</p><p className="truncate text-xs text-muted-foreground">Favorites, recent games, sharing and safer launch screens are ready.</p></div>
            <ArrowRight className="h-4 w-4 text-muted-foreground" />
          </motion.button>
        </section>

        <div className="mx-3 mt-3 hidden sm:block sm:mx-4 sm:mt-4">
          <div className="surface-card p-4"><ComposeBox onSuccess={() => load()} /></div>
        </div>

        <Tabs value={tab} onValueChange={(value) => { setPosts([]); setTab(value); }} className="mt-3 w-full">
          <div className="sticky top-0 z-20 mx-3 rounded-2xl border border-border/70 bg-card/88 px-1 backdrop-blur-xl sm:mx-4 lg:top-[69px]">
            <TabsList className="border-b-0">
              <TabsTrigger value="foryou">For You</TabsTrigger>
              <TabsTrigger value="following">Following</TabsTrigger>
            </TabsList>
          </div>
          <TabsContent value="foryou"><FeedList loading={loading} loadingMore={loadingMore} posts={posts} emptyTitle="Your For You feed is quiet" emptyDescription="Post something or follow people to fill this space." onRefresh={() => load()} setPosts={setPosts} /></TabsContent>
          <TabsContent value="following"><FeedList loading={loading} posts={posts} emptyTitle="No posts from people you follow" emptyDescription="Follow creators to build your Following feed." emptyIcon={Users} onRefresh={() => load()} setPosts={setPosts} /></TabsContent>
        </Tabs>
      </PageTransition>
    </div>
  );
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
    return <div className="space-y-2 px-2 py-2">{Array.from({ length: 4 }).map((_, index) => <div key={index} className="flex gap-3 rounded-[22px] border border-border/70 bg-card p-4 shadow-soft"><div className="skeleton h-11 w-11 rounded-full" /><div className="flex-1 space-y-2"><div className="skeleton h-4 w-1/3" /><div className="skeleton h-4 w-full" /><div className="skeleton h-4 w-2/3" /></div></div>)}</div>;
  }
  if (!posts.length) return <EmptyState icon={emptyIcon} title={emptyTitle} description={emptyDescription} action={<Button variant="outline" onClick={onRefresh}>Refresh</Button>} />;
  return (
    <>
      <StaggerList>{posts.map((post) => <StaggerItem key={post.id}><PostCard post={post} onChange={(updated) => setPosts((prev) => updated.isDeleted ? prev.filter((item) => item.id !== updated.id) : prev.map((item) => item.id === updated.id ? updated : item))} /></StaggerItem>)}</StaggerList>
      {loadingMore ? <p className="py-6 text-center text-xs font-bold text-muted-foreground">Loading more…</p> : null}
    </>
  );
}
