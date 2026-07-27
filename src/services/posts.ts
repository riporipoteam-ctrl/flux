import {
  collection,
  doc,
  getDoc,
  getDocs,
  updateDoc,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  serverTimestamp,
  writeBatch,
  increment,
  type DocumentData,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { MediaItem, Poll, Post, PostWithAuthor } from "@/types";
import { extractHashtags, extractMentions } from "@/lib/utils";
import { getUser } from "./users";
import { getFollowingIds } from "./follows";
import { createNotification } from "./notifications";
import { uploadPostMedia, fileToMediaType } from "./media";
import { COIN_REWARDS } from "@/lib/constants";
import { stripUndefined } from "@/lib/firestore-safe";

function mapPost(id: string, data: DocumentData): Post {
  return {
    id,
    authorId: data.authorId,
    text: data.text ?? "",
    media: data.media ?? [],
    poll: data.poll ?? null,
    type: data.type ?? "post",
    parentId: data.parentId ?? null,
    rootId: data.rootId ?? null,
    quoteOfId: data.quoteOfId ?? null,
    repostOfId: data.repostOfId ?? null,
    threadId: data.threadId ?? null,
    threadOrder: data.threadOrder ?? null,
    hashtags: data.hashtags ?? [],
    mentions: data.mentions ?? [],
    groupId: data.groupId ?? null,
    eventId: data.eventId ?? null,
    visibility: data.visibility ?? "public",
    likesCount: data.likesCount ?? 0,
    repliesCount: data.repliesCount ?? 0,
    repostsCount: data.repostsCount ?? 0,
    quotesCount: data.quotesCount ?? 0,
    bookmarksCount: data.bookmarksCount ?? 0,
    viewsCount: data.viewsCount ?? 0,
    isPinnedToProfile: data.isPinnedToProfile ?? false,
    scheduledFor: data.scheduledFor ?? null,
    isDraft: data.isDraft ?? false,
    isDeleted: data.isDeleted ?? false,
    createdAt: data.createdAt ?? null,
    updatedAt: data.updatedAt ?? null,
  };
}

async function attachAuthors(
  posts: Post[],
  currentUid?: string | null
): Promise<PostWithAuthor[]> {
  const authorIds = [...new Set(posts.map((p) => p.authorId))];
  const authors = await Promise.all(authorIds.map((id) => getUser(id)));
  const authorMap = new Map(
    authors.filter(Boolean).map((a) => [a!.uid, a!])
  );

  const enriched = await Promise.all(
    posts.map(async (post) => {
      let likedByMe = false;
      let bookmarkedByMe = false;
      let repostedByMe = false;
      if (currentUid) {
        const [like, bookmark, repost] = await Promise.all([
          getDoc(doc(db, "posts", post.id, "likes", currentUid)),
          getDoc(doc(db, "posts", post.id, "bookmarks", currentUid)),
          getDoc(doc(db, "posts", post.id, "reposts", currentUid)),
        ]);
        likedByMe = like.exists();
        bookmarkedByMe = bookmark.exists();
        repostedByMe = repost.exists();
      }

      let quotedPost: PostWithAuthor | null = null;
      if (post.quoteOfId) {
        const qSnap = await getDoc(doc(db, "posts", post.quoteOfId));
        if (qSnap.exists()) {
          const qp = mapPost(qSnap.id, qSnap.data());
          quotedPost = {
            ...qp,
            author: (await getUser(qp.authorId)) ?? null,
          };
        }
      }

      return {
        ...post,
        author: authorMap.get(post.authorId) ?? null,
        likedByMe,
        bookmarkedByMe,
        repostedByMe,
        quotedPost,
      };
    })
  );

  return enriched;
}

export async function createPost(input: {
  authorId: string;
  text: string;
  files?: File[];
  /** Pre-hosted media (e.g. GIF URLs) */
  extraMedia?: MediaItem[];
  poll?: { options: string[]; endsInHours?: number } | null;
  type?: Post["type"];
  parentId?: string | null;
  quoteOfId?: string | null;
  repostOfId?: string | null;
  threadId?: string | null;
  threadOrder?: number | null;
  isDraft?: boolean;
  groupId?: string | null;
  eventId?: string | null;
}): Promise<string> {
  const postRef = doc(collection(db, "posts"));
  const postId = postRef.id;

  const media: MediaItem[] = [...(input.extraMedia || [])];
  if (input.files?.length) {
    for (let i = 0; i < input.files.length; i++) {
      const file = input.files[i];
      const url = await uploadPostMedia(input.authorId, postId, file, i);
      media.push({ type: fileToMediaType(file), url });
    }
  }

  let poll: Poll | null = null;
  if (input.poll?.options?.length) {
    const ends = new Date();
    ends.setHours(ends.getHours() + (input.poll.endsInHours ?? 24));
    poll = {
      options: input.poll.options
        .filter(Boolean)
        .map((text, i) => ({ id: `opt_${i}`, text, votes: 0 })),
      endsAt: null, // set below as Timestamp via Date in set
    };
    // store endsAt as Date — Firestore accepts Date
  }

  const hashtags = extractHashtags(input.text);
  const mentions = extractMentions(input.text);

  let rootId: string | null = null;
  if (input.parentId) {
    const parentSnap = await getDoc(doc(db, "posts", input.parentId));
    if (parentSnap.exists()) {
      const pdata = parentSnap.data();
      rootId = (pdata.rootId as string) || input.parentId;
    } else {
      rootId = input.parentId;
    }
  }

  const payload: Record<string, unknown> = {
    authorId: input.authorId,
    text: input.text.trim(),
    media,
    poll: poll
      ? {
          options: poll.options,
          endsAt: new Date(
            Date.now() + (input.poll?.endsInHours ?? 24) * 3600_000
          ),
        }
      : null,
    type: input.type ?? "post",
    parentId: input.parentId ?? null,
    rootId,
    quoteOfId: input.quoteOfId ?? null,
    repostOfId: input.repostOfId ?? null,
    threadId: input.threadId ?? null,
    threadOrder: input.threadOrder ?? null,
    hashtags,
    mentions,
    groupId: input.groupId ?? null,
    eventId: input.eventId ?? null,
    visibility: "public",
    likesCount: 0,
    repliesCount: 0,
    repostsCount: 0,
    quotesCount: 0,
    bookmarksCount: 0,
    viewsCount: 0,
    isPinnedToProfile: false,
    scheduledFor: null,
    isDraft: input.isDraft ?? false,
    isDeleted: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const batch = writeBatch(db);
  batch.set(postRef, stripUndefined(payload));

  if (!input.isDraft) {
    batch.update(doc(db, "users", input.authorId), {
      postsCount: increment(1),
      coins: increment(COIN_REWARDS.post),
      updatedAt: serverTimestamp(),
    });
  }

  if (input.parentId) {
    batch.update(doc(db, "posts", input.parentId), {
      repliesCount: increment(1),
    });
  }
  if (input.quoteOfId) {
    batch.update(doc(db, "posts", input.quoteOfId), {
      quotesCount: increment(1),
    });
  }

  await batch.commit();

  // hashtags
  const { setDoc } = await import("firebase/firestore");
  for (const tag of hashtags) {
    const tagRef = doc(db, "hashtags", tag);
    const tagSnap = await getDoc(tagRef);
    if (tagSnap.exists()) {
      await updateDoc(tagRef, {
        postsCount: increment(1),
        lastUsedAt: serverTimestamp(),
        trendingScore: increment(1),
      });
    } else {
      await setDoc(tagRef, {
        tag,
        postsCount: 1,
        lastUsedAt: serverTimestamp(),
        trendingScore: 1,
      });
    }
  }

  if (input.parentId) {
    const parent = await getDoc(doc(db, "posts", input.parentId));
    if (parent.exists()) {
      await createNotification({
        userId: parent.data().authorId,
        actorId: input.authorId,
        type: "reply",
        message: "replied to your post",
        postId: postId,
      });
    }
  }

  return postId;
}

export async function getForYouFeed(
  currentUid?: string | null,
  pageSize = 20,
  cursor?: QueryDocumentSnapshot | null
): Promise<{ posts: PostWithAuthor[]; lastDoc: QueryDocumentSnapshot | null }> {
  let muted = new Set<string>();
  if (currentUid) {
    try {
      const me = await getUser(currentUid);
      muted = new Set(me?.mutedUserIds || []);
    } catch {
      /* ignore */
    }
  }
  let q = query(
    collection(db, "posts"),
    where("isDeleted", "==", false),
    where("isDraft", "==", false),
    where("type", "in", ["post", "quote", "repost"]),
    orderBy("createdAt", "desc"),
    limit(pageSize)
  );

  if (cursor) {
    q = query(
      collection(db, "posts"),
      where("isDeleted", "==", false),
      where("isDraft", "==", false),
      where("type", "in", ["post", "quote", "repost"]),
      orderBy("createdAt", "desc"),
      startAfter(cursor),
      limit(pageSize)
    );
  }

  try {
    const snap = await getDocs(q);
    const posts = snap.docs
      .map((d) => mapPost(d.id, d.data()))
      .filter((p) => !muted.has(p.authorId));
    const enriched = await attachAuthors(posts, currentUid);
    return {
      posts: enriched,
      lastDoc: snap.docs[snap.docs.length - 1] ?? null,
    };
  } catch {
    // Fallback simpler query if indexes missing
    const snap = await getDocs(
      query(collection(db, "posts"), orderBy("createdAt", "desc"), limit(pageSize))
    );
    const posts = snap.docs
      .map((d) => mapPost(d.id, d.data()))
      .filter(
        (p) =>
          !p.isDeleted &&
          !p.isDraft &&
          p.type !== "reply" &&
          !muted.has(p.authorId)
      );
    return {
      posts: await attachAuthors(posts, currentUid),
      lastDoc: snap.docs[snap.docs.length - 1] ?? null,
    };
  }
}

export async function getFollowingFeed(
  uid: string,
  pageSize = 20
): Promise<PostWithAuthor[]> {
  const following = await getFollowingIds(uid);
  const authorIds = [...following, uid];
  if (!authorIds.length) return [];

  // Firestore `in` max 10 — chunk
  const chunks: string[][] = [];
  for (let i = 0; i < authorIds.length; i += 10) {
    chunks.push(authorIds.slice(i, i + 10));
  }

  const all: Post[] = [];
  for (const chunk of chunks) {
    try {
      const snap = await getDocs(
        query(
          collection(db, "posts"),
          where("authorId", "in", chunk),
          where("isDeleted", "==", false),
          where("isDraft", "==", false),
          orderBy("createdAt", "desc"),
          limit(pageSize)
        )
      );
      all.push(...snap.docs.map((d) => mapPost(d.id, d.data())));
    } catch {
      const snap = await getDocs(
        query(
          collection(db, "posts"),
          where("authorId", "in", chunk),
          limit(pageSize)
        )
      );
      all.push(
        ...snap.docs
          .map((d) => mapPost(d.id, d.data()))
          .filter((p) => !p.isDeleted && !p.isDraft)
      );
    }
  }

  all.sort((a, b) => {
    const ta = a.createdAt?.toMillis?.() ?? 0;
    const tb = b.createdAt?.toMillis?.() ?? 0;
    return tb - ta;
  });

  return attachAuthors(all.slice(0, pageSize), uid);
}

export async function getUserPosts(
  authorId: string,
  tab: "posts" | "replies" | "media" | "likes" = "posts",
  currentUid?: string | null
): Promise<PostWithAuthor[]> {
  if (tab === "likes") {
    const likesSnap = await getDocs(
      query(collection(db, "users", authorId, "likes"), limit(50))
    );
    const posts: Post[] = [];
    for (const d of likesSnap.docs) {
      const p = await getDoc(doc(db, "posts", d.id));
      if (p.exists()) posts.push(mapPost(p.id, p.data()));
    }
    return attachAuthors(posts, currentUid);
  }

  try {
    const snap = await getDocs(
      query(
        collection(db, "posts"),
        where("authorId", "==", authorId),
        where("isDeleted", "==", false),
        where("isDraft", "==", false),
        orderBy("createdAt", "desc"),
        limit(40)
      )
    );
    let posts = snap.docs.map((d) => mapPost(d.id, d.data()));
    if (tab === "replies") posts = posts.filter((p) => p.type === "reply");
    else if (tab === "media")
      posts = posts.filter((p) => p.media?.length > 0 && p.type !== "reply");
    else posts = posts.filter((p) => p.type !== "reply");
    return attachAuthors(posts, currentUid);
  } catch {
    const snap = await getDocs(
      query(
        collection(db, "posts"),
        where("authorId", "==", authorId),
        limit(40)
      )
    );
    let posts = snap.docs
      .map((d) => mapPost(d.id, d.data()))
      .filter((p) => !p.isDeleted && !p.isDraft);
    if (tab === "replies") posts = posts.filter((p) => p.type === "reply");
    else if (tab === "media")
      posts = posts.filter((p) => p.media?.length > 0 && p.type !== "reply");
    else posts = posts.filter((p) => p.type !== "reply");
    posts.sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0));
    return attachAuthors(posts, currentUid);
  }
}

export async function toggleLike(
  postId: string,
  uid: string
): Promise<boolean> {
  const likeRef = doc(db, "posts", postId, "likes", uid);
  const userLikeRef = doc(db, "users", uid, "likes", postId);
  const postRef = doc(db, "posts", postId);
  const existing = await getDoc(likeRef);
  const batch = writeBatch(db);

  if (existing.exists()) {
    batch.delete(likeRef);
    batch.delete(userLikeRef);
    batch.update(postRef, { likesCount: increment(-1) });
    await batch.commit();
    return false;
  }

  batch.set(likeRef, { uid, createdAt: serverTimestamp() });
  batch.set(userLikeRef, { postId, createdAt: serverTimestamp() });
  batch.update(postRef, { likesCount: increment(1) });
  await batch.commit();

  try {
    const { bumpChallengeProgress } = await import("./shop");
    await bumpChallengeProgress(uid, "like");
  } catch {
    /* optional */
  }

  const post = await getDoc(postRef);
  if (post.exists()) {
    await createNotification({
      userId: post.data().authorId,
      actorId: uid,
      type: "like",
      message: "liked your post",
      postId,
    });
    await updateDoc(doc(db, "users", post.data().authorId), {
      coins: increment(COIN_REWARDS.likeReceived),
      likesCount: increment(1),
    });
  }
  return true;
}

export async function toggleBookmark(
  postId: string,
  uid: string
): Promise<boolean> {
  const ref = doc(db, "posts", postId, "bookmarks", uid);
  const userRef = doc(db, "users", uid, "bookmarks", postId);
  const existing = await getDoc(ref);
  const batch = writeBatch(db);
  if (existing.exists()) {
    batch.delete(ref);
    batch.delete(userRef);
    batch.update(doc(db, "posts", postId), {
      bookmarksCount: increment(-1),
    });
    await batch.commit();
    return false;
  }
  batch.set(ref, { uid, createdAt: serverTimestamp() });
  batch.set(userRef, { postId, createdAt: serverTimestamp() });
  batch.update(doc(db, "posts", postId), {
    bookmarksCount: increment(1),
  });
  await batch.commit();
  return true;
}

export async function toggleRepost(
  postId: string,
  uid: string
): Promise<boolean> {
  const ref = doc(db, "posts", postId, "reposts", uid);
  const existing = await getDoc(ref);
  const batch = writeBatch(db);

  if (existing.exists()) {
    batch.delete(ref);
    batch.update(doc(db, "posts", postId), {
      repostsCount: increment(-1),
    });
    // soft-delete user's repost posts
    await batch.commit();
    return false;
  }

  batch.set(ref, { uid, createdAt: serverTimestamp() });
  batch.update(doc(db, "posts", postId), {
    repostsCount: increment(1),
  });
  await batch.commit();

  await createPost({
    authorId: uid,
    text: "",
    type: "repost",
    repostOfId: postId,
  });

  const post = await getDoc(doc(db, "posts", postId));
  if (post.exists()) {
    await createNotification({
      userId: post.data().authorId,
      actorId: uid,
      type: "repost",
      message: "reposted your post",
      postId,
    });
    await updateDoc(doc(db, "users", post.data().authorId), {
      coins: increment(COIN_REWARDS.repostReceived),
    });
  }
  return true;
}

export async function deletePost(postId: string, uid: string): Promise<void> {
  const ref = doc(db, "posts", postId);
  const snap = await getDoc(ref);
  if (!snap.exists() || snap.data().authorId !== uid) {
    throw new Error("Not allowed");
  }
  await updateDoc(ref, {
    isDeleted: true,
    updatedAt: serverTimestamp(),
  });
  await updateDoc(doc(db, "users", uid), {
    postsCount: increment(-1),
  });
}

export async function pinPost(
  uid: string,
  postId: string | null
): Promise<void> {
  await updateDoc(doc(db, "users", uid), {
    pinnedPostId: postId,
    updatedAt: serverTimestamp(),
  });
}

/** One vote per user per post poll */
export async function votePoll(
  postId: string,
  uid: string,
  optionId: string
): Promise<PostWithAuthor | null> {
  const postRef = doc(db, "posts", postId);
  const voteRef = doc(db, "posts", postId, "pollVotes", uid);
  const postSnap = await getDoc(postRef);
  if (!postSnap.exists()) throw new Error("Post not found");
  const data = postSnap.data();
  const poll = data.poll as Poll | null;
  if (!poll?.options?.length) throw new Error("No poll on this post");

  const opt = poll.options.find((o) => o.id === optionId);
  if (!opt) throw new Error("Invalid option");

  const existing = await getDoc(voteRef);
  if (existing.exists()) {
    throw new Error("You already voted");
  }

  const nextOptions = poll.options.map((o) =>
    o.id === optionId ? { ...o, votes: (o.votes || 0) + 1 } : o
  );

  const batch = writeBatch(db);
  batch.set(voteRef, { optionId, uid, createdAt: serverTimestamp() });
  batch.update(postRef, {
    poll: { ...poll, options: nextOptions },
    updatedAt: serverTimestamp(),
  });
  await batch.commit();

  return getPost(postId, uid);
}

export async function getPost(
  postId: string,
  currentUid?: string | null
): Promise<PostWithAuthor | null> {
  const snap = await getDoc(doc(db, "posts", postId));
  if (!snap.exists()) return null;
  const post = mapPost(snap.id, snap.data());
  if (post.isDeleted) return null;
  const [enriched] = await attachAuthors([post], currentUid);
  return enriched;
}

/** Direct replies to a post (threaded comments) */
export async function getReplies(
  postId: string,
  currentUid?: string | null
): Promise<PostWithAuthor[]> {
  try {
    const snap = await getDocs(
      query(
        collection(db, "posts"),
        where("parentId", "==", postId),
        where("isDeleted", "==", false),
        orderBy("createdAt", "asc"),
        limit(100)
      )
    );
    const posts = snap.docs.map((d) => mapPost(d.id, d.data()));
    return attachAuthors(posts, currentUid);
  } catch {
    // Fallback without composite index
    const snap = await getDocs(
      query(collection(db, "posts"), where("parentId", "==", postId), limit(100))
    );
    const posts = snap.docs
      .map((d) => mapPost(d.id, d.data()))
      .filter((p) => !p.isDeleted)
      .sort(
        (a, b) =>
          (a.createdAt?.toMillis?.() ?? 0) - (b.createdAt?.toMillis?.() ?? 0)
      );
    return attachAuthors(posts, currentUid);
  }
}

export async function getBookmarkedPosts(
  uid: string,
  currentUid?: string | null
): Promise<PostWithAuthor[]> {
  const snap = await getDocs(
    query(collection(db, "users", uid, "bookmarks"), limit(50))
  );
  const posts: Post[] = [];
  for (const d of snap.docs) {
    const p = await getDoc(doc(db, "posts", d.id));
    if (p.exists() && !p.data().isDeleted) {
      posts.push(mapPost(p.id, p.data()));
    }
  }
  posts.sort(
    (a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0)
  );
  return attachAuthors(posts, currentUid ?? uid);
}

export async function searchPosts(
  term: string,
  currentUid?: string | null,
  max = 30
): Promise<PostWithAuthor[]> {
  const t = term.toLowerCase().replace(/^#/, "").trim();
  if (!t) return [];
  try {
    const snap = await getDocs(
      query(
        collection(db, "posts"),
        where("isDeleted", "==", false),
        where("isDraft", "==", false),
        orderBy("createdAt", "desc"),
        limit(80)
      )
    );
    const posts = snap.docs
      .map((d) => mapPost(d.id, d.data()))
      .filter(
        (p) =>
          p.type !== "reply" &&
          (p.text.toLowerCase().includes(t) ||
            p.hashtags.some((h) => h.includes(t)))
      )
      .slice(0, max);
    return attachAuthors(posts, currentUid);
  } catch {
    const snap = await getDocs(
      query(collection(db, "posts"), orderBy("createdAt", "desc"), limit(80))
    );
    const posts = snap.docs
      .map((d) => mapPost(d.id, d.data()))
      .filter(
        (p) =>
          !p.isDeleted &&
          !p.isDraft &&
          p.type !== "reply" &&
          (p.text.toLowerCase().includes(t) ||
            p.hashtags.some((h) => h.includes(t)))
      )
      .slice(0, max);
    return attachAuthors(posts, currentUid);
  }
}
