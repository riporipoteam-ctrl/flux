import {
  addDoc,
  collection,
  doc,
  getDocs,
  updateDoc,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  writeBatch,
  type DocumentData,
  type Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Notification } from "@/types";
import { getUser } from "./users";
import type { UserProfile } from "@/types";

export async function createNotification(input: {
  userId: string;
  actorId: string;
  type: Notification["type"];
  message: string;
  postId?: string;
  groupId?: string;
}): Promise<void> {
  if (input.userId === input.actorId) return;
  await addDoc(collection(db, "notifications"), {
    ...input,
    read: false,
    createdAt: serverTimestamp() as Timestamp,
  });
}

function mapNotif(id: string, data: DocumentData): Notification {
  return {
    id,
    userId: data.userId,
    actorId: data.actorId,
    type: data.type,
    postId: data.postId,
    groupId: data.groupId,
    message: data.message ?? "",
    read: data.read ?? false,
    createdAt: data.createdAt ?? null,
  };
}

export async function getNotifications(
  userId: string,
  max = 50
): Promise<(Notification & { actor?: UserProfile | null })[]> {
  try {
    const snap = await getDocs(
      query(
        collection(db, "notifications"),
        where("userId", "==", userId),
        orderBy("createdAt", "desc"),
        limit(max)
      )
    );
    const list = snap.docs.map((d) => mapNotif(d.id, d.data()));
    return Promise.all(
      list.map(async (n) => ({
        ...n,
        actor: await getUser(n.actorId),
      }))
    );
  } catch {
    const snap = await getDocs(
      query(
        collection(db, "notifications"),
        where("userId", "==", userId),
        limit(max)
      )
    );
    const list = snap.docs
      .map((d) => mapNotif(d.id, d.data()))
      .sort(
        (a, b) =>
          (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0)
      );
    return Promise.all(
      list.map(async (n) => ({
        ...n,
        actor: await getUser(n.actorId),
      }))
    );
  }
}

export async function markNotificationRead(id: string): Promise<void> {
  await updateDoc(doc(db, "notifications", id), { read: true });
}

export async function markAllNotificationsRead(userId: string): Promise<void> {
  const list = await getNotifications(userId, 100);
  const unread = list.filter((x) => !x.read);
  if (!unread.length) return;
  const batch = writeBatch(db);
  for (const n of unread) {
    batch.update(doc(db, "notifications", n.id), { read: true });
  }
  await batch.commit();
}

export async function getUnreadCount(userId: string): Promise<number> {
  const list = await getNotifications(userId, 50);
  return list.filter((n) => !n.read).length;
}
