#!/usr/bin/env bash
set -euo pipefail

ROOT="$(pwd)"
WORK="$(mktemp -d)"
DEST="$ROOT/public/games-library"
trap 'rm -rf "$WORK"' EXIT

rm -rf "$DEST"
mkdir -p "$DEST"

copy_repo() {
  local source="$1"
  local destination="$2"
  mkdir -p "$destination"
  rsync -a --delete \
    --exclude='.git' \
    --exclude='node_modules' \
    --exclude='.github' \
    "$source/" "$destination/"
}

write_source_note() {
  local destination="$1"
  local repo="$2"
  local revision="$3"
  cat > "$destination/FLUX-SOURCE.txt" <<EOF
Hosted by Flux from the open-source project below.
Upstream: https://github.com/$repo
Revision: $revision
Flux has not removed the upstream copyright or license files.
EOF
}

# TuxRacer.js — build the Vite game, which already uses relative asset paths.
git clone --depth 1 https://github.com/ebbejan/tux-racer-js.git "$WORK/tux-racer"
(
  cd "$WORK/tux-racer"
  npm ci
  npm run build
)
mkdir -p "$DEST/tux-racer"
rsync -a "$WORK/tux-racer/dist/" "$DEST/tux-racer/"
for license in LICENSE LICENSE.md COPYING; do
  [[ -f "$WORK/tux-racer/$license" ]] && cp "$WORK/tux-racer/$license" "$DEST/tux-racer/$license"
done
write_source_note "$DEST/tux-racer" "ebbejan/tux-racer-js" "$(git -C "$WORK/tux-racer" rev-parse HEAD)"

# XQuest JS — native HTML/CSS/JS; no compilation is required.
git clone --depth 1 https://github.com/scottrippey/xquestjs.git "$WORK/xquest"
copy_repo "$WORK/xquest" "$DEST/xquest"
write_source_note "$DEST/xquest" "scottrippey/xquestjs" "$(git -C "$WORK/xquest" rev-parse HEAD)"

# AntiGravity Pool — static WebGL game. Give its main document a normal index.html entry point.
git clone --depth 1 --branch master https://github.com/erichlof/AntiGravity-Pool.git "$WORK/anti-gravity-pool"
copy_repo "$WORK/anti-gravity-pool" "$DEST/anti-gravity-pool"
cp "$DEST/anti-gravity-pool/AntiGravityPool.html" "$DEST/anti-gravity-pool/index.html"
write_source_note "$DEST/anti-gravity-pool" "erichlof/AntiGravity-Pool" "$(git -C "$WORK/anti-gravity-pool" rev-parse HEAD)"

# OpenPanzer — complete static HTML5 strategy game with local browser saves.
git clone --depth 1 --branch master https://github.com/nicupavel/openpanzer.git "$WORK/openpanzer"
copy_repo "$WORK/openpanzer" "$DEST/openpanzer"
write_source_note "$DEST/openpanzer" "nicupavel/openpanzer" "$(git -C "$WORK/openpanzer" rev-parse HEAD)"

# Progress Knight — public-domain life/idle simulator.
git clone --depth 1 https://github.com/ihtasham42/progress-knight.git "$WORK/progress-knight"
copy_repo "$WORK/progress-knight" "$DEST/progress-knight"
write_source_note "$DEST/progress-knight" "ihtasham42/progress-knight" "$(git -C "$WORK/progress-knight" rev-parse HEAD)"

# Adventures With Anxiety — public-domain interactive story/horror experience.
git clone --depth 1 --branch gh-pages https://github.com/ncase/anxiety.git "$WORK/anxiety"
copy_repo "$WORK/anxiety" "$DEST/anxiety"
write_source_note "$DEST/anxiety" "ncase/anxiety" "$(git -C "$WORK/anxiety" rev-parse HEAD)"

cat > "$DEST/README.md" <<'EOF'
# Flux local game library

Every game in this directory is served from Flux itself. The Play button never redirects to an external game host. Each game folder keeps its upstream license and a `FLUX-SOURCE.txt` file containing its exact upstream project and revision.
EOF

cat > "$ROOT/src/data/browser-games.ts" <<'EOF'
export type BrowserGameCategory =
  | "Racing"
  | "3D"
  | "Simulator"
  | "Tycoon"
  | "Strategy"
  | "Story"
  | "Horror"
  | "Action"
  | "Platformer"
  | "Puzzle"
  | "Sandbox"
  | "Farming";

export type BrowserGame = {
  slug: string;
  title: string;
  author: string;
  shortDescription: string;
  description: string;
  categories: BrowserGameCategory[];
  playUrl: string;
  sourceUrl: string;
  license: string;
  technology: string;
  controls: string;
  devices: string[];
  symbol: string;
  palette: [string, string, string];
  featured?: boolean;
  directEmbed?: boolean;
  internal?: boolean;
  status?: "Released" | "Beta" | "In development";
};

export const GAME_CATEGORIES = [
  "All",
  "3D",
  "Racing",
  "Simulator",
  "Tycoon",
  "Strategy",
  "Story",
  "Horror",
  "Action",
  "Platformer",
  "Puzzle",
  "Sandbox",
  "Farming",
] as const;

export type GameCategoryFilter = (typeof GAME_CATEGORIES)[number];

export const BROWSER_GAMES: BrowserGame[] = [
  {
    slug: "tux-racer",
    title: "TuxRacer.js",
    author: "ebbejan",
    shortDescription: "Fast 3D downhill racing with touch controls and snowy courses.",
    description: "Race down snowy mountains, collect fish and master sharp turns in a proper 3D browser racer hosted directly by Flux.",
    categories: ["Racing", "3D", "Action"],
    playUrl: "/games-library/tux-racer/index.html",
    sourceUrl: "https://github.com/ebbejan/tux-racer-js",
    license: "GPL-2.0",
    technology: "WebGL · TypeScript · Vite",
    controls: "Keyboard · touch joystick",
    devices: ["Mobile", "PC", "Tablet"],
    symbol: "🐧",
    palette: ["#07122d", "#075985", "#67e8f9"],
    featured: true,
    directEmbed: true,
    status: "In development",
  },
  {
    slug: "anti-gravity-pool",
    title: "AntiGravity Pool",
    author: "Erich Loftis",
    shortDescription: "Real-time path-traced 3D pool with desktop and mobile controls.",
    description: "Play pool inside a glowing zero-gravity cube with reflections, physics, mouse controls, keyboard flight and touch gestures.",
    categories: ["3D", "Simulator", "Puzzle"],
    playUrl: "/games-library/anti-gravity-pool/index.html",
    sourceUrl: "https://github.com/erichlof/AntiGravity-Pool",
    license: "CC0-1.0",
    technology: "Three.js · WebGL · WebAudio",
    controls: "Mouse · keyboard · swipe · pinch",
    devices: ["Mobile", "PC", "Tablet"],
    symbol: "🎱",
    palette: ["#09090b", "#312e81", "#f472b6"],
    featured: true,
    directEmbed: true,
    status: "Released",
  },
  {
    slug: "xquest",
    title: "XQuest JS",
    author: "Scott Rippey",
    shortDescription: "Momentum-based space combat with touch, mouse and keyboard.",
    description: "Blast enemies, collect stars, chase power-ups and survive bonus stages in a responsive arcade shooter hosted by Flux.",
    categories: ["Action", "3D"],
    playUrl: "/games-library/xquest/index.html",
    sourceUrl: "https://github.com/scottrippey/xquestjs",
    license: "MIT",
    technology: "HTML5 · JavaScript · Canvas",
    controls: "Touch · mouse · keyboard",
    devices: ["Mobile", "PC", "Tablet"],
    symbol: "🚀",
    palette: ["#020617", "#312e81", "#22d3ee"],
    directEmbed: true,
    status: "Released",
  },
  {
    slug: "openpanzer",
    title: "OpenPanzer",
    author: "Nicu Pavel",
    shortDescription: "Deep turn-based military strategy with campaigns and local saves.",
    description: "Command units across tactical maps, manage equipment and complete full campaigns in a complete touch-friendly HTML5 strategy game.",
    categories: ["Strategy", "Simulator"],
    playUrl: "/games-library/openpanzer/index.html",
    sourceUrl: "https://github.com/nicupavel/openpanzer",
    license: "GPL-2.0+",
    technology: "HTML5 · JavaScript · Canvas",
    controls: "Mouse · touch",
    devices: ["Mobile", "PC", "Tablet"],
    symbol: "🪖",
    palette: ["#1c1917", "#365314", "#a3e635"],
    directEmbed: true,
    status: "Released",
  },
  {
    slug: "progress-knight",
    title: "Progress Knight",
    author: "Ihtasham42",
    shortDescription: "A medieval life, career and wealth simulator with prestige progression.",
    description: "Rise from a beggar through jobs, military ranks and magic training while managing age, money, skills and repeated lives.",
    categories: ["Tycoon", "Simulator", "Story"],
    playUrl: "/games-library/progress-knight/index.html",
    sourceUrl: "https://github.com/ihtasham42/progress-knight",
    license: "Unlicense · Public domain",
    technology: "HTML · CSS · JavaScript",
    controls: "Mouse · touch",
    devices: ["Mobile", "PC", "Tablet"],
    symbol: "⚔️",
    palette: ["#1c1917", "#7c2d12", "#fbbf24"],
    directEmbed: true,
    status: "Released",
  },
  {
    slug: "anxiety",
    title: "Adventures With Anxiety",
    author: "Nicky Case & Monplaisir",
    shortDescription: "A cinematic interactive story where you play as anxiety itself.",
    description: "Make choices as a nervous red wolf, guide a human through escalating fears and experience a polished, emotional interactive story.",
    categories: ["Story", "Horror"],
    playUrl: "/games-library/anxiety/index.html",
    sourceUrl: "https://github.com/ncase/anxiety",
    license: "CC0 · Public domain",
    technology: "HTML5 · JavaScript · Canvas · Audio",
    controls: "Mouse · touch",
    devices: ["Mobile", "PC", "Tablet"],
    symbol: "🐺",
    palette: ["#180b12", "#7f1d1d", "#fb7185"],
    directEmbed: true,
    status: "Released",
  },
  {
    slug: "flux-farm",
    title: "Flux Farm Beta",
    author: "Ripo Team",
    shortDescription: "The original Flux farming experiment, kept available while it is rebuilt.",
    description: "Plant crops, progress through days and test Flux account saving. This remains a beta while the next farming direction is developed.",
    categories: ["Farming", "Simulator"],
    playUrl: "/games/flux-farm",
    sourceUrl: "https://github.com/riporipoteam-ctrl/flux",
    license: "Flux source",
    technology: "Next.js · Canvas · Firebase",
    controls: "Touch · mouse · keyboard",
    devices: ["Mobile", "PC", "Tablet"],
    symbol: "🌾",
    palette: ["#052e16", "#15803d", "#bef264"],
    internal: true,
    status: "Beta",
  },
];

export function getBrowserGame(slug: string | null | undefined) {
  return BROWSER_GAMES.find((game) => game.slug === slug);
}

export const FEATURED_GAMES = BROWSER_GAMES.filter((game) => game.featured);
EOF

cat > "$ROOT/src/components/game/browser-game-shell.tsx" <<'EOF'
"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ExternalLink, Expand, Gamepad2, Heart, RefreshCw, Share2, ShieldCheck, Smartphone } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import type { BrowserGame } from "@/data/browser-games";
import { GameCoverArt } from "@/components/game/game-cover-art";
import { assetUrl } from "@/lib/asset-url";

const FAVORITES_KEY = "flux-games-favorites";
const RECENT_KEY = "flux-games-recent";

export function BrowserGameShell({ game }: { game: BrowserGame }) {
  const shellRef = useRef<HTMLDivElement>(null);
  const [started, setStarted] = useState(false);
  const [frameKey, setFrameKey] = useState(0);
  const [favorite, setFavorite] = useState(false);
  const localGameUrl = assetUrl(game.playUrl);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(FAVORITES_KEY) || "[]") as string[];
      setFavorite(saved.includes(game.slug));
    } catch {
      setFavorite(false);
    }
  }, [game.slug]);

  const rememberGame = () => {
    try {
      const recent = JSON.parse(localStorage.getItem(RECENT_KEY) || "[]") as string[];
      localStorage.setItem(RECENT_KEY, JSON.stringify([game.slug, ...recent.filter((slug) => slug !== game.slug)].slice(0, 6)));
    } catch {
      // The game still launches when browser storage is blocked.
    }
  };

  const launch = () => {
    rememberGame();
    setStarted(true);
  };

  const toggleFavorite = () => {
    try {
      const saved = JSON.parse(localStorage.getItem(FAVORITES_KEY) || "[]") as string[];
      const next = saved.includes(game.slug) ? saved.filter((slug) => slug !== game.slug) : [game.slug, ...saved];
      localStorage.setItem(FAVORITES_KEY, JSON.stringify(next));
      setFavorite(next.includes(game.slug));
      window.dispatchEvent(new Event("flux-games-updated"));
    } catch {
      toast.error("Favorites are unavailable in this browser.");
    }
  };

  const share = async () => {
    try {
      if (navigator.share) await navigator.share({ title: `${game.title} on Flux`, text: game.shortDescription, url: window.location.href });
      else {
        await navigator.clipboard.writeText(window.location.href);
        toast.success("Flux game link copied.");
      }
    } catch (error) {
      if ((error as Error).name !== "AbortError") toast.error("Could not share this game.");
    }
  };

  const enterFullscreen = async () => {
    try {
      await shellRef.current?.requestFullscreen();
    } catch {
      toast.error("Fullscreen is unavailable in this browser.");
    }
  };

  return (
    <div ref={shellRef} className="relative min-h-dvh overflow-hidden bg-[#05070c] text-white">
      <header className="relative z-30 flex min-h-16 items-center gap-2 border-b border-white/10 bg-black/55 px-3 backdrop-blur-2xl sm:px-5">
        <Link href="/games" className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-white/10 bg-white/5 transition hover:bg-white/10" aria-label="Back to games"><ArrowLeft className="h-5 w-5" /></Link>
        <div className="min-w-0 flex-1"><p className="truncate text-sm font-black">{game.title}</p><p className="truncate text-[10px] font-bold uppercase tracking-[0.14em] text-white/45">Hosted on Flux · {game.license}</p></div>
        <button type="button" onClick={toggleFavorite} className="grid h-10 w-10 place-items-center rounded-full border border-white/10 bg-white/5 transition hover:bg-white/10" aria-label={favorite ? "Remove favorite" : "Add favorite"}><Heart className={`h-4.5 w-4.5 ${favorite ? "fill-rose-400 text-rose-400" : ""}`} /></button>
        <button type="button" onClick={share} className="grid h-10 w-10 place-items-center rounded-full border border-white/10 bg-white/5 transition hover:bg-white/10" aria-label="Share game"><Share2 className="h-4.5 w-4.5" /></button>
        {started ? <><button type="button" onClick={() => setFrameKey((value) => value + 1)} className="hidden h-10 items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 text-xs font-black transition hover:bg-white/10 sm:flex"><RefreshCw className="h-4 w-4" /> Reload</button><button type="button" onClick={enterFullscreen} className="grid h-10 w-10 place-items-center rounded-full border border-white/10 bg-white/5 transition hover:bg-white/10" aria-label="Fullscreen"><Expand className="h-4.5 w-4.5" /></button></> : null}
      </header>

      {started ? (
        <div className="relative h-[calc(100dvh-4rem)] bg-black">
          <iframe key={frameKey} src={localGameUrl} title={game.title} className="h-full w-full border-0 bg-black" allow="autoplay; fullscreen; gamepad; clipboard-write" sandbox="allow-scripts allow-same-origin allow-forms allow-pointer-lock allow-popups allow-modals allow-downloads" allowFullScreen />
        </div>
      ) : (
        <main className="relative grid min-h-[calc(100dvh-4rem)] place-items-center overflow-hidden px-4 py-8 sm:px-8">
          <GameCoverArt game={game} />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(0,0,0,.08),rgba(0,0,0,.72)_72%)]" />
          <motion.section initial={{ opacity: 0, y: 22, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.48, ease: "easeOut" }} className="relative z-10 w-full max-w-xl rounded-[30px] border border-white/15 bg-black/58 p-6 shadow-[0_40px_120px_rgba(0,0,0,.55)] backdrop-blur-2xl sm:rounded-[38px] sm:p-9">
            <div className="flex flex-wrap gap-2">{game.categories.slice(0, 3).map((category) => <span key={category} className="rounded-full border border-white/12 bg-white/8 px-3 py-1 text-[9px] font-black uppercase tracking-[0.15em] text-white/70">{category}</span>)}</div>
            <h1 className="mt-5 text-4xl font-black tracking-[-0.06em] sm:text-6xl">{game.title}</h1>
            <p className="mt-4 text-sm leading-6 text-white/65 sm:text-base sm:leading-7">{game.description}</p>
            <div className="mt-6 grid gap-2 text-xs font-bold text-white/65 sm:grid-cols-2">
              <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 p-3"><Smartphone className="h-4 w-4 text-cyan-300" /> {game.devices.join(" · ")}</div>
              <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 p-3"><Gamepad2 className="h-4 w-4 text-violet-300" /> {game.controls}</div>
              <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 p-3 sm:col-span-2"><ShieldCheck className="h-4 w-4 text-emerald-300" /> Stored and served by Flux · no redirect · no VPS</div>
            </div>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <button type="button" onClick={launch} className="inline-flex h-13 flex-1 items-center justify-center gap-2 rounded-full bg-white px-6 text-sm font-black text-black shadow-[0_18px_45px_rgba(255,255,255,.16)] transition hover:-translate-y-0.5"><Gamepad2 className="h-5 w-5" /> Play inside Flux</button>
              <a href={game.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex h-13 items-center justify-center gap-2 rounded-full border border-white/15 bg-white/7 px-6 text-sm font-black transition hover:bg-white/12">Open-source credits <ExternalLink className="h-4 w-4" /></a>
            </div>
          </motion.section>
        </main>
      )}
    </div>
  );
}
EOF

python3 - <<'PY'
from pathlib import Path
path = Path("src/app/(main)/games/page.tsx")
text = path.read_text()
replacements = {
    "Free browser games selected for mobile, tablet and PC.": "Open-source games hosted directly by Flux for mobile, tablet and PC.",
    "No Flux VPS required": "Hosted on Flux",
    "No paid files": "Included in Flux",
    "Free to launch": "No external site",
    'value: "Static", label: "No Flux game server"': 'value: "Static", label: "No VPS required"',
    'value: `${BROWSER_GAMES.length} games`, label: "Source available"': 'value: `${BROWSER_GAMES.length} games`, label: "Hosted locally"',
    "Good games only: cross-device, free to play and source available.": "Good games only: cross-device, free to play, and hosted inside Flux.",
    "Favorites, recent games, sharing and safer launching.": "Favorites, recent games, sharing and true in-Flux launching.",
    "Flux remembers your games on-device, lets you share a clean Flux game link and keeps source and license details visible before launch.": "Flux remembers your games on-device, shares clean Flux links and launches every included game from Flux-owned files without sending players elsewhere.",
}
for old, new in replacements.items():
    if old not in text:
        print(f"warning: copy string not found: {old}")
    text = text.replace(old, new)
path.write_text(text)
PY

# Make sure every catalog entry has a real locally hosted entry document.
for game in tux-racer anti-gravity-pool xquest openpanzer progress-knight anxiety; do
  test -f "$DEST/$game/index.html"
done

# Remove files that should never be committed from imported repositories.
find "$DEST" -type d \( -name node_modules -o -name .git -o -name .github \) -prune -exec rm -rf {} + || true
find "$DEST" -name '.DS_Store' -delete

echo "Vendored Flux games:"
du -sh "$DEST"/*
