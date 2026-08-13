import {
  collection,
  doc,
  FieldPath,
  getDocs,
  limit,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

export interface GameLeaderboardEntry {
  uid: string;
  displayName: string;
  username: string;
  avatarUrl: string;
  score: number;
  plays: number;
  updatedAt: unknown;
}

export type GameLeaderboardMetric = "score" | "plays";
type StoredScore = { best?: number; plays?: number; updatedAt?: unknown };
type PlayerIdentity = {
  gameId: string;
  uid: string;
  displayName?: string | null;
  username?: string | null;
  avatarUrl?: string | null;
};

function cleanGameId(value: string): string {
  return value.trim().replace(/[^a-z0-9-_]/gi, "").slice(0, 80);
}

function identityPayload(input: PlayerIdentity) {
  return {
    uid: input.uid,
    displayName: String(input.displayName || "Flux player").slice(0, 80),
    username: String(input.username || "player").slice(0, 40),
    avatarUrl: String(input.avatarUrl || "").slice(0, 2000),
  };
}

export async function recordGamePlay(input: PlayerIdentity): Promise<{ plays: number }> {
  const gameId = cleanGameId(input.gameId);
  if (!gameId) throw new Error("Invalid game ID");
  const ref = doc(db, "gameSessions", input.uid);

  return runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(ref);
    const current = (snapshot.data()?.scores?.[gameId] || {}) as StoredScore;
    const plays = Math.max(0, Number(current.plays || 0)) + 1;
    transaction.set(ref, {
      ...identityPayload(input),
      scores: {
        [gameId]: {
          best: Math.max(0, Number(current.best || 0)),
          plays,
          updatedAt: serverTimestamp(),
        },
      },
      updatedAt: serverTimestamp(),
    }, { merge: true });
    return { plays };
  });
}

export async function submitGameScore(input: PlayerIdentity & { score: number }): Promise<{ personalBest: number; improved: boolean }> {
  const gameId = cleanGameId(input.gameId);
  if (!gameId) throw new Error("Invalid game ID");
  const cleanScore = Math.max(0, Math.min(1_000_000_000, Math.floor(Number(input.score) || 0)));
  const ref = doc(db, "gameSessions", input.uid);

  return runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(ref);
    const current = (snapshot.data()?.scores?.[gameId] || {}) as StoredScore;
    const previous = Math.max(0, Number(current.best || 0));
    const next = Math.max(previous, cleanScore);
    transaction.set(ref, {
      ...identityPayload(input),
      scores: {
        [gameId]: {
          best: next,
          plays: Math.max(0, Number(current.plays || 0)),
          updatedAt: serverTimestamp(),
        },
      },
      updatedAt: serverTimestamp(),
    }, { merge: true });
    return { personalBest: next, improved: cleanScore > previous };
  });
}

export async function getGameLeaderboard(
  gameId: string,
  take = 20,
  metric: GameLeaderboardMetric = "score"
): Promise<GameLeaderboardEntry[]> {
  const cleanId = cleanGameId(gameId);
  if (!cleanId) return [];
  const field = metric === "plays" ? "plays" : "best";
  const snapshot = await getDocs(query(
    collection(db, "gameSessions"),
    orderBy(new FieldPath("scores", cleanId, field), "desc"),
    limit(Math.max(1, Math.min(50, take)))
  ));

  return snapshot.docs.flatMap((entry) => {
    const data = entry.data();
    const stored = data.scores?.[cleanId] as StoredScore | undefined;
    if (!stored) return [];
    const score = Math.max(0, Number(stored.best || 0));
    const plays = Math.max(0, Number(stored.plays || 0));
    if (metric === "score" && score <= 0) return [];
    if (metric === "plays" && plays <= 0) return [];
    return [{
      uid: String(data.uid || entry.id),
      displayName: String(data.displayName || "Flux player"),
      username: String(data.username || "player"),
      avatarUrl: String(data.avatarUrl || ""),
      score,
      plays,
      updatedAt: stored.updatedAt || null,
    }];
  });
}
