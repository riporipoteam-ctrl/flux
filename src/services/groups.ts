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
  writeBatch,
  increment,
  type DocumentData,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Group, GroupRank, UserProfile } from "@/types";
import { getUser } from "./users";
import { createNotification } from "./notifications";

function mapGroup(id: string, data: DocumentData): Group {
  return {
    id,
    name: data.name ?? "",
    slug: data.slug ?? id,
    description: data.description ?? "",
    avatarUrl: data.avatarUrl ?? null,
    bannerUrl: data.bannerUrl ?? null,
    rules: data.rules ?? "",
    isPrivate: data.isPrivate ?? false,
    ownerId: data.ownerId,
    memberCount: data.memberCount ?? 0,
    decorationIds: data.decorationIds ?? [],
    createdAt: data.createdAt ?? null,
    updatedAt: data.updatedAt ?? null,
  };
}

export async function getOwnedGroup(ownerId: string): Promise<Group | null> {
  const snap = await getDocs(query(collection(db, "groups"), where("ownerId", "==", ownerId), limit(1)));
  if (snap.empty) return null;
  const item = snap.docs[0];
  return mapGroup(item.id, item.data());
}

export async function createGroup(input: {
  ownerId: string;
  name: string;
  description: string;
  isPrivate: boolean;
  avatarUrl?: string | null;
  bannerUrl?: string | null;
  rules?: string;
  extraRanks?: Array<{ name: string; color: string }>;
}): Promise<string> {
  const existing = await getOwnedGroup(input.ownerId);
  if (existing) throw new Error(`Each user can own one group. You already own “${existing.name}”.`);

  const slug = input.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || `group-${Date.now()}`;
  const ref = await addDoc(collection(db, "groups"), {
    name: input.name.trim(),
    slug: `${slug}-${Date.now().toString(36)}`,
    description: input.description.trim(),
    avatarUrl: input.avatarUrl ?? null,
    bannerUrl: input.bannerUrl ?? null,
    rules: input.rules?.trim() || "Be respectful. No spam. Follow Flux guidelines.",
    isPrivate: input.isPrivate,
    ownerId: input.ownerId,
    memberCount: 1,
    decorationIds: [],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  const batch = writeBatch(db);
  const ownerRank = doc(collection(db, "groups", ref.id, "ranks"));
  const modRank = doc(collection(db, "groups", ref.id, "ranks"));
  const memberRank = doc(collection(db, "groups", ref.id, "ranks"));
  batch.set(ownerRank, { name: "Owner", color: "#1d9bf0", order: 0, permissions: { post: true, moderate: true, invite: true, editGroup: true, manageRanks: true } });
  batch.set(modRank, { name: "Moderator", color: "#00ba7c", order: 5, permissions: { post: true, moderate: true, invite: true, editGroup: false, manageRanks: false } });
  batch.set(memberRank, { name: "Member", color: "#71767b", order: 10, permissions: { post: true, moderate: false, invite: false, editGroup: false, manageRanks: false } });
  (input.extraRanks || []).forEach((rank, index) => {
    const rankRef = doc(collection(db, "groups", ref.id, "ranks"));
    batch.set(rankRef, { name: rank.name.slice(0, 32), color: rank.color || "#71767b", order: 20 + index, permissions: { post: true, moderate: false, invite: false, editGroup: false, manageRanks: false } });
  });
  batch.set(doc(db, "groups", ref.id, "members", input.ownerId), { uid: input.ownerId, rankId: ownerRank.id, joinedAt: serverTimestamp() });
  await batch.commit();
  return ref.id;
}

export async function getGroups(max = 40): Promise<Group[]> {
  try {
    const snap = await getDocs(query(collection(db, "groups"), orderBy("memberCount", "desc"), limit(max)));
    return snap.docs.map((item) => mapGroup(item.id, item.data()));
  } catch {
    const snap = await getDocs(query(collection(db, "groups"), limit(max)));
    return snap.docs.map((item) => mapGroup(item.id, item.data()));
  }
}

export async function getGroup(id: string): Promise<Group | null> {
  const snap = await getDoc(doc(db, "groups", id));
  return snap.exists() ? mapGroup(snap.id, snap.data()) : null;
}

export async function isGroupMember(groupId: string, uid: string): Promise<boolean> {
  return (await getDoc(doc(db, "groups", groupId, "members", uid))).exists();
}

export async function joinGroup(groupId: string, uid: string): Promise<void> {
  const group = await getGroup(groupId);
  if (!group) throw new Error("Group not found");
  if (await isGroupMember(groupId, uid)) return;
  const ranks = await getGroupRanks(groupId);
  const memberRank = ranks.find((rank) => rank.name.toLowerCase() === "member") || ranks[ranks.length - 1];
  const batch = writeBatch(db);
  batch.set(doc(db, "groups", groupId, "members", uid), { uid, rankId: memberRank?.id ?? "member", joinedAt: serverTimestamp() });
  batch.update(doc(db, "groups", groupId), { memberCount: increment(1), updatedAt: serverTimestamp() });
  await batch.commit();
  await createNotification({ userId: group.ownerId, actorId: uid, type: "group_invite", message: "joined your group", groupId });
}

export async function leaveGroup(groupId: string, uid: string): Promise<void> {
  const group = await getGroup(groupId);
  if (!group) return;
  if (group.ownerId === uid) throw new Error("Owner cannot leave — transfer ownership first");
  const batch = writeBatch(db);
  batch.delete(doc(db, "groups", groupId, "members", uid));
  batch.update(doc(db, "groups", groupId), { memberCount: increment(-1), updatedAt: serverTimestamp() });
  await batch.commit();
}

export async function updateGroup(groupId: string, ownerId: string, data: Partial<{ name: string; description: string; isPrivate: boolean; avatarUrl: string | null; bannerUrl: string | null; rules: string; decorationIds: string[] }>): Promise<void> {
  const group = await getGroup(groupId);
  if (!group || group.ownerId !== ownerId) throw new Error("Not allowed");
  await updateDoc(doc(db, "groups", groupId), { ...data, updatedAt: serverTimestamp() });
}

export async function getGroupRanks(groupId: string): Promise<GroupRank[]> {
  const snap = await getDocs(collection(db, "groups", groupId, "ranks"));
  return snap.docs.map((item) => ({ id: item.id, name: item.data().name, color: item.data().color ?? "#6b7280", order: item.data().order ?? 0, permissions: item.data().permissions ?? { post: true, moderate: false, invite: false, editGroup: false, manageRanks: false } })).sort((a, b) => a.order - b.order);
}

export async function createRank(groupId: string, ownerId: string, rank: Omit<GroupRank, "id">): Promise<string> {
  const group = await getGroup(groupId);
  if (!group || group.ownerId !== ownerId) throw new Error("Not allowed");
  return (await addDoc(collection(db, "groups", groupId, "ranks"), rank)).id;
}

export async function assignRank(groupId: string, ownerId: string, memberId: string, rankId: string): Promise<void> {
  const group = await getGroup(groupId);
  if (!group || group.ownerId !== ownerId) throw new Error("Not allowed");
  await updateDoc(doc(db, "groups", groupId, "members", memberId), { rankId });
}

export async function getGroupMembers(groupId: string, max = 50): Promise<(UserProfile & { rankId?: string })[]> {
  const snap = await getDocs(query(collection(db, "groups", groupId, "members"), limit(max)));
  const users = await Promise.all(snap.docs.map(async (item) => {
    const user = await getUser(item.id);
    return user ? { ...user, rankId: item.data().rankId as string } : null;
  }));
  return users.filter(Boolean) as (UserProfile & { rankId?: string })[];
}

export async function getGroupPosts(groupId: string, currentUid?: string) {
  try {
    const snap = await getDocs(query(collection(db, "posts"), where("groupId", "==", groupId), where("isDeleted", "==", false), orderBy("createdAt", "desc"), limit(40)));
    const { getPost } = await import("./posts");
    return (await Promise.all(snap.docs.map((item) => getPost(item.id, currentUid)))).filter(Boolean);
  } catch {
    try {
      const snap = await getDocs(query(collection(db, "posts"), where("groupId", "==", groupId), limit(40)));
      const { getPost } = await import("./posts");
      return (await Promise.all(snap.docs.map((item) => getPost(item.id, currentUid)))).filter(Boolean);
    } catch {
      return [];
    }
  }
}