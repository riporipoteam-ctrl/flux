"use client";

import { useDeferredValue, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import {
  ArrowRight,
  Award,
  Boxes,
  CalendarDays,
  Dice5,
  Flame,
  Gamepad2,
  Heart,
  History,
  Loader2,
  Search,
  Sparkles,
  Trophy,
  Users,
  X,
} from "lucide-react";
import {
  ARCADE_GAME_COUNT,
  BROWSER_GAMES,
  FEATURED_GAMES,
  GAME_CATEGORIES,
  type BrowserGame,
  type GameCategoryFilter,
} from "@/data/browser-games";
import { GameCoverArt } from "@/components/game/game-cover-art";
import { listPublishedCommunityGames, type PublishedCommunityGame } from "@/services/studio-projects";
import {
  ARCADE_ACHIEVEMENTS,
  dailyChallengeGame,
  readArcadeProgress,
  recentBrowserGames,
  type ArcadeProgress,
} from "@/lib/game-progress";

const FAVORITES_KEY = "flux-games-favorites";
const PAGE_SIZE = 30;

function hrefForGame(game: BrowserGame): string {
  return game.internal ? game.playUrl : `/games/play?game=${encodeURIComponent(game.slug)}`;
}

export default function GamesHub() {
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const [category, setCategory] = useState<GameCategoryFilter>("All");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [community, setCommunity] = useState<PublishedCommunityGame[]>([]);
  const [communityLoading, setCommunityLoading] = useState(true);
  const [progress, setProgress] = useState<ArcadeProgress | null>(null);
  const [dailyGame, setDailyGame] = useState<BrowserGame | undefined>();
  const hero = FEATURED_GAMES[0] ?? BROWSER_GAMES[0];

  useEffect(() => {
    try { setFavorites(JSON.parse(localStorage.getItem(FAVORITES_KEY) || "[]") as string[]); } catch { setFavorites([]); }
    setProgress(readArcadeProgress());
    setDailyGame(dailyChallengeGame(BROWSER_GAMES));
    const onProgress = (event: Event) => {
      const custom = event as CustomEvent<ArcadeProgress>;
      setProgress(custom.detail || readArcadeProgress());
    };
    window.addEventListener("flux:arcade-progress", onProgress);
    listPublishedCommunityGames(24)
      .then(setCommunity)
      .catch(() => setCommunity([]))
      .finally(() => setCommunityLoading(false));
    return () => window.removeEventListener("flux:arcade-progress", onProgress);
  }, []);

  useEffect(() => { setVisibleCount(PAGE_SIZE); }, [category, deferredQuery]);

  const filteredGames = useMemo(() => {
    const needle = deferredQuery.trim().toLowerCase();
    return BROWSER_GAMES.filter((game) => {
      const categoryMatch = category === "All" || game.categories.includes(category);
      if (!categoryMatch) return false;
      if (!needle) return true;
      return [game.title, game.author, game.shortDescription, ...game.categories]
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });
  }, [category, deferredQuery]);

  const visibleGames = filteredGames.slice(0, visibleCount);
  const favoriteGames = favorites
    .map((slug) => BROWSER_GAMES.find((game) => game.slug === slug))
    .filter(Boolean)
    .slice(0, 6) as BrowserGame[];
  const recentGames = progress ? recentBrowserGames(BROWSER_GAMES, 6) : [];
  const unlockedAchievements = new Set(progress?.achievements || []);

  const toggleFavorite = (slug: string) => {
    setFavorites((current) => {
      const next = current.includes(slug) ? current.filter((item) => item !== slug) : [slug, ...current];
      try { localStorage.setItem(FAVORITES_KEY, JSON.stringify(next)); } catch { /* private mode */ }
      return next;
    });
  };

  const surpriseMe = () => {
    const pool = filteredGames.length ? filteredGames : BROWSER_GAMES;
    const game = pool[Math.floor(Math.random() * pool.length)];
    if (game) router.push(hrefForGame(game));
  };

  return (
    <div className="flux-games-v3 min-h-[100dvh] bg-background">
      <header className="x-header hidden lg:flex">
        <div className="x-header-titles"><h1>Games</h1><p>Play inside Flux, compete globally and create in Studio</p></div>
        <Link href="/studio" className="x-btn x-btn-ink x-btn-sm"><Boxes className="h-4 w-4" />Studio</Link>
      </header>

      <main className="mx-auto w-full max-w-[1220px] px-3 pb-24 pt-3 sm:px-5 sm:pt-5 lg:pb-10">
        <section className="flux-games-hero relative overflow-hidden rounded-[26px] border border-[var(--v8-line)] bg-black">
          <div className="relative min-h-[420px] sm:min-h-[520px]">
            <GameCoverArt game={hero} />
            <motion.div
              className="absolute inset-0 flex max-w-3xl flex-col justify-end p-6 sm:p-10"
              initial={{ opacity: 0, y: reduceMotion ? 0 : 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: reduceMotion ? 0 : 0.4 }}
            >
              <p className="text-[10px] font-black uppercase tracking-[.2em] text-white/55">Featured on Flux</p>
              <h2 className="mt-3 text-4xl font-black leading-[.92] tracking-[-.06em] text-white sm:text-7xl">{hero.title}</h2>
              <p className="mt-4 max-w-xl text-sm leading-6 text-white/68 sm:text-base">{hero.description}</p>
              <div className="mt-7 flex flex-wrap gap-3">
                <Link href={hrefForGame(hero)} className="x-btn x-btn-lg !bg-white !text-black"><Gamepad2 className="h-5 w-5" />Play now<ArrowRight className="h-4 w-4" /></Link>
                <button type="button" onClick={surpriseMe} className="x-btn x-btn-lg !border !border-white/20 !bg-black/30 !text-white backdrop-blur-xl"><Dice5 className="h-4 w-4" />Surprise me</button>
                <Link href="/studio" className="x-btn x-btn-lg !bg-[var(--v8-accent)] !text-white"><Sparkles className="h-4 w-4" />Create a game</Link>
              </div>
            </motion.div>
          </div>
        </section>

        <section className="mt-3 grid grid-cols-3 gap-2 sm:mt-4 sm:gap-3">
          <Stat value={`${BROWSER_GAMES.length + community.length}`} label="Playable" />
          <Stat value={`${ARCADE_GAME_COUNT}`} label="Flux Arcade" />
          <Stat value="Global" label="Leaderboards" />
        </section>

        {dailyGame ? (
          <section className="mt-5 overflow-hidden rounded-[22px] border border-[var(--v8-line)] bg-[var(--v8-panel)]">
            <div className="grid min-h-[220px] sm:grid-cols-[minmax(0,1fr)_minmax(300px,.9fr)]">
              <div className="relative min-h-[220px] overflow-hidden sm:order-2"><GameCoverArt game={dailyGame} compact /></div>
              <div className="flex flex-col justify-center p-5 sm:p-7">
                <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[.18em] text-[var(--v8-accent)]"><CalendarDays className="h-4 w-4" />Daily challenge</div>
                <h2 className="mt-3 text-3xl font-black tracking-[-.045em]">{dailyGame.title}</h2>
                <p className="mt-2 max-w-lg text-sm leading-6 text-muted-foreground">One featured Arcade challenge changes every day. Beat its target and add another win to your profile.</p>
                <Link href={hrefForGame(dailyGame)} className="x-btn x-btn-ink mt-5 w-fit"><Trophy className="h-4 w-4" />Play today&apos;s challenge</Link>
              </div>
            </div>
          </section>
        ) : null}

        <section className="mt-5 rounded-[22px] border border-[var(--v8-line)] bg-[var(--v8-panel)] p-3 sm:p-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-muted-foreground" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search all games and genres" className="h-12 w-full rounded-full border border-[var(--v8-line-strong)] bg-[var(--v8-panel-2)] pl-11 pr-12 text-sm font-semibold outline-none transition focus:border-[var(--v8-accent)] focus:ring-4 focus:ring-[var(--v8-accent-soft)]" />
            {query ? <button type="button" onClick={() => setQuery("")} className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full hover:bg-muted" aria-label="Clear search"><X className="h-4 w-4" /></button> : null}
          </div>
          <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto pb-1">
            {GAME_CATEGORIES.map((item) => <button key={item} type="button" onClick={() => setCategory(item)} data-active={item === category} className="x-chip shrink-0">{item}</button>)}
          </div>
        </section>

        {recentGames.length ? (
          <section className="mt-8">
            <div className="flex items-center gap-2"><History className="h-5 w-5 text-[var(--v8-accent)]" /><h2 className="text-xl font-black tracking-tight">Continue playing</h2><span className="ml-auto text-xs font-bold text-muted-foreground">{progress?.totalRounds || 0} rounds</span></div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{recentGames.map((game, index) => <GameCard key={game.slug} game={game} index={index} favorite={favorites.includes(game.slug)} onToggleFavorite={toggleFavorite} />)}</div>
          </section>
        ) : null}

        {progress ? (
          <section className="mt-8 overflow-hidden rounded-[22px] border border-[var(--v8-line)] bg-[var(--v8-panel)] p-4 sm:p-5">
            <div className="flex flex-wrap items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-full bg-orange-500/12 text-orange-500"><Flame className="h-5 w-5" /></span>
              <div><h2 className="font-black">Arcade achievements</h2><p className="text-xs text-muted-foreground">{unlockedAchievements.size} of {ARCADE_ACHIEVEMENTS.length} unlocked · {progress.streak} day streak</p></div>
              <span className="ml-auto text-xs font-black text-muted-foreground">{progress.totalWins} wins</span>
            </div>
            <div className="no-scrollbar mt-4 flex gap-3 overflow-x-auto pb-1">
              {ARCADE_ACHIEVEMENTS.map((achievement) => {
                const unlocked = unlockedAchievements.has(achievement.id);
                return <div key={achievement.id} className={cn("w-[170px] shrink-0 rounded-2xl border p-3", unlocked ? "border-[var(--v8-accent)]/30 bg-[var(--v8-accent-soft)]" : "border-[var(--v8-line)] bg-[var(--v8-panel-2)] opacity-55")}><span className="text-2xl">{unlocked ? achievement.symbol : "🔒"}</span><p className="mt-2 text-sm font-black">{achievement.title}</p><p className="mt-1 text-[10px] leading-4 text-muted-foreground">{achievement.description}</p></div>;
              })}
            </div>
          </section>
        ) : null}

        {favoriteGames.length ? (
          <section className="mt-8">
            <div className="flex items-center gap-2"><Heart className="h-5 w-5 text-rose-500" /><h2 className="text-xl font-black tracking-tight">Saved games</h2></div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{favoriteGames.map((game, index) => <GameCard key={game.slug} game={game} index={index} favorite onToggleFavorite={toggleFavorite} />)}</div>
          </section>
        ) : null}

        <section className="mt-9">
          <div className="flex items-end justify-between gap-4">
            <div><p className="text-[10px] font-black uppercase tracking-[.18em] text-muted-foreground">Full catalog</p><h2 className="mt-1 text-3xl font-black tracking-[-.05em]">{category === "All" ? "All games" : category}</h2></div>
            <p className="text-xs font-bold text-muted-foreground">{filteredGames.length} results</p>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {visibleGames.map((game, index) => <GameCard key={game.slug} game={game} index={index} favorite={favorites.includes(game.slug)} onToggleFavorite={toggleFavorite} />)}
          </div>
          {visibleCount < filteredGames.length ? <button type="button" onClick={() => setVisibleCount((current) => current + PAGE_SIZE)} className="mx-auto mt-7 flex h-12 items-center rounded-full border border-[var(--v8-line-strong)] bg-[var(--v8-panel)] px-7 text-sm font-black transition hover:bg-[var(--v8-panel-2)]">Show {Math.min(PAGE_SIZE, filteredGames.length - visibleCount)} more</button> : null}
        </section>

        <section className="mt-10 overflow-hidden rounded-[26px] bg-[#0b0f14] p-5 text-white sm:p-7">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div><p className="text-[10px] font-black uppercase tracking-[.18em] text-violet-300">Created by the community</p><h2 className="mt-2 text-3xl font-black tracking-[-.05em]">Studio games</h2><p className="mt-2 max-w-xl text-sm leading-6 text-white/46">Publish a playable project from Flux Studio and it appears here.</p></div>
            <Link href="/studio" className="x-btn !bg-white !text-black"><Boxes className="h-4 w-4" />Open Studio</Link>
          </div>
          {communityLoading ? <div className="grid min-h-44 place-items-center"><Loader2 className="h-6 w-6 animate-spin text-white/35" /></div> : community.length ? <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{community.slice(0, 9).map((game) => <CommunityCard key={game.id} game={game} />)}</div> : <div className="mt-6 grid min-h-40 place-items-center rounded-[22px] border border-dashed border-white/12 text-center"><div><Users className="mx-auto h-7 w-7 text-white/20" /><p className="mt-3 font-black">No community games yet</p><p className="mt-1 text-xs text-white/35">Publish the first one from Studio.</p></div></div>}
        </section>
      </main>
    </div>
  );
}

function GameCard({ game, index, favorite, onToggleFavorite }: { game: BrowserGame; index: number; favorite: boolean; onToggleFavorite: (slug: string) => void }) {
  const reduceMotion = useReducedMotion();
  return (
    <motion.article initial={{ opacity: 0, y: reduceMotion ? 0 : 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: reduceMotion ? 0 : 0.22, delay: Math.min(index * 0.015, 0.12) }} className="flux-game-card group overflow-hidden rounded-[20px] border border-[var(--v8-line)] bg-[var(--v8-panel)]">
      <Link href={hrefForGame(game)} className="block">
        <div className="relative aspect-[16/10] overflow-hidden"><GameCoverArt game={game} compact /><button type="button" onClick={(event) => { event.preventDefault(); event.stopPropagation(); onToggleFavorite(game.slug); }} className="absolute right-2.5 top-2.5 grid h-9 w-9 place-items-center rounded-full border border-white/15 bg-black/45 text-white backdrop-blur-xl transition active:scale-90" aria-label={favorite ? "Remove favorite" : "Save game"}><Heart className={cn("h-4 w-4", favorite && "fill-rose-500 text-rose-500")} /></button><span className="absolute bottom-2.5 left-2.5 rounded-full bg-black/55 px-2.5 py-1 text-[9px] font-black text-white backdrop-blur">{game.arcade ? "Leaderboard" : game.status || "Play"}</span></div>
        <div className="p-3.5"><h3 className="truncate text-[15px] font-black tracking-tight">{game.title}</h3><p className="mt-1.5 line-clamp-2 min-h-10 text-xs leading-5 text-muted-foreground">{game.shortDescription}</p><div className="mt-3 flex items-center gap-2 text-[10px] font-bold text-muted-foreground"><span>{game.categories[0]}</span>{game.arcade ? <span className="ml-auto flex items-center gap-1 text-amber-500"><Trophy className="h-3.5 w-3.5" />Global scores</span> : <span className="ml-auto">{game.author}</span>}</div></div>
      </Link>
    </motion.article>
  );
}

function CommunityCard({ game }: { game: PublishedCommunityGame }) {
  return <Link href={`/studio/play?id=${encodeURIComponent(game.id)}`} className="group overflow-hidden rounded-[20px] border border-white/10 bg-white/6 transition hover:bg-white/10"><div className="aspect-[16/9]" style={{ background: game.thumbnail || "linear-gradient(135deg,#7c3aed,#07111f)" }} /><div className="p-4"><h3 className="truncate font-black">{game.title}</h3><p className="mt-1 line-clamp-2 text-xs leading-5 text-white/42">{game.description}</p><div className="mt-3 flex gap-3 text-[10px] font-bold text-white/32"><span>{game.visits} plays</span><span>{game.cheers} cheers</span></div></div></Link>;
}

function Stat({ value, label }: { value: string; label: string }) {
  return <div className="rounded-[18px] border border-[var(--v8-line)] bg-[var(--v8-panel)] px-3 py-3 text-center sm:py-4"><b className="block text-lg font-black sm:text-2xl">{value}</b><small className="mt-0.5 block text-[9px] font-bold uppercase tracking-[.12em] text-muted-foreground sm:text-[10px]">{label}</small></div>;
}

function cn(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(" ");
}
