"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  ArrowRight,
  Clock3,
  ExternalLink,
  Gamepad2,
  Heart,
  Search,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Star,
  X,
  Zap,
} from "lucide-react";
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
  const reduceMotion = useReducedMotion();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<GameCategoryFilter>("All");
  const [favorites, setFavorites] = useState<string[]>([]);
  const [recent, setRecent] = useState<string[]>([]);
  const hero = FEATURED_GAMES[0] ?? BROWSER_GAMES[0];

  useEffect(() => {
    const loadSaved = () => {
      try {
        setFavorites(JSON.parse(localStorage.getItem(FAVORITES_KEY) || "[]") as string[]);
        setRecent(JSON.parse(localStorage.getItem(RECENT_KEY) || "[]") as string[]);
      } catch {
        setFavorites([]);
        setRecent([]);
      }
    };
    loadSaved();
    window.addEventListener("flux-games-updated", loadSaved);
    window.addEventListener("storage", loadSaved);
    return () => {
      window.removeEventListener("flux-games-updated", loadSaved);
      window.removeEventListener("storage", loadSaved);
    };
  }, []);

  const filteredGames = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return BROWSER_GAMES.filter((game) => {
      const matchesCategory = category === "All" || game.categories.includes(category);
      const matchesSearch = !normalized || [game.title, game.author, game.shortDescription, game.description, ...game.categories]
        .join(" ")
        .toLowerCase()
        .includes(normalized);
      return matchesCategory && matchesSearch;
    });
  }, [category, query]);

  const recentGames = recent.map((slug) => BROWSER_GAMES.find((game) => game.slug === slug)).filter(Boolean) as BrowserGame[];
  const favoriteGames = favorites.map((slug) => BROWSER_GAMES.find((game) => game.slug === slug)).filter(Boolean) as BrowserGame[];

  const toggleFavorite = (slug: string) => {
    setFavorites((current) => {
      const next = current.includes(slug) ? current.filter((item) => item !== slug) : [slug, ...current];
      try {
        localStorage.setItem(FAVORITES_KEY, JSON.stringify(next));
      } catch {
        // The UI still works for the current visit if local storage is blocked.
      }
      return next;
    });
  };

  return (
    <div className="min-h-screen pb-12">
      <header className="sticky top-0 z-40 hidden border-b border-border/70 px-5 py-3 glass-strong lg:block">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-black tracking-[-0.04em]">Flux Games</h1>
            <p className="text-xs text-muted-foreground">Open-source games hosted directly by Flux for mobile, tablet and PC.</p>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-emerald-500/15 bg-emerald-500/8 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-emerald-600">
            <ShieldCheck className="h-3.5 w-3.5" /> Hosted on Flux
          </div>
        </div>
      </header>

      <div className="px-3 pt-3 sm:px-5 sm:pt-5">
        <section className="relative min-h-[510px] overflow-hidden rounded-[30px] border border-white/10 bg-[#07122d] shadow-[0_35px_100px_rgba(2,6,23,.35)] sm:min-h-[550px] sm:rounded-[40px]">
          <GameCoverArt game={hero} />
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(3,7,18,.97)_0%,rgba(3,7,18,.88)_47%,rgba(3,7,18,.18)_82%)]" />
          <motion.div
            className="relative flex min-h-[510px] max-w-3xl flex-col justify-end p-6 sm:min-h-[550px] sm:p-10"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.55, ease: "easeOut" }}
          >
            <div className="mb-4 flex w-fit items-center gap-2 rounded-full border border-cyan-300/15 bg-cyan-300/8 px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.18em] text-cyan-200 backdrop-blur-xl">
              <Sparkles className="h-3.5 w-3.5" /> Featured open-source game
            </div>
            <h2 className="max-w-xl text-5xl font-black leading-[0.9] tracking-[-0.07em] text-white sm:text-7xl">Race the mountain. <span className="text-cyan-300">Anywhere.</span></h2>
            <p className="mt-5 max-w-xl text-sm leading-6 text-white/65 sm:text-base sm:leading-7">{hero.description}</p>
            <div className="mt-5 flex flex-wrap gap-2 text-[10px] font-black text-white/70">
              <span className="rounded-full border border-white/10 bg-white/8 px-3 py-1.5 backdrop-blur-xl">Mobile touch</span>
              <span className="rounded-full border border-white/10 bg-white/8 px-3 py-1.5 backdrop-blur-xl">Keyboard</span>
              <span className="rounded-full border border-white/10 bg-white/8 px-3 py-1.5 backdrop-blur-xl">3D WebGL</span>
              <span className="rounded-full border border-white/10 bg-white/8 px-3 py-1.5 backdrop-blur-xl">Free</span>
            </div>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link href={hrefForGame(hero)} className="inline-flex h-13 items-center gap-2 rounded-full bg-white px-7 text-sm font-black text-slate-950 shadow-[0_18px_50px_rgba(255,255,255,.16)] transition hover:-translate-y-0.5">
                <Gamepad2 className="h-5 w-5" /> Play TuxRacer.js <ArrowRight className="h-4 w-4" />
              </Link>
              <a href={hero.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex h-13 items-center gap-2 rounded-full border border-white/15 bg-white/8 px-6 text-sm font-black text-white backdrop-blur-xl transition hover:bg-white/14">
                <ExternalLink className="h-5 w-5" /> Source
              </a>
            </div>
          </motion.div>
        </section>

        <section className="relative z-10 -mt-4 mx-2 grid grid-cols-2 gap-2 rounded-[26px] border border-border/70 bg-card/88 p-2 shadow-soft backdrop-blur-2xl sm:-mt-7 sm:mx-5 sm:grid-cols-4 sm:gap-3 sm:p-3">
          {[
            { icon: Smartphone, value: "Touch + PC", label: "Cross-device controls" },
            { icon: ShieldCheck, value: "Included in Flux", label: "No external site" },
            { icon: Zap, value: "Static", label: "No VPS required" },
            { icon: ExternalLink, value: `${BROWSER_GAMES.length} games`, label: "Hosted locally" },
          ].map(({ icon: Icon, value, label }) => (
            <motion.div key={value} whileHover={reduceMotion ? undefined : { y: -3 }} className="rounded-[20px] border border-border/60 bg-background/55 p-4">
              <Icon className="h-4.5 w-4.5 text-primary" />
              <p className="mt-4 text-sm font-black">{value}</p>
              <p className="mt-1 text-[10px] font-semibold text-muted-foreground">{label}</p>
            </motion.div>
          ))}
        </section>

        <section className="mt-7 rounded-[28px] border border-border/70 bg-card/72 p-3 shadow-soft backdrop-blur-xl sm:p-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search racing, story, horror, simulator…"
              className="h-13 w-full rounded-2xl border border-border/70 bg-background/75 pl-11 pr-12 text-sm font-semibold outline-none transition placeholder:text-muted-foreground focus:border-primary/35 focus:ring-4 focus:ring-primary/8"
            />
            {query ? <button type="button" onClick={() => setQuery("")} className="absolute right-2 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full hover:bg-muted" aria-label="Clear search"><X className="h-4 w-4" /></button> : null}
          </div>
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1 scrollbar-none">
            {GAME_CATEGORIES.map((item) => {
              const active = item === category;
              const count = item === "All" ? BROWSER_GAMES.length : BROWSER_GAMES.filter((game) => game.categories.includes(item)).length;
              return (
                <button
                  key={item}
                  type="button"
                  onClick={() => setCategory(item)}
                  className={`shrink-0 rounded-full px-4 py-2 text-[11px] font-black transition ${active ? "bg-foreground text-background shadow-lg" : "border border-border/70 bg-background/55 text-muted-foreground hover:text-foreground"}`}
                >
                  {item} <span className={active ? "text-background/55" : "text-muted-foreground/60"}>{count}</span>
                </button>
              );
            })}
          </div>
        </section>

        {recentGames.length ? (
          <GameRow title="Continue playing" subtitle="Recently launched on this device" icon={Clock3} games={recentGames.slice(0, 4)} favorites={favorites} onToggleFavorite={toggleFavorite} />
        ) : null}

        {favoriteGames.length ? (
          <GameRow title="Your favorites" subtitle="Saved locally on this device" icon={Heart} games={favoriteGames.slice(0, 4)} favorites={favorites} onToggleFavorite={toggleFavorite} />
        ) : null}

        <section className="mt-10">
          <div className="flex items-end justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.16em] text-primary"><Star className="h-3.5 w-3.5" /> Curated for Flux</div>
              <h2 className="mt-2 text-3xl font-black tracking-[-0.055em]">{category === "All" ? "All browser games" : category}</h2>
              <p className="mt-1 text-sm text-muted-foreground">Good games only: cross-device, free to play, and hosted inside Flux.</p>
            </div>
            <span className="hidden rounded-full border border-border bg-card px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-muted-foreground sm:block">{filteredGames.length} results</span>
          </div>

          <motion.div layout className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <AnimatePresence mode="popLayout">
              {filteredGames.map((game, index) => (
                <GameCard key={game.slug} game={game} index={index} favorite={favorites.includes(game.slug)} onToggleFavorite={toggleFavorite} />
              ))}
            </AnimatePresence>
          </motion.div>

          {!filteredGames.length ? (
            <div className="mt-5 grid min-h-64 place-items-center rounded-[28px] border border-dashed border-border bg-card/45 p-8 text-center">
              <div><Search className="mx-auto h-8 w-8 text-muted-foreground" /><h3 className="mt-4 text-lg font-black">No matching game</h3><p className="mt-2 text-sm text-muted-foreground">Try another category or clear the search.</p></div>
            </div>
          ) : null}
        </section>

        <section className="mt-10 overflow-hidden rounded-[30px] border border-border/70 bg-[linear-gradient(135deg,rgba(124,58,237,.13),rgba(6,182,212,.08),transparent)] p-6 shadow-soft sm:p-8">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="max-w-2xl">
              <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.16em] text-violet-500"><Sparkles className="h-3.5 w-3.5" /> New Flux features</div>
              <h2 className="mt-2 text-2xl font-black tracking-[-0.045em]">Favorites, recent games, sharing and true in-Flux launching.</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">Flux remembers your games on-device, shares clean Flux links and launches every included game from Flux-owned files without sending players elsewhere.</p>
            </div>
            <div className="flex shrink-0 items-center gap-2 rounded-2xl border border-border/70 bg-card/70 px-4 py-3 text-xs font-black"><ShieldCheck className="h-4 w-4 text-emerald-500" /> Verified catalog</div>
          </div>
        </section>
      </div>
    </div>
  );
}

function GameRow({ title, subtitle, icon: Icon, games, favorites, onToggleFavorite }: {
  title: string;
  subtitle: string;
  icon: typeof Clock3;
  games: BrowserGame[];
  favorites: string[];
  onToggleFavorite: (slug: string) => void;
}) {
  return (
    <section className="mt-9">
      <div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-2xl bg-primary/10 text-primary"><Icon className="h-4.5 w-4.5" /></span><div><h2 className="text-xl font-black tracking-[-0.035em]">{title}</h2><p className="text-xs text-muted-foreground">{subtitle}</p></div></div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {games.map((game, index) => <GameCard key={game.slug} game={game} index={index} favorite={favorites.includes(game.slug)} onToggleFavorite={onToggleFavorite} compact />)}
      </div>
    </section>
  );
}

function GameCard({ game, index, favorite, onToggleFavorite, compact = false }: {
  game: BrowserGame;
  index: number;
  favorite: boolean;
  onToggleFavorite: (slug: string) => void;
  compact?: boolean;
}) {
  const reduceMotion = useReducedMotion();
  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: reduceMotion ? 0 : 18 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: reduceMotion ? 0 : 0.32, delay: Math.min(index * 0.035, 0.2) }}
      whileHover={reduceMotion ? undefined : { y: -5 }}
      className="group relative overflow-hidden rounded-[26px] border border-border/70 bg-card shadow-soft transition hover:border-primary/25 hover:shadow-[0_24px_70px_rgba(15,23,42,.15)]"
    >
      <Link href={hrefForGame(game)} className="block">
        <div className={`relative overflow-hidden ${compact ? "aspect-[16/8]" : "aspect-[16/10]"}`}>
          <GameCoverArt game={game} compact />
          <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
            {game.categories.slice(0, compact ? 1 : 2).map((item) => <span key={item} className="rounded-full border border-white/15 bg-black/35 px-2.5 py-1 text-[8px] font-black uppercase tracking-[0.13em] text-white backdrop-blur-lg">{item}</span>)}
          </div>
          <button
            type="button"
            onClick={(event) => { event.preventDefault(); event.stopPropagation(); onToggleFavorite(game.slug); }}
            className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full border border-white/15 bg-black/35 text-white backdrop-blur-lg transition hover:scale-110 hover:bg-black/55"
            aria-label={favorite ? `Remove ${game.title} from favorites` : `Add ${game.title} to favorites`}
          >
            <Heart className={`h-4 w-4 ${favorite ? "fill-rose-400 text-rose-400" : ""}`} />
          </button>
          <span className="absolute bottom-3 right-3 grid h-11 w-11 place-items-center rounded-full bg-white text-slate-950 shadow-xl transition group-hover:scale-110"><ArrowRight className="h-5 w-5" /></span>
        </div>
        <div className={compact ? "p-4" : "p-5"}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0"><h3 className={`${compact ? "text-base" : "text-xl"} truncate font-black tracking-[-0.035em]`}>{game.title}</h3><p className="mt-1 truncate text-[10px] font-bold text-muted-foreground">{game.author} · {game.status}</p></div>
            {!compact ? <span className="shrink-0 rounded-full bg-emerald-500/10 px-2.5 py-1 text-[9px] font-black text-emerald-600">FREE</span> : null}
          </div>
          {!compact ? <p className="mt-4 line-clamp-2 text-sm leading-6 text-muted-foreground">{game.shortDescription}</p> : null}
          <div className="mt-4 flex items-center justify-between gap-3 border-t border-border/60 pt-3 text-[9px] font-black uppercase tracking-[0.1em] text-muted-foreground">
            <span className="flex items-center gap-1.5"><Smartphone className="h-3.5 w-3.5" /> Mobile + PC</span>
            <span className="flex items-center gap-1.5"><ExternalLink className="h-3.5 w-3.5" /> {game.license}</span>
          </div>
        </div>
      </Link>
    </motion.article>
  );
}
