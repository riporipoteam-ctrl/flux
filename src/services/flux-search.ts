import {
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  where,
  type DocumentData,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { groupPath, postPath, profilePath } from "@/lib/routes";
import { getUser } from "@/services/users";

export type FluxSearchKind = "person" | "group" | "post";
export type FluxSearchCardType = "user" | "group" | "post";

export interface FluxSearchResult {
  id: string;
  kind: FluxSearchKind;
  type: FluxSearchCardType;
  title: string;
  subtitle: string;
  description: string;
  imageUrl: string | null;
  href: string;
  score: number;
  meta?: string;
}

function normalize(value: unknown): string {
  return String(value || "").toLocaleLowerCase().trim();
}

function tokens(value: string): string[] {
  return normalize(value)
    .replace(/[^\p{L}\p{N}_#@-]+/gu, " ")
    .split(/\s+/)
    .filter((item) => item.length > 1)
    .slice(0, 10);
}

function scoreText(queryText: string, fields: Array<unknown>): number {
  const clean = normalize(queryText).replace(/^@/, "");
  const queryTokens = tokens(clean);
  const text = fields.map(normalize).join(" ");
  if (!clean || !text) return 0;

  let score = 0;
  if (text === clean) score += 160;
  if (text.startsWith(clean)) score += 90;
  if (text.includes(clean)) score += 55;
  for (const token of queryTokens) {
    if (text.includes(token)) score += 18;
    if (text.split(/\s+/).some((word) => word.startsWith(token))) score += 9;
  }
  return score;
}

function mapPeople(docs: Array<{ id: string; data: () => DocumentData }>, queryText: string): FluxSearchResult[] {
  return docs
    .map((item) => {
      const data = item.data();
      const score = scoreText(queryText, [data.username, data.displayName, data.businessName, data.bio, data.location, ...(data.interests || [])]);
      return {
        id: item.id,
        kind: "person" as const,
        type: "user" as const,
        title: String(data.displayName || data.username || "Flux user"),
        subtitle: `@${String(data.username || "user")}`,
        description: String(data.bio || data.businessName || "Flux member").slice(0, 180),
        imageUrl: data.avatarUrl || null,
        href: profilePath(data.username),
        score,
        meta: `${Number(data.followersCount || 0)} followers`,
      };
    })
    .filter((item) => item.score > 0);
}

function mapGroups(docs: Array<{ id: string; data: () => DocumentData }>, queryText: string): FluxSearchResult[] {
  return docs
    .map((item) => {
      const data = item.data();
      const score = scoreText(queryText, [data.name, data.slug, data.description, data.rules]);
      return {
        id: item.id,
        kind: "group" as const,
        type: "group" as const,
        title: String(data.name || "Flux group"),
        subtitle: data.isPrivate ? "Private group" : "Public group",
        description: String(data.description || "Community on Flux").slice(0, 180),
        imageUrl: data.avatarUrl || null,
        href: groupPath(item.id),
        score,
        meta: `${Number(data.memberCount || 0)} members`,
      };
    })
    .filter((item) => item.score > 0);
}

async function mapPosts(
  docs: Array<{ id: string; data: () => DocumentData }>,
  queryText: string
): Promise<FluxSearchResult[]> {
  const candidates = docs
    .map((item) => ({ id: item.id, data: item.data() }))
    .filter(({ data }) => !data.isDeleted && !data.isDraft && (!data.visibility || data.visibility === "public"))
    .map(({ id, data }) => ({
      id,
      data,
      score: scoreText(queryText, [data.text, ...(data.hashtags || []), ...(data.mentions || [])]),
    }))
    .filter((item) => item.score > 0)
    .slice(0, 18);

  const authorIds = [...new Set(candidates.map((item) => String(item.data.authorId || "")).filter(Boolean))];
  const authors = await Promise.all(authorIds.map((uid) => getUser(uid).catch(() => null)));
  const authorMap = new Map(authors.filter(Boolean).map((author) => [author!.uid, author!]));

  return candidates.map(({ id, data, score }) => {
    const author = authorMap.get(String(data.authorId || ""));
    const media = Array.isArray(data.media) ? data.media[0] : null;
    return {
      id,
      kind: "post" as const,
      type: "post" as const,
      title: author?.displayName || "Flux post",
      subtitle: `@${author?.username || "user"}`,
      description: String(data.text || "Post on Flux").slice(0, 240),
      imageUrl: media?.thumbUrl || media?.url || author?.avatarUrl || null,
      href: postPath(id),
      score,
      meta: `${Number(data.likesCount || 0)} likes · ${Number(data.viewsCount || 0)} views`,
    };
  });
}

export async function searchFlux(
  queryText: string,
  options: { kinds?: FluxSearchKind[]; max?: number } = {}
): Promise<FluxSearchResult[]> {
  const clean = queryText.trim().replace(/^(search|find|look up)\s+(flux\s+)?/i, "").trim();
  if (clean.length < 2) return [];
  const kinds = options.kinds || ["person", "group", "post"];
  const max = Math.min(30, Math.max(1, options.max || 18));

  const [peopleSnap, groupsSnap, postsSnap] = await Promise.all([
    kinds.includes("person")
      ? getDocs(query(collection(db, "users"), where("onboardingComplete", "==", true), limit(120))).catch(() => null)
      : Promise.resolve(null),
    kinds.includes("group")
      ? getDocs(query(collection(db, "groups"), limit(100))).catch(() => null)
      : Promise.resolve(null),
    kinds.includes("post")
      ? getDocs(query(collection(db, "posts"), orderBy("createdAt", "desc"), limit(160))).catch(() => null)
      : Promise.resolve(null),
  ]);

  const people = peopleSnap ? mapPeople(peopleSnap.docs, clean) : [];
  const groups = groupsSnap ? mapGroups(groupsSnap.docs, clean) : [];
  const posts = postsSnap ? await mapPosts(postsSnap.docs, clean) : [];

  return [...people, ...groups, ...posts]
    .sort((a, b) => b.score - a.score)
    .slice(0, max);
}
