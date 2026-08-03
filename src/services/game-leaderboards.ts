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

type StoredScore = { best?: number; plays?: number; updatedAt?: unknown };

export async function submitGameScore(input: {
  gameId: string;
  uid: string;
  displayName?: string | null;
  username?: string | null;
  avatarUrl?: string | null;
  score: number;
}): Promise<{ personalBest: number; improved: boolean }> {
  const cleanScore = Math.max(0, Math.floor(Number(input.score) || 0));
  const ref = doc(db, "gameSessions", input.uid);

  return runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(ref);
    const current = (snapshot.data()?.scores?.[input.gameId] || {}) as StoredScore;
    const previous = Math.max(0, Number(current.best || 0));
    const next = Math.max(previous, cleanScore);
    transaction.set(ref, {
      uid: input.uid,
      displayName: String(input.displayName || "Flux player").slice(0, 80),
      username: String(input.username || "player").slice(0, 40),
      avatarUrl: String(input.avatarUrl || "").slice(0, 2000),
      scores: {
        [input.gameId]: {
          best: next,
          plays: Math.max(0, Number(current.plays || 0)) + 1,
          updatedAt: serverTimestamp(),
        },
      },
      updatedAt: serverTimestamp(),
    }, { merge: true });
    return { personalBest: next, improved: cleanScore > previous };
  });
}

export async function getGameLeaderboard(gameId: string, take = 20): Promise<GameLeaderboardEntry[]> {
  const snapshot = await getDocs(query(
    collection(db, "gameSessions"),
    orderBy(new FieldPath("scores", gameId, "best"), "desc"),
    limit(Math.max(1, Math.min(50, take)))
  ));

  return snapshot.docs.flatMap((entry) => {
    const data = entry.data();
    const stored = data.scores?.[gameId] as StoredScore | undefined;
    if (!stored || Number(stored.best || 0) <= 0) return [];
    return [{
      uid: String(data.uid || entry.id),
      displayName: String(data.displayName || "Flux player"),
      username: String(data.username || "player"),
      avatarUrl: String(data.avatarUrl || ""),
      score: Math.max(0, Number(stored.best || 0)),
      plays: Math.max(0, Number(stored.plays || 0)),
      updatedAt: stored.updatedAt || null,
    }];
  });
}
