"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Clock3, Dice5, Gamepad2, Heart, Search, ShieldCheck, Smartphone, X } from "lucide-react";
import {
  BROWSER_GAMES,
  FEATURED_GAMES,
  GAME_CATEGORIES,
  type BrowserGame,
  type GameCategoryFilter,
} from "@/data/browser-games";
import { GameCoverArt } from "@/components/game/game-cover-art";

const FAVORITES_KEY = "flux-games-favorites";
const RECENT_KEY = "flux-games-recent";

function hrefForGame(game: BrowserGame) {
  return game.internal ? game.playUrl : `/games/play?game=${encodeURIComponent(game.slug)}`;
}

export default function GamesPage() {
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<GameCategoryFilter>("All");
  const [favorites, setFavorites] = useState<string[]>([]);
  const [recent, setRecent] = useState<string[]>([]);
  const hero = FEATURED_GAMES[0] ?? BROWSER_GAMES[0];

  useEffect(() => {
    const readSaved = () => {
      try {
        setFavorites(JSON.parse(localStorage.getItem(FAVORITES_KEY) || "[]") as string[]);
        setRecent(JSON.parse(localStorage.getItem(RECENT_KEY) || "[]") as string[]);
      } catch {
        setFavorites([]);
        setRecent([]);
      }
    };
    readSaved();
    window.addEventListener("flux-games-updated", readSaved);
    window.addEventListener("storage", readSaved);
    return () => {
      window.removeEventListener("flux-games-updated", readSaved);
      window.removeEventListener("storage", readSaved);
    };
  }, []);

  const filteredGames = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return BROWSER_GAMES.filter((game) => {
      const categoryMatch = category === "All" || game.categories.includes(category);
      const textMatch = !needle || [game.title, game.author, game.shortDescription, ...game.categories].join(" ").toLowerCase().includes(needle);
      return categoryMatch && textMatch;
    });
  }, [category, query]);

  const favoriteGames = favorites.map((slug) => BROWSER_GAMES.find((game) => game.slug === slug)).filter(Boolean) as BrowserGame[];
  const recentGames = recent.map((slug) => BROWSER_GAMES.find((game) => game.slug === slug)).filter(Boolean) as BrowserGame[];

  const toggleFavorite = (slug: string) => {
    setFavorites((current) => {
      const next = current.includes(slug) ? current.filter((item) => item !== slug) : [slug, ...current];
      try {
        localStorage.setItem(FAVORITES_KEY, JSON.stringify(next));
        window.dispatchEvent(new Event("flux-games-updated"));
      } catch {}
      return next;
    });
  };

  const surpriseMe = () => {
    const pool = filteredGames.length ? filteredGames : BROWSER_GAMES;
    router.push(hrefForGame(pool[Math.floor(Math.random() * pool.length)]));
  };

  return (
    <div className="min-h-screen pb-14">
      <header className="sticky top-0 z-40 hidden border-b border-border/70 bg-background/88 px-5 py-3 backdrop-blur-xl lg:block">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-black tracking-[-0.04em]">Flux Games</h1>
            <p className="text-xs text-muted-foreground">Free games hosted and played directly inside Flux.</p>
          </div>
          <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground"><ShieldCheck className="h-4 w-4 text-emerald-500" /> No redirects · no VPS</div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-3 pt-3 sm:px-5 sm:pt-5">
        <section className="relative overflow-hidden rounded-[28px] border border-white/10 bg-black shadow-[0_30px_80px_rgba(0,0,0,.3)] sm:rounded-[34px]">
          <div className="relative min-h-[470px] sm:min-h-[540px]">
            <GameCoverArt game={hero} />
            <motion.div
              className="absolute inset-0 flex max-w-2xl flex-col justify-end p-6 sm:p-10"
              initial={{ opacity: 0, y: reduceMotion ? 0 : 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: reduceMotion ? 0 : 0.42 }}
            >
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/60">Featured this week</p>
              <h2 className="mt-3 text-4xl font-black leading-[0.92] tracking-[-0.06em] text-white sm:text-6xl">{hero.title}</h2>
              <p className="mt-4 max-w-xl text-sm leading-6 text-white/72 sm:text-base">{hero.description}</p>
              <div className="mt-5 flex flex-wrap gap-2">
                {hero.categories.map((item) => <span key={item} className="rounded-full border border-white/15 bg-black/35 px-3 py-1.5 text-[10px] font-bold text-white/80 backdrop-blur-md">{item}</span>)}
              </div>
              <div className="mt-7 flex flex-wrap gap-3">
                <Link href={hrefForGame(hero)} className="inline-flex h-12 items-center gap-2 rounded-full bg-white px-6 text-sm font-black text-black transition hover:-translate-y-0.5"><Gamepad2 className="h-5 w-5" /> Play now <ArrowRight className="h-4 w-4" /></Link>
                <button type="button" onClick={surpriseMe} className="inline-flex h-12 items-center gap-2 rounded-full border border-white/20 bg-black/30 px-5 text-sm font-black text-white backdrop-blur-md transition hover:bg-white/10"><Dice5 className="h-4.5 w-4.5" /> Surprise me</button>
              </div>
            </motion.div>
          </div>
        </section>

        <section className="mt-5 grid grid-cols-3 gap-2 sm:gap-3">
          <Stat value={`${BROWSER_GAMES.length}`} label="Games" />
          <Stat value="3" label="Device types" />
          <Stat value="0" label="External redirects" />
        </section>

        <section className="mt-8 rounded-[24px] border border-border bg-card p-3 shadow-sm sm:p-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-muted-foreground" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search games" className="h-12 w-full rounded-2xl border border-border bg-background pl-11 pr-12 text-sm font-semibold outline-none transition focus:border-foreground/25 focus:ring-4 focus:ring-foreground/5" />
            {query ? <button type="button" onClick={() => setQuery("")} className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full hover:bg-muted" aria-label="Clear search"><X className="h-4 w-4" /></button> : null}
          </div>
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1 scrollbar-none">
            {GAME_CATEGORIES.map((item) => (
              <button key={item} type="button" onClick={() => setCategory(item)} className={`shrink-0 rounded-full px-4 py-2 text-[11px] font-black transition ${item === category ? "bg-foreground text-background" : "border border-border bg-background text-muted-foreground hover:text-foreground"}`}>{item}</button>
            ))}
          </div>
        </section>

        {favoriteGames.length ? <GameRow title="Saved games" icon={Heart} games={favoriteGames.slice(0, 4)} favorites={favorites} onToggleFavorite={toggleFavorite} /> : null}
        {recentGames.length ? <GameRow title="Continue playing" icon={Clock3} games={recentGames.slice(0, 4)} favorites={favorites} onToggleFavorite={toggleFavorite} /> : null}

        <section className="mt-10">
          <div className="flex items-end justify-between gap-4">
            <div><p className="text-[10px] font-black uppercase tracking-[0.16em] text-muted-foreground">Library</p><h2 className="mt-1 text-3xl font-black tracking-[-0.05em]">{category === "All" ? "All games" : category}</h2></div>
            <p className="text-xs font-bold text-muted-foreground">{filteredGames.length} results</p>
          </div>
          <motion.div layout className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <AnimatePresence mode="popLayout">
              {filteredGames.map((game, index) => <GameCard key={game.slug} game={game} index={index} favorite={favorites.includes(game.slug)} onToggleFavorite={toggleFavorite} />)}
            </AnimatePresence>
          </motion.div>
          {!filteredGames.length ? <div className="mt-5 grid min-h-56 place-items-center rounded-[24px] border border-dashed border-border p-8 text-center"><div><Search className="mx-auto h-7 w-7 text-muted-foreground" /><h3 className="mt-3 font-black">Nothing found</h3><p className="mt-1 text-sm text-muted-foreground">Try another search or category.</p></div></div> : null}
        </section>
      </main>
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return <div className="rounded-2xl border border-border bg-card px-4 py-4"><p className="text-xl font-black tracking-[-0.04em]">{value}</p><p className="mt-1 text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">{label}</p></div>;
}

function GameRow({ title, icon: Icon, games, favorites, onToggleFavorite }: { title: string; icon: typeof Clock3; games: BrowserGame[]; favorites: string[]; onToggleFavorite: (slug: string) => void }) {
  return <section className="mt-9"><div className="flex items-center gap-2"><Icon className="h-4.5 w-4.5 text-muted-foreground" /><h2 className="text-xl font-black tracking-[-0.035em]">{title}</h2></div><div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{games.map((game, index) => <GameCard key={game.slug} game={game} index={index} favorite={favorites.includes(game.slug)} onToggleFavorite={onToggleFavorite} compact />)}</div></section>;
}

function GameCard({ game, index, favorite, onToggleFavorite, compact = false }: { game: BrowserGame; index: number; favorite: boolean; onToggleFavorite: (slug: string) => void; compact?: boolean }) {
  const reduceMotion = useReducedMotion();
  return (
    <motion.article layout initial={{ opacity: 0, y: reduceMotion ? 0 : 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.98 }} transition={{ duration: reduceMotion ? 0 : 0.25, delay: Math.min(index * 0.025, 0.14) }} className="group overflow-hidden rounded-[22px] border border-border bg-card transition hover:border-foreground/20 hover:shadow-[0_18px_45px_rgba(0,0,0,.11)]">
      <Link href={hrefForGame(game)} className="block">
        <div className={`relative overflow-hidden ${compact ? "aspect-[16/9]" : "aspect-[16/10]"}`}>
          <GameCoverArt game={game} compact />
          <button type="button" onClick={(event) => { event.preventDefault(); event.stopPropagation(); onToggleFavorite(game.slug); }} className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full border border-white/15 bg-black/45 text-white backdrop-blur-md transition hover:bg-black/70" aria-label={favorite ? `Remove ${game.title} from favorites` : `Add ${game.title} to favorites`}><Heart className={`h-4 w-4 ${favorite ? "fill-rose-400 text-rose-400" : ""}`} /></button>
          <div className="absolute inset-x-3 bottom-3 flex items-center justify-between gap-3"><span className="rounded-full bg-black/55 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.12em] text-white backdrop-blur-md">{game.categories[0]}</span><span className="grid h-9 w-9 place-items-center rounded-full bg-white text-black transition group-hover:translate-x-0.5"><ArrowRight className="h-4 w-4" /></span></div>
        </div>
        <div className={compact ? "p-4" : "p-5"}>
          <div className="flex items-start justify-between gap-3"><div className="min-w-0"><h3 className={`${compact ? "text-base" : "text-xl"} truncate font-black tracking-[-0.035em]`}>{game.title}</h3><p className="mt-1 truncate text-[10px] font-bold text-muted-foreground">{game.author} · {game.status}</p></div>{!compact ? <span className="text-[10px] font-black text-emerald-600">FREE</span> : null}</div>
          {!compact ? <p className="mt-3 line-clamp-2 text-sm leading-6 text-muted-foreground">{game.shortDescription}</p> : null}
          <div className="mt-4 flex items-center gap-1.5 border-t border-border/70 pt-3 text-[9px] font-black uppercase tracking-[0.1em] text-muted-foreground"><Smartphone className="h-3.5 w-3.5" /> Mobile · Tablet · PC</div>
        </div>
      </Link>
    </motion.article>
  );
}
