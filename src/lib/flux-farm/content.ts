/**
 * Flux Farm — static game content.
 *
 * Everything designers would tune lives here: crops, seasons, weather, ranks,
 * hireable farmhands, buildings, upgrades, story chapters and world events.
 * The simulation in `simulation.ts` reads this and never hard-codes balance.
 */

export const TILE = 32;

/* -------------------------------------------------------------------------- */
/* Time and seasons                                                            */
/* -------------------------------------------------------------------------- */

export const MINUTES_PER_DAY = 1440;
export const DAYS_PER_SEASON = 14;
export const SEASONS = ["spring", "summer", "autumn", "winter"] as const;
export type Season = (typeof SEASONS)[number];

export const SEASON_INFO: Record<
  Season,
  { name: string; grass: string; grassAlt: string; tree: string; accent: string; growth: number }
> = {
  spring: { name: "Spring", grass: "#5aa64b", grassAlt: "#69b757", tree: "#3f8f42", accent: "#ffb3d1", growth: 1.1 },
  summer: { name: "Summer", grass: "#4f9c3e", grassAlt: "#63ad4b", tree: "#2f7d34", accent: "#ffd45e", growth: 1.25 },
  autumn: { name: "Autumn", grass: "#8a8a3d", grassAlt: "#9c9445", tree: "#b06a25", accent: "#ff9a4d", growth: 0.85 },
  winter: { name: "Winter", grass: "#c3d3dc", grassAlt: "#d6e3ea", tree: "#5c7a72", accent: "#9fd8ff", growth: 0.4 },
};

export function seasonForDay(day: number): Season {
  return SEASONS[Math.floor((Math.max(1, day) - 1) / DAYS_PER_SEASON) % SEASONS.length];
}

export function dayOfSeason(day: number): number {
  return ((Math.max(1, day) - 1) % DAYS_PER_SEASON) + 1;
}

export function yearForDay(day: number): number {
  return Math.floor((Math.max(1, day) - 1) / (DAYS_PER_SEASON * SEASONS.length)) + 1;
}

/* -------------------------------------------------------------------------- */
/* Weather                                                                     */
/* -------------------------------------------------------------------------- */

export const WEATHERS = [
  "clear",
  "cloudy",
  "rain",
  "storm",
  "fog",
  "windy",
  "heatwave",
  "snow",
  "frost",
] as const;
export type Weather = (typeof WEATHERS)[number];

export interface WeatherInfo {
  name: string;
  /** Multiplier applied to crop growth speed. */
  growth: number;
  /** Soil moisture added per in-game hour (negative dries the soil out). */
  moisture: number;
  /** 0 = pitch dark overcast, 1 = full brightness. */
  light: number;
  /** Base wind strength in tiles/second. */
  wind: number;
  /** Chance per day that a crop takes damage. */
  hazard: number;
  seasons: Season[];
  weight: number;
  description: string;
}

export const WEATHER_INFO: Record<Weather, WeatherInfo> = {
  clear: { name: "Clear", growth: 1, moisture: -0.9, light: 1, wind: 0.4, hazard: 0, seasons: ["spring", "summer", "autumn", "winter"], weight: 34, description: "Blue skies. Crops dry out steadily." },
  cloudy: { name: "Cloudy", growth: 0.95, moisture: -0.35, light: 0.82, wind: 0.9, hazard: 0, seasons: ["spring", "summer", "autumn", "winter"], weight: 20, description: "Soft light, slower evaporation." },
  rain: { name: "Rain", growth: 1.2, moisture: 3.4, light: 0.6, wind: 1.4, hazard: 0, seasons: ["spring", "summer", "autumn"], weight: 16, description: "Every plot waters itself." },
  storm: { name: "Storm", growth: 1.05, moisture: 4.6, light: 0.42, wind: 3.6, hazard: 0.16, seasons: ["spring", "summer", "autumn"], weight: 6, description: "Heavy water, but wind can flatten crops." },
  fog: { name: "Fog", growth: 0.9, moisture: 0.5, light: 0.72, wind: 0.2, hazard: 0, seasons: ["spring", "autumn", "winter"], weight: 8, description: "Damp air keeps the soil moist." },
  windy: { name: "Windy", growth: 0.92, moisture: -1.6, light: 0.94, wind: 3, hazard: 0.04, seasons: ["spring", "summer", "autumn", "winter"], weight: 10, description: "Dry gusts pull water out of the soil." },
  heatwave: { name: "Heatwave", growth: 1.35, moisture: -2.8, light: 1.1, wind: 0.3, hazard: 0.1, seasons: ["summer"], weight: 8, description: "Fast growth, but the soil bakes." },
  snow: { name: "Snow", growth: 0.35, moisture: 1.1, light: 0.78, wind: 1.2, hazard: 0.05, seasons: ["winter"], weight: 22, description: "Only greenhouse crops make progress." },
  frost: { name: "Frost", growth: 0.2, moisture: 0.2, light: 0.86, wind: 0.6, hazard: 0.2, seasons: ["winter", "autumn"], weight: 10, description: "Unprotected crops can be lost overnight." },
};

/* -------------------------------------------------------------------------- */
/* Crops                                                                       */
/* -------------------------------------------------------------------------- */

export const CROP_IDS = [
  "wheat",
  "carrot",
  "potato",
  "corn",
  "tomato",
  "strawberry",
  "blueberry",
  "chili",
  "pumpkin",
  "grape",
  "sunflower",
  "starfruit",
] as const;
export type CropId = (typeof CROP_IDS)[number];

export interface CropInfo {
  name: string;
  emoji: string;
  /** In-game hours from planting to harvest at 1× growth. */
  growHours: number;
  seedCost: number;
  sellPrice: number;
  xp: number;
  /** Soil moisture consumed per in-game hour. */
  thirst: number;
  unlockRank: number;
  seasons: Season[];
  /** Regrows after harvest instead of clearing the plot. */
  regrow?: number;
  rarity: "common" | "uncommon" | "rare" | "legendary";
  /** [stem, leaf, fruit] — drives the procedural sprite generator. */
  palette: [string, string, string];
  shape: "grain" | "root" | "bush" | "vine" | "tall" | "gourd";
}

export const CROPS: Record<CropId, CropInfo> = {
  wheat: { name: "Wheat", emoji: "🌾", growHours: 14, seedCost: 4, sellPrice: 11, xp: 6, thirst: 0.8, unlockRank: 1, seasons: ["spring", "summer", "autumn"], rarity: "common", palette: ["#7f9b3c", "#a8bd52", "#e8d27a"], shape: "grain" },
  carrot: { name: "Carrot", emoji: "🥕", growHours: 20, seedCost: 8, sellPrice: 24, xp: 10, thirst: 1, unlockRank: 1, seasons: ["spring", "autumn"], rarity: "common", palette: ["#3f7a34", "#5aa044", "#f08c2e"], shape: "root" },
  potato: { name: "Potato", emoji: "🥔", growHours: 26, seedCost: 12, sellPrice: 36, xp: 14, thirst: 0.9, unlockRank: 2, seasons: ["spring", "autumn", "winter"], rarity: "common", palette: ["#3d6b30", "#59913f", "#c9a06a"], shape: "root" },
  corn: { name: "Corn", emoji: "🌽", growHours: 34, seedCost: 18, sellPrice: 58, xp: 20, thirst: 1.4, unlockRank: 3, seasons: ["summer", "autumn"], regrow: 12, rarity: "common", palette: ["#4a7f31", "#6fa543", "#f2c33d"], shape: "tall" },
  tomato: { name: "Tomato", emoji: "🍅", growHours: 40, seedCost: 26, sellPrice: 84, xp: 27, thirst: 1.6, unlockRank: 4, seasons: ["summer"], regrow: 10, rarity: "uncommon", palette: ["#39702f", "#57993c", "#e0402f"], shape: "bush" },
  strawberry: { name: "Strawberry", emoji: "🍓", growHours: 46, seedCost: 38, sellPrice: 118, xp: 34, thirst: 1.5, unlockRank: 5, seasons: ["spring", "summer"], regrow: 8, rarity: "uncommon", palette: ["#357033", "#57a04a", "#e63552"], shape: "bush" },
  blueberry: { name: "Blueberry", emoji: "🫐", growHours: 54, seedCost: 52, sellPrice: 156, xp: 42, thirst: 1.4, unlockRank: 6, seasons: ["summer"], regrow: 9, rarity: "uncommon", palette: ["#2f6b3c", "#4c9455", "#4c6fd6"], shape: "bush" },
  chili: { name: "Chili", emoji: "🌶️", growHours: 58, seedCost: 64, sellPrice: 196, xp: 50, thirst: 1.8, unlockRank: 7, seasons: ["summer", "autumn"], regrow: 8, rarity: "rare", palette: ["#33682d", "#4f8f3a", "#d2352a"], shape: "bush" },
  pumpkin: { name: "Pumpkin", emoji: "🎃", growHours: 70, seedCost: 84, sellPrice: 268, xp: 62, thirst: 2, unlockRank: 8, seasons: ["autumn"], rarity: "rare", palette: ["#3a6b2c", "#578f38", "#e57722"], shape: "gourd" },
  grape: { name: "Grape", emoji: "🍇", growHours: 82, seedCost: 110, sellPrice: 352, xp: 76, thirst: 1.9, unlockRank: 9, seasons: ["autumn"], regrow: 11, rarity: "rare", palette: ["#3c6b31", "#5c9440", "#8a4bd6"], shape: "vine" },
  sunflower: { name: "Sunflower", emoji: "🌻", growHours: 62, seedCost: 76, sellPrice: 232, xp: 58, thirst: 1.5, unlockRank: 10, seasons: ["summer", "autumn"], rarity: "rare", palette: ["#41762f", "#63a13f", "#f4c623"], shape: "tall" },
  starfruit: { name: "Starfruit", emoji: "⭐", growHours: 110, seedCost: 210, sellPrice: 780, xp: 140, thirst: 2.4, unlockRank: 12, seasons: ["summer"], rarity: "legendary", palette: ["#3f7a4e", "#5fa768", "#ffe066"], shape: "vine" },
};

export const QUALITY_LABELS = ["Standard", "Silver", "Gold", "Iridium"] as const;
export const QUALITY_MULTIPLIER = [1, 1.35, 1.8, 2.6];

/* -------------------------------------------------------------------------- */
/* Ranks                                                                       */
/* -------------------------------------------------------------------------- */

export const RANKS = [
  { title: "Seedling", xp: 0 },
  { title: "Field Hand", xp: 220 },
  { title: "Grower", xp: 620 },
  { title: "Cultivator", xp: 1250 },
  { title: "Farmsteader", xp: 2200 },
  { title: "Harvester", xp: 3600 },
  { title: "Orchardist", xp: 5600 },
  { title: "Valley Rancher", xp: 8400 },
  { title: "Master Grower", xp: 12200 },
  { title: "Golden Reaper", xp: 17400 },
  { title: "Estate Holder", xp: 24500 },
  { title: "Farm Baron", xp: 34000 },
  { title: "Valley Warden", xp: 47000 },
  { title: "Harvest Sovereign", xp: 64000 },
  { title: "Valley Legend", xp: 88000 },
] as const;

export interface RankState {
  rank: number;
  title: string;
  current: number;
  needed: number;
  progress: number;
}

export function rankForXp(xp: number): RankState {
  const safe = Math.max(0, Math.floor(xp));
  let index = 0;
  for (let i = 0; i < RANKS.length; i += 1) {
    if (safe >= RANKS[i].xp) index = i;
  }
  const floor = RANKS[index].xp;
  const ceiling = RANKS[index + 1]?.xp ?? RANKS[index].xp + 30000;
  return {
    rank: index + 1,
    title: RANKS[index].title,
    current: safe - floor,
    needed: Math.max(1, ceiling - floor),
    progress: Math.min(1, (safe - floor) / Math.max(1, ceiling - floor)),
  };
}

/* -------------------------------------------------------------------------- */
/* Farmhands                                                                   */
/* -------------------------------------------------------------------------- */

export type WorkerJob = "water" | "harvest" | "plant" | "till" | "haul" | "tend";
export const WORKER_IDS = ["mira", "leo", "nora", "sable", "juno", "bram"] as const;
export type WorkerId = (typeof WORKER_IDS)[number];

export interface WorkerInfo {
  name: string;
  job: WorkerJob;
  role: string;
  unlockRank: number;
  cost: number;
  /** Actions per in-game hour. */
  speed: number;
  /** Daily coin wage taken at dawn. */
  wage: number;
  shirt: string;
  hair: string;
}

export const WORKERS: Record<WorkerId, WorkerInfo> = {
  mira: { name: "Mira", job: "water", role: "Waters the driest plots first", unlockRank: 3, cost: 650, speed: 5, wage: 18, shirt: "#4aa3e0", hair: "#4a3527" },
  leo: { name: "Leo", job: "harvest", role: "Harvests anything that is ripe", unlockRank: 4, cost: 1400, speed: 4, wage: 34, shirt: "#e0764a", hair: "#241a12" },
  nora: { name: "Nora", job: "plant", role: "Replants your selected seed", unlockRank: 6, cost: 2900, speed: 3.5, wage: 52, shirt: "#8f5ce0", hair: "#5c2f1e" },
  sable: { name: "Sable", job: "till", role: "Tills fallow ground into beds", unlockRank: 7, cost: 4200, speed: 3, wage: 66, shirt: "#3f8f6a", hair: "#12100e" },
  juno: { name: "Juno", job: "haul", role: "Hauls the barn to market each dawn", unlockRank: 9, cost: 7800, speed: 2.5, wage: 95, shirt: "#d8b23c", hair: "#7a4a22" },
  bram: { name: "Bram", job: "tend", role: "Tends soil quality and clears debris", unlockRank: 11, cost: 13500, speed: 3, wage: 140, shirt: "#c04a6a", hair: "#3a2a1c" },
};

/* -------------------------------------------------------------------------- */
/* Buildings and upgrades                                                      */
/* -------------------------------------------------------------------------- */

export type UpgradeId =
  | "field"
  | "house"
  | "barn"
  | "well"
  | "wateringCan"
  | "greenhouse"
  | "sprinklers"
  | "silo"
  | "windmill"
  | "market";

export interface UpgradeInfo {
  name: string;
  description: string;
  emoji: string;
  maxLevel: number;
  /** Coin cost for the given next level (1-indexed). */
  cost: (nextLevel: number) => number;
  unlockRank: number;
}

export const UPGRADES: Record<UpgradeId, UpgradeInfo> = {
  field: { name: "Field expansion", description: "Opens another block of farmable ground.", emoji: "🌱", maxLevel: 6, cost: (n) => 480 * n * n, unlockRank: 2 },
  wateringCan: { name: "Watering can", description: "Waters more plots per swing.", emoji: "🪣", maxLevel: 5, cost: (n) => 260 * n * n, unlockRank: 1 },
  house: { name: "Farmhouse", description: "More energy each morning.", emoji: "🏠", maxLevel: 5, cost: (n) => 900 * n * n, unlockRank: 3 },
  barn: { name: "Barn", description: "Holds more harvested crops before a sale.", emoji: "🛖", maxLevel: 5, cost: (n) => 700 * n * n, unlockRank: 3 },
  well: { name: "Well", description: "Soil holds moisture for longer.", emoji: "⛲", maxLevel: 4, cost: (n) => 1100 * n * n, unlockRank: 5 },
  greenhouse: { name: "Greenhouse", description: "Winter and off-season crops keep growing.", emoji: "🏵️", maxLevel: 3, cost: (n) => 4200 * n * n, unlockRank: 8 },
  sprinklers: { name: "Sprinklers", description: "Auto-waters a ring of plots at dawn.", emoji: "💦", maxLevel: 4, cost: (n) => 3200 * n * n, unlockRank: 9 },
  silo: { name: "Silo", description: "Seeds cost less at the shop.", emoji: "🌾", maxLevel: 4, cost: (n) => 2400 * n * n, unlockRank: 7 },
  windmill: { name: "Windmill", description: "Wind is converted into extra sale value.", emoji: "🌬️", maxLevel: 3, cost: (n) => 6400 * n * n, unlockRank: 10 },
  market: { name: "Market stall", description: "Better base price on every crop sold.", emoji: "🏪", maxLevel: 5, cost: (n) => 1800 * n * n, unlockRank: 6 },
};

export const UPGRADE_ORDER: UpgradeId[] = [
  "wateringCan",
  "field",
  "barn",
  "house",
  "market",
  "well",
  "silo",
  "greenhouse",
  "sprinklers",
  "windmill",
];

/* -------------------------------------------------------------------------- */
/* World events                                                                */
/* -------------------------------------------------------------------------- */

export interface WorldEventInfo {
  id: string;
  name: string;
  emoji: string;
  text: string;
  /** Whole in-game days the event stays active. */
  days: number;
  priceMultiplier?: number;
  growthMultiplier?: number;
  xpMultiplier?: number;
  seedDiscount?: number;
  /** Chance per day a plot is damaged while active. */
  hazard?: number;
  seasons?: Season[];
  minRank?: number;
}

export const WORLD_EVENTS: WorldEventInfo[] = [
  { id: "harvest-festival", name: "Harvest Festival", emoji: "🎪", text: "The village pays 45% more for everything you sell.", days: 2, priceMultiplier: 1.45 },
  { id: "rainbow-bloom", name: "Rainbow Bloom", emoji: "🌈", text: "Every crop grows at double speed.", days: 1, growthMultiplier: 2 },
  { id: "merchant-caravan", name: "Merchant Caravan", emoji: "🐫", text: "Seeds are half price while the caravan is parked.", days: 2, seedDiscount: 0.5 },
  { id: "crow-swarm", name: "Crow Swarm", emoji: "🐦‍⬛", text: "Crows peck at unattended crops. Harvest quickly.", days: 1, hazard: 0.22 },
  { id: "lantern-night", name: "Lantern Night", emoji: "🏮", text: "Night work earns 80% more experience.", days: 1, xpMultiplier: 1.8 },
  { id: "dry-spell", name: "Dry Spell", emoji: "🥵", text: "Soil drains fast, but scarcity lifts prices by 30%.", days: 2, priceMultiplier: 1.3, growthMultiplier: 0.8, seasons: ["summer", "autumn"] },
  { id: "meteor-shower", name: "Meteor Shower", emoji: "☄️", text: "Star fragments in the soil grant triple experience.", days: 1, xpMultiplier: 3, minRank: 6 },
  { id: "first-frost", name: "First Frost", emoji: "❄️", text: "A cold snap threatens anything left in the ground.", days: 1, hazard: 0.28, growthMultiplier: 0.35, seasons: ["autumn", "winter"] },
  { id: "county-fair", name: "County Fair", emoji: "🏆", text: "Judges double the value of rare and legendary crops.", days: 2, priceMultiplier: 1.25, xpMultiplier: 1.4, minRank: 8 },
];

/* -------------------------------------------------------------------------- */
/* Story                                                                       */
/* -------------------------------------------------------------------------- */

export interface StoryChapter {
  id: string;
  title: string;
  text: string;
  objective: string;
  reward: { coins: number; xp: number; seeds?: Partial<Record<CropId, number>> };
}

export const STORY: StoryChapter[] = [
  { id: "arrival", title: "A Field Left Behind", text: "Grandpa Rowan left you a quiet valley and one request — make the land alive again. The soil is hard; break it open.", objective: "Till 6 plots of ground", reward: { coins: 120, xp: 60, seeds: { wheat: 8 } } },
  { id: "first-seed", title: "First Seed", text: "The seed pouch in the kitchen drawer still has life in it. Plant what you can.", objective: "Plant 8 crops", reward: { coins: 160, xp: 90, seeds: { carrot: 6 } } },
  { id: "first-harvest", title: "First Harvest", text: "The village bakery has been waiting a long time for grain from this valley.", objective: "Harvest 10 crops", reward: { coins: 260, xp: 140 } },
  { id: "market-day", title: "Market Day", text: "Cart the barn down to the stall and see what the valley is worth now.", objective: "Earn 900 coins in total", reward: { coins: 400, xp: 220, seeds: { potato: 6 } } },
  { id: "more-hands", title: "More Hands", text: "You cannot water forty beds alone. Mira is looking for work.", objective: "Hire your first farmhand", reward: { coins: 600, xp: 320 } },
  { id: "beyond-fence", title: "Beyond the Fence", text: "The north field has been fallow for a decade. Take it back.", objective: "Expand the field to level 2", reward: { coins: 900, xp: 480, seeds: { corn: 6 } } },
  { id: "weathered", title: "Weathered", text: "The valley tests everyone who stays. Farm through a storm and a frost.", objective: "Survive 5 days of harsh weather", reward: { coins: 1200, xp: 700 } },
  { id: "four-seasons", title: "Four Seasons", text: "Rowan used to say you do not know a valley until you have seen it turn.", objective: "Reach day 45", reward: { coins: 2200, xp: 1300, seeds: { pumpkin: 4 } } },
  { id: "estate", title: "The Estate", text: "Glass, stone and running water. Build the farm Rowan sketched but never finished.", objective: "Own a greenhouse and sprinklers", reward: { coins: 4500, xp: 2600 } },
  { id: "legend", title: "Keeper of the Valley", text: "Every farmer in Flux knows the name of this valley now. Finish what Rowan started.", objective: "Reach rank 12", reward: { coins: 12000, xp: 6000, seeds: { starfruit: 3 } } },
];

/* -------------------------------------------------------------------------- */
/* Helpers                                                                     */
/* -------------------------------------------------------------------------- */

export function cropInSeason(crop: CropId, season: Season, greenhouse: number): boolean {
  if (greenhouse > 0) return true;
  return CROPS[crop].seasons.includes(season);
}

export function seedPrice(crop: CropId, silo: number, discount: number): number {
  const base = CROPS[crop].seedCost * (1 - Math.min(0.4, silo * 0.1));
  return Math.max(1, Math.round(base * (1 - discount)));
}

export function cropValue(
  crop: CropId,
  quality: number,
  marketLevel: number,
  eventMultiplier: number,
  windBonus: number
): number {
  const base = CROPS[crop].sellPrice;
  const quality_ = QUALITY_MULTIPLIER[Math.min(QUALITY_MULTIPLIER.length - 1, Math.max(0, quality))];
  const market = 1 + marketLevel * 0.08;
  return Math.max(1, Math.round(base * quality_ * market * eventMultiplier * (1 + windBonus)));
}
