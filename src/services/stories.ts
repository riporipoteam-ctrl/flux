import {
  collection,
  doc,
  getDocs,
  increment,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  type DocumentData,
  type Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { uploadImage } from "@/services/media";
import { getUser } from "@/services/users";
import type { UserProfile } from "@/types";

export type StoryMediaType = "image" | "video";

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
}): Promise<string> {
  if (!input.file.type.startsWith("image/") && !input.file.type.startsWith("video/")) {
    throw new Error("Stories support images and videos only");
  }
  if (input.file.size > 40 * 1024 * 1024) {
    throw new Error("Story media must be under 40 MB");
  }

  const ref = doc(collection(db, "stories"));
  const extension = input.file.name.split(".").pop() || (input.file.type.startsWith("video/") ? "mp4" : "jpg");
  const mediaUrl = await uploadImage(
    `stories/${input.authorId}/${ref.id}/${Date.now()}.${extension}`,
    input.file
  );

  await setDoc(ref, {
    authorId: input.authorId,
    mediaUrl,
    mediaType: input.file.type.startsWith("video/") ? "video" : "image",
    text: (input.text || "").slice(0, 240),
    textColor: input.textColor || "#ffffff",
    textStyle: input.textStyle || "clean",
    textPosition: input.textPosition || "center",
    designId: input.designId || null,
    musicId: input.musicId || null,
    viewsCount: 0,
    createdAt: serverTimestamp(),
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
  });

  return ref.id;
}

export async function getActiveStories(max = 80): Promise<StoryGroup[]> {
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
  await setDoc(viewRef, { viewerId, viewedAt: serverTimestamp() }, { merge: true });
  const storyRef = doc(db, "stories", storyId);
  await updateDoc(storyRef, { viewsCount: increment(1) }).catch(() => undefined);
}
