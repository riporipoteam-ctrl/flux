"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import {
  ArrowRight,
  Boxes,
  Clock3,
  Dice5,
  Gamepad2,
  Heart,
  Loader2,
  Search,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import {
  BROWSER_GAMES,
  FEATURED_GAMES,
  GAME_CATEGORIES,
  type BrowserGame,
  type GameCategoryFilter,
} from "@/data/browser-games";
import { GameCoverArt } from "@/components/game/game-cover-art";
import {
  listPublishedCommunityGames,
  type PublishedCommunityGame,
} from "@/services/studio-projects";

const FAVORITES_KEY = "flux-games-favorites";
const RECENT_KEY = "flux-games-recent";

function hrefForGame(game: BrowserGame) {
  return game.internal ? game.playUrl : `/games/play?game=${encodeURIComponent(game.slug)}`;
}

export default function GamesHub() {
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<GameCategoryFilter>("All");
  const [favorites, setFavorites] = useState<string[]>([]);
  const [recent, setRecent] = useState<string[]>([]);
  const [community, setCommunity] = useState<PublishedCommunityGame[]>([]);
  const [communityLoading, setCommunityLoading] = useState(true);
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

  useEffect(() => {
    listPublishedCommunityGames(48)
      .then(setCommunity)
      .catch(() => setCommunity([]))
      .finally(() => setCommunityLoading(false));
  }, []);

  const filteredGames = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return BROWSER_GAMES.filter((game) => {
      const categoryMatch = category === "All" || game.categories.includes(category);
      const textMatch = !needle || [game.title, game.author, game.shortDescription, ...game.categories]
        .join(" ")
        .toLowerCase()
        .includes(needle);
      return categoryMatch && textMatch;
    });
  }, [category, query]);

  const filteredCommunity = useMemo(() => {
    if (category !== "All") return [];
    const needle = query.trim().toLowerCase();
    return community.filter((game) =>
      !needle || [game.title, game.description, ...game.hashtags].join(" ").toLowerCase().includes(needle)
    );
  }, [category, community, query]);

  const favoriteGames = favorites
    .map((slug) => BROWSER_GAMES.find((game) => game.slug === slug))
    .filter(Boolean) as BrowserGame[];
  const recentGames = recent
    .map((slug) => BROWSER_GAMES.find((game) => game.slug === slug))
    .filter(Boolean) as BrowserGame[];

  const toggleFavorite = (slug: string) => {
    setFavorites((current) => {
      const next = current.includes(slug)
        ? current.filter((item) => item !== slug)
        : [slug, ...current];
      try {
        localStorage.setItem(FAVORITES_KEY, JSON.stringify(next));
        window.dispatchEvent(new Event("flux-games-updated"));
      } catch {
        // Ignore browsers with blocked local storage.
      }
      return next;
    });
  };

  const surpriseMe = () => {
    const pool = filteredGames.length ? filteredGames : BROWSER_GAMES;
    const next = pool[Math.floor(Math.random() * pool.length)];
    if (next) router.push(hrefForGame(next));
  };

  return (
    <div className="min-h-screen bg-[#f5f6f8] pb-20 dark:bg-black">
      <header className="sticky top-0 z-40 hidden border-b border-border/70 bg-background/88 px-5 py-3 backdrop-blur-xl lg:block">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-black tracking-[-0.04em]">Flux Games</h1>
            <p className="text-xs text-muted-foreground">Open-source games and community creations, playable inside Flux.</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-2 text-xs font-bold text-muted-foreground">
              <ShieldCheck className="h-4 w-4 text-emerald-500" /> No redirects · no VPS
            </span>
            <Link href="/studio" className="inline-flex h-10 items-center gap-2 rounded-full bg-foreground px-4 text-xs font-black text-background">
              <Boxes className="h-4 w-4" /> Open Studio
            </Link>
          </div>
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
                {hero.categories.map((item) => (
                  <span key={item} className="rounded-full border border-white/15 bg-black/35 px-3 py-1.5 text-[10px] font-bold text-white/80 backdrop-blur-md">{item}</span>
                ))}
              </div>
              <div className="mt-7 flex flex-wrap gap-3">
                <Link href={hrefForGame(hero)} className="inline-flex h-12 items-center gap-2 rounded-full bg-white px-6 text-sm font-black text-black">
                  <Gamepad2 className="h-5 w-5" /> Play now <ArrowRight className="h-4 w-4" />
                </Link>
                <button type="button" onClick={surpriseMe} className="inline-flex h-12 items-center gap-2 rounded-full border border-white/20 bg-black/30 px-5 text-sm font-black text-white backdrop-blur-md">
                  <Dice5 className="h-4 w-4" /> Surprise me
                </button>
                <Link href="/studio" className="inline-flex h-12 items-center gap-2 rounded-full border border-violet-300/25 bg-violet-500/18 px-5 text-sm font-black text-white backdrop-blur-md">
                  <Sparkles className="h-4 w-4" /> Make a game
                </Link>
              </div>
            </motion.div>
          </div>
        </section>

        <section className="mt-5 grid grid-cols-3 gap-2 sm:gap-3">
          <Stat value={`${BROWSER_GAMES.length + community.length}`} label="Games" />
          <Stat value={`${community.length}`} label="Creator games" />
          <Stat value="3" label="Device types" />
        </section>

        <section className="mt-8 rounded-[24px] border border-border bg-card p-3 shadow-sm sm:p-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search games, creators and hashtags"
              className="h-12 w-full rounded-2xl border border-border bg-background pl-11 pr-12 text-sm font-semibold outline-none transition focus:border-foreground/25 focus:ring-4 focus:ring-foreground/5"
            />
            {query ? (
              <button type="button" onClick={() => setQuery("")} className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full hover:bg-muted" aria-label="Clear search">
                <X className="h-4 w-4" />
              </button>
            ) : null}
          </div>
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1 scrollbar-none">
            {GAME_CATEGORIES.map((item) => (
              <button key={item} type="button" onClick={() => setCategory(item)} className={`shrink-0 rounded-full px-4 py-2 text-[11px] font-black ${item === category ? "bg-foreground text-background" : "border border-border bg-background text-muted-foreground"}`}>
                {item}
              </button>
            ))}
          </div>
        </section>

        {favoriteGames.length ? <GameRow title="Saved games" icon={Heart} games={favoriteGames.slice(0, 4)} favorites={favorites} onToggleFavorite={toggleFavorite} /> : null}
        {recentGames.length ? <GameRow title="Continue playing" icon={Clock3} games={recentGames.slice(0, 4)} favorites={favorites} onToggleFavorite={toggleFavorite} /> : null}

        <section className="mt-10 rounded-[30px] bg-[#101216] p-4 text-white sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[.16em] text-violet-300">Built by Flux users</p>
              <h2 className="mt-2 text-3xl font-black tracking-[-.05em]">Community creations</h2>
              <p className="mt-2 max-w-xl text-sm leading-6 text-white/48">Games generated or edited in Flux Studio can be previewed, published and played here.</p>
            </div>
            <Link href="/studio" className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-white px-5 text-sm font-black text-black">
              <Boxes className="h-4 w-4" /> Create in Studio
            </Link>
          </div>
          {communityLoading ? (
            <div className="grid min-h-52 place-items-center"><Loader2 className="h-6 w-6 animate-spin text-white/40" /></div>
          ) : filteredCommunity.length ? (
            <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {filteredCommunity.map((game) => <CommunityCard key={game.id} game={game} />)}
            </div>
          ) : (
            <div className="mt-6 grid min-h-48 place-items-center rounded-[24px] border border-dashed border-white/12 text-center">
              <div><Gamepad2 className="mx-auto h-7 w-7 text-white/25" /><p className="mt-3 font-black">No creator games match yet</p><p className="mt-1 text-xs text-white/35">Publish one from Flux Studio.</p></div>
            </div>
          )}
        </section>

        <section className="mt-10">
          <div className="flex items-end justify-between gap-4">
            <div><p className="text-[10px] font-black uppercase tracking-[0.16em] text-muted-foreground">Open-source library</p><h2 className="mt-1 text-3xl font-black tracking-[-0.05em]">{category === "All" ? "All games" : category}</h2></div>
            <p className="text-xs font-bold text-muted-foreground">{filteredGames.length} results</p>
          </div>
          <motion.div layout className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {filteredGames.map((game, index) => <GameCard key={game.slug} game={game} index={index} favorite={favorites.includes(game.slug)} onToggleFavorite={toggleFavorite} />)}
          </motion.div>
        </section>
      </main>
    </div>
  );
}

function CommunityCard({ game }: { game: PublishedCommunityGame }) {
  return (
    <Link href={`/studio/play?id=${encodeURIComponent(game.id)}`} className="group overflow-hidden rounded-[22px] border border-white/10 bg-white/6 transition hover:-translate-y-1 hover:bg-white/9">
      <div className="relative aspect-[16/9] overflow-hidden" style={{ background: game.thumbnail || "linear-gradient(135deg,#7c3aed,#07111f)" }}>
        <span className="absolute left-3 top-3 rounded-full bg-black/55 px-2.5 py-1 text-[9px] font-black uppercase tracking-wider backdrop-blur">Community</span>
        <span className="absolute bottom-3 right-3 grid h-10 w-10 place-items-center rounded-full bg-white text-black"><ArrowRight className="h-4 w-4" /></span>
      </div>
      <div className="p-4">
        <h3 className="truncate text-lg font-black tracking-tight">{game.title}</h3>
        <p className="mt-2 line-clamp-2 text-sm leading-6 text-white/48">{game.description}</p>
        <div className="mt-4 flex items-center gap-3 border-t border-white/8 pt-3 text-[10px] font-bold text-white/38">
          <span>{game.visits} plays</span><span>{game.cheers} cheers</span>
          {game.multiplayer ? <span className="ml-auto flex items-center gap-1 text-emerald-300"><Users className="h-3.5 w-3.5" />{game.maxPlayers}</span> : null}
        </div>
      </div>
    </Link>
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
    <motion.article initial={{ opacity: 0, y: reduceMotion ? 0 : 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: reduceMotion ? 0 : 0.25, delay: Math.min(index * 0.025, 0.14) }} className="group overflow-hidden rounded-[22px] border border-border bg-card transition hover:border-foreground/20 hover:shadow-[0_18px_45px_rgba(0,0,0,.11)]">
      <Link href={hrefForGame(game)} className="block">
        <div className={`relative overflow-hidden ${compact ? "aspect-[16/9]" : "aspect-[16/10]"}`}>
          <GameCoverArt game={game} compact />
          <button type="button" onClick={(event) => { event.preventDefault(); event.stopPropagation(); onToggleFavorite(game.slug); }} className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full border border-white/15 bg-black/45 text-white backdrop-blur-md" aria-label="Toggle favorite">
            <Heart className={`h-4 w-4 ${favorite ? "fill-rose-400 text-rose-400" : ""}`} />
          </button>
          <span className="absolute bottom-3 right-3 grid h-9 w-9 place-items-center rounded-full bg-white text-black"><ArrowRight className="h-4 w-4" /></span>
        </div>
        <div className={compact ? "p-4" : "p-5"}>
          <h3 className={`${compact ? "text-base" : "text-xl"} truncate font-black tracking-[-0.035em]`}>{game.title}</h3>
          <p className="mt-1 truncate text-[10px] font-bold text-muted-foreground">{game.author} · {game.status}</p>
          {!compact ? <p className="mt-3 line-clamp-2 text-sm leading-6 text-muted-foreground">{game.shortDescription}</p> : null}
          <div className="mt-4 flex items-center gap-1.5 border-t border-border/70 pt-3 text-[9px] font-black uppercase tracking-[0.1em] text-muted-foreground"><Smartphone className="h-3.5 w-3.5" /> Mobile · Tablet · PC</div>
        </div>
      </Link>
    </motion.article>
  );
}
