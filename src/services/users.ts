import {
  collection,
  doc,
  getDoc,
  getDocFromServer,
  getDocs,
  setDoc,
  updateDoc,
  query,
  where,
  limit,
  serverTimestamp,
  runTransaction,
  orderBy,
  type DocumentData,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  defaultUserSettings,
  type SocialLinks,
  type UserProfile,
  type UserSettings,
} from "@/types";
import { formatUsername } from "@/lib/utils";
import { cleanSocialLinks, stripUndefined } from "@/lib/firestore-safe";
import { COIN_REWARDS } from "@/lib/constants";
import { DEFAULT_AVATARS } from "@/lib/default-avatars";

const OWNER_EMAILS = ["ripo.ripoteam@gmail.com"];
const DEFAULT_AI_LIMIT = 20;

function isOwnerEmail(email: string) {
  return OWNER_EMAILS.includes(email.toLowerCase().trim());
}

function mapUser(id: string, data: DocumentData): UserProfile {
  const email = data.email ?? "";
  const onboardingComplete =
    data.onboardingComplete === true || Boolean(String(data.username || "").trim());
  const owner = isOwnerEmail(email);
  const planTier = data.planTier === "premium" || data.planTier === "basic" ? data.planTier : "free";
  return {
    uid: id,
    email,
    username: data.username ?? "",
    displayName: data.displayName ?? "",
    bio: data.bio ?? "",
    avatarUrl: data.avatarUrl ?? null,
    bannerUrl: data.bannerUrl ?? null,
    website: data.website ?? null,
    socialLinks: data.socialLinks ?? {},
    location: data.location ?? null,
    birthDate: data.birthDate ?? null,
    interests: data.interests ?? [],
    isVerified: data.isVerified ?? false,
    verifiedType: data.verifiedType ?? null,
    isAdmin: owner,
    isOwner: owner,
    isPrivate: data.isPrivate ?? false,
    onboardingComplete,
    accountType: data.accountType === "business" ? "business" : "personal",
    businessName: data.businessName ?? null,
    coins: data.coins ?? 0,
    planTier,
    planExpiresAt: data.planExpiresAt ?? null,
    askAIUsage: {
      used: Number(data.askAIUsage?.used || 0),
      limit: Number(data.askAIUsage?.limit || DEFAULT_AI_LIMIT),
      resetAt: data.askAIUsage?.resetAt ?? null,
    },
    aiAgents: Array.isArray(data.aiAgents) ? data.aiAgents.slice(0, 12) : [],
    lastRewardClaimKey: data.lastRewardClaimKey ?? null,
    followersCount: data.followersCount ?? 0,
    followingCount: data.followingCount ?? 0,
    postsCount: data.postsCount ?? 0,
    likesCount: data.likesCount ?? 0,
    pinnedPostId: data.pinnedPostId ?? null,
    decorations: data.decorations ?? {},
    ownedItemIds: data.ownedItemIds ?? [],
    customBadgeIds: data.customBadgeIds ?? [],
    mutedUserIds: data.mutedUserIds ?? [],
    mood: data.mood ?? null,
    profileAccent: data.profileAccent ?? null,
    moderationStatus: data.moderationStatus ?? "active",
    timeoutUntil: data.timeoutUntil ?? null,
    warnCount: data.warnCount ?? 0,
    accountLinkId: data.accountLinkId ?? null,
    linkedUids: data.linkedUids ?? [],
    settings: { ...defaultUserSettings(), ...(data.settings ?? {}) },
    gameActivity: data.gameActivity ?? null,
    createdAt: data.createdAt ?? null,
    updatedAt: data.updatedAt ?? null,
    lastActiveAt: data.lastActiveAt ?? null,
  };
}

export async function getUser(uid: string): Promise<UserProfile | null> {
  const snap = await getDoc(doc(db, "users", uid));
  if (!snap.exists()) return null;
  return mapUser(snap.id, snap.data());
}

export async function getUserByUsername(username: string): Promise<UserProfile | null> {
  const uname = formatUsername(username);
  const q = query(collection(db, "users"), where("username", "==", uname), limit(1));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const d = snap.docs[0];
  return mapUser(d.id, d.data());
}

export async function ensureUserDocument(
  uid: string,
  email: string,
  displayName?: string | null,
  avatarUrl?: string | null
): Promise<UserProfile> {
  const ref = doc(db, "users", uid);
  const owner = isOwnerEmail(email || "");

  let existing = await getDoc(ref);
  if (!existing.exists()) {
    // `getDoc` answers from the local cache when the SDK has not connected
    // yet, and Safari evicts that cache after a week of not visiting — so a
    // reload right after a deploy can report "no such user" for an account
    // that plainly exists. Creating on that answer used to reset the profile
    // and bounce the person back through onboarding, so never create without
    // asking the server first.
    try {
      existing = await getDocFromServer(ref);
    } catch {
      throw new Error("Flux could not reach your profile. Check your connection and try again.");
    }
  }

  if (existing.exists()) {
    const data = existing.data() || {};
    const repair: Record<string, unknown> = {};
    if (owner) {
      if (!data.isAdmin || !data.isOwner) {
        repair.isAdmin = true;
        repair.isOwner = true;
        repair.isVerified = true;
        repair.verifiedType = "flux";
      }
    } else if (data.isAdmin || data.isOwner) {
      repair.isAdmin = false;
      repair.isOwner = false;
    }
    if (data.onboardingComplete !== true && Boolean(String(data.username || "").trim())) {
      repair.onboardingComplete = true;
    }
    if (!data.planTier) repair.planTier = "free";
    if (!data.askAIUsage) {
      repair.askAIUsage = { used: 0, limit: DEFAULT_AI_LIMIT, resetAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) };
    }
    if (!Array.isArray(data.aiAgents)) repair.aiAgents = [];
    if (Object.keys(repair).length) {
      try {
        await updateDoc(ref, { ...repair, updatedAt: serverTimestamp() });
      } catch (error) {
        console.warn("Could not repair legacy user profile", error);
      }
    }
    return mapUser(existing.id, { ...data, ...repair, isAdmin: owner, isOwner: owner });
  }

  const payload = stripUndefined({
    uid,
    email: email || "",
    username: "",
    displayName: displayName || email.split("@")[0] || "Flux User",
    bio: "",
    avatarUrl: avatarUrl || DEFAULT_AVATARS[0].src,
    bannerUrl: null,
    website: null,
    socialLinks: {},
    location: null,
    birthDate: null,
    interests: [] as string[],
    isVerified: owner,
    verifiedType: owner ? "flux" : null,
    isAdmin: owner,
    isOwner: owner,
    isPrivate: false,
    onboardingComplete: false,
    accountType: "personal",
    businessName: null,
    coins: COIN_REWARDS.welcomeBonus,
    planTier: "free",
    planExpiresAt: null,
    askAIUsage: {
      used: 0,
      limit: DEFAULT_AI_LIMIT,
      resetAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
    aiAgents: [],
    lastRewardClaimKey: null,
    followersCount: 0,
    followingCount: 0,
    postsCount: 0,
    likesCount: 0,
    pinnedPostId: null,
    decorations: {},
    ownedItemIds: [] as string[],
    customBadgeIds: [] as string[],
    mutedUserIds: [] as string[],
    mood: null,
    profileAccent: "#0f1419",
    moderationStatus: "active",
    timeoutUntil: null,
    warnCount: 0,
    accountLinkId: null,
    linkedUids: [] as string[],
    settings: defaultUserSettings(),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    lastActiveAt: serverTimestamp(),
  });

  await setDoc(ref, payload, { merge: true });
  return mapUser(uid, payload as DocumentData);
}

export async function isUsernameAvailable(username: string): Promise<boolean> {
  const uname = formatUsername(username);
  if (!uname || uname.length < 3) return false;
  if (!/^[a-z0-9_]+$/.test(uname)) return false;
  const snap = await getDoc(doc(db, "usernames", uname));
  return !snap.exists();
}

export async function claimUsername(uid: string, username: string): Promise<void> {
  const uname = formatUsername(username);
  if (!/^[a-z0-9_]{3,20}$/.test(uname)) {
    throw new Error("Username must be 3–20 characters (letters, numbers, _)");
  }

  await runTransaction(db, async (tx) => {
    const nameRef = doc(db, "usernames", uname);
    const nameSnap = await tx.get(nameRef);
    if (nameSnap.exists() && nameSnap.data()?.uid !== uid) throw new Error("Username is already taken");

    const userRef = doc(db, "users", uid);
    const userSnap = await tx.get(userRef);
    const oldUsername = (userSnap.data()?.username as string) || "";
    if (oldUsername && oldUsername !== uname) tx.delete(doc(db, "usernames", oldUsername));
    if (!nameSnap.exists()) tx.set(nameRef, { uid });
    tx.update(userRef, { username: uname, updatedAt: serverTimestamp() });
  });
}

export async function updateUserProfile(
  uid: string,
  data: Partial<{
    displayName: string;
    bio: string;
    avatarUrl: string | null;
    bannerUrl: string | null;
    website: string | null;
    socialLinks: SocialLinks;
    location: string | null;
    interests: string[];
    onboardingComplete: boolean;
    settings: Partial<UserSettings>;
    pinnedPostId: string | null;
    mood: string | null;
    profileAccent: string | null;
    accountType: "personal" | "business";
    businessName: string | null;
    decorations: UserProfile["decorations"];
    ownedItemIds: string[];
    isPrivate: boolean;
    isVerified: boolean;
    verifiedType: UserProfile["verifiedType"];
    planTier: UserProfile["planTier"];
    planExpiresAt: UserProfile["planExpiresAt"];
    askAIUsage: UserProfile["askAIUsage"];
    aiAgents: UserProfile["aiAgents"];
    lastRewardClaimKey: string | null;
  }>
): Promise<void> {
  const payload: Record<string, unknown> = { updatedAt: serverTimestamp() };

  for (const [key, value] of Object.entries(data)) {
    if (value === undefined) continue;
    if (key === "socialLinks" && value && typeof value === "object") {
      payload.socialLinks = cleanSocialLinks(value as SocialLinks);
      continue;
    }
    if (key === "settings") continue;
    payload[key] = value;
  }

  if (data.settings) {
    const current = await getUser(uid);
    payload.settings = stripUndefined({
      ...defaultUserSettings(),
      ...(current?.settings ?? {}),
      ...data.settings,
      notifications: {
        ...defaultUserSettings().notifications,
        ...(current?.settings?.notifications ?? {}),
        ...(data.settings.notifications ?? {}),
      },
      privacy: {
        ...defaultUserSettings().privacy,
        ...(current?.settings?.privacy ?? {}),
        ...(data.settings.privacy ?? {}),
      },
    });
  }

  if (payload.avatarUrl === "" || payload.avatarUrl === undefined) payload.avatarUrl = DEFAULT_AVATARS[0].src;
  await updateDoc(doc(db, "users", uid), stripUndefined(payload));
}

export async function touchUserPresence(uid: string): Promise<void> {
  await updateDoc(doc(db, "users", uid), { lastActiveAt: serverTimestamp() });
}

export async function completeOnboarding(
  uid: string,
  data: {
    username: string;
    displayName: string;
    bio: string;
    avatarUrl: string | null;
    bannerUrl: string | null;
    interests: string[];
  }
): Promise<void> {
  await claimUsername(uid, data.username);
  await updateUserProfile(uid, {
    displayName: data.displayName,
    bio: data.bio || "",
    avatarUrl: data.avatarUrl || DEFAULT_AVATARS[0].src,
    bannerUrl: data.bannerUrl ?? null,
    interests: data.interests || [],
    onboardingComplete: true,
  });
}

export async function getSuggestedUsers(excludeUid: string, max = 8): Promise<UserProfile[]> {
  try {
    const q = query(collection(db, "users"), where("onboardingComplete", "==", true), orderBy("followersCount", "desc"), limit(max + 5));
    const snap = await getDocs(q);
    return snap.docs.map((d) => mapUser(d.id, d.data())).filter((u) => u.uid !== excludeUid).slice(0, max);
  } catch {
    const snap = await getDocs(query(collection(db, "users"), where("onboardingComplete", "==", true), limit(max + 5)));
    return snap.docs.map((d) => mapUser(d.id, d.data())).filter((u) => u.uid !== excludeUid).slice(0, max);
  }
}

export async function searchUsers(term: string, max = 20): Promise<UserProfile[]> {
  const t = formatUsername(term);
  if (!t && !term.trim()) return [];
  const snap = await getDocs(query(collection(db, "users"), where("onboardingComplete", "==", true), limit(60)));
  const lower = term.toLowerCase();
  return snap.docs
    .map((d) => mapUser(d.id, d.data()))
    .filter((u) => u.username.includes(t || lower) || u.displayName.toLowerCase().includes(lower))
    .slice(0, max);
}

export async function muteUser(uid: string, targetId: string): Promise<void> {
  const user = await getUser(uid);
  if (!user) return;
  const muted = new Set(user.mutedUserIds || []);
  muted.add(targetId);
  await updateDoc(doc(db, "users", uid), stripUndefined({ mutedUserIds: [...muted], updatedAt: serverTimestamp() }));
}

export async function blockUser(blockerId: string, blockedId: string): Promise<void> {
  if (blockerId === blockedId) return;
  const id = `${blockerId}_${blockedId}`;
  await setDoc(doc(db, "blocks", id), stripUndefined({ blockerId, blockedId, createdAt: serverTimestamp() }));
  try {
    const { unfollowUser } = await import("./follows");
    await unfollowUser(blockerId, blockedId);
    await unfollowUser(blockedId, blockerId);
  } catch {
    /* ignore */
  }
}

export async function isBlocked(a: string, b: string): Promise<boolean> {
  const snap1 = await getDoc(doc(db, "blocks", `${a}_${b}`));
  const snap2 = await getDoc(doc(db, "blocks", `${b}_${a}`));
  return snap1.exists() || snap2.exists();
}