import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  type DocumentData,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { stripUndefined } from "@/lib/firestore-safe";
import type { UserProfile } from "@/types";
import { getUser } from "./users";

export type GameSessionStatus = "playing" | "lobby" | "ended";

export interface GameSession {
  uid: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  gameId: string;
  gameName: string;
  status: GameSessionStatus;
  roomCode?: string | null;
  startedAt: unknown;
  updatedAt: unknown;
  endedAt?: unknown;
}

function mapSession(id: string, data: DocumentData): GameSession {
  return {
    uid: id,
    username: data.username ?? "",
    displayName: data.displayName ?? "",
    avatarUrl: data.avatarUrl ?? null,
    gameId: data.gameId ?? "recroom-2019",
    gameName: data.gameName ?? "Rec Room (March 19, 2019)",
    status: data.status ?? "playing",
    roomCode: data.roomCode ?? null,
    startedAt: data.startedAt ?? null,
    updatedAt: data.updatedAt ?? null,
    endedAt: data.endedAt ?? null,
  };
}

/** Mark user as in-game (profile activity + live session doc) */
export async function startGameSession(
  profile: UserProfile,
  opts?: { roomCode?: string; gameId?: string; gameName?: string }
): Promise<void> {
  const gameId = opts?.gameId || "recroom-2019";
  const gameName = opts?.gameName || "Rec Room (March 19, 2019)";
  const sessionRef = doc(db, "gameSessions", profile.uid);
  const payload = stripUndefined({
    uid: profile.uid,
    username: profile.username,
    displayName: profile.displayName,
    avatarUrl: profile.avatarUrl,
    gameId,
    gameName,
    status: "playing" as const,
    roomCode: opts?.roomCode || null,
    startedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    endedAt: null,
  });
  await setDoc(sessionRef, payload, { merge: true });

  await updateDoc(doc(db, "users", profile.uid), {
    gameActivity: {
      gameId,
      gameName,
      status: "playing",
      roomCode: opts?.roomCode || null,
      since: serverTimestamp(),
    },
    lastActiveAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function endGameSession(uid: string): Promise<void> {
  const sessionRef = doc(db, "gameSessions", uid);
  await setDoc(
    sessionRef,
    {
      status: "ended",
      endedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
  await updateDoc(doc(db, "users", uid), {
    gameActivity: null,
    updatedAt: serverTimestamp(),
  });
}

export async function setGameRoomCode(
  uid: string,
  roomCode: string
): Promise<void> {
  await updateDoc(doc(db, "gameSessions", uid), {
    roomCode: roomCode.trim().toUpperCase(),
    updatedAt: serverTimestamp(),
  });
  const user = await getUser(uid);
  if (user?.gameActivity) {
    await updateDoc(doc(db, "users", uid), {
      "gameActivity.roomCode": roomCode.trim().toUpperCase(),
      updatedAt: serverTimestamp(),
    });
  }
}

export async function getActivePlayers(max = 40): Promise<GameSession[]> {
  try {
    const snap = await getDocs(
      query(
        collection(db, "gameSessions"),
        where("status", "==", "playing"),
        orderBy("updatedAt", "desc"),
        limit(max)
      )
    );
    return snap.docs.map((d) => mapSession(d.id, d.data()));
  } catch {
    // Fallback without composite index
    try {
      const snap = await getDocs(
        query(
          collection(db, "gameSessions"),
          where("status", "==", "playing"),
          limit(max)
        )
      );
      return snap.docs.map((d) => mapSession(d.id, d.data()));
    } catch {
      return [];
    }
  }
}

export async function getMySession(uid: string): Promise<GameSession | null> {
  const snap = await getDoc(doc(db, "gameSessions", uid));
  if (!snap.exists()) return null;
  const s = mapSession(snap.id, snap.data());
  if (s.status === "ended") return null;
  return s;
}

export async function bumpPlaytime(uid: string, minutes = 1): Promise<void> {
  const ref = doc(db, "gameStats", uid);
  const snap = await getDoc(ref);
  const prev = snap.exists() ? snap.data() : {};
  await setDoc(
    ref,
    {
      uid,
      totalMinutes: (prev.totalMinutes || 0) + minutes,
      sessions: (prev.sessions || 0) + (minutes === 0 ? 0 : 0),
      lastPlayedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

export async function recordSessionComplete(uid: string): Promise<void> {
  const ref = doc(db, "gameStats", uid);
  const snap = await getDoc(ref);
  const prev = snap.exists() ? snap.data() : {};
  await setDoc(
    ref,
    {
      uid,
      sessions: (prev.sessions || 0) + 1,
      lastPlayedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

export async function getGameStats(uid: string) {
  const snap = await getDoc(doc(db, "gameStats", uid));
  if (!snap.exists()) {
    return { totalMinutes: 0, sessions: 0, lastPlayedAt: null };
  }
  const d = snap.data();
  return {
    totalMinutes: d.totalMinutes || 0,
    sessions: d.sessions || 0,
    lastPlayedAt: d.lastPlayedAt || null,
  };
}
