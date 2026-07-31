import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import { activePlan } from "@/services/flux-platform";
import { getUser } from "@/services/users";

export type StickerSurface = "posts" | "stories" | "chats";
export type StickerAudience = "everyone" | "followers" | "only-me";

export interface CustomSticker {
  id: string;
  ownerId: string;
  name: string;
  imageUrl: string;
  animated: boolean;
  audience: StickerAudience;
  surfaces: StickerSurface[];
  tags: string[];
  usesCount: number;
  createdAt: unknown;
  updatedAt: unknown;
}

function mapSticker(id: string, data: Record<string, unknown>): CustomSticker {
  return {
    id,
    ownerId: String(data.authorId || ""),
    name: String(data.title || "Sticker"),
    imageUrl: String(data.imageUrl || ""),
    animated: data.animated === true,
    audience: (data.audience as StickerAudience) || "everyone",
    surfaces: Array.isArray(data.surfaces) ? data.surfaces as StickerSurface[] : ["posts", "stories", "chats"],
    tags: Array.isArray(data.tags) ? data.tags.map(String) : [],
    usesCount: Number(data.usesCount || 0),
    createdAt: data.createdAt || null,
    updatedAt: data.updatedAt || null,
  };
}

export async function createCustomSticker(input: {
  ownerId: string;
  name: string;
  file: File;
  audience: StickerAudience;
  surfaces: StickerSurface[];
  tags?: string[];
}): Promise<CustomSticker> {
  const owner = await getUser(input.ownerId);
  const plan = activePlan(owner);
  if (plan === "free") throw new Error("Flux Basic or Premium is required to create stickers.");
  if (!input.file.type.startsWith("image/")) throw new Error("Choose a PNG, WebP, GIF, or another image file.");
  if (input.file.size > 5 * 1024 * 1024) throw new Error("Sticker files must be under 5 MB.");
  const snap = await getDocs(collection(db, "publishedRooms"));
  const ownedCount = snap.docs.filter((item) => item.data().kind === "sticker" && item.data().authorId === input.ownerId).length;
  const limit = plan === "premium" ? 100 : 25;
  if (ownedCount >= limit) throw new Error(`${plan === "premium" ? "Premium" : "Basic"} supports ${limit} published stickers.`);

  const id = `sticker-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const extension = input.file.name.split(".").pop()?.replace(/[^a-z0-9]/gi, "") || "img";
  const storageRef = ref(storage, `stickers/${input.ownerId}/${id}.${extension}`);
  await uploadBytes(storageRef, input.file, { contentType: input.file.type });
  const imageUrl = await getDownloadURL(storageRef);
  const payload = {
    authorId: input.ownerId,
    isOfficial: false,
    isPrivate: input.audience === "only-me",
    kind: "sticker",
    title: input.name.trim().slice(0, 48) || "Custom Sticker",
    imageUrl,
    animated: input.file.type === "image/gif" || /\.gif$/i.test(input.file.name),
    audience: input.audience,
    surfaces: input.surfaces.length ? input.surfaces : ["posts", "stories", "chats"],
    tags: (input.tags || []).map((tag) => tag.toLowerCase().replace(/^#/, "")).filter(Boolean).slice(0, 10),
    usesCount: 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  await setDoc(doc(db, "publishedRooms", id), payload);
  return mapSticker(id, payload);
}

export async function listCustomStickers(options: { ownerId?: string; surface?: StickerSurface; viewerId?: string } = {}): Promise<CustomSticker[]> {
  const snap = await getDocs(collection(db, "publishedRooms"));
  return snap.docs
    .filter((item) => {
      const data = item.data();
      if (data.kind !== "sticker") return false;
      if (options.ownerId && data.authorId !== options.ownerId) return false;
      if (options.surface && Array.isArray(data.surfaces) && !data.surfaces.includes(options.surface)) return false;
      if (data.audience === "only-me" && data.authorId !== options.viewerId) return false;
      // Follower-only enforcement needs a server-side relationship query. Until
      // then it is visible to the owner only rather than leaking it publicly.
      if (data.audience === "followers" && data.authorId !== options.viewerId) return false;
      return true;
    })
    .map((item) => mapSticker(item.id, item.data()))
    .sort((a, b) => Number(b.animated) - Number(a.animated) || a.name.localeCompare(b.name));
}

export async function incrementStickerUse(stickerId: string): Promise<void> {
  const ref = doc(db, "publishedRooms", stickerId);
  const stickers = await listCustomStickers();
  const sticker = stickers.find((item) => item.id === stickerId);
  if (!sticker) return;
  await updateDoc(ref, { usesCount: sticker.usesCount + 1, updatedAt: serverTimestamp() }).catch(() => undefined);
}

export async function deleteCustomSticker(ownerId: string, stickerId: string): Promise<void> {
  const stickers = await listCustomStickers({ ownerId, viewerId: ownerId });
  if (!stickers.some((item) => item.id === stickerId)) throw new Error("You do not own this sticker.");
  await deleteDoc(doc(db, "publishedRooms", stickerId));
}
