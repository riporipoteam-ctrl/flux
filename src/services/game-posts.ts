import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { GamePostSource, PostWithAuthor } from "@/types";
import { getUserPosts } from "./posts";

/**
 * Marks an existing normal Flux post as having been explicitly shared from a
 * Flux game experience. The post continues to use the regular Firestore/feed,
 * media, likes, replies, moderation, and profile systems.
 */
export async function tagGamePost(
  postId: string,
  authorId: string,
  gameSource: GamePostSource,
): Promise<void> {
  const ref = doc(db, "posts", postId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("Post not found");
  if (snap.data().authorId !== authorId) throw new Error("Not allowed");

  const safeSource: GamePostSource = {
    gameId: String(gameSource.gameId).slice(0, 64),
    gameName: String(gameSource.gameName).slice(0, 96),
    buildId: gameSource.buildId ? String(gameSource.buildId).slice(0, 96) : null,
    captureId: gameSource.captureId ? String(gameSource.captureId).slice(0, 128) : null,
  };

  await updateDoc(ref, { gameSource: safeSource });
}

function legacyRecRoomSource(post: PostWithAuthor): GamePostSource | null {
  const tags = new Set((post.hashtags || []).map((tag) => tag.toLowerCase()));
  if (!post.media?.length || !tags.has("recroom") || !tags.has("fluxgames")) return null;
  return {
    gameId: "recroom",
    gameName: "Rec Room",
    buildId: "recroom-2022-05-19",
    captureId: null,
  };
}

/**
 * Returns game-share media for a user's profile. New posts can carry the
 * explicit `gameSource` field. Existing Rec Room captures created by the first
 * Flux integration are recognized only when they have media plus both canonical
 * #RecRoom and #FluxGames tags.
 */
export async function getUserGamePosts(
  authorId: string,
  currentUid?: string | null,
): Promise<PostWithAuthor[]> {
  const mediaPosts = await getUserPosts(authorId, "media", currentUid);
  const enriched = await Promise.all(
    mediaPosts.map(async (post) => {
      try {
        const snap = await getDoc(doc(db, "posts", post.id));
        const source = snap.exists() ? (snap.data().gameSource as GamePostSource | undefined) : undefined;
        const resolved = source?.gameId ? source : legacyRecRoomSource(post);
        return resolved ? { ...post, gameSource: resolved } : null;
      } catch {
        const legacy = legacyRecRoomSource(post);
        return legacy ? { ...post, gameSource: legacy } : null;
      }
    }),
  );

  return enriched.filter((post): post is PostWithAuthor => Boolean(post));
}
