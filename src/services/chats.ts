import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  updateDoc,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  onSnapshot,
  setDoc,
  type Unsubscribe,
  type DocumentData,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { getUser } from "./users";
import type { UserProfile } from "@/types";

export interface Conversation {
  id: string;
  type: "dm" | "group";
  participantIds: string[];
  name?: string;
  lastMessage: string;
  lastMessageAt: { toMillis?: () => number; toDate?: () => Date } | null;
  updatedAt: { toMillis?: () => number } | null;
  createdAt: unknown;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  text: string;
  mediaUrl?: string | null;
  reactions: Record<string, string[]>;
  readBy: string[];
  createdAt: { toMillis?: () => number; toDate?: () => Date } | null;
  sender?: UserProfile | null;
}

function mapConv(id: string, data: DocumentData): Conversation {
  return {
    id,
    type: data.type ?? "dm",
    participantIds: data.participantIds ?? [],
    name: data.name,
    lastMessage: data.lastMessage ?? "",
    lastMessageAt: data.lastMessageAt ?? null,
    updatedAt: data.updatedAt ?? null,
    createdAt: data.createdAt,
  };
}

export async function getOrCreateDm(
  uidA: string,
  uidB: string
): Promise<string> {
  if (uidA === uidB) throw new Error("Cannot message yourself");
  const participants = [uidA, uidB].sort();
  const key = participants.join("_");

  // deterministic id for DMs
  const ref = doc(db, "conversations", `dm_${key}`);
  const existing = await getDoc(ref);
  if (existing.exists()) return ref.id;

  await setDoc(ref, {
    type: "dm",
    participantIds: participants,
    lastMessage: "",
    lastMessageAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function getMyConversations(uid: string): Promise<
  (Conversation & { otherUser?: UserProfile | null })[]
> {
  try {
    const snap = await getDocs(
      query(
        collection(db, "conversations"),
        where("participantIds", "array-contains", uid),
        orderBy("updatedAt", "desc"),
        limit(40)
      )
    );
    const convs = snap.docs.map((d) => mapConv(d.id, d.data()));
    return Promise.all(
      convs.map(async (c) => {
        const otherId = c.participantIds.find((id) => id !== uid);
        return {
          ...c,
          otherUser: otherId ? await getUser(otherId) : null,
        };
      })
    );
  } catch {
    const snap = await getDocs(
      query(
        collection(db, "conversations"),
        where("participantIds", "array-contains", uid),
        limit(40)
      )
    );
    const convs = snap.docs.map((d) => mapConv(d.id, d.data()));
    convs.sort(
      (a, b) =>
        (b.updatedAt?.toMillis?.() ?? 0) - (a.updatedAt?.toMillis?.() ?? 0)
    );
    return Promise.all(
      convs.map(async (c) => {
        const otherId = c.participantIds.find((id) => id !== uid);
        return {
          ...c,
          otherUser: otherId ? await getUser(otherId) : null,
        };
      })
    );
  }
}

export async function sendMessage(
  conversationId: string,
  senderId: string,
  text: string
): Promise<void> {
  const trimmed = text.trim();
  if (!trimmed) return;

  await addDoc(collection(db, "conversations", conversationId, "messages"), {
    senderId,
    text: trimmed,
    mediaUrl: null,
    reactions: {},
    readBy: [senderId],
    createdAt: serverTimestamp(),
  });

  await updateDoc(doc(db, "conversations", conversationId), {
    lastMessage: trimmed.slice(0, 200),
    lastMessageAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export function subscribeMessages(
  conversationId: string,
  cb: (messages: ChatMessage[]) => void
): Unsubscribe {
  const q = query(
    collection(db, "conversations", conversationId, "messages"),
    orderBy("createdAt", "asc"),
    limit(200)
  );
  return onSnapshot(
    q,
    async (snap) => {
      const msgs: ChatMessage[] = snap.docs.map((d) => ({
        id: d.id,
        senderId: d.data().senderId,
        text: d.data().text ?? "",
        mediaUrl: d.data().mediaUrl ?? null,
        reactions: d.data().reactions ?? {},
        readBy: d.data().readBy ?? [],
        createdAt: d.data().createdAt ?? null,
      }));
      // attach senders lightly
      const ids = [...new Set(msgs.map((m) => m.senderId))];
      const users = await Promise.all(ids.map((id) => getUser(id)));
      const map = new Map(users.filter(Boolean).map((u) => [u!.uid, u!]));
      cb(msgs.map((m) => ({ ...m, sender: map.get(m.senderId) ?? null })));
    },
    () => cb([])
  );
}

export async function reactToMessage(
  conversationId: string,
  messageId: string,
  uid: string,
  emoji: string
): Promise<void> {
  const ref = doc(db, "conversations", conversationId, "messages", messageId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const reactions = { ...(snap.data().reactions || {}) } as Record<
    string,
    string[]
  >;
  const list = new Set(reactions[emoji] || []);
  if (list.has(uid)) list.delete(uid);
  else list.add(uid);
  reactions[emoji] = [...list];
  await updateDoc(ref, { reactions });
}

export async function markRead(
  conversationId: string,
  messageId: string,
  uid: string
): Promise<void> {
  const ref = doc(db, "conversations", conversationId, "messages", messageId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const readBy: string[] = snap.data().readBy || [];
  if (readBy.includes(uid)) return;
  await updateDoc(ref, { readBy: [...readBy, uid] });
}

export async function setTyping(
  conversationId: string,
  uid: string,
  isTyping: boolean
): Promise<void> {
  const ref = doc(db, "conversations", conversationId, "typing", uid);
  if (isTyping) {
    await setDoc(ref, { uid, at: serverTimestamp() });
  } else {
    const { deleteDoc } = await import("firebase/firestore");
    await deleteDoc(ref).catch(() => undefined);
  }
}
