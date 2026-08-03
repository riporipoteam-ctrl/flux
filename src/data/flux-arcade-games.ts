export type FluxArcadeMode = "runner" | "survival" | "tycoon" | "quest" | "puzzle";

export type FluxArcadeGenre =
  | "Horror"
  | "Simulator"
  | "Quest"
  | "Tycoon"
  | "Story"
  | "Racing"
  | "Platformer"
  | "Puzzle"
  | "Survival"
  | "Farming";

export interface FluxArcadeGame {
  slug: string;
  title: string;
  shortDescription: string;
  description: string;
  genre: FluxArcadeGenre;
  mode: FluxArcadeMode;
  difficulty: 1 | 2 | 3 | 4 | 5;
  targetScore: number;
  roundSeconds: number;
  speed: number;
  seed: number;
  symbol: string;
  palette: [string, string, string];
}

type World = {
  name: string;
  adjective: string;
  symbol: string;
  palette: [string, string, string];
};

const WORLDS: World[] = [
  { name: "Neon Harbor", adjective: "Neon", symbol: "🌃", palette: ["#07111f", "#075985", "#22d3ee"] },
  { name: "Blackwood", adjective: "Blackwood", symbol: "🌲", palette: ["#050807", "#143524", "#84cc16"] },
  { name: "Crimson Motel", adjective: "Crimson", symbol: "🏚️", palette: ["#12080b", "#7f1d1d", "#fb7185"] },
  { name: "Moonbase Nine", adjective: "Lunar", symbol: "🌙", palette: ["#070817", "#312e81", "#a5b4fc"] },
  { name: "Dust County", adjective: "Dust County", symbol: "🏜️", palette: ["#1c1208", "#9a3412", "#fbbf24"] },
  { name: "Deep Signal", adjective: "Deep Signal", symbol: "📡", palette: ["#020617", "#0f766e", "#5eead4"] },
  { name: "Glass City", adjective: "Glass City", symbol: "🏙️", palette: ["#07131c", "#2563eb", "#bfdbfe"] },
  { name: "Iron Valley", adjective: "Iron Valley", symbol: "⛰️", palette: ["#111827", "#475569", "#cbd5e1"] },
  { name: "Sunset Coast", adjective: "Sunset", symbol: "🌅", palette: ["#2a0d18", "#ea580c", "#fde68a"] },
  { name: "Frostline", adjective: "Frostline", symbol: "❄️", palette: ["#06111c", "#0e7490", "#e0f2fe"] },
  { name: "Static Woods", adjective: "Static", symbol: "📺", palette: ["#09090b", "#3f3f46", "#d4d4d8"] },
  { name: "Golden Fields", adjective: "Golden", symbol: "🌾", palette: ["#17210d", "#4d7c0f", "#fde047"] },
  { name: "Red Planet", adjective: "Martian", symbol: "🪐", palette: ["#1c0906", "#c2410c", "#fdba74"] },
  { name: "Blue Metro", adjective: "Metro", symbol: "🚇", palette: ["#071427", "#1d4ed8", "#60a5fa"] },
  { name: "Ghost Station", adjective: "Ghost", symbol: "🚉", palette: ["#07080b", "#3730a3", "#c4b5fd"] },
  { name: "Emerald Isles", adjective: "Emerald", symbol: "🏝️", palette: ["#042f2e", "#059669", "#6ee7b7"] },
  { name: "Ashfall", adjective: "Ashfall", symbol: "🌋", palette: ["#160c08", "#b91c1c", "#fb923c"] },
  { name: "Skyline Zero", adjective: "Skyline", symbol: "☁️", palette: ["#082f49", "#0284c7", "#bae6fd"] },
  { name: "Night Market", adjective: "Night Market", symbol: "🏮", palette: ["#18051a", "#a21caf", "#f0abfc"] },
  { name: "Copper Ridge", adjective: "Copper", symbol: "⛏️", palette: ["#1b1009", "#a16207", "#facc15"] },
  { name: "Silent Lake", adjective: "Silent Lake", symbol: "🌫️", palette: ["#071314", "#155e75", "#a5f3fc"] },
  { name: "Orbit Garden", adjective: "Orbit", symbol: "🛰️", palette: ["#090720", "#6d28d9", "#ddd6fe"] },
  { name: "Candy Circuit", adjective: "Candy", symbol: "🍬", palette: ["#2b0a24", "#db2777", "#f9a8d4"] },
  { name: "Jungle Relay", adjective: "Jungle", symbol: "🦜", palette: ["#062b18", "#15803d", "#86efac"] },
  { name: "Storm District", adjective: "Storm", symbol: "⛈️", palette: ["#0f172a", "#334155", "#93c5fd"] },
  { name: "Pixel Kingdom", adjective: "Pixel", symbol: "👑", palette: ["#1e1033", "#7c3aed", "#f5d0fe"] },
  { name: "Ocean Trench", adjective: "Abyssal", symbol: "🐙", palette: ["#020617", "#0c4a6e", "#38bdf8"] },
  { name: "Solar Frontier", adjective: "Solar", symbol: "☀️", palette: ["#271208", "#f59e0b", "#fef3c7"] },
];

const GENRES: Array<{
  genre: FluxArcadeGenre;
  mode: FluxArcadeMode;
  suffix: string;
  action: string;
  symbol: string;
  baseTarget: number;
  seconds: number;
}> = [
  { genre: "Horror", mode: "survival", suffix: "Night Shift", action: "Stay alive while the shadows close in", symbol: "👁️", baseTarget: 75, seconds: 45 },
  { genre: "Simulator", mode: "tycoon", suffix: "Life Simulator", action: "Build income, upgrade your operation and hit the target", symbol: "⚙️", baseTarget: 900, seconds: 60 },
  { genre: "Quest", mode: "quest", suffix: "Quest", action: "Make smart choices and complete the expedition", symbol: "🧭", baseTarget: 8, seconds: 70 },
  { genre: "Tycoon", mode: "tycoon", suffix: "Tycoon", action: "Grow a tiny business into a high-scoring empire", symbol: "🏦", baseTarget: 1250, seconds: 60 },
  { genre: "Story", mode: "quest", suffix: "Chronicles", action: "Choose the path and unlock the best ending", symbol: "📖", baseTarget: 10, seconds: 80 },
  { genre: "Racing", mode: "runner", suffix: "Rush", action: "Dodge traffic, jump hazards and chase a new record", symbol: "🏁", baseTarget: 110, seconds: 50 },
  { genre: "Platformer", mode: "runner", suffix: "Leap", action: "Time your jumps and survive an accelerating course", symbol: "🧗", baseTarget: 95, seconds: 50 },
  { genre: "Puzzle", mode: "puzzle", suffix: "Logic Lab", action: "Repeat growing patterns before time runs out", symbol: "🧩", baseTarget: 9, seconds: 70 },
  { genre: "Survival", mode: "survival", suffix: "Last Stand", action: "Move fast, dodge waves and hold out to the end", symbol: "🛡️", baseTarget: 90, seconds: 50 },
  { genre: "Farming", mode: "tycoon", suffix: "Farm Days", action: "Harvest, reinvest and grow the farm before sunset", symbol: "🚜", baseTarget: 1050, seconds: 65 },
];

function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export const FLUX_ARCADE_GAMES: FluxArcadeGame[] = WORLDS.flatMap((world, worldIndex) =>
  GENRES.map((template, genreIndex) => {
    const seed = worldIndex * 101 + genreIndex * 17 + 31;
    const difficulty = ((seed % 5) + 1) as 1 | 2 | 3 | 4 | 5;
    const title = `${world.adjective} ${template.suffix}`;
    return {
      slug: `flux-arcade-${slugify(title)}`,
      title,
      shortDescription: `${template.action} in ${world.name}.`,
      description: `${template.action} in a replayable ${template.genre.toLowerCase()} game built directly into Flux. Every round supports phone, tablet and desktop controls, saves your personal best and can submit to the global leaderboard.`,
      genre: template.genre,
      mode: template.mode,
      difficulty,
      targetScore: template.baseTarget + difficulty * (template.mode === "tycoon" ? 180 : template.mode === "runner" || template.mode === "survival" ? 12 : 1),
      roundSeconds: template.seconds + (seed % 9),
      speed: 0.8 + difficulty * 0.16 + (seed % 7) * 0.025,
      seed,
      symbol: genreIndex % 2 === 0 ? template.symbol : world.symbol,
      palette: world.palette,
    };
  })
);

export function getFluxArcadeGame(slug: string | null | undefined): FluxArcadeGame | undefined {
  return FLUX_ARCADE_GAMES.find((game) => game.slug === slug);
}
