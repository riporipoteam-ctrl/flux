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
  const slug =
    input.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40) || `group-${Date.now()}`;

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
  // Default ranks
  const ownerRank = doc(collection(db, "groups", ref.id, "ranks"));
  const modRank = doc(collection(db, "groups", ref.id, "ranks"));
  const memberRank = doc(collection(db, "groups", ref.id, "ranks"));
  batch.set(ownerRank, {
    name: "Owner",
    color: "#1d9bf0",
    order: 0,
    permissions: {
      post: true,
      moderate: true,
      invite: true,
      editGroup: true,
      manageRanks: true,
    },
  });
  batch.set(modRank, {
    name: "Moderator",
    color: "#00ba7c",
    order: 5,
    permissions: {
      post: true,
      moderate: true,
      invite: true,
      editGroup: false,
      manageRanks: false,
    },
  });
  batch.set(memberRank, {
    name: "Member",
    color: "#71767b",
    order: 10,
    permissions: {
      post: true,
      moderate: false,
      invite: false,
      editGroup: false,
      manageRanks: false,
    },
  });

  (input.extraRanks || []).forEach((r, i) => {
    const rankRef = doc(collection(db, "groups", ref.id, "ranks"));
    batch.set(rankRef, {
      name: r.name.slice(0, 32),
      color: r.color || "#71767b",
      order: 20 + i,
      permissions: {
        post: true,
        moderate: false,
        invite: false,
        editGroup: false,
        manageRanks: false,
      },
    });
  });

  batch.set(doc(db, "groups", ref.id, "members", input.ownerId), {
    uid: input.ownerId,
    rankId: ownerRank.id,
    joinedAt: serverTimestamp(),
  });
  await batch.commit();
  return ref.id;
}

export async function getGroups(max = 40): Promise<Group[]> {
  try {
    const snap = await getDocs(
      query(collection(db, "groups"), orderBy("memberCount", "desc"), limit(max))
    );
    return snap.docs.map((d) => mapGroup(d.id, d.data()));
  } catch {
    const snap = await getDocs(query(collection(db, "groups"), limit(max)));
    return snap.docs.map((d) => mapGroup(d.id, d.data()));
  }
}

export async function getGroup(id: string): Promise<Group | null> {
  const snap = await getDoc(doc(db, "groups", id));
  if (!snap.exists()) return null;
  return mapGroup(snap.id, snap.data());
}

export async function isGroupMember(
  groupId: string,
  uid: string
): Promise<boolean> {
  const snap = await getDoc(doc(db, "groups", groupId, "members", uid));
  return snap.exists();
}

export async function joinGroup(groupId: string, uid: string): Promise<void> {
  const group = await getGroup(groupId);
  if (!group) throw new Error("Group not found");
  if (await isGroupMember(groupId, uid)) return;

  // Use first non-owner rank or default Member
  const ranks = await getGroupRanks(groupId);
  const memberRank =
    ranks.find((r) => r.name.toLowerCase() === "member") || ranks[ranks.length - 1];

  const batch = writeBatch(db);
  batch.set(doc(db, "groups", groupId, "members", uid), {
    uid,
    rankId: memberRank?.id ?? "member",
    joinedAt: serverTimestamp(),
  });
  batch.update(doc(db, "groups", groupId), {
    memberCount: increment(1),
    updatedAt: serverTimestamp(),
  });
  await batch.commit();

  await createNotification({
    userId: group.ownerId,
    actorId: uid,
    type: "group_invite",
    message: "joined your group",
    groupId,
  });
}

export async function leaveGroup(groupId: string, uid: string): Promise<void> {
  const group = await getGroup(groupId);
  if (!group) return;
  if (group.ownerId === uid) throw new Error("Owner cannot leave — transfer ownership first");

  const batch = writeBatch(db);
  batch.delete(doc(db, "groups", groupId, "members", uid));
  batch.update(doc(db, "groups", groupId), {
    memberCount: increment(-1),
    updatedAt: serverTimestamp(),
  });
  await batch.commit();
}

export async function updateGroup(
  groupId: string,
  ownerId: string,
  data: Partial<{
    name: string;
    description: string;
    isPrivate: boolean;
    avatarUrl: string | null;
    bannerUrl: string | null;
    rules: string;
    decorationIds: string[];
  }>
): Promise<void> {
  const group = await getGroup(groupId);
  if (!group || group.ownerId !== ownerId) throw new Error("Not allowed");
  await updateDoc(doc(db, "groups", groupId), {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

export async function getGroupRanks(groupId: string): Promise<GroupRank[]> {
  const snap = await getDocs(collection(db, "groups", groupId, "ranks"));
  return snap.docs
    .map((d) => ({
      id: d.id,
      name: d.data().name,
      color: d.data().color ?? "#6b7280",
      order: d.data().order ?? 0,
      permissions: d.data().permissions ?? {
        post: true,
        moderate: false,
        invite: false,
        editGroup: false,
        manageRanks: false,
      },
    }))
    .sort((a, b) => a.order - b.order);
}

export async function createRank(
  groupId: string,
  ownerId: string,
  rank: Omit<GroupRank, "id">
): Promise<string> {
  const group = await getGroup(groupId);
  if (!group || group.ownerId !== ownerId) throw new Error("Not allowed");
  const ref = await addDoc(collection(db, "groups", groupId, "ranks"), rank);
  return ref.id;
}

export async function assignRank(
  groupId: string,
  ownerId: string,
  memberId: string,
  rankId: string
): Promise<void> {
  const group = await getGroup(groupId);
  if (!group || group.ownerId !== ownerId) throw new Error("Not allowed");
  await updateDoc(doc(db, "groups", groupId, "members", memberId), { rankId });
}

export async function getGroupMembers(
  groupId: string,
  max = 50
): Promise<(UserProfile & { rankId?: string })[]> {
  const snap = await getDocs(
    query(collection(db, "groups", groupId, "members"), limit(max))
  );
  const users = await Promise.all(
    snap.docs.map(async (d) => {
      const u = await getUser(d.id);
      return u ? { ...u, rankId: d.data().rankId as string } : null;
    })
  );
  return users.filter(Boolean) as (UserProfile & { rankId?: string })[];
}

export async function getGroupPosts(groupId: string, currentUid?: string) {
  try {
    const snap = await getDocs(
      query(
        collection(db, "posts"),
        where("groupId", "==", groupId),
        where("isDeleted", "==", false),
        orderBy("createdAt", "desc"),
        limit(40)
      )
    );
    const { getPost } = await import("./posts");
    const posts = await Promise.all(
      snap.docs.map((d) => getPost(d.id, currentUid))
    );
    return posts.filter(Boolean);
  } catch {
    try {
      const snap = await getDocs(
        query(
          collection(db, "posts"),
          where("groupId", "==", groupId),
          limit(40)
        )
      );
      const { getPost } = await import("./posts");
      const posts = await Promise.all(
        snap.docs.map((d) => getPost(d.id, currentUid))
      );
      return posts.filter(Boolean);
    } catch {
      return [];
    }
  }
}
