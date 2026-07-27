import {
  collection,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  serverTimestamp,
  getDoc,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { stripUndefined } from "@/lib/firestore-safe";

export type GameMode = "hangout" | "tag" | "coins";

export interface HangoutPlayer {
  uid: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  x: number;
  y: number;
  color: string;
  emoji: string;
  facing: "left" | "right";
  score: number;
  isIt: boolean;
  updatedAt?: unknown;
}

export interface HangoutChat {
  id: string;
  uid: string;
  displayName: string;
  text: string;
  createdAt?: unknown;
}

export interface RoomState {
  code: string;
  mode: GameMode;
  hostUid: string | null;
  itUid: string | null;
  roundEndsAt: number | null; // ms epoch
  message: string | null;
  updatedAt?: unknown;
}

export interface Pickup {
  id: string;
  x: number;
  y: number;
  type: "coin" | "star";
  value: number;
}

const COLORS = [
  "#1d9bf0",
  "#f43f5e",
  "#10b981",
  "#f59e0b",
  "#a78bfa",
  "#22d3ee",
  "#fb923c",
  "#e879f9",
];

export const WORLD_W = 1400;
export const WORLD_H = 900;

export function playerColor(uid: string) {
  let h = 0;
  for (let i = 0; i < uid.length; i++)
    h = (h + uid.charCodeAt(i) * 17) % COLORS.length;
  return COLORS[h];
}

export function roomPath(roomCode: string) {
  const code =
    roomCode.trim().toUpperCase().replace(/[^A-Z0-9]/g, "") || "LOBBY";
  return code.slice(0, 12);
}

export async function joinHangout(
  roomCode: string,
  player: {
    uid: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
    color: string;
    emoji?: string;
    x?: number;
    y?: number;
  }
) {
  const code = roomPath(roomCode);
  const roomRef = doc(db, "hangoutRooms", code);
  const roomSnap = await getDoc(roomRef);
  if (!roomSnap.exists()) {
    await setDoc(
      roomRef,
      stripUndefined({
        code,
        mode: "hangout",
        hostUid: player.uid,
        itUid: null,
        roundEndsAt: null,
        message: "Welcome to Flux Arena!",
        createdAt: serverTimestamp(),
        lastActiveAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    );
  } else {
    await updateDoc(roomRef, {
      lastActiveAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  const ref = doc(db, "hangoutRooms", code, "players", player.uid);
  await setDoc(
    ref,
    stripUndefined({
      uid: player.uid,
      username: player.username,
      displayName: player.displayName,
      avatarUrl: player.avatarUrl,
      x: player.x ?? 500 + Math.random() * 200,
      y: player.y ?? 400 + Math.random() * 120,
      color: player.color,
      emoji: player.emoji || "🙂",
      facing: "right",
      score: 0,
      isIt: false,
      updatedAt: serverTimestamp(),
    }),
    { merge: true }
  );
  return code;
}

export async function updateHangoutPos(
  roomCode: string,
  uid: string,
  data: Partial<
    Pick<HangoutPlayer, "x" | "y" | "facing" | "emoji" | "score" | "isIt">
  >
) {
  const code = roomPath(roomCode);
  await updateDoc(doc(db, "hangoutRooms", code, "players", uid), {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

export async function leaveHangout(roomCode: string, uid: string) {
  const code = roomPath(roomCode);
  try {
    await deleteDoc(doc(db, "hangoutRooms", code, "players", uid));
  } catch {
    /* ignore */
  }
}

export function subscribeHangoutPlayers(
  roomCode: string,
  cb: (players: HangoutPlayer[]) => void
): Unsubscribe {
  const code = roomPath(roomCode);
  return onSnapshot(
    collection(db, "hangoutRooms", code, "players"),
    (snap) => {
      const list = snap.docs.map((d) => {
        const data = d.data();
        return {
          uid: d.id,
          username: data.username ?? "",
          displayName: data.displayName ?? "Player",
          avatarUrl: data.avatarUrl ?? null,
          x: data.x ?? 0,
          y: data.y ?? 0,
          color: data.color ?? "#1d9bf0",
          emoji: data.emoji || "🙂",
          facing: data.facing === "left" ? "left" : "right",
          score: data.score ?? 0,
          isIt: !!data.isIt,
          updatedAt: data.updatedAt,
        } as HangoutPlayer;
      });
      cb(list);
    },
    () => cb([])
  );
}

export function subscribeRoomState(
  roomCode: string,
  cb: (state: RoomState | null) => void
): Unsubscribe {
  const code = roomPath(roomCode);
  return onSnapshot(
    doc(db, "hangoutRooms", code),
    (snap) => {
      if (!snap.exists()) {
        cb(null);
        return;
      }
      const d = snap.data();
      cb({
        code,
        mode: (d.mode as GameMode) || "hangout",
        hostUid: d.hostUid ?? null,
        itUid: d.itUid ?? null,
        roundEndsAt: d.roundEndsAt ?? null,
        message: d.message ?? null,
        updatedAt: d.updatedAt,
      });
    },
    () => cb(null)
  );
}

export async function setRoomMode(
  roomCode: string,
  mode: GameMode,
  hostUid: string,
  players: HangoutPlayer[]
) {
  const code = roomPath(roomCode);
  const roundEndsAt =
    mode === "hangout" ? null : Date.now() + (mode === "tag" ? 90_000 : 60_000);

  let itUid: string | null = null;
  if (mode === "tag" && players.length > 0) {
    itUid = players[Math.floor(Math.random() * players.length)].uid;
  }

  await setDoc(
    doc(db, "hangoutRooms", code),
    stripUndefined({
      code,
      mode,
      hostUid,
      itUid,
      roundEndsAt,
      message:
        mode === "hangout"
          ? "Free hangout"
          : mode === "tag"
            ? "TAG! Don't get caught!"
            : "Coin Rush — grab the gold!",
      updatedAt: serverTimestamp(),
      lastActiveAt: serverTimestamp(),
    }),
    { merge: true }
  );

  // reset scores / it flags
  for (const p of players) {
    await updateDoc(doc(db, "hangoutRooms", code, "players", p.uid), {
      score: 0,
      isIt: p.uid === itUid,
      updatedAt: serverTimestamp(),
    });
  }

  if (mode === "coins") {
    await spawnCoins(code, 18);
  } else {
    await clearPickups(code);
  }
}

async function clearPickups(code: string) {
  // best-effort: overwrite pickup docs by setting empty markers
  // we use fixed ids coin_0..coin_N
  for (let i = 0; i < 24; i++) {
    try {
      await deleteDoc(doc(db, "hangoutRooms", code, "pickups", `coin_${i}`));
    } catch {
      /* ignore */
    }
  }
}

export async function spawnCoins(code: string, count = 16) {
  const c = roomPath(code);
  for (let i = 0; i < count; i++) {
    await setDoc(doc(db, "hangoutRooms", c, "pickups", `coin_${i}`), {
      id: `coin_${i}`,
      x: 80 + Math.random() * (WORLD_W - 160),
      y: 80 + Math.random() * (WORLD_H - 160),
      type: Math.random() > 0.85 ? "star" : "coin",
      value: Math.random() > 0.85 ? 5 : 1,
      active: true,
      updatedAt: serverTimestamp(),
    });
  }
}

export function subscribePickups(
  roomCode: string,
  cb: (pickups: Pickup[]) => void
): Unsubscribe {
  const code = roomPath(roomCode);
  return onSnapshot(
    collection(db, "hangoutRooms", code, "pickups"),
    (snap) => {
      const list = snap.docs
        .map((d) => {
          const data = d.data();
          if (data.active === false) return null;
          return {
            id: d.id,
            x: data.x ?? 0,
            y: data.y ?? 0,
            type: (data.type as "coin" | "star") || "coin",
            value: data.value ?? 1,
          } as Pickup;
        })
        .filter(Boolean) as Pickup[];
      cb(list);
    },
    () => cb([])
  );
}

export async function collectPickup(
  roomCode: string,
  pickupId: string,
  uid: string,
  value: number,
  currentScore: number
) {
  const code = roomPath(roomCode);
  // mark collected
  await setDoc(
    doc(db, "hangoutRooms", code, "pickups", pickupId),
    { active: false, collectedBy: uid, updatedAt: serverTimestamp() },
    { merge: true }
  );
  await updateDoc(doc(db, "hangoutRooms", code, "players", uid), {
    score: currentScore + value,
    updatedAt: serverTimestamp(),
  });
}

export async function tagPlayer(
  roomCode: string,
  fromUid: string,
  toUid: string
) {
  const code = roomPath(roomCode);
  const room = await getDoc(doc(db, "hangoutRooms", code));
  if (!room.exists() || room.data().mode !== "tag") return;
  if (room.data().itUid !== fromUid) return;

  await updateDoc(doc(db, "hangoutRooms", code), {
    itUid: toUid,
    message: "Tagged!",
    updatedAt: serverTimestamp(),
  });
  await updateDoc(doc(db, "hangoutRooms", code, "players", fromUid), {
    isIt: false,
    score: (await getPlayerScore(code, fromUid)) + 1,
    updatedAt: serverTimestamp(),
  });
  await updateDoc(doc(db, "hangoutRooms", code, "players", toUid), {
    isIt: true,
    updatedAt: serverTimestamp(),
  });
}

async function getPlayerScore(code: string, uid: string) {
  const snap = await getDoc(doc(db, "hangoutRooms", code, "players", uid));
  return snap.exists() ? snap.data().score || 0 : 0;
}

export async function sendHangoutChat(
  roomCode: string,
  msg: { uid: string; displayName: string; text: string }
) {
  const code = roomPath(roomCode);
  const id = `${Date.now()}_${msg.uid.slice(0, 6)}`;
  await setDoc(
    doc(db, "hangoutRooms", code, "chat", id),
    stripUndefined({
      uid: msg.uid,
      displayName: msg.displayName,
      text: msg.text.slice(0, 140),
      createdAt: serverTimestamp(),
    })
  );
}

export function subscribeHangoutChat(
  roomCode: string,
  cb: (msgs: HangoutChat[]) => void
): Unsubscribe {
  const code = roomPath(roomCode);
  return onSnapshot(
    collection(db, "hangoutRooms", code, "chat"),
    (snap) => {
      const list = snap.docs
        .map((d) => ({
          id: d.id,
          uid: d.data().uid as string,
          displayName: d.data().displayName as string,
          text: d.data().text as string,
          createdAt: d.data().createdAt as { toMillis?: () => number } | null,
        }))
        .sort((a, b) => {
          const ta = a.createdAt?.toMillis?.() ?? 0;
          const tb = b.createdAt?.toMillis?.() ?? 0;
          return ta - tb;
        })
        .slice(-40);
      cb(list);
    },
    () => cb([])
  );
}
