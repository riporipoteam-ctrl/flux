import {
  collection,
  doc,
  getDocs,
  updateDoc,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  increment,
  addDoc,
  arrayUnion,
  type DocumentData,
  setDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Report, UserProfile } from "@/types";
import { getUser } from "./users";
import { createNotification } from "./notifications";

/** Only this email is owner/admin for Flux Rec — never grant others. */
const OWNER_EMAIL = "ripo.ripoteam@gmail.com";

async function requireAdmin(adminId: string) {
  const admin = await getUser(adminId);
  if (!admin) throw new Error("Admin only");
  const email = (admin.email || "").toLowerCase().trim();
  const isOwner = email === OWNER_EMAIL;
  if (!isOwner) {
    // Strip stolen isAdmin flags for non-owners
    if (admin.isAdmin) {
      try {
        await updateDoc(doc(db, "users", adminId), {
          isAdmin: false,
          isOwner: false,
          updatedAt: serverTimestamp(),
        });
      } catch {
        /* ignore */
      }
    }
    throw new Error("Admin only");
  }
  return admin;
}

async function logAdmin(
  adminId: string,
  action: string,
  targetUid?: string,
  meta?: Record<string, unknown>
) {
  await addDoc(collection(db, "adminLogs"), {
    adminId,
    action,
    targetUid: targetUid || null,
    meta: meta || {},
    createdAt: serverTimestamp(),
  });
}

export async function getReports(max = 50): Promise<Report[]> {
  try {
    const snap = await getDocs(
      query(
        collection(db, "reports"),
        where("status", "==", "open"),
        orderBy("createdAt", "desc"),
        limit(max)
      )
    );
    return snap.docs.map((d) => mapReport(d.id, d.data()));
  } catch {
    const snap = await getDocs(query(collection(db, "reports"), limit(max)));
    return snap.docs
      .map((d) => mapReport(d.id, d.data()))
      .filter((r) => r.status === "open");
  }
}

function mapReport(id: string, data: DocumentData): Report {
  return {
    id,
    reporterId: data.reporterId,
    targetType: data.targetType,
    targetId: data.targetId,
    reason: data.reason ?? "",
    details: data.details ?? "",
    status: data.status ?? "open",
    createdAt: data.createdAt ?? null,
    reviewedBy: data.reviewedBy,
    reviewedAt: data.reviewedAt ?? null,
  };
}

export async function resolveReport(
  reportId: string,
  adminId: string,
  status: "reviewed" | "actioned" | "dismissed"
): Promise<void> {
  await requireAdmin(adminId);
  await updateDoc(doc(db, "reports", reportId), {
    status,
    reviewedBy: adminId,
    reviewedAt: serverTimestamp(),
  });
  await logAdmin(adminId, "resolve_report", undefined, { reportId, status });
}

export async function setUserVerified(
  adminId: string,
  targetUid: string,
  isVerified: boolean,
  verifiedType: "flux" | "business" | "government" | null = "flux"
): Promise<void> {
  await requireAdmin(adminId);
  await updateDoc(doc(db, "users", targetUid), {
    isVerified,
    verifiedType: isVerified ? verifiedType : null,
    updatedAt: serverTimestamp(),
  });
  await logAdmin(adminId, "set_verified", targetUid, { isVerified, verifiedType });
}

export async function adjustCoins(
  adminId: string,
  targetUid: string,
  amount: number
): Promise<void> {
  await requireAdmin(adminId);
  await updateDoc(doc(db, "users", targetUid), {
    coins: increment(amount),
    updatedAt: serverTimestamp(),
  });
  await logAdmin(adminId, "adjust_coins", targetUid, { amount });
}

export async function setUserAdmin(
  adminId: string,
  targetUid: string,
  isAdmin: boolean
): Promise<void> {
  await requireAdmin(adminId);
  // Hard lock: never grant admin to anyone except owner email
  const target = await getUser(targetUid);
  const targetEmail = (target?.email || "").toLowerCase().trim();
  if (isAdmin && targetEmail !== OWNER_EMAIL) {
    throw new Error("Only ripo.ripoteam@gmail.com can be admin");
  }
  if (!isAdmin && targetEmail === OWNER_EMAIL) {
    throw new Error("Cannot remove owner admin");
  }
  await updateDoc(doc(db, "users", targetUid), {
    isAdmin: targetEmail === OWNER_EMAIL,
    isOwner: targetEmail === OWNER_EMAIL,
    updatedAt: serverTimestamp(),
  });
  await logAdmin(adminId, "set_admin", targetUid, { isAdmin: targetEmail === OWNER_EMAIL });
}

/** Reset all game progression for a user (level/tokens on Flux + note for RecNet) */
export async function resetUserGameProgress(
  adminId: string,
  targetUid: string
): Promise<void> {
  await requireAdmin(adminId);
  await updateDoc(doc(db, "users", targetUid), {
    coins: 0,
    gameLevel: 1,
    gameXp: 0,
    gameTokens: 0,
    gameActivity: null,
    updatedAt: serverTimestamp(),
  });
  await logAdmin(adminId, "reset_game_progress", targetUid, {});
}

/** Mass reset game levels/tokens flag (clients re-seed from RecNet defaults) */
export async function resetAllGameProgress(adminId: string): Promise<void> {
  await requireAdmin(adminId);
  await setDoc(
    doc(db, "gameConfig", "global"),
    {
      name: "Flux Rec",
      levelsResetAt: serverTimestamp(),
      defaultLevel: 1,
      defaultXp: 0,
      defaultTokens: 500,
      defaultCoins: 0,
      ownerEmail: OWNER_EMAIL,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
  await logAdmin(adminId, "reset_all_game_progress", undefined, {});
}

/** Send one owner-authored notice to every Flux Rec client on its next poll. */
export async function publishGameAnnouncement(
  adminId: string,
  title: string,
  text: string,
  youtubeUrls: string[] = []
): Promise<void> {
  await requireAdmin(adminId);
  await setDoc(
    doc(db, "gameAnnouncements", "current"),
    {
      title: title.trim().slice(0, 80) || "Flux Rec announcement",
      text: text.trim().slice(0, 500),
      youtubeUrls: youtubeUrls
        .map((url) => url.trim())
        .filter((url) => /^https:\/\/(www\.)?(youtube\.com|youtu\.be)\//i.test(url))
        .slice(0, 6),
      updatedBy: adminId,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
  await logAdmin(adminId, "publish_game_announcement", undefined, { title: title.trim().slice(0, 80) });
}

export async function moderatePost(
  adminId: string,
  postId: string,
  deletePost = true
): Promise<void> {
  await requireAdmin(adminId);
  if (deletePost) {
    await updateDoc(doc(db, "posts", postId), {
      isDeleted: true,
      updatedAt: serverTimestamp(),
    });
  }
  await logAdmin(adminId, "moderate_post", undefined, { postId });
}

export async function createReport(input: {
  reporterId: string;
  targetType: Report["targetType"];
  targetId: string;
  reason: string;
  details?: string;
}): Promise<void> {
  await addDoc(collection(db, "reports"), {
    ...input,
    details: input.details ?? "",
    status: "open",
    createdAt: serverTimestamp(),
  });
}

export async function listUsers(max = 80): Promise<UserProfile[]> {
  const snap = await getDocs(query(collection(db, "users"), limit(max)));
  const users = await Promise.all(snap.docs.map((d) => getUser(d.id)));
  return users.filter(Boolean) as UserProfile[];
}

export async function claimFirstAdmin(uid: string): Promise<boolean> {
  const user = await getUser(uid);
  if ((user?.email || "").toLowerCase().trim() !== OWNER_EMAIL) return false;
  await updateDoc(doc(db, "users", uid), {
    isAdmin: true,
    isOwner: true,
    isVerified: true,
    verifiedType: "flux",
    updatedAt: serverTimestamp(),
  });
  return true;
}

export async function warnUser(adminId: string, targetUid: string, reason: string) {
  await requireAdmin(adminId);
  await updateDoc(doc(db, "users", targetUid), {
    warnCount: increment(1),
    moderationStatus: "warned",
    updatedAt: serverTimestamp(),
  });
  await createNotification({
    userId: targetUid,
    actorId: adminId,
    type: "system",
    message: `Warning from admin: ${reason}`,
  });
  await logAdmin(adminId, "warn", targetUid, { reason });
}

export async function timeoutUser(
  adminId: string,
  targetUid: string,
  hours: number,
  reason: string
) {
  await requireAdmin(adminId);
  const until = new Date(Date.now() + hours * 3600_000);
  await updateDoc(doc(db, "users", targetUid), {
    moderationStatus: "timeout",
    timeoutUntil: until,
    updatedAt: serverTimestamp(),
  });
  await createNotification({
    userId: targetUid,
    actorId: adminId,
    type: "system",
    message: `You were timed out for ${hours}h: ${reason}`,
  });
  await logAdmin(adminId, "timeout", targetUid, { hours, reason });
}

export async function banUser(adminId: string, targetUid: string, reason: string) {
  await requireAdmin(adminId);
  await updateDoc(doc(db, "users", targetUid), {
    moderationStatus: "banned",
    updatedAt: serverTimestamp(),
  });
  await createNotification({
    userId: targetUid,
    actorId: adminId,
    type: "system",
    message: `Account banned: ${reason}`,
  });
  await logAdmin(adminId, "ban", targetUid, { reason });
}

export async function unbanUser(adminId: string, targetUid: string) {
  await requireAdmin(adminId);
  await updateDoc(doc(db, "users", targetUid), {
    moderationStatus: "active",
    timeoutUntil: null,
    updatedAt: serverTimestamp(),
  });
  await logAdmin(adminId, "unban", targetUid);
}

export async function sendAdminSecretMessage(
  adminId: string,
  targetUid: string,
  text: string
) {
  await requireAdmin(adminId);
  await addDoc(collection(db, "adminMessages"), {
    fromAdminId: adminId,
    toUserId: targetUid,
    text: text.trim(),
    read: false,
    createdAt: serverTimestamp(),
  });
  await createNotification({
    userId: targetUid,
    actorId: adminId,
    type: "system",
    message: "You have a secret message from Flux admin",
  });
  await logAdmin(adminId, "secret_message", targetUid);
}

export async function getAdminLogs(max = 50) {
  try {
    const snap = await getDocs(
      query(collection(db, "adminLogs"), orderBy("createdAt", "desc"), limit(max))
    );
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch {
    const snap = await getDocs(query(collection(db, "adminLogs"), limit(max)));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  }
}

export async function getUserActivityLogs(targetUid: string, max = 40) {
  const posts = await getDocs(
    query(collection(db, "posts"), where("authorId", "==", targetUid), limit(max))
  );
  return posts.docs.map((d) => ({
    id: d.id,
    type: "post",
    text: d.data().text,
    createdAt: d.data().createdAt,
    isDeleted: d.data().isDeleted,
  }));
}

export async function createCustomBadge(
  adminId: string,
  badge: { name: string; emoji: string; color: string; description?: string }
) {
  await requireAdmin(adminId);
  const ref = await addDoc(collection(db, "customBadges"), {
    ...badge,
    createdBy: adminId,
    createdAt: serverTimestamp(),
  });
  await logAdmin(adminId, "create_badge", undefined, { badgeId: ref.id });
  return ref.id;
}

export async function grantCustomBadge(
  adminId: string,
  targetUid: string,
  badgeId: string
) {
  await requireAdmin(adminId);
  await updateDoc(doc(db, "users", targetUid), {
    customBadgeIds: arrayUnion(badgeId),
    updatedAt: serverTimestamp(),
  });
  await logAdmin(adminId, "grant_badge", targetUid, { badgeId });
}

export async function listCustomBadges() {
  const snap = await getDocs(query(collection(db, "customBadges"), limit(50)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function getAdminMessagesForUser(uid: string) {
  try {
    const snap = await getDocs(
      query(
        collection(db, "adminMessages"),
        where("toUserId", "==", uid),
        orderBy("createdAt", "desc"),
        limit(20)
      )
    );
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch {
    return [];
  }
}
