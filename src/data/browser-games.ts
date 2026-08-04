export type BrowserGameCategory =
  | "2D"
  | "3D"
  | "Racing"
  | "Sports"
  | "Action"
  | "Platformer"
  | "Arcade"
  | "Puzzle";

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
};

export const GAME_CATEGORIES = [
  "All",
  "3D",
  "2D",
  "Racing",
  "Sports",
  "Action",
  "Platformer",
  "Arcade",
  "Puzzle",
] as const;

export type GameCategoryFilter = (typeof GAME_CATEGORIES)[number];

function fluxOriginal(input: Omit<BrowserGame, "author" | "sourceUrl" | "license" | "thumbnail" | "directEmbed" | "internal" | "arcade" | "status" | "origin">): BrowserGame {
  return {
    ...input,
    author: "Ripo Team",
    sourceUrl: "https://github.com/riporipoteam-ctrl/flux",
    license: "Flux Original",
    thumbnail: "",
    directEmbed: true,
    internal: false,
    arcade: false,
    status: "Released",
    origin: "bundled",
  };
}

/**
 * Every public game below is stored in /public/games-library and is served by
 * the same Flux deployment. No remote game host or third-party iframe is used.
 */
export const FLUX_ORIGINALS: BrowserGame[] = [
  fluxOriginal({
    slug: "flux-velocity",
    title: "Flux Velocity",
    shortDescription: "A neon 3D highway racer built for touch, keyboard and swipe controls.",
    description: "Dodge traffic, collect energy and survive an increasingly fast neon highway.",
    categories: ["3D", "Racing", "Action"],
    playUrl: "/games-library/flux-velocity/index.html",
    technology: "Three.js · WebGL",
    controls: "Touch steering · swipe · keyboard · boost",
    devices: ["Mobile", "Tablet", "PC"],
    symbol: "🏎️",
    palette: ["#020617", "#0891b2", "#67e8f9"],
    featured: true,
    dimension: "3D",
  }),
  fluxOriginal({
    slug: "flux-orbit",
    title: "Flux Orbit",
    shortDescription: "Pilot a 3D ship through debris fields with a real mobile joystick.",
    description: "Steer through a collapsing energy field, collect power and pulse nearby debris.",
    categories: ["3D", "Action", "Arcade"],
    playUrl: "/games-library/flux-orbit/index.html",
    technology: "Three.js · WebGL",
    controls: "Touch joystick · pulse button · keyboard",
    devices: ["Mobile", "Tablet", "PC"],
    symbol: "🚀",
    palette: ["#02030a", "#7c3aed", "#22d3ee"],
    featured: true,
    dimension: "3D",
  }),
  fluxOriginal({
    slug: "flux-rooftop",
    title: "Flux Rooftop",
    shortDescription: "A fast 2D parkour runner with touch jumping and double jumps.",
    description: "Clear rooftop gaps, collect energy and keep the run alive as speed increases.",
    categories: ["2D", "Platformer", "Action"],
    playUrl: "/games-library/flux-rooftop/index.html",
    technology: "Canvas 2D",
    controls: "Tap anywhere · jump button · keyboard",
    devices: ["Mobile", "Tablet", "PC"],
    symbol: "🏃",
    palette: ["#08111f", "#1d4ed8", "#38bdf8"],
    featured: true,
    dimension: "2D",
  }),
  fluxOriginal({
    slug: "flux-hoops",
    title: "Flux Hoops",
    shortDescription: "Charge, release and sink moving shots in a touch-first basketball game.",
    description: "Master shot power while the basket moves to a new position after every score.",
    categories: ["2D", "Sports", "Arcade"],
    playUrl: "/games-library/flux-hoops/index.html",
    technology: "Canvas 2D",
    controls: "Hold and release · spacebar",
    devices: ["Mobile", "Tablet", "PC"],
    symbol: "🏀",
    palette: ["#120b08", "#c2410c", "#fb923c"],
    dimension: "2D",
  }),
  fluxOriginal({
    slug: "flux-defender",
    title: "Flux Defender",
    shortDescription: "Protect the city core in a neon 2D shooter with mobile controls.",
    description: "Move along the defense line, destroy incoming drones and survive each wave.",
    categories: ["2D", "Action", "Arcade"],
    playUrl: "/games-library/flux-defender/index.html",
    technology: "Canvas 2D",
    controls: "Left/right touch buttons · fire · keyboard",
    devices: ["Mobile", "Tablet", "PC"],
    symbol: "🛡️",
    palette: ["#020617", "#0e7490", "#ec4899"],
    dimension: "2D",
  }),
  fluxOriginal({
    slug: "flux-stack",
    title: "Flux Stack",
    shortDescription: "Time each drop and build a glowing city tower one floor at a time.",
    description: "Trim every overhang, preserve the tower width and push the skyline higher.",
    categories: ["2D", "Puzzle", "Arcade"],
    playUrl: "/games-library/flux-stack/index.html",
    technology: "Canvas 2D",
    controls: "Tap anywhere · drop button · spacebar",
    devices: ["Mobile", "Tablet", "PC"],
    symbol: "🏙️",
    palette: ["#070716", "#7c3aed", "#db2777"],
    dimension: "2D",
  }),
];

export const BROWSER_GAMES: BrowserGame[] = FLUX_ORIGINALS;
export const FEATURED_GAMES = FLUX_ORIGINALS.filter((game) => game.featured);
export const OPEN_SOURCE_GAME_COUNT = 0;
export const ARCADE_GAME_COUNT = 0;

export function getBrowserGame(slug: string | null | undefined) {
  return BROWSER_GAMES.find((game) => game.slug === slug);
}
