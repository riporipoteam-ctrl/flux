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
import { imageToFirestoreFallback, processStoryImage } from "@/lib/media-processing";
import { getUser } from "@/services/users";
import type { UserProfile } from "@/types";

export type StoryMediaType = "image" | "video";
export type StoryLayerKind = "emoji" | "label" | "text" | "shape";
export type StoryShape = "rectangle" | "circle" | "pill" | "line";
export type StoryFont = "sans" | "display" | "serif" | "mono";
export type StoryAlign = "left" | "center" | "right";

export interface StorySticker {
  id: string;
  kind: StoryLayerKind;
  value: string;
  x: number;
  y: number;
  scale: number;
  rotation: number;
  width?: number;
  opacity?: number;
  color?: string;
  background?: string;
  fontSize?: number;
  fontFamily?: StoryFont;
  fontWeight?: number;
  align?: StoryAlign;
  shape?: StoryShape;
  locked?: boolean;
  hidden?: boolean;
}

export interface FluxStory {
  id: string;
  authorId: string;
  mediaUrl: string;
  mediaType: StoryMediaType;
  mediaStorage?: "firebase" | "firestore-fallback" | "none";
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

const TEXT_STORY_MEDIA =
  "data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns='http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg'%20width='9'%20height='16'%20viewBox='0%200%209%2016'%3E%3Crect%20width='9'%20height='16'%20fill='transparent'%2F%3E%3C%2Fsvg%3E";

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
}

function storyLayerKind(value: unknown): StoryLayerKind {
  return value === "label" || value === "text" || value === "shape" ? value : "emoji";
}

function storyShape(value: unknown): StoryShape {
  return value === "circle" || value === "pill" || value === "line" ? value : "rectangle";
}

function storyFont(value: unknown): StoryFont {
  return value === "display" || value === "serif" || value === "mono" ? value : "sans";
}

function storyAlign(value: unknown): StoryAlign {
  return value === "left" || value === "right" ? value : "center";
}

function mapLayer(item: Record<string, unknown>, index: number): StorySticker {
  const kind = storyLayerKind(item.kind);
  return {
    id: String(item.id || `layer-${index}`),
    kind,
    value: String(item.value || (kind === "shape" ? "" : kind === "text" ? "Text" : "✨")).slice(0, kind === "text" ? 240 : 40),
    x: clampNumber(item.x, 2, 98, 50),
    y: clampNumber(item.y, 2, 98, 50),
    scale: clampNumber(item.scale, 0.15, 5, 1),
    rotation: clampNumber(item.rotation, -180, 180, 0),
    width: clampNumber(item.width, 12, 94, kind === "text" ? 72 : 36),
    opacity: clampNumber(item.opacity, 0.1, 1, 1),
    color: String(item.color || (kind === "shape" ? "#ffffff" : "#ffffff")).slice(0, 32),
    background: String(item.background || (kind === "label" ? "#ffffff" : "transparent")).slice(0, 40),
    fontSize: clampNumber(item.fontSize, 12, 96, kind === "text" ? 32 : 18),
    fontFamily: storyFont(item.fontFamily),
    fontWeight: clampNumber(item.fontWeight, 300, 900, kind === "text" ? 800 : 700),
    align: storyAlign(item.align),
    shape: storyShape(item.shape),
    locked: item.locked === true,
    hidden: item.hidden === true,
  };
}

function mapStory(id: string, data: DocumentData): FluxStory {
  return {
    id,
    authorId: String(data.authorId || ""),
    mediaUrl: String(data.mediaUrl || TEXT_STORY_MEDIA),
    mediaType: data.mediaType === "video" ? "video" : "image",
    mediaStorage: data.mediaStorage === "firebase" || data.mediaStorage === "firestore-fallback" ? data.mediaStorage : "none",
    text: String(data.text || ""),
    textColor: String(data.textColor || "#ffffff"),
    textStyle: data.textStyle === "bold" || data.textStyle === "serif" || data.textStyle === "mono" ? data.textStyle : "clean",
    textPosition: data.textPosition === "top" || data.textPosition === "bottom" ? data.textPosition : "center",
    designId: data.designId || null,
    musicId: data.musicId || null,
    stickers: Array.isArray(data.stickers)
      ? data.stickers
          .filter((item: unknown) => Boolean(item && typeof item === "object"))
          .slice(0, 40)
          .map((item: Record<string, unknown>, index: number) => mapLayer(item, index))
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

export function isTextOnlyStory(story: Pick<FluxStory, "mediaUrl">): boolean {
  return story.mediaUrl.startsWith("data:image/svg+xml");
}

export async function createStory(input: {
  authorId: string;
  file?: File | null;
  text?: string;
  textColor?: string;
  textStyle?: FluxStory["textStyle"];
  textPosition?: FluxStory["textPosition"];
  designId?: string | null;
  musicId?: string | null;
  stickers?: StorySticker[];
}): Promise<string> {
  const text = (input.text || "").trim().slice(0, 240);
  const stickers = (input.stickers || [])
    .slice(0, 40)
    .map((item, index) => mapLayer(item as unknown as Record<string, unknown>, index));

  if (!input.file && !text && stickers.filter((item) => !item.hidden).length === 0) {
    throw new Error("Add a photo, video, text, shape, or sticker first.");
  }

  if (input.file && !input.file.type.startsWith("image/") && !input.file.type.startsWith("video/")) {
    throw new Error("Stories support images and videos only.");
  }
  if (input.file && input.file.size > 40 * 1024 * 1024) {
    throw new Error("Story media must be under 40 MB.");
  }

  const storyRef = doc(collection(db, "stories"));
  let mediaUrl = TEXT_STORY_MEDIA;
  let mediaType: StoryMediaType = "image";
  let mediaStorage: FluxStory["mediaStorage"] = "none";
  let uploadWarning: string | null = null;

  if (input.file) {
    mediaType = input.file.type.startsWith("video/") ? "video" : "image";
    const preparedFile = mediaType === "image"
      ? (await processStoryImage(input.file, { maxDimension: 1920, quality: 0.84 })).file
      : input.file;
    const extension = preparedFile.name.split(".").pop() || (mediaType === "video" ? "mp4" : "webp");

    try {
      mediaUrl = await uploadImage(`stories/${input.authorId}/${storyRef.id}/${Date.now()}.${extension}`, preparedFile);
      mediaStorage = "firebase";
    } catch (error) {
      if (mediaType === "video") {
        throw new Error(error instanceof Error
          ? `${error.message} Video Stories require Firebase Storage, so this Story was not published.`
          : "Video Stories require Firebase Storage, and the upload failed.");
      }
      mediaUrl = await imageToFirestoreFallback(input.file);
      mediaStorage = "firestore-fallback";
      uploadWarning = error instanceof Error ? error.message : "Firebase Storage was unavailable.";
      console.warn("Flux Story used the Firestore image fallback:", uploadWarning);
    }
  }

  await setDoc(storyRef, {
    authorId: input.authorId,
    mediaUrl,
    mediaType,
    mediaStorage,
    uploadWarning,
    text,
    textColor: input.textColor || "#ffffff",
    textStyle: input.textStyle || "clean",
    textPosition: input.textPosition || "center",
    designId: input.designId || (input.file ? null : "ocean"),
    musicId: input.musicId || null,
    stickers,
    editorVersion: 3,
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
    stories: list.sort((a, b) => (a.createdAt?.toMillis?.() || 0) - (b.createdAt?.toMillis?.() || 0)),
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
      transaction.set(viewRef, { viewerId, viewedAt: serverTimestamp(), firstViewedAt: serverTimestamp() });
      transaction.update(storyRef, { viewsCount: Number(storySnap.data().viewsCount || 0) + 1 });
      return;
    }

    transaction.set(viewRef, { viewerId, viewedAt: serverTimestamp() }, { merge: true });
  });
}

export async function getStoryViewers(storyId: string): Promise<StoryViewerProfile[]> {
  const snap = await getDocs(query(collection(db, "stories", storyId, "views"), orderBy("viewedAt", "desc"), limit(250)));
  const rows = snap.docs.map((item) => ({ uid: String(item.data().viewerId || item.id), viewedAt: (item.data().viewedAt || null) as Timestamp | null }));
  const profiles = await Promise.all(rows.map((item) => getUser(item.uid)));
  return rows.map((item, index) => ({ ...item, profile: profiles[index] || null }));
}
