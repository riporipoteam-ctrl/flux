"use client";

import { useDeferredValue, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  Boxes,
  Flame,
  Gamepad2,
  Heart,
  Info,
  MonitorPlay,
  Search,
  Smartphone,
  Sparkles,
  Trophy,
  X,
} from "lucide-react";
import {
  BROWSER_GAMES,
  FEATURED_GAMES,
  GAME_CATEGORIES,
  OPEN_SOURCE_GAME_COUNT,
  type BrowserGame,
  type GameCategoryFilter,
} from "@/data/browser-games";
import { assetUrl } from "@/lib/asset-url";
import { cn } from "@/lib/utils";
import { getGameLeaderboard, type GameLeaderboardEntry } from "@/services/game-leaderboards";

const FAVORITES_KEY = "flux-games-favorites";
const RECENT_KEY = "flux-games-recent";
const PAGE_SIZE = 24;

function gameHref(game: BrowserGame) {
  return `/games/play?game=${encodeURIComponent(game.slug)}`;
}

export default function GamesHub() {
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const [category, setCategory] = useState<GameCategoryFilter>("All");
  const [favorites, setFavorites] = useState<string[]>([]);
  const [recent, setRecent] = useState<string[]>([]);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [heroLeaders, setHeroLeaders] = useState<GameLeaderboardEntry[]>([]);
  const hero = FEATURED_GAMES[0] || BROWSER_GAMES[0];
  const spotlight = FEATURED_GAMES.slice(1, 4);

  useEffect(() => {
    try {
      setFavorites(JSON.parse(localStorage.getItem(FAVORITES_KEY) || "[]") as string[]);
      setRecent(JSON.parse(localStorage.getItem(RECENT_KEY) || "[]") as string[]);
    } catch {
      setFavorites([]);
      setRecent([]);
    }
  }, []);

  useEffect(() => {
    if (!hero?.slug) return;
    getGameLeaderboard(hero.slug, 5, "plays").then(setHeroLeaders).catch(() => setHeroLeaders([]));
  }, [hero?.slug]);

  const filtered = useMemo(() => {
    const needle = deferredQuery.trim().toLowerCase();
    return BROWSER_GAMES.filter((game) => {
      if (category !== "All" && !game.categories.includes(category as never)) return false;
      if (!needle) return true;
      return [game.title, game.author, game.shortDescription, game.dimension, game.controls, ...game.categories]
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });
  }, [category, deferredQuery]);

  useEffect(() => setVisibleCount(PAGE_SIZE), [category, deferredQuery]);

  const visibleGames = filtered.slice(0, visibleCount);
  const remaining = Math.max(0, filtered.length - visibleGames.length);
  const favoriteGames = favorites
    .map((slug) => BROWSER_GAMES.find((game) => game.slug === slug))
    .filter(Boolean)
    .slice(0, 4) as BrowserGame[];
  const recentGames = recent
    .map((slug) => BROWSER_GAMES.find((game) => game.slug === slug))
    .filter(Boolean)
    .slice(0, 4) as BrowserGame[];

  const toggleFavorite = (slug: string) => {
    setFavorites((current) => {
      const next = current.includes(slug)
        ? current.filter((item) => item !== slug)
        : [slug, ...current];
      try { localStorage.setItem(FAVORITES_KEY, JSON.stringify(next)); } catch { /* private mode */ }
      return next;
    });
  };

  return (
    <div className="flux10-page">
      <header className="flux10-page-head">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-foreground text-background">
          <Gamepad2 className="h-[19px] w-[19px]" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="flux10-kicker">Self-hosted open-source games</p>
          <h1 className="flux10-title mt-1">Flux Games</h1>
        </div>
        <span className="flux10-chip hidden sm:inline-flex"><BadgeCheck className="h-3.5 w-3.5 text-primary" /> {OPEN_SOURCE_GAME_COUNT} open games</span>
        <Link href="/games/licenses" className="flux10-secondary" aria-label="Game licenses"><Info className="h-4 w-4" /><span className="hidden sm:inline">Licenses</span></Link>
        <Link href="/studio" className="flux10-primary hidden sm:inline-flex"><Boxes className="h-4 w-4" /> Studio</Link>
      </header>

      <main className="pb-28 lg:pb-12">
        <section className="flux10-games-hero">
          <Link href={gameHref(hero)} className="flux10-games-hero-media group block">
            <img src={assetUrl(hero.thumbnail)} alt={hero.title} loading="eager" decoding="async" />
            <div className="absolute inset-x-0 bottom-0 z-10 flex items-end justify-between gap-4 p-5 sm:p-7">
              <span className="rounded-full border border-white/20 bg-black/55 px-3 py-1.5 text-[10px] font-black uppercase tracking-[.13em] text-white backdrop-blur-md">Featured · {hero.dimension}</span>
              <span className="grid h-11 w-11 place-items-center rounded-full bg-white text-black shadow-xl transition-transform group-hover:scale-105"><ArrowRight className="h-5 w-5" /></span>
            </div>
          </Link>
          <div className="flux10-games-hero-copy">
            <div className="flex flex-wrap gap-2">
              <span className="flux10-chip"><Sparkles className="h-3.5 w-3.5 text-primary" /> Featured</span>
              <span className="flux10-chip"><Smartphone className="h-3.5 w-3.5" /> Touch</span>
              <span className="flux10-chip"><MonitorPlay className="h-3.5 w-3.5" /> PC</span>
              <span className="flux10-chip"><BadgeCheck className="h-3.5 w-3.5 text-primary" /> Open source</span>
              <span className="flux10-chip">Hosted by Flux</span>
            </div>
            <h2 className="mt-5 text-[clamp(2.5rem,7vw,5.3rem)] font-black leading-[.88] tracking-[-.075em]">{hero.title}</h2>
            <p className="mt-5 max-w-xl text-sm leading-6 text-muted-foreground sm:text-base">{hero.description}</p>
            <div className="mt-6 flex flex-wrap gap-2">
              <Link href={gameHref(hero)} className="flux10-primary min-w-36">Play now <ArrowRight className="h-4 w-4" /></Link>
              <button type="button" onClick={() => toggleFavorite(hero.slug)} className="flux10-secondary">
                <Heart className={cn("h-4 w-4", favorites.includes(hero.slug) && "fill-rose-500 text-rose-500")} />
                {favorites.includes(hero.slug) ? "Saved" : "Save"}
              </button>
            </div>
            <div className="mt-7 border-t border-border/70 pt-5">
              <div className="flex items-center justify-between gap-3"><p className="text-xs font-black">Community activity</p><span className="text-[10px] font-bold uppercase tracking-[.12em] text-muted-foreground">Most plays</span></div>
              {heroLeaders.length ? (
                <div className="mt-3 space-y-2">
                  {heroLeaders.slice(0, 3).map((entry, index) => (
                    <div key={entry.uid} className="flex items-center gap-3 rounded-xl bg-foreground/[.035] px-3 py-2.5">
                      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-background text-[11px] font-black">{index + 1}</span>
                      <div className="min-w-0 flex-1"><p className="truncate text-xs font-black">{entry.displayName}</p><p className="truncate text-[10px] text-muted-foreground">@{entry.username}</p></div>
                      <span className="text-xs font-black tabular-nums">{entry.plays} plays</span>
                    </div>
                  ))}
                </div>
              ) : <p className="mt-3 text-xs leading-5 text-muted-foreground">Play the featured game to start its community leaderboard.</p>}
            </div>
          </div>
        </section>

        <section className="px-3 pt-5 sm:px-5">
          <div className="flux10-panel p-3 sm:p-4">
            <div className="relative">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-muted-foreground" />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search games, creators, controls or genres" className="flux10-search" />
              {query ? <button type="button" onClick={() => setQuery("")} className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full hover:bg-muted" aria-label="Clear search"><X className="h-4 w-4" /></button> : null}
            </div>
            <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto pb-1">
              {GAME_CATEGORIES.map((item) => <button key={item} type="button" onClick={() => setCategory(item)} className={cn("flux10-chip shrink-0", category === item && "is-active")}>{item}</button>)}
            </div>
          </div>
        </section>

        {spotlight.length ? (
          <section className="px-3 pt-8 sm:px-5">
            <SectionHeading icon={Flame} eyebrow="Trending picks" title="Jump back in" subtitle="Fast-loading games picked from the hosted Flux library." />
            <div className="mt-4 flux10-game-grid">{spotlight.map((game) => <GameCard key={game.slug} game={game} favorite={favorites.includes(game.slug)} onFavorite={toggleFavorite} />)}</div>
          </section>
        ) : null}

        {recentGames.length || favoriteGames.length ? (
          <section className="px-3 pt-9 sm:px-5">
            <SectionHeading icon={Heart} eyebrow="Your library" title={recentGames.length ? "Continue playing" : "Saved games"} subtitle="Your recent and saved browser games stay one tap away." />
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {(recentGames.length ? recentGames : favoriteGames).map((game) => <MiniGameCard key={game.slug} game={game} />)}
            </div>
          </section>
        ) : null}

        <section className="px-3 pt-10 sm:px-5">
          <div className="flex items-end justify-between gap-4">
            <SectionHeading icon={Trophy} eyebrow="Flux Open Games" title={category === "All" ? "Explore everything" : category} subtitle="Hosted in Flux — no install, no redirect to another game site." />
            <p className="shrink-0 pb-1 text-xs font-black text-muted-foreground">{filtered.length} found</p>
          </div>
          <div className="mt-4 flux10-game-grid">
            {visibleGames.map((game) => <GameCard key={game.slug} game={game} favorite={favorites.includes(game.slug)} onFavorite={toggleFavorite} />)}
          </div>
          {remaining > 0 ? <div className="mt-6 flex justify-center"><button type="button" onClick={() => setVisibleCount((count) => count + PAGE_SIZE)} className="flux10-secondary min-h-11 px-6">Show {Math.min(PAGE_SIZE, remaining)} more · {remaining} remaining</button></div> : null}
          {!filtered.length ? <div className="flux10-panel mt-5 grid min-h-52 place-items-center p-8 text-center"><div><Search className="mx-auto h-7 w-7 text-muted-foreground" /><p className="mt-3 text-lg font-black">No matching game</p><p className="mt-1 text-sm text-muted-foreground">Try another name, creator, control type or category.</p></div></div> : null}
        </section>

        <section className="mx-3 mt-10 overflow-hidden rounded-[24px] border border-border bg-foreground text-background sm:mx-5">
          <div className="grid gap-5 p-6 sm:p-8 lg:grid-cols-[1fr_auto] lg:items-center">
            <div><p className="text-[10px] font-black uppercase tracking-[.16em] opacity-60">Open by design</p><h2 className="mt-2 text-2xl font-black tracking-[-.045em]">Real games. Visible sources. One Flux library.</h2><p className="mt-2 max-w-2xl text-sm leading-6 opacity-70">Every imported game keeps its source and license record. The player stays inside Flux while credits live on a dedicated page.</p></div>
            <Link href="/games/licenses" className="inline-flex h-11 items-center justify-center rounded-full bg-background px-5 text-sm font-black text-foreground">View licenses</Link>
          </div>
        </section>
      </main>
    </div>
  );
}

function SectionHeading({ icon: Icon, eyebrow, title, subtitle }: { icon: typeof Trophy; eyebrow: string; title: string; subtitle: string }) {
  return <div className="flex items-start gap-3"><span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary/10 text-primary"><Icon className="h-4 w-4" /></span><div><p className="flux10-kicker">{eyebrow}</p><h2 className="mt-1 text-2xl font-black tracking-[-.05em] sm:text-3xl">{title}</h2><p className="mt-1 max-w-2xl text-xs leading-5 text-muted-foreground sm:text-sm">{subtitle}</p></div></div>;
}

function GameCard({ game, favorite, onFavorite }: { game: BrowserGame; favorite: boolean; onFavorite: (slug: string) => void }) {
  return (
    <article className="flux10-game-card group">
      <Link href={gameHref(game)} className="flux10-game-media relative block">
        <img src={assetUrl(game.thumbnail)} alt={game.title} loading="lazy" decoding="async" />
        <span className="absolute bottom-3 left-3 rounded-full border border-white/15 bg-black/60 px-2.5 py-1 text-[9px] font-black uppercase tracking-[.11em] text-white backdrop-blur-md">{game.dimension}</span>
      </Link>
      <div className="p-4">
        <div className="flex items-start gap-3"><div className="min-w-0 flex-1"><Link href={gameHref(game)} className="text-[17px] font-black tracking-[-.035em] hover:underline">{game.title}</Link><p className="mt-1 line-clamp-2 min-h-10 text-xs leading-5 text-muted-foreground">{game.shortDescription}</p></div><button type="button" onClick={() => onFavorite(game.slug)} className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-border transition hover:bg-muted" aria-label={favorite ? "Remove favorite" : "Save game"}><Heart className={cn("h-4 w-4", favorite && "fill-rose-500 text-rose-500")} /></button></div>
        <div className="mt-3 flex flex-wrap gap-1.5">{game.categories.slice(0, 2).map((item) => <span key={item} className="rounded-full bg-foreground/[.055] px-2.5 py-1 text-[9px] font-black uppercase tracking-[.08em] text-muted-foreground">{item}</span>)}<span className="rounded-full bg-primary/10 px-2.5 py-1 text-[9px] font-black uppercase tracking-[.08em] text-primary">Touch</span></div>
        <Link href={gameHref(game)} className="mt-4 flex h-10 items-center justify-center gap-2 rounded-full bg-foreground text-xs font-black text-background transition hover:opacity-90">Play now <ArrowRight className="h-3.5 w-3.5" /></Link>
      </div>
    </article>
  );
}

function MiniGameCard({ game }: { game: BrowserGame }) {
  return <Link href={gameHref(game)} className="group flex items-center gap-3 rounded-2xl border border-border bg-card p-2.5 transition hover:-translate-y-0.5 hover:border-primary/40"><div className="h-16 w-20 shrink-0 overflow-hidden rounded-xl bg-black"><img src={assetUrl(game.thumbnail)} alt="" loading="lazy" className="h-full w-full object-cover transition-transform group-hover:scale-105" /></div><div className="min-w-0 flex-1"><p className="truncate text-sm font-black">{game.title}</p><p className="mt-1 truncate text-[10px] font-bold uppercase tracking-[.09em] text-muted-foreground">{game.dimension} · instant play</p></div><ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" /></Link>;
}
