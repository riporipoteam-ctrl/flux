/**
 * Flux Farm — simulation.
 *
 * A pure-ish step function: `advance(state, dtSeconds)` moves in-game time,
 * grows crops, drains soil, rolls weather and world events, pays wages, runs
 * farmhand AI and emits a queue of events the React layer turns into HUD
 * toasts and sound effects. Nothing here touches the DOM.
 */

import {
  CROPS,
  MINUTES_PER_DAY,
  QUALITY_LABELS,
  STORY,
  UPGRADES,
  WEATHER_INFO,
  WORKERS,
  WORLD_EVENTS,
  cropInSeason,
  cropValue,
  dayOfSeason,
  TILE,
  rankForXp,
  seasonForDay,
  seedPrice,
  type CropId,
  type Season,
  type UpgradeId,
  type Weather,
  type WorkerId,
} from "./content";
import {
  FARM_H,
  FARM_W,
  FARM_X,
  FARM_Y,
  barnCapacity,
  buildPlotIndex,
  createPlot,
  generateTerrain,
  hash2,
  isPlotUnlocked,
  plotKey,
  totalBarnCount,
  unlockedPlotBounds,
  type BarnItem,
  type FarmSaveV2,
  type Plot,
  type Terrain,
  type WorkerEntity,
} from "./world";

/** Real seconds per in-game minute at 1× speed. */
const SECONDS_PER_GAME_MINUTE = 0.32;

export type GameEventKind =
  | "till"
  | "plant"
  | "water"
  | "harvest"
  | "sell"
  | "levelup"
  | "day"
  | "season"
  | "weather"
  | "worldevent"
  | "story"
  | "wither"
  | "purchase"
  | "hire"
  | "deny"
  | "energy";

export interface GameEvent {
  kind: GameEventKind;
  message?: string;
  detail?: string;
  x?: number;
  y?: number;
  value?: number;
  crop?: CropId;
}

export interface FarmRuntime {
  save: FarmSaveV2;
  terrain: Terrain;
  plotIndex: Map<number, Plot>;
  workers: WorkerEntity[];
  player: {
    x: number;
    y: number;
    vx: number;
    vy: number;
    facing: 0 | 1 | 2 | 3;
    moving: boolean;
    phase: number;
    action: { kind: "till" | "water" | "plant" | "harvest"; timer: number } | null;
  };
  events: GameEvent[];
  /** Fractional in-game minutes carried between frames. */
  minuteAccumulator: number;
  /** Wind gust phase for the renderer and audio. */
  windPhase: number;
  paused: boolean;
  speed: number;
}

/* -------------------------------------------------------------------------- */
/* Construction                                                                */
/* -------------------------------------------------------------------------- */

export function createRuntime(save: FarmSaveV2): FarmRuntime {
  const terrain = generateTerrain(save.seed);

  // Materialise every unlocked plot so the field is always a complete grid.
  const index = buildPlotIndex(save.plots);
  const field = save.upgrades.field ?? 1;
  const bounds = unlockedPlotBounds(field);
  for (let y = bounds.y; y < bounds.y + bounds.h; y += 1) {
    for (let x = bounds.x; x < bounds.x + bounds.w; x += 1) {
      const key = plotKey(x, y);
      if (!index.has(key)) {
        const plot = createPlot(x, y);
        index.set(key, plot);
        save.plots.push(plot);
      }
    }
  }

  const workers: WorkerEntity[] = save.workers
    .filter((worker) => worker.hired && WORKERS[worker.id])
    .map((worker, i) => ({
      id: worker.id,
      x: (FARM_X - 5 + i) * TILE,
      y: (FARM_Y + 12) * TILE,
      targetX: (FARM_X - 5 + i) * TILE,
      targetY: (FARM_Y + 12) * TILE,
      cooldown: 0,
      phase: Math.random() * 6,
      facing: 0,
      busy: false,
    }));

  // A save written before a building existed — or by an older layout — can
  // place the player inside a solid tile, which would wedge them permanently.
  const spawn = nearestFreePoint(terrain, save.playerX, save.playerY);
  save.playerX = spawn.x;
  save.playerY = spawn.y;

  return {
    save,
    terrain,
    plotIndex: index,
    workers,
    player: {
      x: save.playerX,
      y: save.playerY,
      vx: 0,
      vy: 0,
      facing: 0,
      moving: false,
      phase: 0,
      action: null,
    },
    events: [],
    minuteAccumulator: 0,
    windPhase: 0,
    paused: false,
    speed: 1,
  };
}

/** Spiral out from a point until a walkable tile is found. */
function nearestFreePoint(terrain: Terrain, x: number, y: number) {
  const startX = Math.floor(x / TILE);
  const startY = Math.floor(y / TILE);
  const free = (tx: number, ty: number) =>
    tx >= 1 && ty >= 1 && tx < 47 && ty < 35 && !terrain.solid[ty * 48 + tx];

  if (free(startX, startY)) return { x, y };

  for (let radius = 1; radius < 20; radius += 1) {
    for (let dy = -radius; dy <= radius; dy += 1) {
      for (let dx = -radius; dx <= radius; dx += 1) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== radius) continue;
        if (free(startX + dx, startY + dy)) {
          return { x: (startX + dx) * TILE, y: (startY + dy) * TILE };
        }
      }
    }
  }
  return { x: FARM_X * TILE, y: (FARM_Y + 2) * TILE };
}

/* -------------------------------------------------------------------------- */
/* Derived state                                                               */
/* -------------------------------------------------------------------------- */

export function upgradeLevel(save: FarmSaveV2, id: UpgradeId) {
  return save.upgrades[id] ?? 0;
}

export function activeEventInfo(save: FarmSaveV2) {
  if (!save.activeEvent) return null;
  const info = WORLD_EVENTS.find((entry) => entry.id === save.activeEvent?.id);
  if (!info) return null;
  if (save.day > save.activeEvent.endsOnDay) return null;
  return info;
}

export function isNight(minute: number) {
  return minute < 5 * 60 + 30 || minute >= 19 * 60 + 30;
}

/** 0 at midnight, 1 at midday — drives the renderer's lighting curve. */
export function dayFactor(minute: number) {
  const t = (minute / MINUTES_PER_DAY) * Math.PI * 2;
  return Math.max(0, Math.sin(t - Math.PI / 2) * 0.5 + 0.5);
}

export function formatClock(minute: number) {
  const safe = ((Math.floor(minute) % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  const hours24 = Math.floor(safe / 60);
  const minutes = safe % 60;
  const suffix = hours24 >= 12 ? "PM" : "AM";
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  return `${hours12}:${String(minutes).padStart(2, "0")} ${suffix}`;
}

export function growthRequirement(crop: CropId) {
  return CROPS[crop].growHours;
}

export function plotAt(runtime: FarmRuntime, x: number, y: number) {
  return runtime.plotIndex.get(plotKey(x, y)) ?? null;
}

export function tileUnderPlayer(runtime: FarmRuntime) {
  return {
    x: Math.floor((runtime.player.x + TILE / 2) / TILE),
    y: Math.floor((runtime.player.y + TILE / 2) / TILE),
  };
}

/** The tile the player is facing — the target for tool actions. */
export function facingTile(runtime: FarmRuntime) {
  const base = tileUnderPlayer(runtime);
  const offsets = [
    { x: 0, y: 1 },
    { x: -1, y: 0 },
    { x: 1, y: 0 },
    { x: 0, y: -1 },
  ];
  const offset = offsets[runtime.player.facing];
  return { x: base.x + offset.x, y: base.y + offset.y };
}

/* -------------------------------------------------------------------------- */
/* Weather + events                                                            */
/* -------------------------------------------------------------------------- */

function rollWeather(day: number, seed: number, season: Season): Weather {
  const candidates = (Object.keys(WEATHER_INFO) as Weather[]).filter((weather) =>
    WEATHER_INFO[weather].seasons.includes(season)
  );
  const total = candidates.reduce((sum, weather) => sum + WEATHER_INFO[weather].weight, 0);
  let roll = hash2(day, season.length, seed + 7331) * total;
  for (const weather of candidates) {
    roll -= WEATHER_INFO[weather].weight;
    if (roll <= 0) return weather;
  }
  return candidates[0] ?? "clear";
}

function rollWorldEvent(save: FarmSaveV2, season: Season) {
  const rank = rankForXp(save.xp).rank;
  const pool = WORLD_EVENTS.filter(
    (event) => (!event.seasons || event.seasons.includes(season)) && (!event.minRank || rank >= event.minRank)
  );
  if (!pool.length) return null;
  const chance = hash2(save.day, 17, save.seed + 991);
  if (chance > 0.34) return null;
  const pick = pool[Math.floor(hash2(save.day, 43, save.seed + 555) * pool.length) % pool.length];
  return pick;
}

/* -------------------------------------------------------------------------- */
/* Actions                                                                     */
/* -------------------------------------------------------------------------- */

const ENERGY_COST = { till: 3, plant: 1, water: 1.5, harvest: 1 };

function spendEnergy(runtime: FarmRuntime, amount: number) {
  if (runtime.save.energy < amount) {
    runtime.events.push({ kind: "energy", message: "Too tired — sleep at the farmhouse to restore energy." });
    return false;
  }
  runtime.save.energy = Math.max(0, runtime.save.energy - amount);
  return true;
}

export function tryTill(runtime: FarmRuntime, x: number, y: number): boolean {
  const field = upgradeLevel(runtime.save, "field");
  if (!isPlotUnlocked(x, y, field)) {
    runtime.events.push({ kind: "deny", message: "That ground is not yours yet. Buy a field expansion." });
    return false;
  }
  const plot = plotAt(runtime, x, y);
  if (!plot || plot.tilled) return false;
  if (!spendEnergy(runtime, ENERGY_COST.till)) return false;

  plot.tilled = true;
  plot.moisture = Math.max(plot.moisture, 0.1);
  runtime.save.stats.tilled += 1;
  runtime.events.push({ kind: "till", x, y });
  return true;
}

export function tryPlant(runtime: FarmRuntime, x: number, y: number, crop?: CropId): boolean {
  const chosen = crop ?? runtime.save.selectedCrop;
  const plot = plotAt(runtime, x, y);
  if (!plot || !plot.tilled || plot.crop) return false;

  const owned = runtime.save.seeds[chosen] ?? 0;
  if (owned <= 0) {
    runtime.events.push({ kind: "deny", message: `No ${CROPS[chosen].name} seeds left. Buy more from the shop.` });
    return false;
  }
  const season = seasonForDay(runtime.save.day);
  if (!cropInSeason(chosen, season, upgradeLevel(runtime.save, "greenhouse"))) {
    runtime.events.push({
      kind: "deny",
      message: `${CROPS[chosen].name} will not grow in ${season}. Build a greenhouse to ignore seasons.`,
    });
    return false;
  }
  if (!spendEnergy(runtime, ENERGY_COST.plant)) return false;

  runtime.save.seeds[chosen] = owned - 1;
  plot.crop = chosen;
  plot.growth = 0;
  plot.stress = 0;
  plot.dead = false;
  plot.regrowAt = null;
  plot.quality = 0;
  runtime.save.stats.planted += 1;
  runtime.events.push({ kind: "plant", x, y, crop: chosen });
  return true;
}

export function tryWater(runtime: FarmRuntime, x: number, y: number): boolean {
  const radius = Math.max(0, upgradeLevel(runtime.save, "wateringCan") - 1);
  let watered = 0;

  for (let dy = -radius; dy <= radius; dy += 1) {
    for (let dx = -radius; dx <= radius; dx += 1) {
      const plot = plotAt(runtime, x + dx, y + dy);
      if (!plot || !plot.tilled || plot.moisture >= 0.95) continue;
      plot.moisture = 1;
      plot.stress = Math.max(0, plot.stress - 4);
      watered += 1;
    }
  }

  if (!watered) return false;
  if (!spendEnergy(runtime, ENERGY_COST.water)) return false;
  runtime.save.stats.watered += watered;
  runtime.events.push({ kind: "water", x, y, value: watered });
  return true;
}

export function tryHarvest(runtime: FarmRuntime, x: number, y: number): boolean {
  const plot = plotAt(runtime, x, y);
  if (!plot || !plot.crop) return false;

  if (plot.dead) {
    plot.crop = null;
    plot.dead = false;
    plot.growth = 0;
    plot.stress = 0;
    runtime.events.push({ kind: "harvest", x, y, value: 0, message: "Cleared the withered plant." });
    return true;
  }

  const info = CROPS[plot.crop];
  if (plot.growth < info.growHours) return false;
  if (!spendEnergy(runtime, ENERGY_COST.harvest)) return false;

  const capacity = barnCapacity(upgradeLevel(runtime.save, "barn"));
  if (totalBarnCount(runtime.save.barn) >= capacity) {
    runtime.events.push({ kind: "deny", message: "The barn is full. Sell the harvest or upgrade the barn." });
    return false;
  }

  const quality = plot.quality;
  addToBarn(runtime.save, plot.crop, quality, 1);

  const eventInfo = activeEventInfo(runtime.save);
  const xpMultiplier = eventInfo?.xpMultiplier ?? 1;
  const nightBonus = isNight(runtime.save.minute) && eventInfo?.id === "lantern-night" ? 1.2 : 1;
  const gained = Math.round(info.xp * (1 + quality * 0.25) * xpMultiplier * nightBonus);
  grantXp(runtime, gained);

  runtime.save.stats.harvested += 1;
  runtime.events.push({
    kind: "harvest",
    x,
    y,
    crop: plot.crop,
    value: gained,
    detail: quality > 0 ? QUALITY_LABELS[Math.min(QUALITY_LABELS.length - 1, quality)] : undefined,
  });

  if (info.regrow) {
    plot.growth = Math.max(0, info.growHours - info.regrow);
    plot.quality = Math.max(0, quality - 1);
  } else {
    plot.crop = null;
    plot.growth = 0;
    plot.quality = 0;
    plot.tilled = true;
  }
  plot.stress = 0;
  return true;
}

export function addToBarn(save: FarmSaveV2, crop: CropId, quality: number, count: number) {
  const existing = save.barn.find((item) => item.crop === crop && item.quality === quality);
  if (existing) existing.count += count;
  else save.barn.push({ crop, quality, count });
}

export function sellBarn(runtime: FarmRuntime): number {
  const { save } = runtime;
  if (!save.barn.length) {
    runtime.events.push({ kind: "deny", message: "The barn is empty." });
    return 0;
  }

  const eventInfo = activeEventInfo(save);
  const priceMultiplier = eventInfo?.priceMultiplier ?? 1;
  const windBonus = upgradeLevel(save, "windmill") > 0 ? Math.min(0.25, save.windSpeed * 0.06 * upgradeLevel(save, "windmill")) : 0;
  const market = upgradeLevel(save, "market");

  let total = 0;
  for (const item of save.barn) {
    total += cropValue(item.crop, item.quality, market, priceMultiplier, windBonus) * item.count;
  }

  save.barn = [];
  save.coins += total;
  save.stats.coinsEarned += total;
  save.stats.bestSale = Math.max(save.stats.bestSale, total);
  grantXp(runtime, Math.round(total * 0.05));
  runtime.events.push({ kind: "sell", value: total, message: `Sold the barn for ${total.toLocaleString()} coins` });
  return total;
}

export function buySeeds(runtime: FarmRuntime, crop: CropId, count: number): boolean {
  const { save } = runtime;
  const rank = rankForXp(save.xp).rank;
  if (rank < CROPS[crop].unlockRank) {
    runtime.events.push({ kind: "deny", message: `${CROPS[crop].name} unlocks at rank ${CROPS[crop].unlockRank}.` });
    return false;
  }
  const eventInfo = activeEventInfo(save);
  const unit = seedPrice(crop, upgradeLevel(save, "silo"), eventInfo?.seedDiscount ?? 0);
  const total = unit * count;
  if (save.coins < total) {
    runtime.events.push({ kind: "deny", message: "Not enough coins." });
    return false;
  }
  save.coins -= total;
  save.stats.coinsSpent += total;
  save.seeds[crop] = (save.seeds[crop] ?? 0) + count;
  runtime.events.push({ kind: "purchase", message: `Bought ${count}× ${CROPS[crop].name} seeds`, value: total });
  return true;
}

export function buyUpgrade(runtime: FarmRuntime, id: UpgradeId): boolean {
  const { save } = runtime;
  const info = UPGRADES[id];
  const level = upgradeLevel(save, id);
  if (level >= info.maxLevel) return false;

  const rank = rankForXp(save.xp).rank;
  if (rank < info.unlockRank) {
    runtime.events.push({ kind: "deny", message: `${info.name} unlocks at rank ${info.unlockRank}.` });
    return false;
  }

  const cost = info.cost(level + 1);
  if (save.coins < cost) {
    runtime.events.push({ kind: "deny", message: "Not enough coins." });
    return false;
  }

  save.coins -= cost;
  save.stats.coinsSpent += cost;
  save.upgrades[id] = level + 1;
  grantXp(runtime, Math.round(cost * 0.08));

  if (id === "field") openNewPlots(runtime);
  if (id === "house") save.maxEnergy = 120 + (level + 1 - 1) * 45;

  runtime.events.push({ kind: "purchase", message: `${info.name} upgraded to level ${level + 1}`, value: cost });
  return true;
}

function openNewPlots(runtime: FarmRuntime) {
  const bounds = unlockedPlotBounds(upgradeLevel(runtime.save, "field"));
  for (let y = bounds.y; y < bounds.y + bounds.h; y += 1) {
    for (let x = bounds.x; x < bounds.x + bounds.w; x += 1) {
      const key = plotKey(x, y);
      if (!runtime.plotIndex.has(key)) {
        const plot = createPlot(x, y);
        runtime.plotIndex.set(key, plot);
        runtime.save.plots.push(plot);
      }
    }
  }
}

export function hireWorker(runtime: FarmRuntime, id: WorkerId): boolean {
  const { save } = runtime;
  const info = WORKERS[id];
  if (save.workers.some((worker) => worker.id === id && worker.hired)) return false;

  const rank = rankForXp(save.xp).rank;
  if (rank < info.unlockRank) {
    runtime.events.push({ kind: "deny", message: `${info.name} will only work for a rank ${info.unlockRank} farmer.` });
    return false;
  }
  if (save.coins < info.cost) {
    runtime.events.push({ kind: "deny", message: "Not enough coins for the signing fee." });
    return false;
  }

  save.coins -= info.cost;
  save.stats.coinsSpent += info.cost;
  save.workers = save.workers.filter((worker) => worker.id !== id);
  save.workers.push({ id, hired: true, hiredDay: save.day });
  runtime.workers.push({
    id,
    x: (FARM_X - 4) * TILE,
    y: (FARM_Y + 10) * TILE,
    targetX: (FARM_X - 4) * TILE,
    targetY: (FARM_Y + 10) * TILE,
    cooldown: 0,
    phase: Math.random() * 6,
    facing: 0,
    busy: false,
  });
  runtime.events.push({ kind: "hire", message: `${info.name} joined the farm`, detail: info.role });
  return true;
}

export function sleep(runtime: FarmRuntime) {
  const { save } = runtime;
  const minutesToDawn = save.minute < 6 * 60 ? 6 * 60 - save.minute : MINUTES_PER_DAY - save.minute + 6 * 60;
  advanceMinutes(runtime, minutesToDawn);
  save.energy = save.maxEnergy;
  runtime.events.push({ kind: "energy", message: "Rested until dawn. Energy restored." });
}

export function grantXp(runtime: FarmRuntime, amount: number) {
  if (amount <= 0) return;
  const before = rankForXp(runtime.save.xp).rank;
  runtime.save.xp += amount;
  const after = rankForXp(runtime.save.xp);
  if (after.rank > before) {
    runtime.events.push({
      kind: "levelup",
      message: `Rank ${after.rank} — ${after.title}`,
      detail: "New seeds, upgrades and farmhands may be available.",
      value: after.rank,
    });
  }
}

/* -------------------------------------------------------------------------- */
/* Story                                                                       */
/* -------------------------------------------------------------------------- */

function storyObjectiveMet(save: FarmSaveV2, step: number): boolean {
  const rank = rankForXp(save.xp).rank;
  switch (STORY[step]?.id) {
    case "arrival":
      return save.stats.tilled >= 6;
    case "first-seed":
      return save.stats.planted >= 8;
    case "first-harvest":
      return save.stats.harvested >= 10;
    case "market-day":
      return save.stats.coinsEarned >= 900;
    case "more-hands":
      return save.workers.some((worker) => worker.hired);
    case "beyond-fence":
      return (save.upgrades.field ?? 1) >= 2;
    case "weathered":
      return save.stats.harshDays >= 5;
    case "four-seasons":
      return save.day >= 45;
    case "estate":
      return (save.upgrades.greenhouse ?? 0) >= 1 && (save.upgrades.sprinklers ?? 0) >= 1;
    case "legend":
      return rank >= 12;
    default:
      return false;
  }
}

function checkStory(runtime: FarmRuntime) {
  const { save } = runtime;
  while (save.storyStep < STORY.length && storyObjectiveMet(save, save.storyStep)) {
    const chapter = STORY[save.storyStep];
    save.coins += chapter.reward.coins;
    save.stats.coinsEarned += chapter.reward.coins;
    grantXp(runtime, chapter.reward.xp);
    for (const [crop, count] of Object.entries(chapter.reward.seeds ?? {})) {
      save.seeds[crop as CropId] = (save.seeds[crop as CropId] ?? 0) + (count ?? 0);
    }
    save.storyStep += 1;
    runtime.events.push({
      kind: "story",
      message: `Chapter complete — ${chapter.title}`,
      detail: `+${chapter.reward.coins} coins · +${chapter.reward.xp} XP`,
    });
  }
}

/* -------------------------------------------------------------------------- */
/* Time                                                                        */
/* -------------------------------------------------------------------------- */

function growPlots(runtime: FarmRuntime, hours: number) {
  const { save } = runtime;
  const season = seasonForDay(save.day);
  const weather = WEATHER_INFO[save.weather];
  const eventInfo = activeEventInfo(save);
  const greenhouse = upgradeLevel(save, "greenhouse");
  const well = upgradeLevel(save, "well");
  const moistureRetention = 1 - Math.min(0.6, well * 0.15);
  const seasonGrowth = greenhouse > 0 ? Math.max(0.85, SEASON_GROWTH[season]) : SEASON_GROWTH[season];
  const globalGrowth = weather.growth * seasonGrowth * (eventInfo?.growthMultiplier ?? 1);

  for (const plot of save.plots) {
    if (!plot.tilled) continue;

    // Soil moisture: weather adds or removes, crops drink.
    const drink = plot.crop ? CROPS[plot.crop].thirst * 0.06 : 0.02;
    const delta = (weather.moisture * 0.02 - drink) * hours * moistureRetention;
    plot.moisture = Math.max(0, Math.min(1, plot.moisture + delta));

    if (!plot.crop || plot.dead) continue;

    const info = CROPS[plot.crop];
    const inSeason = cropInSeason(plot.crop, season, greenhouse);
    if (!inSeason) {
      plot.stress += hours * 0.5;
    } else if (plot.moisture > 0.12) {
      const moistureFactor = 0.55 + plot.moisture * 0.65;
      plot.growth = Math.min(info.growHours, plot.growth + hours * globalGrowth * moistureFactor);
      plot.stress = Math.max(0, plot.stress - hours * 0.4);
      // Consistently damp, fertile soil raises harvest quality.
      plot.fertility = Math.min(1, plot.fertility + hours * 0.004 * plot.moisture);
      plot.quality = plot.fertility > 0.85 ? 3 : plot.fertility > 0.62 ? 2 : plot.fertility > 0.38 ? 1 : 0;
    } else {
      plot.stress += hours;
    }

    if (plot.stress > 26) {
      plot.dead = true;
      save.stats.cropsLost += 1;
      runtime.events.push({ kind: "wither", x: plot.x, y: plot.y, crop: plot.crop });
    }
  }
}

const SEASON_GROWTH: Record<Season, number> = {
  spring: 1.1,
  summer: 1.25,
  autumn: 0.85,
  winter: 0.4,
};

function startNewDay(runtime: FarmRuntime) {
  const { save } = runtime;
  save.day += 1;
  save.stats.daysPlayed += 1;
  save.energy = Math.min(save.maxEnergy, save.energy + Math.round(save.maxEnergy * 0.35));

  const previousSeason = seasonForDay(save.day - 1);
  const season = seasonForDay(save.day);
  const previousWeather = save.weather;
  save.weather = rollWeather(save.day, save.seed, season);
  save.windSpeed = WEATHER_INFO[save.weather].wind * (0.7 + hash2(save.day, 3, save.seed) * 0.6);
  save.windAngle = hash2(save.day, 11, save.seed) * Math.PI * 2;

  if (season !== previousSeason) {
    runtime.events.push({ kind: "season", message: `${season[0].toUpperCase()}${season.slice(1)} begins`, detail: `Day ${dayOfSeason(save.day)} of the season` });
  }
  if (save.weather !== previousWeather) {
    runtime.events.push({
      kind: "weather",
      message: WEATHER_INFO[save.weather].name,
      detail: WEATHER_INFO[save.weather].description,
    });
  }
  if (WEATHER_INFO[save.weather].hazard > 0) save.stats.harshDays += 1;

  // World events expire, then a new one may roll in.
  if (save.activeEvent && save.day > save.activeEvent.endsOnDay) save.activeEvent = null;
  if (!save.activeEvent) {
    const next = rollWorldEvent(save, season);
    if (next) {
      save.activeEvent = { id: next.id, endsOnDay: save.day + next.days - 1 };
      save.stats.eventsSeen += 1;
      runtime.events.push({ kind: "worldevent", message: `${next.emoji} ${next.name}`, detail: next.text });
    }
  }

  // Sprinklers water a block around the farmhouse gate each dawn.
  const sprinklers = upgradeLevel(save, "sprinklers");
  if (sprinklers > 0) {
    const reach = 1 + sprinklers;
    for (const plot of save.plots) {
      const withinX = Math.abs(plot.x - (FARM_X + 2)) <= reach + 1;
      const withinY = Math.abs(plot.y - (FARM_Y + 2)) <= reach + 1;
      if (plot.tilled && withinX && withinY) plot.moisture = 1;
    }
  }

  // Overnight hazards from weather and the active world event.
  const eventInfo = activeEventInfo(save);
  const hazard = WEATHER_INFO[save.weather].hazard + (eventInfo?.hazard ?? 0);
  if (hazard > 0) {
    let lost = 0;
    for (const plot of save.plots) {
      if (!plot.crop || plot.dead) continue;
      const protectedByGreenhouse = upgradeLevel(save, "greenhouse") > 0 && hash2(plot.x, plot.y, save.day) > 0.55;
      if (protectedByGreenhouse) continue;
      if (hash2(plot.x, plot.y, save.day + save.seed) < hazard) {
        plot.dead = true;
        lost += 1;
      }
    }
    if (lost > 0) {
      save.stats.cropsLost += lost;
      runtime.events.push({ kind: "wither", message: `${lost} crop${lost === 1 ? "" : "s"} lost overnight`, detail: WEATHER_INFO[save.weather].name });
    }
  }

  // Wages.
  const wages = save.workers
    .filter((worker) => worker.hired)
    .reduce((sum, worker) => sum + WORKERS[worker.id].wage, 0);
  if (wages > 0) {
    const paid = Math.min(save.coins, wages);
    save.coins -= paid;
    save.stats.coinsSpent += paid;
    if (paid < wages) {
      const quitting = save.workers.filter((worker) => worker.hired).pop();
      if (quitting) {
        quitting.hired = false;
        runtime.workers = runtime.workers.filter((worker) => worker.id !== quitting.id);
        runtime.events.push({ kind: "deny", message: `${WORKERS[quitting.id].name} left — wages went unpaid.` });
      }
    }
  }

  runtime.events.push({ kind: "day", message: `Day ${save.day}`, detail: `${WEATHER_INFO[save.weather].name} · ${season}` });
}

export function advanceMinutes(runtime: FarmRuntime, minutes: number) {
  const { save } = runtime;
  let remaining = minutes;

  while (remaining > 0) {
    const untilMidnight = MINUTES_PER_DAY - save.minute;
    const step = Math.min(remaining, untilMidnight);
    growPlots(runtime, step / 60);
    save.minute += step;
    remaining -= step;

    if (save.minute >= MINUTES_PER_DAY) {
      save.minute = 0;
      startNewDay(runtime);
    }
  }
  checkStory(runtime);
}

/* -------------------------------------------------------------------------- */
/* Farmhand AI                                                                 */
/* -------------------------------------------------------------------------- */

function findWorkerTask(runtime: FarmRuntime, job: string): Plot | null {
  const { save } = runtime;
  let best: Plot | null = null;
  let bestScore = -Infinity;

  for (const plot of save.plots) {
    let score = -Infinity;
    switch (job) {
      case "water":
        if (plot.tilled && plot.crop && !plot.dead && plot.moisture < 0.45) score = 1 - plot.moisture;
        break;
      case "harvest":
        if (plot.crop && !plot.dead && plot.growth >= CROPS[plot.crop].growHours) score = CROPS[plot.crop].sellPrice;
        else if (plot.dead) score = 1;
        break;
      case "plant":
        if (plot.tilled && !plot.crop) score = 1;
        break;
      case "till":
        if (!plot.tilled) score = 1;
        break;
      case "tend":
        if (plot.tilled && plot.fertility < 0.9) score = 1 - plot.fertility;
        break;
      default:
        score = -Infinity;
    }
    if (score > bestScore) {
      bestScore = score;
      best = plot;
    }
  }
  return bestScore > -Infinity ? best : null;
}

function stepWorkers(runtime: FarmRuntime, dt: number, gameHours: number) {
  for (const worker of runtime.workers) {
    const info = WORKERS[worker.id];
    worker.cooldown -= gameHours * info.speed;
    worker.phase += dt * 6;

    if (info.job === "haul") {
      // Juno empties the barn at dawn without needing to walk the field.
      if (runtime.save.minute > 6 * 60 && runtime.save.minute < 6 * 60 + 30 && runtime.save.barn.length > 8) {
        sellBarn(runtime);
      }
      continue;
    }

    const target = findWorkerTask(runtime, info.job);
    if (!target) {
      worker.busy = false;
      continue;
    }

    worker.busy = true;
    worker.targetX = target.x * TILE;
    worker.targetY = target.y * TILE;

    const dx = worker.targetX - worker.x;
    const dy = worker.targetY - worker.y;
    const distance = Math.hypot(dx, dy);
    const speed = 62 * dt;

    if (distance > 6) {
      worker.x += (dx / distance) * speed;
      worker.y += (dy / distance) * speed;
      worker.facing = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 2 : 1) : dy > 0 ? 0 : 3;
      continue;
    }

    if (worker.cooldown > 0) continue;
    worker.cooldown = 1;

    switch (info.job) {
      case "water":
        target.moisture = 1;
        target.stress = Math.max(0, target.stress - 4);
        runtime.save.stats.watered += 1;
        break;
      case "harvest": {
        const before = runtime.save.energy;
        runtime.save.energy = runtime.save.maxEnergy; // hired hands use their own stamina
        tryHarvest(runtime, target.x, target.y);
        runtime.save.energy = before;
        break;
      }
      case "plant": {
        const before = runtime.save.energy;
        runtime.save.energy = runtime.save.maxEnergy;
        tryPlant(runtime, target.x, target.y);
        runtime.save.energy = before;
        break;
      }
      case "till": {
        const before = runtime.save.energy;
        runtime.save.energy = runtime.save.maxEnergy;
        tryTill(runtime, target.x, target.y);
        runtime.save.energy = before;
        break;
      }
      case "tend":
        target.fertility = Math.min(1, target.fertility + 0.08);
        break;
      default:
        break;
    }
  }
}

/* -------------------------------------------------------------------------- */
/* Main step                                                                   */
/* -------------------------------------------------------------------------- */

export function advance(runtime: FarmRuntime, dt: number) {
  if (runtime.paused) return;
  const scaled = dt * runtime.speed;

  runtime.windPhase += scaled * (0.4 + runtime.save.windSpeed * 0.35);
  runtime.minuteAccumulator += scaled / SECONDS_PER_GAME_MINUTE;

  const minutes = Math.floor(runtime.minuteAccumulator);
  if (minutes > 0) {
    runtime.minuteAccumulator -= minutes;
    advanceMinutes(runtime, minutes);
  }

  stepWorkers(runtime, scaled, minutes / 60);

  runtime.save.playerX = runtime.player.x;
  runtime.save.playerY = runtime.player.y;
  runtime.save.lastPlayedAt = Date.now();
}

/* -------------------------------------------------------------------------- */
/* Movement                                                                    */
/* -------------------------------------------------------------------------- */

const PLAYER_SPEED = 118;
const PLAYER_RADIUS = 9;

export function movePlayer(runtime: FarmRuntime, inputX: number, inputY: number, dt: number) {
  const length = Math.hypot(inputX, inputY);
  if (length < 0.08) {
    runtime.player.moving = false;
    runtime.player.vx = 0;
    runtime.player.vy = 0;
    return;
  }

  const nx = inputX / length;
  const ny = inputY / length;
  const speed = PLAYER_SPEED * Math.min(1, length) * (runtime.save.energy > 0 ? 1 : 0.55);

  runtime.player.vx = nx * speed;
  runtime.player.vy = ny * speed;
  runtime.player.moving = true;
  runtime.player.phase += dt * (6 + Math.min(1, length) * 5);
  runtime.player.facing = Math.abs(nx) > Math.abs(ny) ? (nx > 0 ? 2 : 1) : ny > 0 ? 0 : 3;

  const nextX = runtime.player.x + runtime.player.vx * dt;
  const nextY = runtime.player.y + runtime.player.vy * dt;
  if (!blocked(runtime, nextX, runtime.player.y)) runtime.player.x = nextX;
  if (!blocked(runtime, runtime.player.x, nextY)) runtime.player.y = nextY;

  runtime.player.x = Math.max(TILE, Math.min((FARM_X + FARM_W + 8) * TILE, runtime.player.x));
  runtime.player.y = Math.max(TILE, Math.min((FARM_Y + FARM_H + 8) * TILE, runtime.player.y));
}

function blocked(runtime: FarmRuntime, x: number, y: number) {
  const centerX = x + TILE / 2;
  const centerY = y + TILE / 2;
  for (const [dx, dy] of [
    [-PLAYER_RADIUS, 0],
    [PLAYER_RADIUS, 0],
    [0, PLAYER_RADIUS],
    [0, -PLAYER_RADIUS],
  ]) {
    const tileX = Math.floor((centerX + dx) / TILE);
    const tileY = Math.floor((centerY + dy) / TILE);
    if (tileX < 0 || tileY < 0) return true;
    const index = tileY * 48 + tileX;
    if (runtime.terrain.solid[index]) return true;
  }
  return false;
}

/* -------------------------------------------------------------------------- */
/* Context-sensitive primary action                                            */
/* -------------------------------------------------------------------------- */

export type ToolId = "auto" | "hoe" | "can" | "seed" | "scythe";

/** What the primary button would do on the tile in front of the player. */
export function resolveAction(runtime: FarmRuntime, tool: ToolId) {
  const tile = facingTile(runtime);
  const plot = plotAt(runtime, tile.x, tile.y);
  const field = upgradeLevel(runtime.save, "field");
  const unlocked = isPlotUnlocked(tile.x, tile.y, field);

  if (tool === "hoe") return { action: "till" as const, tile, valid: unlocked && !!plot && !plot.tilled };
  if (tool === "can") return { action: "water" as const, tile, valid: !!plot && plot.tilled };
  if (tool === "seed") return { action: "plant" as const, tile, valid: !!plot && plot.tilled && !plot.crop };
  if (tool === "scythe") return { action: "harvest" as const, tile, valid: !!plot?.crop };

  if (!plot || !unlocked) return { action: "till" as const, tile, valid: false };
  if (plot.crop && (plot.dead || plot.growth >= CROPS[plot.crop].growHours)) {
    return { action: "harvest" as const, tile, valid: true };
  }
  if (!plot.tilled) return { action: "till" as const, tile, valid: true };
  if (!plot.crop) return { action: "plant" as const, tile, valid: (runtime.save.seeds[runtime.save.selectedCrop] ?? 0) > 0 };
  return { action: "water" as const, tile, valid: plot.moisture < 0.95 };
}

export function performAction(runtime: FarmRuntime, tool: ToolId): boolean {
  const resolved = resolveAction(runtime, tool);
  runtime.player.action = { kind: resolved.action, timer: 0.28 };
  switch (resolved.action) {
    case "till":
      return tryTill(runtime, resolved.tile.x, resolved.tile.y);
    case "plant":
      return tryPlant(runtime, resolved.tile.x, resolved.tile.y);
    case "water":
      return tryWater(runtime, resolved.tile.x, resolved.tile.y);
    case "harvest":
      return tryHarvest(runtime, resolved.tile.x, resolved.tile.y);
    default:
      return false;
  }
}

export function drainEvents(runtime: FarmRuntime): GameEvent[] {
  if (!runtime.events.length) return [];
  const events = runtime.events;
  runtime.events = [];
  return events;
}

export { FARM_H, FARM_W, FARM_X, FARM_Y, TILE };
export type { BarnItem, FarmSaveV2, Plot };
