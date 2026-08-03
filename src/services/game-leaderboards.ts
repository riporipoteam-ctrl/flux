import {
  collection,
  doc,
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

function scoreRef(gameId: string, uid: string) {
  return doc(db, "gameLeaderboards", gameId, "scores", uid);
}

export async function submitGameScore(input: {
  gameId: string;
  uid: string;
  displayName?: string | null;
  username?: string | null;
  avatarUrl?: string | null;
  score: number;
}): Promise<{ personalBest: number; improved: boolean }> {
  const cleanScore = Math.max(0, Math.floor(Number(input.score) || 0));
  const ref = scoreRef(input.gameId, input.uid);

  return runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(ref);
    const previous = Math.max(0, Number(snapshot.data()?.score || 0));
    const next = Math.max(previous, cleanScore);
    transaction.set(ref, {
      uid: input.uid,
      displayName: String(input.displayName || "Flux player").slice(0, 80),
      username: String(input.username || "player").slice(0, 40),
      avatarUrl: String(input.avatarUrl || "").slice(0, 2000),
      score: next,
      plays: Number(snapshot.data()?.plays || 0) + 1,
      updatedAt: serverTimestamp(),
    }, { merge: true });
    return { personalBest: next, improved: cleanScore > previous };
  });
}

export async function getGameLeaderboard(gameId: string, take = 20): Promise<GameLeaderboardEntry[]> {
  const snapshot = await getDocs(query(
    collection(db, "gameLeaderboards", gameId, "scores"),
    orderBy("score", "desc"),
    limit(Math.max(1, Math.min(50, take)))
  ));
  return snapshot.docs.map((entry) => ({
    uid: String(entry.data().uid || entry.id),
    displayName: String(entry.data().displayName || "Flux player"),
    username: String(entry.data().username || "player"),
    avatarUrl: String(entry.data().avatarUrl || ""),
    score: Math.max(0, Number(entry.data().score || 0)),
    plays: Math.max(0, Number(entry.data().plays || 0)),
    updatedAt: entry.data().updatedAt || null,
  }));
}
