export type BrowserGameCategory =
  | "Racing" | "3D" | "Simulator" | "Tycoon" | "Strategy" | "Story"
  | "Horror" | "Action" | "Platformer" | "Puzzle" | "Sandbox" | "Farming"
  | "Quest" | "Survival" | "Arcade" | "Board" | "Music";

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
};

export const GAME_CATEGORIES = [
  "All", "Horror", "Racing", "Action", "Platformer", "Puzzle", "Strategy",
  "Simulator", "Tycoon", "Story", "Survival", "Arcade", "Board", "3D",
  "Farming", "Sandbox",
] as const;

export type GameCategoryFilter = (typeof GAME_CATEGORIES)[number];

type GameInput = Omit<BrowserGame, "description" | "technology" | "controls" | "devices" | "thumbnail" | "directEmbed" | "origin" | "status"> & Partial<Pick<BrowserGame, "description" | "technology" | "controls" | "devices" | "thumbnail" | "directEmbed" | "origin" | "status">>;

const githubCover = (repository: string) => `https://opengraph.githubassets.com/flux-open-source/${repository}`;
const fosiper = (path: string) => `https://fosiper.com/games/${path.replace(/^\//, "")}`;
const repoName = (url: string) => url.replace("https://github.com/", "").replace(/\/$/, "");

function openGame(input: GameInput): BrowserGame {
  return {
    description: input.shortDescription,
    technology: "HTML5 · JavaScript",
    controls: "Touch · mouse · keyboard where supported",
    devices: ["Mobile", "PC", "Tablet"],
    thumbnail: githubCover(repoName(input.sourceUrl)),
    directEmbed: true,
    origin: "original-host",
    status: "Released",
    ...input,
    arcade: false,
  };
}

/**
 * Public Games is a source-linked open-source library. The rejected generated
 * Arcade variations are deliberately not mapped into BROWSER_GAMES.
 */
export const OPEN_SOURCE_GAMES: BrowserGame[] = [
  openGame({ slug: "2048", title: "2048", author: "Gabriele Cirulli · Attogram build", shortDescription: "Slide matching number tiles and build the 2048 tile.", categories: ["Puzzle", "Board"], playUrl: fosiper("2048-lite/"), sourceUrl: "https://github.com/attogram/2048-lite", license: "MIT · see repository", symbol: "🔢", palette: ["#3b2f2a", "#bbada0", "#f2b179"], featured: true, controls: "Swipe · arrow keys" }),
  openGame({ slug: "hextris", title: "Hextris", author: "Hextris contributors · Attogram build", shortDescription: "Fast rotating hexagon puzzle with combo chains.", categories: ["Puzzle", "Arcade"], playUrl: fosiper("hextris-lite/"), sourceUrl: "https://github.com/attogram/hextris-lite", license: "Open source · see repository", symbol: "⬡", palette: ["#111827", "#7c3aed", "#22d3ee"], featured: true }),
  openGame({ slug: "hexgl", title: "HexGL", author: "BKcore · Attogram build", shortDescription: "High-speed futuristic WebGL racing through neon tracks.", categories: ["Racing", "3D", "Action"], playUrl: fosiper("hexgl-lite/"), sourceUrl: "https://github.com/attogram/HexGL-lite", license: "Open source · see repository", symbol: "🏎️", palette: ["#020617", "#1e3a8a", "#22d3ee"], featured: true, technology: "Three.js · WebGL · JavaScript", devices: ["PC", "Tablet"] }),
  openGame({ slug: "clumsy-bird", title: "Clumsy Bird", author: "Ellison Leão", shortDescription: "Open-source side-scrolling arcade flight with touch controls.", categories: ["Arcade", "Platformer"], playUrl: fosiper("clumsy-bird/"), sourceUrl: "https://github.com/ellisonleao/clumsy-bird", license: "MIT · see repository", symbol: "🐦", palette: ["#0ea5e9", "#38bdf8", "#fde047"], controls: "Tap · click · space" }),
  openGame({ slug: "dead-valley", title: "Dead Valley", author: "David McInnes", shortDescription: "Atmospheric browser survival game set in a dangerous valley.", categories: ["Horror", "Survival", "Action"], playUrl: fosiper("dead-valley/"), sourceUrl: "https://github.com/dmcinnes/dead-valley", license: "Open source · see repository", symbol: "🧟", palette: ["#09090b", "#3f3f46", "#84cc16"], devices: ["PC"] }),
  openGame({ slug: "the-house", title: "The House", author: "Artur Kot", shortDescription: "A compact open-source horror exploration game.", categories: ["Horror", "Story", "Quest"], playUrl: fosiper("the-house-game/"), sourceUrl: "https://github.com/arturkot/the-house-game", license: "Open source · see repository", symbol: "🏚️", palette: ["#030712", "#27272a", "#991b1b"], devices: ["PC", "Tablet"] }),
  openGame({ slug: "underrun", title: "Underrun", author: "Dominic Szablewski", shortDescription: "Polished sci-fi action inside a dark space facility.", categories: ["Action", "Horror", "3D"], playUrl: fosiper("underrun/index-debug.html"), sourceUrl: "https://github.com/phoboslab/underrun", license: "MIT · see repository", symbol: "🔫", palette: ["#020617", "#0f172a", "#f97316"], featured: true, technology: "WebGL · JavaScript", devices: ["PC"] }),
  openGame({ slug: "particle-clicker", title: "Particle Clicker", author: "CERN Webfest contributors", shortDescription: "Run a particle-physics laboratory in an open-source clicker.", categories: ["Simulator", "Tycoon", "Strategy"], playUrl: fosiper("particle-clicker/"), sourceUrl: "https://github.com/particle-clicker/particle-clicker", license: "Open source · see repository", symbol: "⚛️", palette: ["#111827", "#1d4ed8", "#60a5fa"] }),
  openGame({ slug: "html5-asteroids", title: "HTML5 Asteroids", author: "David McInnes", shortDescription: "Classic asteroid combat that runs directly in the browser.", categories: ["Action", "Arcade"], playUrl: fosiper("html5-asteroids/"), sourceUrl: "https://github.com/dmcinnes/HTML5-Asteroids", license: "MIT", symbol: "☄️", palette: ["#020617", "#172554", "#e2e8f0"], controls: "Keyboard", devices: ["PC"] }),
  openGame({ slug: "pacman", title: "Pac-Man Lite", author: "Attogram contributors", shortDescription: "Open-source browser maze chase with familiar arcade rules.", categories: ["Arcade", "Action"], playUrl: fosiper("pacman-lite/"), sourceUrl: "https://github.com/attogram/pacman-lite", license: "Open source · see repository", symbol: "🟡", palette: ["#020617", "#1d4ed8", "#facc15"], controls: "Swipe · arrow keys" }),
  openGame({ slug: "classic-pool", title: "Classic Pool", author: "Henshmi", shortDescription: "Aim, set power and clear the table in a browser pool game.", categories: ["Simulator", "Board", "Puzzle"], playUrl: fosiper("classic-pool-game/"), sourceUrl: "https://github.com/henshmi/Classic-Pool-Game", license: "Open source · see repository", symbol: "🎱", palette: ["#052e16", "#15803d", "#f8fafc"], controls: "Touch · mouse" }),
  openGame({ slug: "three-d-city", title: "3D.City", author: "lo-th", shortDescription: "Build a living city in an open-source WebGL simulator.", categories: ["Simulator", "Strategy", "3D"], playUrl: fosiper("3d.city/"), sourceUrl: "https://github.com/lo-th/3d.city", license: "Open source · see repository", symbol: "🏙️", palette: ["#0f172a", "#0369a1", "#4ade80"], technology: "Three.js · WebGL", devices: ["PC", "Tablet"] }),
  openGame({ slug: "eight-queens", title: "Eight Queens", author: "Attogram contributors", shortDescription: "Solve the classic chessboard placement puzzle.", categories: ["Puzzle", "Board", "Strategy"], playUrl: fosiper("eight-queens/"), sourceUrl: "https://github.com/attogram/EightQueens", license: "Open source · see repository", symbol: "♛", palette: ["#18181b", "#52525b", "#f4f4f5"] }),
  openGame({ slug: "missile-game", title: "Missile Game", author: "Ben Mather", shortDescription: "Race through a shifting tunnel in a first-person arcade game.", categories: ["Action", "Arcade", "3D"], playUrl: fosiper("missile-game/"), sourceUrl: "https://github.com/bwhmather/missile-game", license: "Open source · see repository", symbol: "🚀", palette: ["#030712", "#7c2d12", "#f97316"], technology: "WebGL · JavaScript" }),
  openGame({ slug: "ns-shaft", title: "NS-Shaft", author: "iPel", shortDescription: "Descend through endless platforms without getting crushed.", categories: ["Platformer", "Survival", "Arcade"], playUrl: fosiper("ns-shaft/"), sourceUrl: "https://github.com/iPel/NS-SHAFT", license: "Open source · see repository", symbol: "⬇️", palette: ["#111827", "#6d28d9", "#f472b6"] }),
  openGame({ slug: "tower", title: "Tower Game", author: "Kun Huang", shortDescription: "Stack moving blocks and build the tallest possible tower.", categories: ["Arcade", "Puzzle"], playUrl: fosiper("tower-game/"), sourceUrl: "https://github.com/iamkun/tower_game", license: "MIT · see repository", symbol: "🏗️", palette: ["#1e1b4b", "#7c3aed", "#f0abfc"], controls: "Tap · click · space" }),
  openGame({ slug: "twisty-polyhedra", title: "Twisty Polyhedra", author: "Aditya Ramesh", shortDescription: "Explore and solve interactive 3D twisty puzzles.", categories: ["Puzzle", "3D", "Sandbox"], playUrl: fosiper("twisty-polyhedra/"), sourceUrl: "https://github.com/aditya-r-m/twisty-polyhedra", license: "Open source · see repository", symbol: "🧊", palette: ["#111827", "#2563eb", "#f43f5e"], technology: "WebGL · JavaScript" }),
  openGame({ slug: "fire-n-ice", title: "Fire ’n Ice", author: "Eugenio Enko", shortDescription: "Open-source puzzle platforming with fire and ice mechanics.", categories: ["Platformer", "Puzzle", "Action"], playUrl: fosiper("fire-n-ice/"), sourceUrl: "https://github.com/eugenioenko/fire-n-ice", license: "Open source · see repository", symbol: "🔥", palette: ["#1e3a8a", "#38bdf8", "#fb923c"], devices: ["PC"] }),
  openGame({ slug: "paint-run-2", title: "Paint Run 2", author: "ahl389", shortDescription: "Color every route without crashing into your own runners.", categories: ["Puzzle", "Arcade"], playUrl: fosiper("paint-run2/"), sourceUrl: "https://github.com/ahl389/paint-run2", license: "Open source · see repository", symbol: "🎨", palette: ["#172554", "#db2777", "#facc15"] }),
  openGame({ slug: "tap-tap-tap", title: "Tap Tap Tap", author: "Mahdi Fathi", shortDescription: "Minimal one-touch reflex game for quick mobile rounds.", categories: ["Arcade", "Action"], playUrl: fosiper("tap-tap-tap/"), sourceUrl: "https://github.com/MahdiF/taptaptap", license: "Open source · see repository", symbol: "👆", palette: ["#0f172a", "#0ea5e9", "#f8fafc"], controls: "Tap · click" }),
  openGame({ slug: "html5-hearts", title: "HTML5 Hearts", author: "Y. Y. Jhao", shortDescription: "Play the classic trick-taking card game in the browser.", categories: ["Board", "Strategy"], playUrl: fosiper("html5-hearts/"), sourceUrl: "https://github.com/yyjhao/html5-hearts", license: "Open source · see repository", symbol: "♥️", palette: ["#450a0a", "#b91c1c", "#f8fafc"] }),
  openGame({ slug: "mahjong", title: "Mah-jongg", author: "tiansh", shortDescription: "Open-source tile matching and traditional mah-jongg play.", categories: ["Board", "Puzzle", "Strategy"], playUrl: fosiper("mah-jongg/"), sourceUrl: "https://github.com/tiansh/tjmj", license: "Open source · see repository", symbol: "🀄", palette: ["#052e16", "#166534", "#fef3c7"] }),

  openGame({ slug: "tux-racer", title: "TuxRacer.js", author: "ebbejan", shortDescription: "Fast 3D downhill racing with snowy courses.", categories: ["Racing", "3D", "Action"], playUrl: "/games-library/tux-racer/index.html", sourceUrl: "https://github.com/ebbejan/tux-racer-js", license: "GPL-2.0", symbol: "🐧", palette: ["#07122d", "#075985", "#67e8f9"], featured: true, technology: "WebGL · TypeScript · Vite", controls: "Keyboard · touch joystick", thumbnail: "/game-covers/tux-racer.svg", origin: "bundled", status: "In development" }),
  openGame({ slug: "anti-gravity-pool", title: "AntiGravity Pool", author: "Erich Loftis", shortDescription: "Real-time path-traced 3D pool with desktop and mobile controls.", categories: ["3D", "Simulator", "Puzzle"], playUrl: "/games-library/anti-gravity-pool/index.html", sourceUrl: "https://github.com/erichlof/AntiGravity-Pool", license: "CC0-1.0", symbol: "🎱", palette: ["#09090b", "#312e81", "#f472b6"], technology: "Three.js · WebGL · WebAudio", thumbnail: "/game-covers/anti-gravity-pool.svg", origin: "bundled" }),
  openGame({ slug: "xquest", title: "XQuest JS", author: "Scott Rippey", shortDescription: "Momentum-based space combat with touch, mouse and keyboard.", categories: ["Action", "Arcade"], playUrl: "/games-library/xquest/index.html", sourceUrl: "https://github.com/scottrippey/xquestjs", license: "MIT", symbol: "🚀", palette: ["#020617", "#312e81", "#22d3ee"], thumbnail: "/game-covers/xquest.svg", origin: "bundled" }),
  openGame({ slug: "openpanzer", title: "OpenPanzer", author: "Nicu Pavel", shortDescription: "Deep turn-based military strategy with campaigns.", categories: ["Strategy", "Simulator"], playUrl: "/games-library/openpanzer/index.html", sourceUrl: "https://github.com/nicupavel/openpanzer", license: "GPL-2.0+", symbol: "🪖", palette: ["#1c1917", "#365314", "#a3e635"], thumbnail: "/game-covers/openpanzer.svg", origin: "bundled" }),
  openGame({ slug: "progress-knight", title: "Progress Knight", author: "Ihtasham42", shortDescription: "A medieval life, career and wealth simulator.", categories: ["Tycoon", "Simulator", "Story"], playUrl: "/games-library/progress-knight/index.html", sourceUrl: "https://github.com/ihtasham42/progress-knight", license: "Unlicense · Public domain", symbol: "⚔️", palette: ["#1c1917", "#7c2d12", "#fbbf24"], thumbnail: "/game-covers/progress-knight.svg", origin: "bundled" }),
  openGame({ slug: "anxiety", title: "Adventures With Anxiety", author: "Nicky Case & Monplaisir", shortDescription: "A cinematic interactive story where you play anxiety itself.", categories: ["Story", "Horror"], playUrl: "/games-library/anxiety/index.html", sourceUrl: "https://github.com/ncase/anxiety", license: "CC0 · Public domain", symbol: "🐺", palette: ["#180b12", "#7f1d1d", "#fb7185"], thumbnail: "/game-covers/anxiety.svg", origin: "bundled" }),
  openGame({ slug: "flux-farm", title: "Flux Farm", author: "Ripo Team", shortDescription: "Flux’s first-party 2D farming life-sim.", categories: ["Farming", "Simulator"], playUrl: "/games/flux-farm", sourceUrl: "https://github.com/riporipoteam-ctrl/flux", license: "Flux source repository", symbol: "🌾", palette: ["#0d2818", "#2f7d42", "#c7f284"], thumbnail: "/game-covers/flux-farm.svg", internal: true, origin: "community" }),
];

export const BROWSER_GAMES: BrowserGame[] = OPEN_SOURCE_GAMES;
export const OPEN_SOURCE_GAME_COUNT = OPEN_SOURCE_GAMES.filter((game) => !game.internal).length;

export function getBrowserGame(slug: string | null | undefined) {
  return BROWSER_GAMES.find((game) => game.slug === slug);
}

export const FEATURED_GAMES = BROWSER_GAMES.filter((game) => game.featured);
