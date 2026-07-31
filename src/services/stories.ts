import {
  collection,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  type DocumentData,
  type Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { uploadImage } from "@/services/media";
import { getUser } from "@/services/users";
import type { UserProfile } from "@/types";

export type StoryMediaType = "image" | "video";

export interface StorySticker {
  id: string;
  kind: "emoji" | "label";
  value: string;
  x: number;
  y: number;
  scale: number;
  rotation: number;
}

export interface FluxStory {
  id: string;
  authorId: string;
  mediaUrl: string;
  mediaType: StoryMediaType;
  text: string;
  textColor: string;
  textStyle: "clean" | "bold" | "serif" | "mono";
  textPosition: "top" | "center" | "bottom";
  designId: string | null;
  musicId: string | null;
  stickers: StorySticker[];
  viewsCount: number;
  createdAt: Timestamp | null;
  expiresAt: Timestamp | Date | null;
  author?: UserProfile | null;
}

export interface StoryGroup {
  authorId: string;
  author: UserProfile | null;
  stories: FluxStory[];
}

export interface StoryViewerProfile {
  uid: string;
  viewedAt: Timestamp | null;
  profile: UserProfile | null;
}

function mapStory(id: string, data: DocumentData): FluxStory {
  return {
    id,
    authorId: String(data.authorId || ""),
    mediaUrl: String(data.mediaUrl || ""),
    mediaType: data.mediaType === "video" ? "video" : "image",
    text: String(data.text || ""),
    textColor: String(data.textColor || "#ffffff"),
    textStyle: data.textStyle || "clean",
    textPosition: data.textPosition || "center",
    designId: data.designId || null,
    musicId: data.musicId || null,
    stickers: Array.isArray(data.stickers)
      ? data.stickers
          .filter((item: unknown) => Boolean(item && typeof item === "object"))
          .slice(0, 20)
          .map((item: Record<string, unknown>, index: number) => ({
            id: String(item.id || `sticker-${index}`),
            kind: item.kind === "label" ? "label" : "emoji",
            value: String(item.value || "✨").slice(0, 40),
            x: Math.min(92, Math.max(8, Number(item.x || 50))),
            y: Math.min(92, Math.max(8, Number(item.y || 50))),
            scale: Math.min(2.5, Math.max(0.55, Number(item.scale || 1))),
            rotation: Math.min(180, Math.max(-180, Number(item.rotation || 0))),
          }))
      : [],
    viewsCount: Number(data.viewsCount || 0),
    createdAt: data.createdAt || null,
    expiresAt: data.expiresAt || null,
  };
}

function storyExpiryMs(value: FluxStory["expiresAt"]): number {
  if (!value) return 0;
  if (value instanceof Date) return value.getTime();
  if (typeof value === "object" && "toDate" in value && typeof value.toDate === "function") {
    return value.toDate().getTime();
  }
  return 0;
}

export async function createStory(input: {
  authorId: string;
  file: File;
  text?: string;
  textColor?: string;
  textStyle?: FluxStory["textStyle"];
  textPosition?: FluxStory["textPosition"];
  designId?: string | null;
  musicId?: string | null;
  stickers?: StorySticker[];
}): Promise<string> {
  if (!input.file.type.startsWith("image/") && !input.file.type.startsWith("video/")) {
    throw new Error("Stories support images and videos only");
  }
  if (input.file.size > 40 * 1024 * 1024) {
    throw new Error("Story media must be under 40 MB");
  }

  const storyRef = doc(collection(db, "stories"));
  const extension = input.file.name.split(".").pop() || (input.file.type.startsWith("video/") ? "mp4" : "jpg");
  const mediaUrl = await uploadImage(
    `stories/${input.authorId}/${storyRef.id}/${Date.now()}.${extension}`,
    input.file
  );

  await setDoc(storyRef, {
    authorId: input.authorId,
    mediaUrl,
    mediaType: input.file.type.startsWith("video/") ? "video" : "image",
    text: (input.text || "").slice(0, 240),
    textColor: input.textColor || "#ffffff",
    textStyle: input.textStyle || "clean",
    textPosition: input.textPosition || "center",
    designId: input.designId || null,
    musicId: input.musicId || null,
    stickers: (input.stickers || []).slice(0, 20),
    viewsCount: 0,
    createdAt: serverTimestamp(),
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
  });

  return storyRef.id;
}

export async function getActiveStories(max = 100): Promise<StoryGroup[]> {
  const snap = await getDocs(query(collection(db, "stories"), orderBy("createdAt", "desc"), limit(max)));
  const now = Date.now();
  const stories = snap.docs
    .map((item) => mapStory(item.id, item.data()))
    .filter((story) => story.mediaUrl && storyExpiryMs(story.expiresAt) > now);

  const authors = [...new Set(stories.map((story) => story.authorId))];
  const profiles = await Promise.all(authors.map((uid) => getUser(uid)));
  const profileMap = new Map(profiles.filter(Boolean).map((profile) => [profile!.uid, profile!]));
  const grouped = new Map<string, FluxStory[]>();

  for (const story of stories) {
    const list = grouped.get(story.authorId) || [];
    list.push({ ...story, author: profileMap.get(story.authorId) || null });
    grouped.set(story.authorId, list);
  }

  return [...grouped.entries()].map(([authorId, list]) => ({
    authorId,
    author: profileMap.get(authorId) || null,
    stories: list.sort(
      (a, b) => (a.createdAt?.toMillis?.() || 0) - (b.createdAt?.toMillis?.() || 0)
    ),
  }));
}

export async function markStoryViewed(storyId: string, viewerId: string): Promise<void> {
  const viewRef = doc(db, "stories", storyId, "views", viewerId);
  const storyRef = doc(db, "stories", storyId);

  await runTransaction(db, async (transaction) => {
    const viewSnap = await transaction.get(viewRef);
    const storySnap = await transaction.get(storyRef);
    if (!storySnap.exists()) return;

    if (!viewSnap.exists()) {
      transaction.set(viewRef, { viewerId, viewedAt: serverTimestamp() });
      transaction.update(storyRef, { viewsCount: Number(storySnap.data().viewsCount || 0) + 1 });
    } else {
      transaction.set(viewRef, { viewerId, viewedAt: serverTimestamp() }, { merge: true });
    }
  });
}

export async function getStoryViewers(storyId: string): Promise<StoryViewerProfile[]> {
  const snap = await getDocs(query(collection(db, "stories", storyId, "views"), orderBy("viewedAt", "desc"), limit(250)));
  const rows = snap.docs.map((item) => ({
    uid: String(item.data().viewerId || item.id),
    viewedAt: (item.data().viewedAt || null) as Timestamp | null,
  }));
  const profiles = await Promise.all(rows.map((item) => getUser(item.uid)));
  return rows.map((item, index) => ({ ...item, profile: profiles[index] || null }));
}
