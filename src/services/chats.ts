import {
  addDoc,
  collection,
  deleteDoc,
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
import { assertContentAllowed } from "@/lib/automod";
import { getUser } from "./users";
import { isFollowing } from "./follows";
import type { UserProfile } from "@/types";

export interface Conversation {
  id: string;
  type: "dm" | "group";
  participantIds: string[];
  name?: string;
  ownerId?: string | null;
  avatarUrl?: string | null;
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
  mediaType?: "image" | "video" | "file" | "gif" | null;
  fileName?: string | null;
  fileSize?: number | null;
  sharedPostId?: string | null;
  sharedStoryId?: string | null;
  reactions: Record<string, string[]>;
  readBy: string[];
  createdAt: { toMillis?: () => number; toDate?: () => Date } | null;
  sender?: UserProfile | null;
}

export interface SendMessageInput {
  text?: string;
  mediaUrl?: string | null;
  mediaType?: ChatMessage["mediaType"];
  fileName?: string | null;
  fileSize?: number | null;
  sharedPostId?: string | null;
  sharedStoryId?: string | null;
}

function mapConv(id: string, data: DocumentData): Conversation {
  return {
    id,
    type: data.type ?? "dm",
    participantIds: data.participantIds ?? [],
    name: data.name,
    ownerId: data.ownerId ?? null,
    avatarUrl: data.avatarUrl ?? null,
    lastMessage: data.lastMessage ?? "",
    lastMessageAt: data.lastMessageAt ?? null,
    updatedAt: data.updatedAt ?? null,
    createdAt: data.createdAt,
  };
}

export async function areFriends(uidA: string, uidB: string): Promise<boolean> {
  if (!uidA || !uidB || uidA === uidB) return false;
  const [aFollowsB, bFollowsA] = await Promise.all([
    isFollowing(uidA, uidB),
    isFollowing(uidB, uidA),
  ]);
  return aFollowsB && bFollowsA;
}

export async function canMessageUser(senderId: string, targetId: string): Promise<boolean> {
  if (!senderId || !targetId || senderId === targetId) return false;
  const target = await getUser(targetId);
  if (!target) return false;
  if (target.accountType === "business") return true;
  return areFriends(senderId, targetId);
}

export async function canCallUser(callerId: string, targetId: string): Promise<boolean> {
  const [caller, target, friends] = await Promise.all([
    getUser(callerId),
    getUser(targetId),
    areFriends(callerId, targetId),
  ]);
  return !!caller && !!target && friends && caller.accountType !== "business" && target.accountType !== "business";
}

export async function getOrCreateDm(uidA: string, uidB: string): Promise<string> {
  if (uidA === uidB) throw new Error("Cannot message yourself");
  if (!(await canMessageUser(uidA, uidB))) {
    throw new Error("You can message friends who follow you back. Business accounts can receive messages from anyone.");
  }

  const participants = [uidA, uidB].sort();
  const key = participants.join("_");
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

export async function createGroupConversation(input: {
  ownerId: string;
  memberIds: string[];
  name: string;
}): Promise<string> {
  const members = [...new Set(input.memberIds.filter((uid) => uid && uid !== input.ownerId))];
  if (members.length < 2) throw new Error("Choose at least two friends for a group chat");
  if (members.length > 49) throw new Error("Group chats support up to 50 people");
  assertContentAllowed(input.name, "group");

  const checks = await Promise.all(members.map((uid) => areFriends(input.ownerId, uid)));
  if (checks.some((allowed) => !allowed)) {
    throw new Error("You can only add friends who follow you back");
  }

  const ref = doc(collection(db, "conversations"));
  await setDoc(ref, {
    type: "group",
    ownerId: input.ownerId,
    participantIds: [input.ownerId, ...members],
    name: input.name.trim().slice(0, 60) || "New group",
    avatarUrl: null,
    lastMessage: "Group created",
    lastMessageAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function getMyConversations(uid: string): Promise<(Conversation & { otherUser?: UserProfile | null })[]> {
  const load = async (ordered: boolean) => {
    const constraints = [where("participantIds", "array-contains", uid)];
    const snap = ordered
      ? await getDocs(query(collection(db, "conversations"), ...constraints, orderBy("updatedAt", "desc"), limit(50)))
      : await getDocs(query(collection(db, "conversations"), ...constraints, limit(50)));
    const conversations = snap.docs.map((item) => mapConv(item.id, item.data()));
    conversations.sort((a, b) => (b.updatedAt?.toMillis?.() ?? 0) - (a.updatedAt?.toMillis?.() ?? 0));
    return Promise.all(
      conversations.map(async (conversation) => {
        const otherId = conversation.type === "dm" ? conversation.participantIds.find((id) => id !== uid) : null;
        return {
          ...conversation,
          otherUser: otherId ? await getUser(otherId) : null,
        };
      })
    );
  };

  try {
    return await load(true);
  } catch {
    return load(false);
  }
}

export async function sendMessage(
  conversationId: string,
  senderId: string,
  input: string | SendMessageInput
): Promise<void> {
  const payload: SendMessageInput = typeof input === "string" ? { text: input } : input;
  const text = (payload.text || "").trim();
  const hasAttachment = !!(payload.mediaUrl || payload.sharedPostId || payload.sharedStoryId);
  if (!text && !hasAttachment) return;
  if (text) assertContentAllowed(text, "message");

  const conversationRef = doc(db, "conversations", conversationId);
  const conversationSnap = await getDoc(conversationRef);
  if (!conversationSnap.exists()) throw new Error("Conversation not found");
  const conversation = mapConv(conversationSnap.id, conversationSnap.data());
  if (!conversation.participantIds.includes(senderId)) throw new Error("You are not in this conversation");

  if (conversation.type === "dm") {
    const targetId = conversation.participantIds.find((uid) => uid !== senderId);
    if (!targetId) throw new Error("Conversation is invalid");
    const [sender, target, friends] = await Promise.all([
      getUser(senderId),
      getUser(targetId),
      areFriends(senderId, targetId),
    ]);
    const businessConversation = sender?.accountType === "business" || target?.accountType === "business";
    if (!friends && !businessConversation) {
      throw new Error("You can only message friends who follow you back");
    }
  }

  await addDoc(collection(db, "conversations", conversationId, "messages"), {
    senderId,
    text,
    mediaUrl: payload.mediaUrl || null,
    mediaType: payload.mediaType || null,
    fileName: payload.fileName || null,
    fileSize: payload.fileSize || null,
    sharedPostId: payload.sharedPostId || null,
    sharedStoryId: payload.sharedStoryId || null,
    reactions: {},
    readBy: [senderId],
    createdAt: serverTimestamp(),
  });

  const preview = text || (payload.mediaType === "image" ? "Photo" : payload.mediaType === "video" ? "Video" : payload.mediaType === "gif" ? "GIF" : payload.sharedPostId ? "Shared a post" : payload.sharedStoryId ? "Shared a story" : "File");
  await updateDoc(conversationRef, {
    lastMessage: preview.slice(0, 200),
    lastMessageAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export function subscribeMessages(conversationId: string, cb: (messages: ChatMessage[]) => void): Unsubscribe {
  const messagesQuery = query(
    collection(db, "conversations", conversationId, "messages"),
    orderBy("createdAt", "asc"),
    limit(250)
  );
  return onSnapshot(
    messagesQuery,
    async (snap) => {
      const messages: ChatMessage[] = snap.docs.map((item) => ({
        id: item.id,
        senderId: item.data().senderId,
        text: item.data().text ?? "",
        mediaUrl: item.data().mediaUrl ?? null,
        mediaType: item.data().mediaType ?? null,
        fileName: item.data().fileName ?? null,
        fileSize: item.data().fileSize ?? null,
        sharedPostId: item.data().sharedPostId ?? null,
        sharedStoryId: item.data().sharedStoryId ?? null,
        reactions: item.data().reactions ?? {},
        readBy: item.data().readBy ?? [],
        createdAt: item.data().createdAt ?? null,
      }));
      const ids = [...new Set(messages.map((message) => message.senderId))];
      const users = await Promise.all(ids.map((id) => getUser(id)));
      const userMap = new Map(users.filter(Boolean).map((profile) => [profile!.uid, profile!]));
      cb(messages.map((message) => ({ ...message, sender: userMap.get(message.senderId) ?? null }))
    },
    () => cb([])
  );
}

export async function reactToMessage(conversationId: string, messageId: string, uid: string, emoji: string): Promise<void> {
  const ref = doc(db, "conversations", conversationId, "messages", messageId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const reactions = { ...(snap.data().reactions || {}) } as Record<string, string[]>;
  const list = new Set(reactions[emoji] || []);
  if (list.has(uid)) list.delete(uid);
  else list.add(uid);
  reactions[emoji] = [...list];
  await updateDoc(ref, { reactions });
}

export async function markRead(conversationId: string, messageId: string, uid: string): Promise<void> {
  const ref = doc(db, "conversations", conversationId, "messages", messageId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const readBy: string[] = snap.data().readBy || [];
  if (!readBy.includes(uid)) await updateDoc(ref, { readBy: [...readBy, uid] });
}

export async function setTyping(conversationId: string, uid: string, isTyping: boolean): Promise<void> {
  const ref = doc(db, "conversations", conversationId, "typing", uid);
  if (isTyping) await setDoc(ref, { uid, at: serverTimestamp() });
  else await deleteDoc(ref).catch(() => undefined);
}