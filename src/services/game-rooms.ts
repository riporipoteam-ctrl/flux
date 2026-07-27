/**
 * Published Rec Room / Flux rooms gallery (Firebase-hosted metadata).
 */
import {
  collection,
  doc,
  getDocs,
  setDoc,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  updateDoc,
  increment,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { stripUndefined } from "@/lib/firestore-safe";

export type PublishedRoom = {
  id: string;
  name: string;
  description: string;
  imageUrl: string | null;
  imageName: string | null;
  authorId: string | null;
  authorName: string | null;
  visits: number;
  cheers: number;
  tags: string[];
  isOfficial: boolean;
  /** Private rooms: only author can list/read */
  isPrivate?: boolean;
  buildId: string;
  createdAt?: unknown;
  updatedAt?: unknown;
};

/** Official RRO stubs seeded when collection is empty (client-side) */
function official(
  name: string,
  description: string,
  imageName: string,
  tags: string[],
  visits: number,
  cheers: number
): Omit<PublishedRoom, "id"> {
  return {
    name,
    description,
    imageUrl: `/game-thumbs/${imageName}.png`,
    imageName,
    authorId: null,
    authorName: "Flux Rec",
    visits,
    cheers,
    tags,
    isOfficial: true,
    isPrivate: false,
    buildId: "2019",
  };
}

export const OFFICIAL_ROOM_SEED: Omit<PublishedRoom, "id">[] = [
  official("Rec Center", "Social hub — meet friends, explore doors.", "22eefa3219f046fd9e2090814650ede3", ["rro", "social"], 12040, 890),
  official("Paintball", "Team battle and CTF on classic maps.", "93a53ced93a04f658795a87f4a4aab85", ["rro", "pvp"], 8200, 640),
  official("Golden Trophy", "Quest with Coach — recover the trophy!", "38e9d0d4eff94556a0b106508249dcf9", ["rro", "quest"], 5400, 410),
  official("Dodgeball", "Fast sports mode.", "6d5c494668784816bbc41d9b870e5003", ["rro", "sport"], 3900, 220),
  official("Disc Golf Lake", "Chill disc golf course.", "52cf6c3271894ecd95fb0c9b2d2209a7", ["rro", "sport"], 2100, 150),
  official("Laser Tag", "Teams vs robots and each other.", "c5a72193d6904811b2d0195a6deb3125", ["rro", "pvp"], 4800, 300),
  official("Charades", "Draw, act, and guess!", "a446d5808ed14401a27f53e631c31b93", ["rro", "social"], 3100, 180),
  official("Paddleball", "Zero-g rally tube.", "ffdca6ed8bd94631ac15e3e894acb6c6", ["rro", "sport"], 2800, 140),
  official("Soccer", "Teams of three — goal!", "51c6f5ac5e6f4777b573e7e43f8a85ea", ["rro", "sport", "pvp"], 2600, 160),
  official("Bowling", "Knock down pins with friends.", "4d143a3359e8483e8d48116ab6cacecb", ["rro", "sport"], 1900, 110),
  official("Lounge", "Chill party room.", "3e8c2458f1e542ab8aa275e4083ee47a", ["rro", "social"], 4200, 250),
  official("Park", "Amphitheater, fields, cave.", "79ee7af2532247f397867e48daa9d264", ["rro", "social"], 3500, 200),
];

function mapRoom(id: string, data: Record<string, unknown>): PublishedRoom {
  return {
    id,
    name: String(data.name || "Room"),
    description: String(data.description || ""),
    imageUrl: (data.imageUrl as string) || null,
    imageName: (data.imageName as string) || null,
    authorId: (data.authorId as string) || null,
    authorName: (data.authorName as string) || null,
    visits: Number(data.visits || 0),
    cheers: Number(data.cheers || 0),
    tags: Array.isArray(data.tags) ? (data.tags as string[]) : [],
    isOfficial: !!data.isOfficial,
    isPrivate: !!data.isPrivate,
    buildId: String(data.buildId || "2019"),
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };
}

export async function listPublishedRooms(max = 40): Promise<PublishedRoom[]> {
  try {
    const q = query(
      collection(db, "publishedRooms"),
      orderBy("visits", "desc"),
      limit(max)
    );
    const snap = await getDocs(q);
    if (!snap.empty) {
      // Public gallery only — never show others' private rooms
      return snap.docs
        .map((d) => mapRoom(d.id, d.data()))
        .filter((r) => !r.isPrivate);
    }
  } catch {
    /* index missing or empty — fall through */
  }
  return OFFICIAL_ROOM_SEED.map((r, i) => ({
    ...r,
    id: `official-${i}-${r.name.replace(/\s+/g, "")}`,
    isPrivate: false,
  }));
}

/** Only the signed-in user's private rooms */
export async function listMyPrivateRooms(uid: string): Promise<PublishedRoom[]> {
  if (!uid) return [];
  try {
    const q = query(
      collection(db, "publishedRooms"),
      where("authorId", "==", uid),
      limit(40)
    );
    const snap = await getDocs(q);
    return snap.docs
      .map((d) => mapRoom(d.id, d.data()))
      .filter((r) => r.isPrivate);
  } catch {
    return [];
  }
}

export async function seedOfficialRoomsIfEmpty(uid: string) {
  const existing = await getDocs(query(collection(db, "publishedRooms"), limit(1)));
  if (!existing.empty) return;
  await Promise.all(
    OFFICIAL_ROOM_SEED.map(async (r, i) => {
      const id = `official-${r.name.replace(/\s+/g, "")}`;
      await setDoc(
        doc(db, "publishedRooms", id),
        stripUndefined({
          ...r,
          seededBy: uid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        })
      );
    })
  );
}

export async function cheerRoom(roomId: string) {
  await updateDoc(doc(db, "publishedRooms", roomId), {
    cheers: increment(1),
    updatedAt: serverTimestamp(),
  });
}

export async function visitRoom(roomId: string) {
  try {
    await updateDoc(doc(db, "publishedRooms", roomId), {
      visits: increment(1),
      updatedAt: serverTimestamp(),
    });
  } catch {
    /* official seed ids may not exist in firestore yet */
  }
}

export async function publishUserRoom(
  uid: string,
  authorName: string,
  data: {
    name: string;
    description: string;
    imageUrl?: string | null;
    imageName?: string | null;
    tags?: string[];
    isPrivate?: boolean;
  }
) {
  const id = `user-${uid.slice(0, 6)}-${Date.now().toString(36)}`;
  await setDoc(
    doc(db, "publishedRooms", id),
    stripUndefined({
      name: data.name,
      description: data.description || "",
      imageUrl: data.imageUrl || null,
      imageName: data.imageName || null,
      authorId: uid,
      authorName,
      visits: 0,
      cheers: 0,
      tags: data.tags || ["community"],
      isOfficial: false,
      isPrivate: !!data.isPrivate,
      buildId: "2019",
      gameName: "Flux Rec",
      source: "flux-rec",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
  );
  return id;
}

/** Resolve room thumbnail — always prefer static /game-thumbs (works online + offline) */
export function roomThumbUrl(room: PublishedRoom): string {
  if (room.imageUrl) {
    // Absolute or site-relative
    if (room.imageUrl.startsWith("http") || room.imageUrl.startsWith("/")) {
      return room.imageUrl;
    }
  }
  const raw = (room.imageName || room.imageUrl || "").trim();
  if (raw) {
    const base = raw
      .replace(/\.(png|jpg|jpeg)$/i, "")
      .replace(/[^a-zA-Z0-9._-]/g, "");
    if (base) {
      // 1) Static public copy  2) API route that also reads RecNet cache
      return `/game-thumbs/${encodeURIComponent(base)}.png`;
    }
  }
  // Deterministic gradient avatar fallback (no external dependency)
  const label = encodeURIComponent((room.name || "Room").slice(0, 18));
  return `https://ui-avatars.com/api/?name=${label}&background=0f172a&color=38bdf8&size=256&bold=true&format=png`;
}
