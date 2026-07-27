import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { stripUndefined } from "@/lib/firestore-safe";

export interface AIConversation {
  id: string;
  userId: string;
  title: string;
  updatedAt: { toMillis?: () => number } | null;
  createdAt: unknown;
}

export interface AIMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  imageUrl?: string | null;
  generatedImageUrl?: string | null;
  meta?: Record<string, unknown>;
  createdAt: { toDate?: () => Date } | null;
}

export async function listConversations(uid: string): Promise<AIConversation[]> {
  try {
    const snap = await getDocs(
      query(
        collection(db, "aiConversations"),
        where("userId", "==", uid),
        orderBy("updatedAt", "desc"),
        limit(40)
      )
    );
    return snap.docs.map((d) => ({
      id: d.id,
      userId: d.data().userId,
      title: d.data().title || "Chat",
      updatedAt: d.data().updatedAt ?? null,
      createdAt: d.data().createdAt,
    }));
  } catch {
    const snap = await getDocs(
      query(
        collection(db, "aiConversations"),
        where("userId", "==", uid),
        limit(40)
      )
    );
    return snap.docs
      .map((d) => ({
        id: d.id,
        userId: d.data().userId,
        title: d.data().title || "Chat",
        updatedAt: d.data().updatedAt ?? null,
        createdAt: d.data().createdAt,
      }))
      .sort(
        (a, b) =>
          (b.updatedAt?.toMillis?.() ?? 0) - (a.updatedAt?.toMillis?.() ?? 0)
      );
  }
}

export async function createConversation(
  uid: string,
  title = "New chat"
): Promise<string> {
  const ref = await addDoc(
    collection(db, "aiConversations"),
    stripUndefined({
      userId: uid,
      title,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
  );
  return ref.id;
}

export async function renameConversation(
  id: string,
  title: string
): Promise<void> {
  await updateDoc(doc(db, "aiConversations", id), {
    title: title.slice(0, 80),
    updatedAt: serverTimestamp(),
  });
}

export async function deleteConversation(id: string): Promise<void> {
  // delete messages then conversation
  const msgs = await getDocs(
    collection(db, "aiConversations", id, "messages")
  );
  const batch = writeBatch(db);
  msgs.docs.forEach((d) => batch.delete(d.ref));
  batch.delete(doc(db, "aiConversations", id));
  await batch.commit();
}

export async function getMessages(conversationId: string): Promise<AIMessage[]> {
  try {
    const snap = await getDocs(
      query(
        collection(db, "aiConversations", conversationId, "messages"),
        orderBy("createdAt", "asc"),
        limit(100)
      )
    );
    return snap.docs.map((d) => ({
      id: d.id,
      role: d.data().role,
      content: d.data().content || "",
      imageUrl: d.data().imageUrl ?? null,
      generatedImageUrl: d.data().generatedImageUrl ?? null,
      meta: d.data().meta,
      createdAt: d.data().createdAt ?? null,
    }));
  } catch {
    const snap = await getDocs(
      collection(db, "aiConversations", conversationId, "messages")
    );
    return snap.docs
      .map((d) => ({
        id: d.id,
        role: d.data().role as AIMessage["role"],
        content: d.data().content || "",
        imageUrl: d.data().imageUrl ?? null,
        generatedImageUrl: d.data().generatedImageUrl ?? null,
        meta: d.data().meta,
        createdAt: d.data().createdAt ?? null,
      }))
      .sort(
        (a, b) =>
          (a.createdAt?.toDate?.()?.getTime() ?? 0) -
          (b.createdAt?.toDate?.()?.getTime() ?? 0)
      );
  }
}

export async function addMessage(
  conversationId: string,
  msg: {
    role: "user" | "assistant";
    content: string;
    imageUrl?: string | null;
    generatedImageUrl?: string | null;
    meta?: Record<string, unknown>;
  }
): Promise<void> {
  await addDoc(
    collection(db, "aiConversations", conversationId, "messages"),
    stripUndefined({
      ...msg,
      createdAt: serverTimestamp(),
    })
  );
  await updateDoc(doc(db, "aiConversations", conversationId), {
    updatedAt: serverTimestamp(),
  });
}

export async function ensureConversationOwned(
  conversationId: string,
  uid: string
): Promise<boolean> {
  const snap = await getDoc(doc(db, "aiConversations", conversationId));
  return snap.exists() && snap.data()?.userId === uid;
}
