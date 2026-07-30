import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { db, isFirebaseConfigured } from "@/lib/firebase";

export type FluxFarmWeather = "clear" | "cloudy" | "rain" | "storm" | "fog" | "windy";
export type FluxFarmSeed = "wheat" | "carrot" | "corn" | "tomato" | "strawberry" | "pumpkin";

export interface FluxFarmCrop {
  id: string;
  plot: number;
  seed: FluxFarmSeed;
  plantedAt: number;
  wateredAt: number;
  growth: number;
  ready: boolean;
}

export interface FluxFarmWorker {
  id: "mira" | "leo" | "nora";
  hired: boolean;
  hiredAt?: number;
}

export interface FluxFarmUpgrades {
  wateringCan: number;
  barn: number;
  house: number;
  field: number;
}

export interface FluxFarmStats {
  planted: number;
  harvested: number;
  coinsEarned: number;
  rainyDays: number;
  eventsSeen: number;
}

export interface FluxFarmSave {
  version: 1;
  uid: string;
  displayName: string;
  avatarUrl: string | null;
  day: number;
  minuteOfDay: number;
  weather: FluxFarmWeather;
  coins: number;
  xp: number;
  energy: number;
  selectedSeed: FluxFarmSeed;
  seeds: Record<FluxFarmSeed, number>;
  crops: FluxFarmCrop[];
  workers: FluxFarmWorker[];
  upgrades: FluxFarmUpgrades;
  storyStep: number;
  activeEvent: string | null;
  stats: FluxFarmStats;
  lastPlayedAt: number;
}

export interface FluxFarmLeaderboardEntry {
  uid: string;
  displayName: string;
  avatarUrl: string | null;
  rank: number;
  rankTitle: string;
  xp: number;
  coins: number;
  day: number;
  harvested: number;
}

export const FARM_SEEDS: Record<FluxFarmSeed, {
  name: string;
  emoji: string;
  unlockRank: number;
  growMinutes: number;
  seedCost: number;
  sellPrice: number;
  xp: number;
}> = {
  wheat: { name: "Wheat", emoji: "🌾", unlockRank: 1, growMinutes: 180, seedCost: 3, sellPrice: 8, xp: 7 },
  carrot: { name: "Carrot", emoji: "🥕", unlockRank: 2, growMinutes: 240, seedCost: 6, sellPrice: 15, xp: 11 },
  corn: { name: "Corn", emoji: "🌽", unlockRank: 3, growMinutes: 320, seedCost: 10, sellPrice: 24, xp: 16 },
  tomato: { name: "Tomato", emoji: "🍅", unlockRank: 5, growMinutes: 400, seedCost: 15, sellPrice: 36, xp: 23 },
  strawberry: { name: "Strawberry", emoji: "🍓", unlockRank: 7, growMinutes: 500, seedCost: 24, sellPrice: 58, xp: 32 },
  pumpkin: { name: "Pumpkin", emoji: "🎃", unlockRank: 10, growMinutes: 720, seedCost: 42, sellPrice: 105, xp: 50 },
};

export function getFluxFarmRank(xp: number) {
  const rank = Math.max(1, Math.floor(Math.sqrt(Math.max(0, xp) / 90)) + 1);
  const titles = [
    "New Seed",
    "Fieldhand",
    "Village Grower",
    "Skilled Farmer",
    "Harvest Keeper",
    "Valley Rancher",
    "Master Cultivator",
    "Golden Harvester",
    "Farm Baron",
    "Valley Legend",
  ];
  return {
    rank,
    title: titles[Math.min(titles.length - 1, rank - 1)],
    current: xp - Math.pow(rank - 1, 2) * 90,
    needed: Math.max(90, (Math.pow(rank, 2) - Math.pow(rank - 1, 2)) * 90),
  };
}

export function createDefaultFluxFarmSave(
  uid: string,
  displayName: string,
  avatarUrl: string | null
): FluxFarmSave {
  return {
    version: 1,
    uid,
    displayName,
    avatarUrl,
    day: 1,
    minuteOfDay: 7 * 60,
    weather: "clear",
    coins: 120,
    xp: 0,
    energy: 100,
    selectedSeed: "wheat",
    seeds: { wheat: 12, carrot: 4, corn: 0, tomato: 0, strawberry: 0, pumpkin: 0 },
    crops: [],
    workers: [
      { id: "mira", hired: false },
      { id: "leo", hired: false },
      { id: "nora", hired: false },
    ],
    upgrades: { wateringCan: 1, barn: 1, house: 1, field: 1 },
    storyStep: 0,
    activeEvent: null,
    stats: { planted: 0, harvested: 0, coinsEarned: 0, rainyDays: 0, eventsSeen: 0 },
    lastPlayedAt: Date.now(),
  };
}

function normalizeSave(raw: Partial<FluxFarmSave>, fallback: FluxFarmSave): FluxFarmSave {
  return {
    ...fallback,
    ...raw,
    seeds: { ...fallback.seeds, ...(raw.seeds || {}) },
    upgrades: { ...fallback.upgrades, ...(raw.upgrades || {}) },
    stats: { ...fallback.stats, ...(raw.stats || {}) },
    crops: Array.isArray(raw.crops) ? raw.crops : [],
    workers: Array.isArray(raw.workers) ? raw.workers : fallback.workers,
    version: 1,
    uid: fallback.uid,
    displayName: fallback.displayName,
    avatarUrl: fallback.avatarUrl,
  };
}

export async function loadFluxFarmSave(
  uid: string,
  displayName: string,
  avatarUrl: string | null
): Promise<FluxFarmSave> {
  const fallback = createDefaultFluxFarmSave(uid, displayName, avatarUrl);
  if (!isFirebaseConfigured) return fallback;
  const snapshot = await getDoc(doc(db, "fluxFarmSaves", uid));
  if (!snapshot.exists()) return fallback;
  return normalizeSave(snapshot.data() as Partial<FluxFarmSave>, fallback);
}

export async function saveFluxFarmProgress(save: FluxFarmSave) {
  if (!isFirebaseConfigured) return;
  const rank = getFluxFarmRank(save.xp);
  await setDoc(
    doc(db, "fluxFarmSaves", save.uid),
    {
      ...save,
      rank: rank.rank,
      rankTitle: rank.title,
      updatedAt: serverTimestamp(),
      leaderboardUpdatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

export async function listFluxFarmLeaderboard(count = 25): Promise<FluxFarmLeaderboardEntry[]> {
  if (!isFirebaseConfigured) return [];
  const snapshot = await getDocs(
    query(collection(db, "fluxFarmSaves"), orderBy("xp", "desc"), limit(count))
  );
  return snapshot.docs.map((entry) => {
    const data = entry.data() as Partial<FluxFarmSave> & {
      rank?: number;
      rankTitle?: string;
    };
    const computed = getFluxFarmRank(Number(data.xp || 0));
    return {
      uid: entry.id,
      displayName: String(data.displayName || "Flux Farmer"),
      avatarUrl: data.avatarUrl || null,
      rank: Number(data.rank || computed.rank),
      rankTitle: String(data.rankTitle || computed.title),
      xp: Number(data.xp || 0),
      coins: Number(data.coins || 0),
      day: Number(data.day || 1),
      harvested: Number(data.stats?.harvested || 0),
    };
  });
}
