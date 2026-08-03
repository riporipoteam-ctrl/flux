import {
  doc,
  increment,
  runTransaction,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { COIN_REWARDS } from "@/lib/constants";
import { createNotification } from "@/services/notifications";

function repostDocumentId(uid: string, postId: string): string {
  return `repost_${uid}_${postId}`;
}

/**
 * Sets a repost to an explicit state instead of blindly toggling it.
 *
 * A deterministic post document plus a Firestore transaction makes retries and
 * fast taps idempotent. The same account can never create multiple repost shell
 * documents for the same original post through this path.
 */
export async function setRepostState(
  postId: string,
  uid: string,
  desired: boolean
): Promise<boolean> {
  const postRef = doc(db, "posts", postId);
  const markerRef = doc(db, "posts", postId, "reposts", uid);
  const repostRef = doc(db, "posts", repostDocumentId(uid, postId));
  const userRef = doc(db, "users", uid);

  const result = await runTransaction(db, async (transaction) => {
    const [postSnap, markerSnap, repostSnap, userSnap] = await Promise.all([
      transaction.get(postRef),
      transaction.get(markerRef),
      transaction.get(repostRef),
      transaction.get(userRef),
    ]);

    if (!postSnap.exists()) throw new Error("The original post no longer exists.");
    const currentlyReposted = markerSnap.exists();
    const original = postSnap.data();
    const originalCount = Math.max(0, Number(original.repostsCount || 0));
    const userPostsCount = Math.max(0, Number(userSnap.data()?.postsCount || 0));

    if (currentlyReposted === desired) {
      return {
        changed: false,
        authorId: String(original.authorId || ""),
      };
    }

    if (desired) {
      transaction.set(markerRef, {
        uid,
        repostPostId: repostRef.id,
        createdAt: serverTimestamp(),
      });
      transaction.update(postRef, {
        repostsCount: originalCount + 1,
        updatedAt: serverTimestamp(),
      });
      transaction.set(repostRef, {
        authorId: uid,
        text: "",
        media: [],
        poll: null,
        type: "repost",
        parentId: null,
        rootId: null,
        quoteOfId: null,
        repostOfId: postId,
        threadId: null,
        threadOrder: null,
        hashtags: [],
        mentions: [],
        groupId: null,
        eventId: null,
        visibility: "public",
        likesCount: 0,
        repliesCount: 0,
        repostsCount: 0,
        quotesCount: 0,
        bookmarksCount: 0,
        viewsCount: 0,
        isPinnedToProfile: false,
        scheduledFor: null,
        isDraft: false,
        isDeleted: false,
        createdAt: repostSnap.exists() ? repostSnap.data().createdAt || serverTimestamp() : serverTimestamp(),
        updatedAt: serverTimestamp(),
      }, { merge: true });
      if (userSnap.exists()) {
        transaction.update(userRef, {
          postsCount: userPostsCount + 1,
          updatedAt: serverTimestamp(),
        });
      }
    } else {
      transaction.delete(markerRef);
      transaction.update(postRef, {
        repostsCount: Math.max(0, originalCount - 1),
        updatedAt: serverTimestamp(),
      });
      if (repostSnap.exists()) {
        transaction.update(repostRef, {
          isDeleted: true,
          updatedAt: serverTimestamp(),
        });
      }
      if (userSnap.exists()) {
        transaction.update(userRef, {
          postsCount: Math.max(0, userPostsCount - 1),
          updatedAt: serverTimestamp(),
        });
      }
    }

    return {
      changed: true,
      authorId: String(original.authorId || ""),
    };
  });

  if (desired && result.changed && result.authorId && result.authorId !== uid) {
    await Promise.allSettled([
      createNotification({
        userId: result.authorId,
        actorId: uid,
        type: "repost",
        message: "reposted your post",
        postId,
      }),
      updateDoc(doc(db, "users", result.authorId), {
        coins: increment(COIN_REWARDS.repostReceived),
        updatedAt: serverTimestamp(),
      }),
    ]);
  }

  return desired;
}
