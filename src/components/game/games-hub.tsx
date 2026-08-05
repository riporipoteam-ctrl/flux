"use client";

import { useDeferredValue, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  Boxes,
  Gamepad2,
  Heart,
  Info,
  MonitorPlay,
  Search,
  Smartphone,
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

const FAVORITES_KEY = "flux-games-favorites";
const RECENT_KEY = "flux-games-recent";

function gameHref(game: BrowserGame) {
  return `/games/play?game=${encodeURIComponent(game.slug)}`;
}

export default function GamesHub() {
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const [category, setCategory] = useState<GameCategoryFilter>("All");
  const [favorites, setFavorites] = useState<string[]>([]);
  const [recent, setRecent] = useState<string[]>([]);
  const hero = FEATURED_GAMES[0] || BROWSER_GAMES[0];

  useEffect(() => {
    try {
      setFavorites(JSON.parse(localStorage.getItem(FAVORITES_KEY) || "[]") as string[]);
      setRecent(JSON.parse(localStorage.getItem(RECENT_KEY) || "[]") as string[]);
    } catch {
      setFavorites([]);
      setRecent([]);
    }
  }, []);

  const filtered = useMemo(() => {
    const needle = deferredQuery.trim().toLowerCase();
    return BROWSER_GAMES.filter((game) => {
      if (category !== "All" && !game.categories.includes(category as never)) return false;
      if (!needle) return true;
      return [game.title, game.shortDescription, game.dimension, game.controls, ...game.categories]
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });
  }, [category, deferredQuery]);

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
    <div className="min-h-[100dvh] bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b border-border bg-background/94 backdrop-blur-xl">
        <div className="mx-auto flex min-h-14 max-w-[1180px] items-center gap-3 px-4 sm:px-6">
          <span className="grid h-9 w-9 place-items-center rounded-full bg-foreground text-background">
            <Gamepad2 className="h-4.5 w-4.5" />
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="text-[15px] font-black tracking-[-.025em]">Flux Games</h1>
            <p className="truncate text-[10px] font-semibold text-muted-foreground">Self-hosted open-source games · no blocked outside players</p>
          </div>
          <Link href="/games/licenses" className="grid h-9 w-9 place-items-center rounded-full border border-border hover:bg-muted" aria-label="Game licenses">
            <Info className="h-4 w-4" />
          </Link>
          <Link href="/studio" className="hidden h-9 items-center gap-2 rounded-full bg-foreground px-4 text-xs font-black text-background sm:flex">
            <Boxes className="h-3.5 w-3.5" /> Studio
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1180px] px-3 pb-28 pt-4 sm:px-6 lg:pb-12">
        <section className="grid overflow-hidden border-y border-border bg-card sm:rounded-[24px] sm:border lg:grid-cols-[1.12fr_.88fr]">
          <GameVisual game={hero} hero />
          <div className="flex flex-col justify-center p-5 sm:p-8 lg:p-10">
            <div className="flex flex-wrap gap-2">
              <Badge>{hero.dimension}</Badge>
              <Badge>TOUCH READY</Badge>
              <Badge>OPEN SOURCE</Badge>
            </div>
            <h2 className="mt-4 text-4xl font-black leading-[.94] tracking-[-.06em] sm:text-6xl">{hero.title}</h2>
            <p className="mt-4 max-w-xl text-sm leading-6 text-muted-foreground sm:text-base">{hero.description}</p>
            <div className="mt-5 flex flex-wrap gap-2 text-xs font-bold text-muted-foreground">
              <span className="flex items-center gap-1.5 rounded-full bg-muted px-3 py-2"><Smartphone className="h-3.5 w-3.5" /> Mobile controls</span>
              <span className="flex items-center gap-1.5 rounded-full bg-muted px-3 py-2"><MonitorPlay className="h-3.5 w-3.5" /> Fullscreen</span>
              <span className="flex items-center gap-1.5 rounded-full bg-muted px-3 py-2"><BadgeCheck className="h-3.5 w-3.5" /> Hosted by Flux</span>
            </div>
            <Link href={gameHref(hero)} className="mt-6 inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-foreground px-7 text-sm font-black text-background sm:w-fit">
              Play now <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>

        <section className="mt-4 border-y border-border bg-card p-3 sm:rounded-[20px] sm:border sm:p-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search games, controls or genres"
              className="h-11 w-full rounded-full border border-border bg-muted/55 pl-11 pr-11 text-sm font-semibold outline-none focus:border-primary"
            />
            {query ? <button type="button" onClick={() => setQuery("")} className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full hover:bg-muted" aria-label="Clear search"><X className="h-4 w-4" /></button> : null}
          </div>
          <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto pb-1">
            {GAME_CATEGORIES.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setCategory(item)}
                className={cn("h-8 shrink-0 rounded-full px-4 text-xs font-black", category === item ? "bg-foreground text-background" : "border border-border bg-background text-muted-foreground")}
              >{item}</button>
            ))}
          </div>
        </section>

        {recentGames.length ? (
          <section className="mt-8">
            <SectionTitle eyebrow="Your library" title="Continue playing" />
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {recentGames.map((game) => <GameCard key={game.slug} game={game} favorite={favorites.includes(game.slug)} onFavorite={toggleFavorite} compact />)}
            </div>
          </section>
        ) : null}

        <section className="mt-8">
          <div className="flex items-end justify-between gap-4 px-1">
            <SectionTitle eyebrow="Flux Open Games" title={category === "All" ? "All games" : category} />
            <p className="pb-1 text-xs font-bold text-muted-foreground">{filtered.length} of {OPEN_SOURCE_GAME_COUNT}</p>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((game) => <GameCard key={game.slug} game={game} favorite={favorites.includes(game.slug)} onFavorite={toggleFavorite} />)}
          </div>
          {!filtered.length ? <div className="mt-5 grid min-h-44 place-items-center border-y border-dashed border-border text-center sm:rounded-[20px] sm:border"><div><Search className="mx-auto h-6 w-6 text-muted-foreground" /><p className="mt-3 font-black">No matching game</p><p className="mt-1 text-xs text-muted-foreground">Try another name or category.</p></div></div> : null}
        </section>

        <section className="mt-9 flex flex-col gap-4 border-y border-border bg-card p-5 sm:flex-row sm:items-center sm:justify-between sm:rounded-[20px] sm:border">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[.18em] text-muted-foreground">Credits and licenses</p>
            <h2 className="mt-1 text-xl font-black">Open-source, properly credited</h2>
            <p className="mt-1 max-w-xl text-sm leading-6 text-muted-foreground">The player stays clean. Required authorship, source and license information lives on one dedicated page.</p>
          </div>
          <Link href="/games/licenses" className="inline-flex h-11 shrink-0 items-center justify-center rounded-full border border-border px-5 text-sm font-black hover:bg-muted">View licenses</Link>
        </section>
      </main>
    </div>
  );
}

function SectionTitle({ eyebrow, title }: { eyebrow: string; title: string }) {
  return <div><p className="text-[10px] font-black uppercase tracking-[.18em] text-muted-foreground">{eyebrow}</p><h2 className="mt-1 text-2xl font-black tracking-[-.045em] sm:text-3xl">{title}</h2></div>;
}

function Badge({ children }: { children: React.ReactNode }) {
  return <span className="rounded-full border border-border bg-muted px-3 py-1.5 text-[9px] font-black tracking-[.12em] text-muted-foreground">{children}</span>;
}

function GameVisual({ game, hero = false }: { game: BrowserGame; hero?: boolean }) {
  return (
    <div className={cn("relative overflow-hidden bg-black", hero ? "min-h-[280px] sm:min-h-[400px]" : "aspect-[16/10]")}>
      <img src={assetUrl(game.thumbnail)} alt="" loading={hero ? "eager" : "lazy"} decoding="async" className="absolute inset-0 h-full w-full object-cover" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/76 via-transparent to-black/5" />
      <span className="absolute bottom-3 left-3 rounded-full border border-white/20 bg-black/55 px-3 py-1.5 text-[9px] font-black uppercase tracking-[.13em] text-white backdrop-blur-md">{game.dimension} · Open source</span>
    </div>
  );
}

function GameCard({ game, favorite, onFavorite, compact = false }: { game: BrowserGame; favorite: boolean; onFavorite: (slug: string) => void; compact?: boolean }) {
  return (
    <article className="group overflow-hidden border-y border-border bg-card sm:rounded-[20px] sm:border">
      <Link href={gameHref(game)} className="block"><GameVisual game={game} /></Link>
      <div className={cn("p-4", !compact && "sm:p-5")}>
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <Link href={gameHref(game)} className="text-lg font-black tracking-[-.035em] hover:underline">{game.title}</Link>
            <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">{game.shortDescription}</p>
          </div>
          <button type="button" onClick={() => onFavorite(game.slug)} className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-border hover:bg-muted" aria-label={favorite ? "Remove favorite" : "Save game"}>
            <Heart className={cn("h-4 w-4", favorite && "fill-rose-500 text-rose-500")} />
          </button>
        </div>
        <div className="mt-3 flex items-center gap-2 text-[10px] font-black uppercase tracking-[.1em] text-muted-foreground">
          <Smartphone className="h-3.5 w-3.5" /> Touch ready
          <span>·</span>
          <span>{game.dimension}</span>
        </div>
        <Link href={gameHref(game)} className="mt-4 flex h-10 items-center justify-center gap-2 rounded-full bg-foreground text-xs font-black text-background">Play <ArrowRight className="h-3.5 w-3.5" /></Link>
      </div>
    </article>
  );
}
