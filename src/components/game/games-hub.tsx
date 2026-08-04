"use client";

import { useDeferredValue, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Boxes,
  Code2,
  Dice5,
  ExternalLink,
  Gamepad2,
  Heart,
  History,
  LibraryBig,
  Loader2,
  Search,
  ShieldCheck,
  Smartphone,
  Users,
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
import { GameCoverArt } from "@/components/game/game-cover-art";
import { listPublishedCommunityGames, type PublishedCommunityGame } from "@/services/studio-projects";

const FAVORITES_KEY = "flux-games-favorites";
const RECENT_KEY = "flux-games-recent";

function hrefForGame(game: BrowserGame): string {
  return game.internal ? game.playUrl : `/games/play?game=${encodeURIComponent(game.slug)}`;
}

function readSaved(key: string): string[] {
  try {
    const value = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(value) ? value.map(String) : [];
  } catch {
    return [];
  }
}

export default function GamesHub() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const [category, setCategory] = useState<GameCategoryFilter>("All");
  const [favorites, setFavorites] = useState<string[]>([]);
  const [recent, setRecent] = useState<string[]>([]);
  const [community, setCommunity] = useState<PublishedCommunityGame[]>([]);
  const [communityLoading, setCommunityLoading] = useState(true);
  const hero = FEATURED_GAMES[0] ?? BROWSER_GAMES[0];

  useEffect(() => {
    const syncLocal = () => {
      setFavorites(readSaved(FAVORITES_KEY));
      setRecent(readSaved(RECENT_KEY));
    };
    syncLocal();
    window.addEventListener("storage", syncLocal);
    window.addEventListener("flux-games-updated", syncLocal);
    listPublishedCommunityGames(18)
      .then(setCommunity)
      .catch(() => setCommunity([]))
      .finally(() => setCommunityLoading(false));
    return () => {
      window.removeEventListener("storage", syncLocal);
      window.removeEventListener("flux-games-updated", syncLocal);
    };
  }, []);

  const filteredGames = useMemo(() => {
    const needle = deferredQuery.trim().toLowerCase();
    return BROWSER_GAMES.filter((game) => {
      const categoryMatch = category === "All" || game.categories.includes(category);
      if (!categoryMatch) return false;
      if (!needle) return true;
      return [game.title, game.author, game.shortDescription, game.license, ...game.categories]
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });
  }, [category, deferredQuery]);

  const favoriteGames = favorites
    .map((slug) => BROWSER_GAMES.find((game) => game.slug === slug))
    .filter((game): game is BrowserGame => Boolean(game))
    .slice(0, 6);

  const recentGames = recent
    .map((slug) => BROWSER_GAMES.find((game) => game.slug === slug))
    .filter((game): game is BrowserGame => Boolean(game))
    .slice(0, 6);

  const toggleFavorite = (slug: string) => {
    setFavorites((current) => {
      const next = current.includes(slug) ? current.filter((item) => item !== slug) : [slug, ...current];
      try { localStorage.setItem(FAVORITES_KEY, JSON.stringify(next)); } catch { /* private mode */ }
      window.dispatchEvent(new Event("flux-games-updated"));
      return next;
    });
  };

  const surpriseMe = () => {
    const pool = filteredGames.length ? filteredGames : BROWSER_GAMES;
    const game = pool[Math.floor(Math.random() * pool.length)];
    if (game) router.push(hrefForGame(game));
  };

  if (!hero) return null;

  return (
    <div className="flux-open-games min-h-[100dvh] bg-background">
      <header className="x-header hidden lg:flex">
        <div className="x-header-titles"><h1>Open Games</h1><p>Real source-linked browser games, not generated catalog filler</p></div>
        <Link href="/studio" className="x-btn x-btn-ink x-btn-sm"><Boxes className="h-4 w-4" />Flux Studio</Link>
      </header>

      <main className="mx-auto w-full max-w-[1240px] px-3 pb-28 pt-3 sm:px-5 sm:pt-5 lg:pb-12">
        <section className="relative overflow-hidden rounded-[28px] border border-white/10 bg-[#05070c] text-white shadow-[0_30px_100px_rgba(0,0,0,.22)]">
          <div className="relative min-h-[430px] sm:min-h-[540px]">
            <GameCoverArt game={hero} />
            <div className="absolute inset-0 flex max-w-3xl flex-col justify-end p-6 sm:p-10">
              <div className="flex w-fit items-center gap-2 rounded-full border border-white/15 bg-black/45 px-3 py-1.5 text-[10px] font-black uppercase tracking-[.16em] backdrop-blur-xl"><Code2 className="h-3.5 w-3.5" />Source linked</div>
              <h2 className="mt-4 text-4xl font-black leading-[.9] tracking-[-.065em] sm:text-7xl">{hero.title}</h2>
              <p className="mt-4 max-w-xl text-sm leading-6 text-white/70 sm:text-base">{hero.description}</p>
              <div className="mt-7 flex flex-wrap gap-3">
                <Link href={hrefForGame(hero)} className="x-btn x-btn-lg !bg-white !text-black"><Gamepad2 className="h-5 w-5" />Play inside Flux<ArrowRight className="h-4 w-4" /></Link>
                <a href={hero.sourceUrl} target="_blank" rel="noreferrer" className="x-btn x-btn-lg !border !border-white/20 !bg-black/35 !text-white backdrop-blur-xl"><ExternalLink className="h-4 w-4" />View source</a>
                <button type="button" onClick={surpriseMe} className="x-btn x-btn-lg !border !border-white/20 !bg-black/35 !text-white backdrop-blur-xl"><Dice5 className="h-4 w-4" />Random game</button>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-3 grid grid-cols-3 gap-2 sm:mt-4 sm:gap-3">
          <Stat icon={LibraryBig} value={String(OPEN_SOURCE_GAME_COUNT)} label="Open-source" />
          <Stat icon={ShieldCheck} value="Source" label="Shown on every game" />
          <Stat icon={Smartphone} value="Web" label="Phone · tablet · PC" />
        </section>

        <section className="mt-5 rounded-[22px] border border-[var(--v8-line)] bg-[var(--v8-panel)] p-3 sm:p-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-muted-foreground" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search games, genres, authors or licenses" className="h-12 w-full rounded-full border border-[var(--v8-line-strong)] bg-[var(--v8-panel-2)] pl-11 pr-12 text-sm font-semibold outline-none transition focus:border-[var(--v8-accent)] focus:ring-4 focus:ring-[var(--v8-accent-soft)]" />
            {query ? <button type="button" onClick={() => setQuery("")} className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full hover:bg-muted" aria-label="Clear search"><X className="h-4 w-4" /></button> : null}
          </div>
          <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto pb-1">
            {GAME_CATEGORIES.map((item) => <button key={item} type="button" onClick={() => setCategory(item)} data-active={item === category} className="x-chip shrink-0">{item}</button>)}
          </div>
        </section>

        {recentGames.length ? <GameShelf title="Continue playing" icon={History} games={recentGames} favorites={favorites} onToggleFavorite={toggleFavorite} /> : null}
        {favoriteGames.length ? <GameShelf title="Saved games" icon={Heart} games={favoriteGames} favorites={favorites} onToggleFavorite={toggleFavorite} /> : null}

        <section className="mt-9">
          <div className="flex items-end justify-between gap-4">
            <div><p className="text-[10px] font-black uppercase tracking-[.18em] text-muted-foreground">Curated source library</p><h2 className="mt-1 text-3xl font-black tracking-[-.05em]">{category === "All" ? "All open-source games" : category}</h2></div>
            <p className="text-xs font-bold text-muted-foreground">{filteredGames.length} projects</p>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredGames.map((game) => <GameCard key={game.slug} game={game} favorite={favorites.includes(game.slug)} onToggleFavorite={toggleFavorite} />)}
          </div>
          {!filteredGames.length ? <div className="mt-5 rounded-3xl border border-dashed border-[var(--v8-line-strong)] p-12 text-center"><Search className="mx-auto h-7 w-7 text-muted-foreground" /><p className="mt-3 font-black">No matching source-linked games</p><button type="button" onClick={() => { setQuery(""); setCategory("All"); }} className="mt-3 text-sm font-black text-[var(--v8-accent)]">Reset filters</button></div> : null}
        </section>

        <section className="mt-10 overflow-hidden rounded-[26px] bg-[#0b0f14] p-5 text-white sm:p-7">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div><p className="text-[10px] font-black uppercase tracking-[.18em] text-violet-300">Made by Flux creators</p><h2 className="mt-2 text-3xl font-black tracking-[-.05em]">Community projects</h2><p className="mt-2 max-w-xl text-sm leading-6 text-white/46">Studio projects stay separate from the open-source library, so Flux never pretends they are the same thing.</p></div>
            <Link href="/studio" className="x-btn !bg-white !text-black"><Boxes className="h-4 w-4" />Open Studio</Link>
          </div>
          {communityLoading ? <div className="grid min-h-44 place-items-center"><Loader2 className="h-6 w-6 animate-spin text-white/35" /></div> : community.length ? <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{community.slice(0, 9).map((game) => <CommunityCard key={game.id} game={game} />)}</div> : <div className="mt-6 grid min-h-40 place-items-center rounded-[22px] border border-dashed border-white/12 text-center"><div><Users className="mx-auto h-7 w-7 text-white/20" /><p className="mt-3 font-black">No community projects yet</p><p className="mt-1 text-xs text-white/35">Publish one from Studio.</p></div></div>}
        </section>
      </main>
    </div>
  );
}

function GameShelf({ title, icon: Icon, games, favorites, onToggleFavorite }: { title: string; icon: typeof History; games: BrowserGame[]; favorites: string[]; onToggleFavorite: (slug: string) => void }) {
  return <section className="mt-8"><div className="flex items-center gap-2"><Icon className="h-5 w-5 text-[var(--v8-accent)]" /><h2 className="text-xl font-black tracking-tight">{title}</h2></div><div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{games.map((game) => <GameCard key={game.slug} game={game} favorite={favorites.includes(game.slug)} onToggleFavorite={onToggleFavorite} />)}</div></section>;
}

function GameCard({ game, favorite, onToggleFavorite }: { game: BrowserGame; favorite: boolean; onToggleFavorite: (slug: string) => void }) {
  return (
    <article className="flux-game-card group overflow-hidden rounded-[20px] border border-[var(--v8-line)] bg-[var(--v8-panel)]">
      <Link href={hrefForGame(game)} className="block">
        <div className="relative aspect-[16/10] overflow-hidden"><GameCoverArt game={game} compact /><button type="button" onClick={(event) => { event.preventDefault(); event.stopPropagation(); onToggleFavorite(game.slug); }} className="absolute right-2.5 top-2.5 grid h-9 w-9 place-items-center rounded-full border border-white/15 bg-black/55 text-white backdrop-blur-xl transition active:scale-90" aria-label={favorite ? "Remove favorite" : "Save game"}><Heart className={favorite ? "h-4 w-4 fill-rose-500 text-rose-500" : "h-4 w-4"} /></button><span className="absolute bottom-2.5 left-2.5 flex items-center gap-1.5 rounded-full bg-emerald-500/90 px-2.5 py-1 text-[9px] font-black text-white backdrop-blur"><Code2 className="h-3 w-3" />OPEN SOURCE</span></div>
        <div className="p-3.5"><h3 className="truncate text-[15px] font-black tracking-tight">{game.title}</h3><p className="mt-1 truncate text-[10px] font-bold text-muted-foreground">{game.author}</p><p className="mt-2 line-clamp-2 min-h-10 text-xs leading-5 text-muted-foreground">{game.shortDescription}</p><div className="mt-3 flex items-center gap-2 text-[10px] font-bold text-muted-foreground"><span>{game.categories[0]}</span><span className="ml-auto truncate">{game.license}</span></div></div>
      </Link>
    </article>
  );
}

function CommunityCard({ game }: { game: PublishedCommunityGame }) {
  return <Link href={`/studio/play?id=${encodeURIComponent(game.id)}`} className="group overflow-hidden rounded-[20px] border border-white/10 bg-white/6 transition hover:bg-white/10"><div className="aspect-[16/9]" style={{ background: game.thumbnail || "linear-gradient(135deg,#7c3aed,#07111f)" }} /><div className="p-4"><h3 className="truncate font-black">{game.title}</h3><p className="mt-1 line-clamp-2 text-xs leading-5 text-white/42">{game.description}</p><div className="mt-3 flex gap-3 text-[10px] font-bold text-white/32"><span>{game.visits} plays</span><span>{game.cheers} cheers</span></div></div></Link>;
}

function Stat({ icon: Icon, value, label }: { icon: typeof LibraryBig; value: string; label: string }) {
  return <div className="rounded-[18px] border border-[var(--v8-line)] bg-[var(--v8-panel)] px-2 py-3 text-center sm:py-4"><Icon className="mx-auto h-4 w-4 text-[var(--v8-accent)]" /><b className="mt-1 block truncate text-base font-black sm:text-xl">{value}</b><small className="mt-0.5 block truncate text-[8px] font-bold uppercase tracking-[.1em] text-muted-foreground sm:text-[10px]">{label}</small></div>;
}
