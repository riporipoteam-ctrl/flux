export type BrowserGameCategory =
  | "Racing"
  | "3D"
  | "Simulator"
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
    author: "0x00EB",
    shortDescription: "Fast 3D downhill racing with touch controls and multiple snowy courses.",
    description:
      "Race Tux down snowy mountains, collect fish and master sharp turns in a modern browser port built for desktop and mobile.",
    categories: ["Racing", "3D", "Action"],
    playUrl: "https://0x00eb.itch.io/tux-racer",
    sourceUrl: "https://github.com/ebbejan/tux-racer-js",
    license: "GPL-2.0",
    technology: "WebGL · TypeScript · Vite",
    controls: "Keyboard · touch joystick",
    devices: ["Mobile", "PC", "Tablet"],
    symbol: "🐧",
    palette: ["#07122d", "#075985", "#67e8f9"],
    featured: true,
    status: "In development",
  },
  {
    slug: "anti-gravity-pool",
    title: "AntiGravity Pool",
    author: "Erich Loftis",
    shortDescription: "A striking real-time path-traced 3D pool game with zero gravity.",
    description:
      "Play pool inside a glowing 3D cube with real-time reflections, physics and purpose-built controls for mouse, keyboard and touch screens.",
    categories: ["3D", "Simulator", "Puzzle"],
    playUrl: "https://erichlof.github.io/AntiGravity-Pool/AntiGravityPool.html",
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
    slug: "pekka-kana-2",
    title: "Pekka Kana 2",
    author: "Piste Gamez community",
    shortDescription: "A complete classic platform adventure rebuilt for WebAssembly.",
    description:
      "Run, jump, attack and explore full levels in a compact WebAssembly port with browser saves, keyboard, gamepad and multi-touch controls.",
    categories: ["Platformer", "Story", "Action"],
    playUrl: "https://pk2.m-h.org.uk/",
    sourceUrl: "https://github.com/GMH-Code/PK2",
    license: "MIT",
    technology: "C++ · WebAssembly · SDL2",
    controls: "Keyboard · gamepad · multi-touch",
    devices: ["Mobile", "PC", "Tablet"],
    symbol: "🐔",
    palette: ["#172554", "#2563eb", "#facc15"],
    featured: true,
    directEmbed: true,
    status: "Released",
  },
  {
    slug: "sandspiel",
    title: "Sandspiel",
    author: "Max Bittker",
    shortDescription: "A beautiful falling-sand physics sandbox made for mouse and touch.",
    description:
      "Paint with sand, water, fire, lava, plants, fungus and dozens of interacting materials to create tiny simulated worlds.",
    categories: ["Simulator", "Sandbox"],
    playUrl: "https://sandspiel.club/",
    sourceUrl: "https://github.com/MaxBittker/sandspiel",
    license: "MIT",
    technology: "Rust · WebAssembly · WebGL",
    controls: "Mouse · touch drawing",
    devices: ["Mobile", "PC", "Tablet"],
    symbol: "🏜️",
    palette: ["#451a03", "#c2410c", "#fde68a"],
    directEmbed: true,
    status: "Released",
  },
  {
    slug: "a-dark-room",
    title: "A Dark Room",
    author: "Doublespeak Games",
    shortDescription: "A mysterious survival story that grows into a settlement strategy game.",
    description:
      "Begin beside a dying fire, uncover a bleak world and manage an expanding settlement in a legendary minimalist browser adventure.",
    categories: ["Story", "Strategy", "Horror", "Simulator"],
    playUrl: "https://adarkroom.doublespeakgames.com/",
    sourceUrl: "https://github.com/doublespeakgames/adarkroom",
    license: "MPL-2.0",
    technology: "HTML · CSS · JavaScript",
    controls: "Mouse · touch · keyboard",
    devices: ["Mobile", "PC", "Tablet"],
    symbol: "🔥",
    palette: ["#050505", "#292524", "#f97316"],
    directEmbed: true,
    status: "Released",
  },
  {
    slug: "princejs",
    title: "PrinceJS",
    author: "oklemenz",
    shortDescription: "The complete cinematic platform classic recreated in HTML5.",
    description:
      "Escape traps, duel guards and race against time through fourteen levels with keyboard, controller or carefully designed mobile gestures.",
    categories: ["Story", "Platformer", "Action"],
    playUrl: "https://princejs.com/",
    sourceUrl: "https://github.com/oklemenz/PrinceJS",
    license: "Public domain",
    technology: "HTML5 · JavaScript · Canvas",
    controls: "Keyboard · controller · touch gestures",
    devices: ["Mobile", "PC", "Tablet"],
    symbol: "⚔️",
    palette: ["#1c1917", "#7f1d1d", "#fbbf24"],
    directEmbed: true,
    status: "Released",
  },
  {
    slug: "xquest",
    title: "XQuest JS",
    author: "Scott Rippey",
    shortDescription: "A fast momentum-based space shooter with touch, mouse and keyboard.",
    description:
      "Blast enemies, collect stars, chase power-ups and survive bonus stages in a responsive arcade shooter built entirely with web technology.",
    categories: ["Action", "3D"],
    playUrl: "https://scottrippey.github.io/xquestjs/",
    sourceUrl: "https://github.com/scottrippey/xquestjs",
    license: "Open source",
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
    shortDescription: "Deep turn-based military strategy with campaigns and browser saves.",
    description:
      "Command units across large tactical maps, manage equipment and complete campaigns in a pure HTML5 strategy game supporting Android and iOS browsers.",
    categories: ["Strategy", "Simulator"],
    playUrl: "https://panzermarshal.com/",
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
    slug: "nodulus",
    title: "Nodulus",
    author: "Hyperparticle",
    shortDescription: "A polished 3D logic puzzle built around rotating cubes and rods.",
    description:
      "Swipe and rotate connected shapes through twenty increasingly clever levels in an abstract puzzle designed specifically for touch devices.",
    categories: ["3D", "Puzzle"],
    playUrl: "https://hyperparticle.itch.io/nodulus",
    sourceUrl: "https://github.com/hyperparticle/nodulus",
    license: "Open source",
    technology: "Unity · WebGL",
    controls: "Swipe · mouse",
    devices: ["Mobile", "PC", "Tablet"],
    symbol: "🧊",
    palette: ["#082f49", "#0f766e", "#5eead4"],
    status: "Released",
  },
  {
    slug: "grave-hopper",
    title: "Grave Hopper",
    author: "Kamil Kulach",
    shortDescription: "A clever dark puzzle platformer where every death creates a tool.",
    description:
      "Turn your previous failures into platforms, switches and solutions in a compact puzzle game with on-screen mobile buttons and keyboard controls.",
    categories: ["Puzzle", "Platformer", "Horror"],
    playUrl: "https://kam1ni.itch.io/grave-hopper",
    sourceUrl: "https://github.com/Kam1ni/nokiajam2-grave-hopper",
    license: "MIT · CC BY 4.0 assets",
    technology: "HTML5 · Scrapy Engine",
    controls: "On-screen buttons · keyboard",
    devices: ["Mobile", "PC", "Tablet"],
    symbol: "🪦",
    palette: ["#111827", "#374151", "#d1d5db"],
    status: "Released",
  },
  {
    slug: "txtaria",
    title: "Txtaria",
    author: "ar0se",
    shortDescription: "A stylish ASCII platformer with responsive one- and two-finger controls.",
    description:
      "Collect falling money, dodge hazards and move through a high-contrast text world with local saves and accessible touch controls.",
    categories: ["Platformer", "Action"],
    playUrl: "https://ar0se.itch.io/txtaria",
    sourceUrl: "https://github.com/ar0se/txtaria",
    license: "MIT",
    technology: "Phaser · HTML5",
    controls: "Keyboard · mouse · one/two-finger touch",
    devices: ["Mobile", "PC", "Tablet"],
    symbol: "⌨️",
    palette: ["#020617", "#18181b", "#a3e635"],
    status: "In development",
  },
  {
    slug: "flux-farm",
    title: "Flux Farm Beta",
    author: "Ripo Team",
    shortDescription: "The original Flux farming experiment, kept available while it is rebuilt.",
    description:
      "Plant crops, progress through days and test Flux account saving. This remains a beta while the next farming game direction is developed.",
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
