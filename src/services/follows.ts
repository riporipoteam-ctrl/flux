import {
  collection,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  writeBatch,
  limit,
  query,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { getUser } from "./users";
import type { UserProfile } from "@/types";
import { createNotification } from "./notifications";

export async function isFollowing(
  followerId: string,
  followingId: string
): Promise<boolean> {
  const snap = await getDoc(
    doc(db, "users", followerId, "following", followingId)
  );
  return snap.exists();
}

export async function followUser(
  followerId: string,
  followingId: string
): Promise<void> {
  if (followerId === followingId) return;

  const already = await isFollowing(followerId, followingId);
  if (already) return;

  const batch = writeBatch(db);
  const followingRef = doc(db, "users", followerId, "following", followingId);
  const followerRef = doc(db, "users", followingId, "followers", followerId);
  const followerUser = doc(db, "users", followerId);
  const followingUser = doc(db, "users", followingId);

  batch.set(followingRef, {
    uid: followingId,
    createdAt: serverTimestamp(),
  });
  batch.set(followerRef, {
    uid: followerId,
    createdAt: serverTimestamp(),
  });

  const [fSnap, tSnap] = await Promise.all([
    getDoc(followerUser),
    getDoc(followingUser),
  ]);

  batch.update(followerUser, {
    followingCount: (fSnap.data()?.followingCount ?? 0) + 1,
  });
  batch.update(followingUser, {
    followersCount: (tSnap.data()?.followersCount ?? 0) + 1,
  });

  await batch.commit();

  try {
    const { bumpChallengeProgress } = await import("./shop");
    await bumpChallengeProgress(followerId, "follow");
  } catch {
    /* optional */
  }

  await createNotification({
    userId: followingId,
    actorId: followerId,
    type: "follow",
    message: "started following you",
  });
}

export async function unfollowUser(
  followerId: string,
  followingId: string
): Promise<void> {
  const already = await isFollowing(followerId, followingId);
  if (!already) return;

  const batch = writeBatch(db);
  batch.delete(doc(db, "users", followerId, "following", followingId));
  batch.delete(doc(db, "users", followingId, "followers", followerId));

  const followerUser = doc(db, "users", followerId);
  const followingUser = doc(db, "users", followingId);
  const [fSnap, tSnap] = await Promise.all([
    getDoc(followerUser),
    getDoc(followingUser),
  ]);

  batch.update(followerUser, {
    followingCount: Math.max(0, (fSnap.data()?.followingCount ?? 0) - 1),
  });
  batch.update(followingUser, {
    followersCount: Math.max(0, (tSnap.data()?.followersCount ?? 0) - 1),
  });

  await batch.commit();
}

export async function getFollowingIds(uid: string): Promise<string[]> {
  const snap = await getDocs(
    query(collection(db, "users", uid, "following"), limit(500))
  );
  return snap.docs.map((d) => d.id);
}

export async function getFollowers(
  uid: string,
  max = 50
): Promise<UserProfile[]> {
  const snap = await getDocs(
    query(collection(db, "users", uid, "followers"), limit(max))
  );
  const users = await Promise.all(snap.docs.map((d) => getUser(d.id)));
  return users.filter(Boolean) as UserProfile[];
}

export async function getFollowing(
  uid: string,
  max = 50
): Promise<UserProfile[]> {
  const snap = await getDocs(
    query(collection(db, "users", uid, "following"), limit(max))
  );
  const users = await Promise.all(snap.docs.map((d) => getUser(d.id)));
  return users.filter(Boolean) as UserProfile[];
}
