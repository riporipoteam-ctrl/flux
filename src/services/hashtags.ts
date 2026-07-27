import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  setDoc,
  updateDoc,
  increment,
  serverTimestamp,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { extractHashtags } from "@/lib/utils";

export interface HashtagInfo {
  tag: string;
  postsCount: number;
  trendingScore: number;
}

export async function getTrendingHashtags(max = 5): Promise<HashtagInfo[]> {
  try {
    const snap = await getDocs(
      query(
        collection(db, "hashtags"),
        orderBy("trendingScore", "desc"),
        limit(max)
      )
    );
    return snap.docs.map((d) => ({
      tag: d.data().tag || d.id,
      postsCount: d.data().postsCount || 0,
      trendingScore: d.data().trendingScore || 0,
    }));
  } catch {
    try {
      const snap = await getDocs(query(collection(db, "hashtags"), limit(40)));
      return snap.docs
        .map((d) => ({
          tag: d.data().tag || d.id,
          postsCount: d.data().postsCount || 0,
          trendingScore: d.data().trendingScore || d.data().postsCount || 0,
        }))
        .sort((a, b) => b.trendingScore - a.trendingScore)
        .slice(0, max);
    } catch {
      return [];
    }
  }
}

export async function searchHashtags(
  prefix: string,
  max = 8
): Promise<HashtagInfo[]> {
  const p = prefix.replace(/^#/, "").toLowerCase().trim();
  if (!p) return getTrendingHashtags(max);

  // Prefer trending that match prefix; also allow inventing typed tag
  const all = await getTrendingHashtags(30);
  const matched = all.filter((h) => h.tag.toLowerCase().startsWith(p));
  if (!matched.find((h) => h.tag === p)) {
    matched.unshift({ tag: p, postsCount: 0, trendingScore: 0 });
  }
  return matched.slice(0, max);
}

export async function ensureHashtagsFromText(text: string): Promise<void> {
  const tags = extractHashtags(text);
  for (const tag of tags) {
    const ref = doc(db, "hashtags", tag);
    const snap = await getDoc(ref);
    if (snap.exists()) {
      await updateDoc(ref, {
        postsCount: increment(1),
        trendingScore: increment(2),
        lastUsedAt: serverTimestamp(),
      });
    } else {
      await setDoc(ref, {
        tag,
        postsCount: 1,
        trendingScore: 2,
        lastUsedAt: serverTimestamp(),
        createdAt: serverTimestamp(),
      });
    }
  }
}

export async function getPostsByHashtag(tag: string, max = 40) {
  const t = tag.replace(/^#/, "").toLowerCase();
  try {
    const snap = await getDocs(
      query(
        collection(db, "posts"),
        where("hashtags", "array-contains", t),
        orderBy("createdAt", "desc"),
        limit(max)
      )
    );
    return snap.docs.map((d) => d.id);
  } catch {
    const snap = await getDocs(
      query(collection(db, "posts"), where("hashtags", "array-contains", t), limit(max))
    );
    return snap.docs.map((d) => d.id);
  }
}
