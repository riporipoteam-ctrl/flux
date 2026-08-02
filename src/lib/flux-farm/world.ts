/**
 * Flux Farm — world model.
 *
 * The world is a fixed 48×36 tile valley. Terrain is generated deterministically
 * from the save's seed so the same farm looks identical on every device, while
 * the mutable layer (tilled soil, moisture, crops, entities) lives in the save.
 */

import {
  CROPS,
  DAYS_PER_SEASON,
  MINUTES_PER_DAY,
  TILE,
  type CropId,
  type UpgradeId,
  type Weather,
  type WorkerId,
} from "./content";

export { TILE };

export const WORLD_W = 48;
export const WORLD_H = 36;

/** Farmable region — expansions unlock rows/columns inside this rectangle. */
export const FARM_X = 14;
export const FARM_Y = 10;
export const FARM_W = 24;
export const FARM_H = 18;

export type TerrainKind =
  | "grass"
  | "grass-alt"
  | "path"
  | "water"
  | "sand"
  | "stone"
  | "farm"
  | "wood";

export type PropKind =
  | "tree"
  | "pine"
  | "rock"
  | "bush"
  | "flower"
  | "stump"
  | "fence-h"
  | "fence-v"
  | "post"
  | "lantern"
  | "sign"
  | "crate";

export interface PropEntity {
  kind: PropKind;
  x: number;
  y: number;
  variant: number;
}

export interface BuildingEntity {
  id: "house" | "barn" | "well" | "greenhouse" | "silo" | "windmill" | "market" | "shed";
  x: number;
  y: number;
  w: number;
  h: number;
  requiresUpgrade?: UpgradeId;
}

export interface Plot {
  /** Tile index within the farm rectangle. */
  x: number;
  y: number;
  tilled: boolean;
  /** 0..1 */
  moisture: number;
  /** 0..1, raises harvest quality over time when tended. */
  fertility: number;
  crop: CropId | null;
  /** In-game hours of growth accumulated. */
  growth: number;
  /** Hours the crop has spent thirsty; enough of it kills the plant. */
  stress: number;
  /** Set when the crop has been harvested and is regrowing. */
  regrowAt: number | null;
  dead: boolean;
  quality: number;
}

export interface WorkerEntity {
  id: WorkerId;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  cooldown: number;
  phase: number;
  facing: 0 | 1 | 2 | 3;
  busy: boolean;
}

export interface BarnItem {
  crop: CropId;
  quality: number;
  count: number;
}

export interface FarmStats {
  tilled: number;
  planted: number;
  harvested: number;
  watered: number;
  coinsEarned: number;
  coinsSpent: number;
  daysPlayed: number;
  harshDays: number;
  eventsSeen: number;
  cropsLost: number;
  bestSale: number;
}

export interface FarmSaveV2 {
  version: 2;
  uid: string;
  displayName: string;
  avatarUrl: string | null;
  seed: number;

  day: number;
  minute: number;
  weather: Weather;
  windAngle: number;
  windSpeed: number;

  coins: number;
  xp: number;
  energy: number;
  maxEnergy: number;

  selectedCrop: CropId;
  seeds: Partial<Record<CropId, number>>;
  plots: Plot[];
  barn: BarnItem[];
  workers: Array<{ id: WorkerId; hired: boolean; hiredDay: number }>;
  upgrades: Partial<Record<UpgradeId, number>>;

  storyStep: number;
  storyProgress: Record<string, number>;
  activeEvent: { id: string; endsOnDay: number } | null;

  playerX: number;
  playerY: number;

  stats: FarmStats;
  lastPlayedAt: number;
}

/* -------------------------------------------------------------------------- */
/* Deterministic noise                                                         */
/* -------------------------------------------------------------------------- */

export function hash2(x: number, y: number, seed: number): number {
  let h = (x * 374761393 + y * 668265263 + seed * 2246822519) | 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function smoothNoise(x: number, y: number, seed: number, scale: number): number {
  const sx = x / scale;
  const sy = y / scale;
  const x0 = Math.floor(sx);
  const y0 = Math.floor(sy);
  const fx = sx - x0;
  const fy = sy - y0;
  const ease = (t: number) => t * t * (3 - 2 * t);
  const a = hash2(x0, y0, seed);
  const b = hash2(x0 + 1, y0, seed);
  const c = hash2(x0, y0 + 1, seed);
  const d = hash2(x0 + 1, y0 + 1, seed);
  const ex = ease(fx);
  const ey = ease(fy);
  return (a * (1 - ex) + b * ex) * (1 - ey) + (c * (1 - ex) + d * ex) * ey;
}

/* -------------------------------------------------------------------------- */
/* Terrain                                                                     */
/* -------------------------------------------------------------------------- */

export interface Terrain {
  kind: TerrainKind[];
  variant: number[];
  solid: Uint8Array;
  props: PropEntity[];
  buildings: BuildingEntity[];
}

function inFarm(x: number, y: number) {
  return x >= FARM_X && x < FARM_X + FARM_W && y >= FARM_Y && y < FARM_Y + FARM_H;
}

export function generateTerrain(seed: number): Terrain {
  const kind: TerrainKind[] = new Array(WORLD_W * WORLD_H);
  const variant: number[] = new Array(WORLD_W * WORLD_H);
  const solid = new Uint8Array(WORLD_W * WORLD_H);
  const props: PropEntity[] = [];

  for (let y = 0; y < WORLD_H; y += 1) {
    for (let x = 0; x < WORLD_W; x += 1) {
      const index = y * WORLD_W + x;
      const n = smoothNoise(x, y, seed, 7);
      const detail = hash2(x, y, seed + 99);

      if (x < 4 && smoothNoise(x, y, seed + 21, 5) > 0.34) {
        kind[index] = "water";
        solid[index] = 1;
      } else if (x < 6 && smoothNoise(x, y, seed + 21, 5) > 0.26) {
        kind[index] = "sand";
      } else if (inFarm(x, y)) {
        kind[index] = "farm";
      } else if (n > 0.72 && !inFarm(x, y)) {
        kind[index] = "stone";
      } else {
        kind[index] = detail > 0.58 ? "grass-alt" : "grass";
      }
      variant[index] = Math.floor(detail * 4);
    }
  }

  // A dirt road from the west bridge to the farmyard, then south to market.
  const roadY = FARM_Y + FARM_H + 3;
  for (let x = 6; x < WORLD_W - 3; x += 1) {
    const index = roadY * WORLD_W + x;
    kind[index] = "path";
    kind[index - WORLD_W] = "path";
  }
  for (let y = FARM_Y - 4; y < roadY; y += 1) {
    const index = y * WORLD_W + (FARM_X - 3);
    if (kind[index] !== "water") kind[index] = "path";
  }

  // Trees and rocks outside the farm and off the road.
  for (let y = 1; y < WORLD_H - 1; y += 1) {
    for (let x = 1; x < WORLD_W - 1; x += 1) {
      const index = y * WORLD_W + x;
      const onFenceRing =
        x >= FARM_X - 1 && x <= FARM_X + FARM_W && y >= FARM_Y - 1 && y <= FARM_Y + FARM_H;
      if (onFenceRing || kind[index] === "path" || kind[index] === "water" || kind[index] === "sand") continue;
      const roll = hash2(x, y, seed + 400);
      const density = smoothNoise(x, y, seed + 500, 9);

      if (roll > 0.94 - density * 0.16) {
        const pine = smoothNoise(x, y, seed + 600, 12) > 0.55;
        props.push({ kind: pine ? "pine" : "tree", x, y, variant: Math.floor(roll * 3) });
        solid[index] = 1;
      } else if (roll > 0.9) {
        props.push({ kind: "rock", x, y, variant: Math.floor(roll * 3) });
        solid[index] = 1;
      } else if (roll > 0.86) {
        props.push({ kind: "bush", x, y, variant: Math.floor(roll * 3) });
      } else if (roll > 0.8) {
        props.push({ kind: "flower", x, y, variant: Math.floor(roll * 4) });
      }
    }
  }

  // Placed as a farmyard hugging the west and north edges of the field. In an
  // isometric projection anything more than a few tiles away leaves the frame,
  // so these sit deliberately tight to the plots.
  const buildings: BuildingEntity[] = [
    { id: "house", x: FARM_X - 2, y: FARM_Y, w: 1, h: 1 },
    { id: "barn", x: FARM_X - 2, y: FARM_Y + 2, w: 1, h: 1 },
    { id: "shed", x: FARM_X - 2, y: FARM_Y + 4, w: 1, h: 1 },
    { id: "well", x: FARM_X - 1, y: FARM_Y + 6, w: 1, h: 1 },
    { id: "market", x: FARM_X + 2, y: FARM_Y - 2, w: 1, h: 1 },
    { id: "silo", x: FARM_X + 4, y: FARM_Y - 2, w: 1, h: 1, requiresUpgrade: "silo" },
    { id: "greenhouse", x: FARM_X + 6, y: FARM_Y - 2, w: 1, h: 1, requiresUpgrade: "greenhouse" },
    { id: "windmill", x: FARM_X - 2, y: FARM_Y - 2, w: 1, h: 1, requiresUpgrade: "windmill" },
  ];


  // Fence the farm rectangle so the play space reads as a farm, not a field.
  for (let x = FARM_X - 1; x <= FARM_X + FARM_W; x += 1) {
    props.push({ kind: "fence-h", x, y: FARM_Y - 1, variant: 0 });
    props.push({ kind: "fence-h", x, y: FARM_Y + FARM_H, variant: 0 });
  }
  const gateY = FARM_Y + 4;
  for (let y = FARM_Y; y < FARM_Y + FARM_H; y += 1) {
    if (y !== gateY) props.push({ kind: "fence-v", x: FARM_X - 1, y, variant: 0 });
    props.push({ kind: "fence-v", x: FARM_X + FARM_W, y, variant: 0 });
  }
  props.push({ kind: "post", x: FARM_X - 1, y: gateY, variant: 0 });
  props.push({ kind: "lantern", x: FARM_X - 2, y: FARM_Y - 1, variant: 0 });
  props.push({ kind: "lantern", x: FARM_X + FARM_W + 1, y: FARM_Y + FARM_H, variant: 0 });
  props.push({ kind: "lantern", x: FARM_X - 4, y: FARM_Y + 5, variant: 0 });
  props.push({ kind: "sign", x: FARM_X - 3, y: FARM_Y + FARM_H + 1, variant: 0 });

  for (const building of buildings) {
    for (let y = building.y; y < building.y + building.h; y += 1) {
      for (let x = building.x; x < building.x + building.w; x += 1) {
        const index = y * WORLD_W + x;
        if (index >= 0 && index < solid.length) solid[index] = 1;
      }
    }
  }

  return { kind, variant, solid, props, buildings };
}

/* -------------------------------------------------------------------------- */
/* Plots                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Field expansions open concentric blocks outward from the farmyard gate, so
 * every upgrade visibly widens the working area instead of adding a stray row.
 */
export function unlockedPlotBounds(fieldLevel: number) {
  const level = Math.max(1, Math.min(6, fieldLevel));
  const width = Math.min(FARM_W, 6 + (level - 1) * 4);
  const height = Math.min(FARM_H, 5 + (level - 1) * 3);
  return { x: FARM_X, y: FARM_Y, w: width, h: height };
}

export function isPlotUnlocked(plotX: number, plotY: number, fieldLevel: number) {
  const bounds = unlockedPlotBounds(fieldLevel);
  return plotX >= bounds.x && plotX < bounds.x + bounds.w && plotY >= bounds.y && plotY < bounds.y + bounds.h;
}

export function createPlot(x: number, y: number): Plot {
  return {
    x,
    y,
    tilled: false,
    moisture: 0,
    fertility: 0.2,
    crop: null,
    growth: 0,
    stress: 0,
    regrowAt: null,
    dead: false,
    quality: 0,
  };
}

export function plotKey(x: number, y: number) {
  return y * WORLD_W + x;
}

export function buildPlotIndex(plots: Plot[]): Map<number, Plot> {
  const map = new Map<number, Plot>();
  for (const plot of plots) map.set(plotKey(plot.x, plot.y), plot);
  return map;
}

/* -------------------------------------------------------------------------- */
/* Save creation and migration                                                 */
/* -------------------------------------------------------------------------- */

export function createFarmSave(uid: string, displayName: string, avatarUrl: string | null): FarmSaveV2 {
  let numericSeed = 0;
  for (let i = 0; i < uid.length; i += 1) numericSeed = (numericSeed * 31 + uid.charCodeAt(i)) | 0;

  return {
    version: 2,
    uid,
    displayName,
    avatarUrl,
    seed: Math.abs(numericSeed) % 100000 || 1337,

    day: 1,
    minute: 6 * 60,
    weather: "clear",
    windAngle: 0.6,
    windSpeed: 0.5,

    coins: 350,
    xp: 0,
    energy: 120,
    maxEnergy: 120,

    selectedCrop: "wheat",
    seeds: { wheat: 14, carrot: 6 },
    plots: [],
    barn: [],
    workers: [],
    upgrades: { field: 1, wateringCan: 1, house: 1, barn: 1 },

    storyStep: 0,
    storyProgress: {},
    activeEvent: null,

    // On the yard path level with the field gate, clear of every building
    // footprint (`nearestFreePoint` is the runtime safety net for old saves).
    playerX: (FARM_X - 3) * TILE,
    playerY: (FARM_Y + 4) * TILE,

    stats: {
      tilled: 0,
      planted: 0,
      harvested: 0,
      watered: 0,
      coinsEarned: 0,
      coinsSpent: 0,
      daysPlayed: 1,
      harshDays: 0,
      eventsSeen: 0,
      cropsLost: 0,
      bestSale: 0,
    },
    lastPlayedAt: Date.now(),
  };
}

/** Accepts both v1 and v2 documents so old beta saves are never thrown away. */
export function normalizeFarmSave(
  raw: unknown,
  uid: string,
  displayName: string,
  avatarUrl: string | null
): FarmSaveV2 {
  const base = createFarmSave(uid, displayName, avatarUrl);
  if (!raw || typeof raw !== "object") return base;
  const data = raw as Record<string, unknown>;

  if (data.version !== 2) {
    // v1 beta save: carry the meaningful economy forward, rebuild the world.
    const legacyStats = (data.stats || {}) as Record<string, number>;
    return {
      ...base,
      day: clampNumber(data.day, 1, 1, 100000),
      coins: clampNumber(data.coins, base.coins, 0, 1e9),
      xp: clampNumber(data.xp, 0, 0, 1e9),
      seeds: { ...base.seeds, ...(typeof data.seeds === "object" ? (data.seeds as Partial<Record<CropId, number>>) : {}) },
      stats: {
        ...base.stats,
        planted: clampNumber(legacyStats.planted, 0, 0, 1e9),
        harvested: clampNumber(legacyStats.harvested, 0, 0, 1e9),
        coinsEarned: clampNumber(legacyStats.coinsEarned, 0, 0, 1e9),
        eventsSeen: clampNumber(legacyStats.eventsSeen, 0, 0, 1e9),
      },
    };
  }

  const plots = Array.isArray(data.plots)
    ? (data.plots as Plot[])
        .filter((plot) => plot && Number.isFinite(plot.x) && Number.isFinite(plot.y))
        .map((plot) => ({
          ...createPlot(plot.x, plot.y),
          ...plot,
          crop: plot.crop && CROPS[plot.crop as CropId] ? plot.crop : null,
        }))
    : [];

  return {
    ...base,
    ...(data as Partial<FarmSaveV2>),
    version: 2,
    uid,
    displayName,
    avatarUrl,
    plots,
    seeds: { ...base.seeds, ...(typeof data.seeds === "object" ? (data.seeds as Partial<Record<CropId, number>>) : {}) },
    upgrades: { ...base.upgrades, ...(typeof data.upgrades === "object" ? (data.upgrades as Partial<Record<UpgradeId, number>>) : {}) },
    stats: { ...base.stats, ...(typeof data.stats === "object" ? (data.stats as Partial<FarmStats>) : {}) },
    storyProgress: typeof data.storyProgress === "object" ? (data.storyProgress as Record<string, number>) : {},
    barn: Array.isArray(data.barn) ? (data.barn as BarnItem[]) : [],
    workers: Array.isArray(data.workers) ? (data.workers as FarmSaveV2["workers"]) : [],
    minute: clampNumber(data.minute, 6 * 60, 0, MINUTES_PER_DAY - 1),
    day: clampNumber(data.day, 1, 1, 100000),
  };
}

function clampNumber(value: unknown, fallback: number, min: number, max: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

export function totalBarnCount(barn: BarnItem[]) {
  return barn.reduce((sum, item) => sum + item.count, 0);
}

export function barnCapacity(barnLevel: number) {
  return 60 + Math.max(0, barnLevel - 1) * 70;
}

export function seasonProgressLabel(day: number) {
  const inSeason = ((day - 1) % DAYS_PER_SEASON) + 1;
  return `${inSeason}/${DAYS_PER_SEASON}`;
}
