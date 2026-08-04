"use client";

import { useDeferredValue, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Boxes,
  Gamepad2,
  Heart,
  MonitorPlay,
  Search,
  Smartphone,
  Sparkles,
  X,
} from "lucide-react";
import {
  BROWSER_GAMES,
  FEATURED_GAMES,
  GAME_CATEGORIES,
  type BrowserGame,
  type GameCategoryFilter,
} from "@/data/browser-games";
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
      return [game.title, game.shortDescription, game.dimension, ...game.categories]
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
    <div className="min-h-[100dvh] bg-[#05070b] text-white">
      <header className="sticky top-0 z-40 border-b border-white/8 bg-[#05070b]/86 backdrop-blur-2xl">
        <div className="mx-auto flex min-h-16 max-w-[1280px] items-center gap-3 px-4 sm:px-6">
          <div className="grid h-10 w-10 place-items-center rounded-2xl bg-white text-black">
            <Gamepad2 className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-base font-black tracking-[-.03em]">Flux Games</h1>
            <p className="text-[10px] font-bold uppercase tracking-[.16em] text-white/35">Instant play · no redirects</p>
          </div>
          <Link href="/studio" className="hidden h-10 items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 text-xs font-black transition hover:bg-white/10 sm:flex">
            <Boxes className="h-4 w-4" /> Studio
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1280px] px-3 pb-28 pt-3 sm:px-6 sm:pt-6 lg:pb-12">
        <section className="grid overflow-hidden rounded-[28px] border border-white/10 bg-[#0b1019] lg:grid-cols-[1.18fr_.82fr]">
          <GameVisual game={hero} hero />
          <div className="flex flex-col justify-center p-6 sm:p-9 lg:p-11">
            <div className="flex flex-wrap gap-2">
              <Badge>{hero.dimension}</Badge>
              <Badge>TOUCH READY</Badge>
              <Badge>FLUX ORIGINAL</Badge>
            </div>
            <h2 className="mt-5 text-4xl font-black leading-[.92] tracking-[-.065em] sm:text-6xl">{hero.title}</h2>
            <p className="mt-4 max-w-xl text-sm leading-6 text-white/55 sm:text-base sm:leading-7">{hero.description}</p>
            <div className="mt-5 flex flex-wrap gap-2 text-xs font-bold text-white/45">
              <span className="flex items-center gap-1.5 rounded-full bg-white/5 px-3 py-2"><Smartphone className="h-3.5 w-3.5" /> Mobile controls</span>
              <span className="flex items-center gap-1.5 rounded-full bg-white/5 px-3 py-2"><MonitorPlay className="h-3.5 w-3.5" /> Fullscreen</span>
            </div>
            <Link href={gameHref(hero)} className="mt-7 inline-flex h-13 w-full items-center justify-center gap-2 rounded-full bg-white px-7 text-sm font-black text-black transition hover:scale-[1.01] sm:w-fit">
              Play now <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>

        <section className="mt-4 rounded-[24px] border border-white/8 bg-white/[.035] p-3 sm:p-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-white/32" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search Flux Games"
              className="h-12 w-full rounded-2xl border border-white/8 bg-black/25 pl-11 pr-11 text-sm font-semibold outline-none transition placeholder:text-white/25 focus:border-cyan-400/50"
            />
            {query ? <button type="button" onClick={() => setQuery("")} className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full hover:bg-white/8" aria-label="Clear search"><X className="h-4 w-4" /></button> : null}
          </div>
          <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto pb-1">
            {GAME_CATEGORIES.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setCategory(item)}
                className={cn("h-9 shrink-0 rounded-full px-4 text-xs font-black transition", category === item ? "bg-white text-black" : "bg-white/6 text-white/55 hover:bg-white/10")}
              >{item}</button>
            ))}
          </div>
        </section>

        {recentGames.length ? (
          <section className="mt-8">
            <SectionTitle eyebrow="Your games" title="Continue playing" />
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {recentGames.map((game) => <GameCard key={game.slug} game={game} favorite={favorites.includes(game.slug)} onFavorite={toggleFavorite} compact />)}
            </div>
          </section>
        ) : null}

        <section className="mt-9">
          <div className="flex items-end justify-between gap-4">
            <SectionTitle eyebrow="Flux Originals" title={category === "All" ? "All games" : category} />
            <p className="pb-1 text-xs font-bold text-white/35">{filtered.length} working games</p>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((game) => <GameCard key={game.slug} game={game} favorite={favorites.includes(game.slug)} onFavorite={toggleFavorite} />)}
          </div>
          {!filtered.length ? <div className="mt-5 grid min-h-48 place-items-center rounded-[24px] border border-dashed border-white/10 text-center"><div><Search className="mx-auto h-6 w-6 text-white/20" /><p className="mt-3 font-black">No matching game</p><p className="mt-1 text-xs text-white/35">Try another name or category.</p></div></div> : null}
        </section>

        <section className="mt-10 overflow-hidden rounded-[28px] border border-violet-400/15 bg-gradient-to-br from-violet-500/15 via-cyan-400/8 to-transparent p-6 sm:p-9">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[.18em] text-violet-300"><Sparkles className="h-4 w-4" /> Build the next one</div>
              <h2 className="mt-3 text-3xl font-black tracking-[-.05em]">Flux Studio</h2>
              <p className="mt-2 max-w-xl text-sm leading-6 text-white/45">Create and publish another game without mixing it into fake catalog variations.</p>
            </div>
            <Link href="/studio" className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-white px-6 text-sm font-black text-black"><Boxes className="h-4 w-4" /> Open Studio</Link>
          </div>
        </section>
      </main>
    </div>
  );
}

function SectionTitle({ eyebrow, title }: { eyebrow: string; title: string }) {
  return <div><p className="text-[10px] font-black uppercase tracking-[.18em] text-white/30">{eyebrow}</p><h2 className="mt-1 text-2xl font-black tracking-[-.045em] sm:text-3xl">{title}</h2></div>;
}

function Badge({ children }: { children: React.ReactNode }) {
  return <span className="rounded-full border border-white/10 bg-white/7 px-3 py-1.5 text-[9px] font-black tracking-[.13em] text-white/70">{children}</span>;
}

function GameVisual({ game, hero = false }: { game: BrowserGame; hero?: boolean }) {
  const [a, b, c] = game.palette;
  return (
    <div className={cn("relative overflow-hidden", hero ? "min-h-[310px] sm:min-h-[430px]" : "aspect-[16/10]")} style={{ background: `linear-gradient(145deg, ${a}, ${b})` }}>
      <div className="absolute inset-0 opacity-75" style={{ background: `radial-gradient(circle at 70% 25%, ${c}88, transparent 34%), radial-gradient(circle at 20% 90%, ${b}, transparent 45%)` }} />
      <div className="absolute inset-0 bg-[linear-gradient(115deg,transparent_25%,rgba(255,255,255,.09)_25.5%,transparent_26%)] bg-[length:44px_44px] opacity-35" />
      <span className={cn("absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 drop-shadow-[0_25px_50px_rgba(0,0,0,.4)]", hero ? "text-[110px] sm:text-[170px]" : "text-[82px]")}>{game.symbol}</span>
      <span className="absolute bottom-4 left-4 rounded-full bg-black/45 px-3 py-1.5 text-[9px] font-black uppercase tracking-[.16em] backdrop-blur-xl">{game.dimension} · Flux Original</span>
    </div>
  );
}

function GameCard({ game, favorite, onFavorite, compact = false }: { game: BrowserGame; favorite: boolean; onFavorite: (slug: string) => void; compact?: boolean }) {
  return (
    <article className="group overflow-hidden rounded-[24px] border border-white/9 bg-[#0b1018] transition hover:-translate-y-0.5 hover:border-white/16">
      <Link href={gameHref(game)} className="block"><GameVisual game={game} /></Link>
      <div className={cn("p-4", !compact && "sm:p-5")}>
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <Link href={gameHref(game)} className="text-lg font-black tracking-[-.035em] hover:underline">{game.title}</Link>
            <p className="mt-1 line-clamp-2 text-xs leading-5 text-white/42">{game.shortDescription}</p>
          </div>
          <button type="button" onClick={() => onFavorite(game.slug)} className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/6 transition hover:bg-white/12" aria-label={favorite ? "Remove favorite" : "Save game"}>
            <Heart className={cn("h-4.5 w-4.5", favorite && "fill-rose-400 text-rose-400")} />
          </button>
        </div>
        <div className="mt-4 flex items-center gap-2 text-[10px] font-black uppercase tracking-[.12em] text-white/35">
          <Smartphone className="h-3.5 w-3.5" /> Touch ready
          <span>·</span>
          <span>{game.dimension}</span>
        </div>
        <Link href={gameHref(game)} className="mt-4 flex h-11 items-center justify-center gap-2 rounded-full bg-white text-xs font-black text-black">Play <ArrowRight className="h-3.5 w-3.5" /></Link>
      </div>
    </article>
  );
}
