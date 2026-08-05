export type BrowserGameCategory =
  | "2D"
  | "3D"
  | "Racing"
  | "Action"
  | "Arcade"
  | "Puzzle"
  | "Simulator"
  | "Strategy"
  | "Story"
  | "Horror"
  | "Tycoon"
  | "Quest"
  | "Platformer"
  | "Survival"
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
  thumbnail: string;
  featured?: boolean;
  directEmbed?: boolean;
  internal?: boolean;
  arcade?: boolean;
  status?: "Released" | "Beta" | "In development";
  origin?: "bundled" | "original-host" | "community";
  dimension: "2D" | "3D";
  mobileReady: boolean;
};

export const GAME_CATEGORIES = [
  "All",
  "3D",
  "2D",
  "Action",
  "Racing",
  "Puzzle",
  "Simulator",
  "Strategy",
  "Story",
] as const;

export type GameCategoryFilter = (typeof GAME_CATEGORIES)[number];

type OpenGameInput = Omit<BrowserGame, "directEmbed" | "internal" | "arcade" | "origin">;

function openSourceGame(input: OpenGameInput): BrowserGame {
  return {
    ...input,
    directEmbed: true,
    internal: false,
    arcade: false,
    origin: "bundled",
  };
}

/**
 * Every game in this catalog is stored under /public/games-library and served
 * by the same Flux deployment. There are no third-party iframe hosts. Credits
 * and license notices are shown on /games/licenses.
 */
export const OPEN_SOURCE_GAMES: BrowserGame[] = [
  openSourceGame({
    slug: "tux-racer",
    title: "TuxRacer.js",
    author: "ebbejan and contributors",
    shortDescription: "Fast 3D downhill racing with snowy courses and a touch joystick.",
    description: "Race downhill, steer around obstacles and collect fish in a WebGL remake built for browsers.",
    categories: ["3D", "Racing", "Action"],
    playUrl: "/games-library/tux-racer/index.html",
    sourceUrl: "https://github.com/ebbejan/tux-racer-js",
    license: "GPL-2.0",
    technology: "WebGL · TypeScript · Vite",
    controls: "Touch joystick · keyboard",
    devices: ["Mobile", "Tablet", "PC"],
    symbol: "🐧",
    palette: ["#07122d", "#075985", "#67e8f9"],
    thumbnail: "/game-covers/tux-racer.svg",
    featured: true,
    status: "In development",
    dimension: "3D",
    mobileReady: true,
  }),
  openSourceGame({
    slug: "anti-gravity-pool",
    title: "Anti-Gravity Pool",
    author: "Erich Loftis",
    shortDescription: "A real-time path-traced 3D pool game with mobile joystick support.",
    description: "Play a physics-based pool game rendered with Three.js path tracing and mobile controls.",
    categories: ["3D", "Simulator", "Puzzle"],
    playUrl: "/games-library/anti-gravity-pool/index.html",
    sourceUrl: "https://github.com/erichlof/AntiGravity-Pool",
    license: "CC0-1.0",
    technology: "Three.js · WebGL · WebAudio",
    controls: "Touch joystick · tap Play · keyboard",
    devices: ["Mobile", "Tablet", "PC"],
    symbol: "🎱",
    palette: ["#09090b", "#312e81", "#f472b6"],
    thumbnail: "/game-covers/anti-gravity-pool.svg",
    featured: true,
    status: "Released",
    dimension: "3D",
    mobileReady: true,
  }),
  openSourceGame({
    slug: "xquest",
    title: "XQuest JS",
    author: "Scott Rippey",
    shortDescription: "Momentum-based space combat with native touch, mouse and keyboard controls.",
    description: "Collect stars, fight enemies and unlock the gate in an open-source arcade space shooter.",
    categories: ["2D", "Action", "Arcade"],
    playUrl: "/games-library/xquest/index.html",
    sourceUrl: "https://github.com/scottrippey/xquestjs",
    license: "MIT",
    technology: "HTML5 Canvas · JavaScript",
    controls: "Touch drag · multi-touch shoot/bomb · keyboard",
    devices: ["Mobile", "Tablet", "PC"],
    symbol: "🚀",
    palette: ["#020617", "#312e81", "#22d3ee"],
    thumbnail: "/game-covers/xquest.svg",
    featured: true,
    status: "Beta",
    dimension: "2D",
    mobileReady: true,
  }),
  openSourceGame({
    slug: "progress-knight",
    title: "Progress Knight",
    author: "Ihtasham42",
    shortDescription: "A medieval life, career and wealth simulator designed around touch-friendly menus.",
    description: "Train skills, choose careers and build a long-running medieval life in an open-source idle simulator.",
    categories: ["2D", "Simulator", "Tycoon"],
    playUrl: "/games-library/progress-knight/index.html",
    sourceUrl: "https://github.com/ihtasham42/progress-knight",
    license: "Unlicense · Public domain",
    technology: "HTML · CSS · JavaScript",
    controls: "Touch menus · mouse",
    devices: ["Mobile", "Tablet", "PC"],
    symbol: "⚔️",
    palette: ["#1c1917", "#7c2d12", "#fbbf24"],
    thumbnail: "/game-covers/progress-knight.svg",
    status: "Released",
    dimension: "2D",
    mobileReady: true,
  }),
  openSourceGame({
    slug: "anxiety",
    title: "Adventures With Anxiety",
    author: "Nicky Case and Monplaisir",
    shortDescription: "A cinematic interactive story where you play as anxiety itself.",
    description: "Make choices in an expressive open-source story game built around taps and clicks.",
    categories: ["2D", "Story", "Horror"],
    playUrl: "/games-library/anxiety/index.html",
    sourceUrl: "https://github.com/ncase/anxiety",
    license: "CC0 · Public domain",
    technology: "HTML5 · JavaScript",
    controls: "Tap · click",
    devices: ["Mobile", "Tablet", "PC"],
    symbol: "🐺",
    palette: ["#180b12", "#7f1d1d", "#fb7185"],
    thumbnail: "/game-covers/anxiety.svg",
    status: "Released",
    dimension: "2D",
    mobileReady: true,
  }),
  openSourceGame({
    slug: "openpanzer",
    title: "OpenPanzer",
    author: "Nicu Pavel",
    shortDescription: "A full turn-based strategy game with campaigns and touch-friendly map interaction.",
    description: "Command units through scenarios in an open-source HTML5 strategy game inspired by classic war games.",
    categories: ["2D", "Strategy", "Simulator"],
    playUrl: "/games-library/openpanzer/index.html",
    sourceUrl: "https://github.com/nicupavel/openpanzer",
    license: "GPL-2.0+",
    technology: "HTML5 Canvas · JavaScript",
    controls: "Touch map · mouse",
    devices: ["Mobile", "Tablet", "PC"],
    symbol: "🪖",
    palette: ["#1c1917", "#365314", "#a3e635"],
    thumbnail: "/game-covers/openpanzer.svg",
    status: "Released",
    dimension: "2D",
    mobileReady: true,
  }),
];

export const BROWSER_GAMES: BrowserGame[] = OPEN_SOURCE_GAMES;
export const FEATURED_GAMES = OPEN_SOURCE_GAMES.filter((game) => game.featured);
export const OPEN_SOURCE_GAME_COUNT = OPEN_SOURCE_GAMES.length;
export const ARCADE_GAME_COUNT = 0;

export function getBrowserGame(slug: string | null | undefined) {
  return BROWSER_GAMES.find((game) => game.slug === slug);
}
