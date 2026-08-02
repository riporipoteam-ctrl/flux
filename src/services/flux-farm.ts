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
import { rankForXp } from "@/lib/flux-farm/content";
import { createFarmSave, normalizeFarmSave, type FarmSaveV2 } from "@/lib/flux-farm/world";

const COLLECTION = "fluxFarmSaves";
const LOCAL_KEY = "flux-farm-save-v2";

export type { FarmSaveV2 };

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
  updatedAt: number | null;
}

/* -------------------------------------------------------------------------- */
/* Local mirror                                                                */
/* -------------------------------------------------------------------------- */

/**
 * Every save is mirrored to localStorage so a dropped connection, an offline
 * session or a Firebase-less static deploy never costs the player progress.
 * Firestore stays the source of truth when it is reachable and newer.
 */
function readLocal(uid: string): FarmSaveV2 | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(`${LOCAL_KEY}:${uid}`);
    if (!raw) return null;
    return JSON.parse(raw) as FarmSaveV2;
  } catch {
    return null;
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([
    promise,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), ms)),
  ]);
}

function writeLocal(save: FarmSaveV2) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(`${LOCAL_KEY}:${save.uid}`, JSON.stringify(save));
  } catch {
    // Storage can be full or blocked; the cloud save still applies.
  }
}

/* -------------------------------------------------------------------------- */
/* Load / save                                                                 */
/* -------------------------------------------------------------------------- */

export async function loadFarmSave(
  uid: string,
  displayName: string,
  avatarUrl: string | null
): Promise<FarmSaveV2> {
  const local = readLocal(uid);

  if (!isFirebaseConfigured) {
    return local
      ? normalizeFarmSave(local, uid, displayName, avatarUrl)
      : createFarmSave(uid, displayName, avatarUrl);
  }

  try {
    // Firestore's own retry can hang for ~10s offline; the game must open
    // immediately and reconcile with the cloud save when it arrives.
    const snapshot = await withTimeout(getDoc(doc(db, COLLECTION, uid)), 3500);
    if (!snapshot) {
      return local
        ? normalizeFarmSave(local, uid, displayName, avatarUrl)
        : createFarmSave(uid, displayName, avatarUrl);
    }
    if (!snapshot.exists()) {
      return local
        ? normalizeFarmSave(local, uid, displayName, avatarUrl)
        : createFarmSave(uid, displayName, avatarUrl);
    }

    const remote = normalizeFarmSave(snapshot.data(), uid, displayName, avatarUrl);
    if (local && Number(local.lastPlayedAt || 0) > Number(remote.lastPlayedAt || 0)) {
      return normalizeFarmSave(local, uid, displayName, avatarUrl);
    }
    return remote;
  } catch {
    return local
      ? normalizeFarmSave(local, uid, displayName, avatarUrl)
      : createFarmSave(uid, displayName, avatarUrl);
  }
}

export async function saveFarmProgress(save: FarmSaveV2): Promise<void> {
  writeLocal(save);
  if (!isFirebaseConfigured) return;

  const rank = rankForXp(save.xp);
  await setDoc(
    doc(db, COLLECTION, save.uid),
    {
      ...save,
      // Denormalised so the leaderboard query does not have to read plots.
      rank: rank.rank,
      rankTitle: rank.title,
      harvested: save.stats.harvested,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

/* -------------------------------------------------------------------------- */
/* Leaderboard                                                                 */
/* -------------------------------------------------------------------------- */

export async function listFarmLeaderboard(count = 50): Promise<FluxFarmLeaderboardEntry[]> {
  if (!isFirebaseConfigured) return [];

  const snapshot = await getDocs(query(collection(db, COLLECTION), orderBy("xp", "desc"), limit(count)));

  return snapshot.docs.map((entry) => {
    const data = entry.data() as Record<string, unknown>;
    const xp = Number(data.xp || 0);
    const computed = rankForXp(xp);
    const updatedAt = data.updatedAt as { toMillis?: () => number } | undefined;

    return {
      uid: entry.id,
      displayName: String(data.displayName || "Flux Farmer"),
      avatarUrl: (data.avatarUrl as string | null) ?? null,
      rank: Number(data.rank || computed.rank),
      rankTitle: String(data.rankTitle || computed.title),
      xp,
      coins: Number(data.coins || 0),
      day: Number(data.day || 1),
      harvested: Number(
        data.harvested ?? (data.stats as { harvested?: number } | undefined)?.harvested ?? 0
      ),
      updatedAt: typeof updatedAt?.toMillis === "function" ? updatedAt.toMillis() : null,
    };
  });
}

export { createFarmSave, rankForXp };
