import { FLUX_ARCADE_GAMES } from "@/data/flux-arcade-games";

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
  | "Farming"
  | "Quest"
  | "Survival"
  | "Arcade";

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
  thumbnail: string;
  featured?: boolean;
  directEmbed?: boolean;
  internal?: boolean;
  arcade?: boolean;
  status?: "Released" | "Beta" | "In development";
};

export const GAME_CATEGORIES = [
  "All",
  "Arcade",
  "Horror",
  "Simulator",
  "Quest",
  "Tycoon",
  "Story",
  "Racing",
  "Platformer",
  "Puzzle",
  "Survival",
  "Farming",
  "3D",
  "Strategy",
  "Action",
  "Sandbox",
] as const;

export type GameCategoryFilter = (typeof GAME_CATEGORIES)[number];

const OPEN_SOURCE_GAMES: BrowserGame[] = [
  {
    slug: "tux-racer",
    title: "TuxRacer.js",
    author: "ebbejan",
    shortDescription: "Fast 3D downhill racing with touch controls and snowy courses.",
    description: "Race down snowy mountains, collect fish and master sharp turns in a full 3D browser racer hosted directly by Flux.",
    categories: ["Racing", "3D", "Action"],
    playUrl: "/games-library/tux-racer/index.html",
    sourceUrl: "https://github.com/ebbejan/tux-racer-js",
    license: "GPL-2.0",
    technology: "WebGL · TypeScript · Vite",
    controls: "Keyboard · touch joystick",
    devices: ["Mobile", "PC", "Tablet"],
    symbol: "🐧",
    palette: ["#07122d", "#075985", "#67e8f9"],
    thumbnail: "/game-covers/tux-racer.svg",
    featured: true,
    directEmbed: true,
    status: "In development",
  },
  {
    slug: "anti-gravity-pool",
    title: "AntiGravity Pool",
    author: "Erich Loftis",
    shortDescription: "Real-time path-traced 3D pool with desktop and mobile controls.",
    description: "Play pool inside a glowing zero-gravity cube with reflections, physics, keyboard controls and touch gestures.",
    categories: ["3D", "Simulator", "Puzzle"],
    playUrl: "/games-library/anti-gravity-pool/index.html",
    sourceUrl: "https://github.com/erichlof/AntiGravity-Pool",
    license: "CC0-1.0",
    technology: "Three.js · WebGL · WebAudio",
    controls: "Mouse · keyboard · swipe · pinch",
    devices: ["Mobile", "PC", "Tablet"],
    symbol: "🎱",
    palette: ["#09090b", "#312e81", "#f472b6"],
    thumbnail: "/game-covers/anti-gravity-pool.svg",
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
    thumbnail: "/game-covers/xquest.svg",
    featured: true,
    directEmbed: true,
    status: "Released",
  },
  {
    slug: "openpanzer",
    title: "OpenPanzer",
    author: "Nicu Pavel",
    shortDescription: "Deep turn-based military strategy with campaigns and local saves.",
    description: "Command units across tactical maps, manage equipment and complete campaigns in a touch-friendly HTML5 strategy game.",
    categories: ["Strategy", "Simulator"],
    playUrl: "/games-library/openpanzer/index.html",
    sourceUrl: "https://github.com/nicupavel/openpanzer",
    license: "GPL-2.0+",
    technology: "HTML5 · JavaScript · Canvas",
    controls: "Mouse · touch",
    devices: ["Mobile", "PC", "Tablet"],
    symbol: "🪖",
    palette: ["#1c1917", "#365314", "#a3e635"],
    thumbnail: "/game-covers/openpanzer.svg",
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
    thumbnail: "/game-covers/progress-knight.svg",
    directEmbed: true,
    status: "Released",
  },
  {
    slug: "anxiety",
    title: "Adventures With Anxiety",
    author: "Nicky Case & Monplaisir",
    shortDescription: "A cinematic interactive story where you play as anxiety itself.",
    description: "Make choices as a nervous red wolf, guide a human through escalating fears and experience a polished emotional story.",
    categories: ["Story", "Horror"],
    playUrl: "/games-library/anxiety/index.html",
    sourceUrl: "https://github.com/ncase/anxiety",
    license: "CC0 · Public domain",
    technology: "HTML5 · JavaScript · Canvas · Audio",
    controls: "Mouse · touch",
    devices: ["Mobile", "PC", "Tablet"],
    symbol: "🐺",
    palette: ["#180b12", "#7f1d1d", "#fb7185"],
    thumbnail: "/game-covers/anxiety.svg",
    directEmbed: true,
    status: "Released",
  },
  {
    slug: "flux-farm",
    title: "Flux Farm",
    author: "Ripo Team",
    shortDescription: "A 2D farming life-sim with seasons, upgrades, events and a global ladder.",
    description: "Restore a forgotten valley, grow crops, upgrade the farm and compete for the highest Flux Farm rank.",
    categories: ["Farming", "Simulator"],
    playUrl: "/games/flux-farm",
    sourceUrl: "https://github.com/riporipoteam-ctrl/flux",
    license: "Flux source",
    technology: "Next.js · Canvas 2D · WebAudio · Firebase",
    controls: "Touch · mouse · keyboard",
    devices: ["Mobile", "PC", "Tablet"],
    symbol: "🌾",
    palette: ["#0d2818", "#2f7d42", "#c7f284"],
    thumbnail: "/game-covers/flux-farm.svg",
    internal: true,
    featured: true,
    status: "Released",
  },
];

const ARCADE_GAMES: BrowserGame[] = FLUX_ARCADE_GAMES.map((game, index) => ({
  slug: game.slug,
  title: game.title,
  author: "Flux Arcade",
  shortDescription: game.shortDescription,
  description: game.description,
  categories: [game.genre, "Arcade"] as BrowserGameCategory[],
  playUrl: `/games/arcade?game=${encodeURIComponent(game.slug)}`,
  sourceUrl: "https://github.com/riporipoteam-ctrl/flux",
  license: "Flux source",
  technology: "React · WebAudio · Firebase leaderboard",
  controls: "Touch · mouse · keyboard",
  devices: ["Mobile", "PC", "Tablet"],
  symbol: game.symbol,
  palette: game.palette,
  thumbnail: "/game-covers/flux-arcade.svg",
  internal: true,
  arcade: true,
  featured: index < 3,
  status: "Released",
}));

export const BROWSER_GAMES: BrowserGame[] = [...OPEN_SOURCE_GAMES, ...ARCADE_GAMES];
export const ARCADE_GAME_COUNT = ARCADE_GAMES.length;

export function getBrowserGame(slug: string | null | undefined) {
  return BROWSER_GAMES.find((game) => game.slug === slug);
}

export const FEATURED_GAMES = BROWSER_GAMES.filter((game) => game.featured).sort(
  (a, b) => Number(b.slug === "flux-farm") - Number(a.slug === "flux-farm")
);
