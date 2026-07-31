import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { getUser } from "@/services/users";
import { FLUX_PLANS } from "@/services/flux-platform";
import type { FluxPlanTier } from "@/types";

const OWNER_EMAIL = "ripo.ripoteam@gmail.com";

async function requireOwner(adminId: string) {
  const user = await getUser(adminId);
  if (!user || user.email.toLowerCase().trim() !== OWNER_EMAIL) throw new Error("Owner access required");
}

async function writeLog(adminId: string, action: string, targetId?: string, meta: Record<string, unknown> = {}) {
  const ref = doc(collection(db, "adminLogs"));
  const batch = writeBatch(db);
  batch.set(ref, { adminId, action, targetUid: targetId || null, meta, createdAt: serverTimestamp() });
  await batch.commit();
}

export async function adminSetPlan(
  adminId: string,
  targetUid: string,
  tier: FluxPlanTier,
  days = 30
): Promise<void> {
  await requireOwner(adminId);
  const plan = FLUX_PLANS[tier];
  const premium = tier === "premium";
  await updateDoc(doc(db, "users", targetUid), {
    planTier: tier,
    planExpiresAt: tier === "free" ? null : new Date(Date.now() + Math.max(1, days) * 86_400_000),
    askAIUsage: {
      used: 0,
      limit: plan.askAILimit,
      resetAt: new Date(Date.now() + 7 * 86_400_000),
    },
    ...(premium ? { isVerified: true, verifiedType: "flux" } : {}),
    updatedAt: serverTimestamp(),
  });
  await writeLog(adminId, "set_flux_plan", targetUid, { tier, days });
}

export async function adminResetAskAIUsage(adminId: string, targetUid: string): Promise<void> {
  await requireOwner(adminId);
  const target = await getUser(targetUid);
  const tier: FluxPlanTier = target?.planTier === "basic" || target?.planTier === "premium" ? target.planTier : "free";
  await updateDoc(doc(db, "users", targetUid), {
    askAIUsage: {
      used: 0,
      limit: FLUX_PLANS[tier].askAILimit,
      resetAt: new Date(Date.now() + 7 * 86_400_000),
    },
    updatedAt: serverTimestamp(),
  });
  await writeLog(adminId, "reset_askai_usage", targetUid, { tier });
}

export async function adminResetAllAskAIUsage(adminId: string): Promise<number> {
  await requireOwner(adminId);
  const snap = await getDocs(query(collection(db, "users"), limit(450)));
  let processed = 0;
  for (let offset = 0; offset < snap.docs.length; offset += 400) {
    const batch = writeBatch(db);
    for (const item of snap.docs.slice(offset, offset + 400)) {
      const tier: FluxPlanTier = item.data().planTier === "premium" || item.data().planTier === "basic" ? item.data().planTier : "free";
      batch.update(item.ref, {
        askAIUsage: {
          used: 0,
          limit: FLUX_PLANS[tier].askAILimit,
          resetAt: new Date(Date.now() + 7 * 86_400_000),
        },
        updatedAt: serverTimestamp(),
      });
      processed += 1;
    }
    await batch.commit();
  }
  await writeLog(adminId, "reset_all_askai_usage", undefined, { processed });
  return processed;
}

export interface AdminContentItem {
  id: string;
  type: "story" | "live";
  authorId: string;
  title: string;
  status: string;
  createdAt: unknown;
}

export async function listAdminActiveContent(): Promise<AdminContentItem[]> {
  const [stories, lives] = await Promise.all([
    getDocs(query(collection(db, "stories"), limit(80))),
    getDocs(query(collection(db, "liveStreams"), where("status", "==", "live"), limit(40))),
  ]);
  const storyRows: AdminContentItem[] = stories.docs.map((item) => ({
    id: item.id,
    type: "story",
    authorId: String(item.data().authorId || ""),
    title: String(item.data().text || "Story").slice(0, 90) || "Story",
    status: "active",
    createdAt: item.data().createdAt || null,
  }));
  const liveRows: AdminContentItem[] = lives.docs.map((item) => ({
    id: item.id,
    type: "live",
    authorId: String(item.data().hostId || ""),
    title: String(item.data().title || "Untitled live"),
    status: String(item.data().status || "live"),
    createdAt: item.data().startedAt || null,
  }));
  return [...liveRows, ...storyRows];
}

export async function adminRemoveStory(adminId: string, storyId: string): Promise<void> {
  await requireOwner(adminId);
  await deleteDoc(doc(db, "stories", storyId));
  await writeLog(adminId, "remove_story", undefined, { storyId });
}

export async function adminEndLive(adminId: string, streamId: string): Promise<void> {
  await requireOwner(adminId);
  await updateDoc(doc(db, "liveStreams", streamId), {
    status: "ended",
    viewersCount: 0,
    endedAt: serverTimestamp(),
  });
  await writeLog(adminId, "end_live", undefined, { streamId });
}
