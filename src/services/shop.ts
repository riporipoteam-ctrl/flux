import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  addDoc,
  query,
  limit,
  serverTimestamp,
  writeBatch,
  increment,
  arrayUnion,
  type DocumentData,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { ShopItem, UserDecorations } from "@/types";
import { COIN_REWARDS } from "@/lib/constants";
import { SHOP_CATALOG } from "@/lib/shop-catalog";
import { createNotification } from "./notifications";
import { stripUndefined } from "@/lib/firestore-safe";

function weekKey(d = new Date()) {
  const onejan = new Date(d.getFullYear(), 0, 1);
  const week = Math.ceil(
    ((d.getTime() - onejan.getTime()) / 86400000 + onejan.getDay() + 1) / 7
  );
  return `${d.getFullYear()}-W${week}`;
}

/** Local Imagine assets in /public/shop — always load */
const CATALOG: Array<Omit<ShopItem, "id"> & { id: string }> = SHOP_CATALOG.map(
  (item) => ({
    id: item.id,
    name: item.name,
    description: item.description,
    type: item.type as ShopItem["type"],
    price: item.price,
    previewUrl: item.previewUrl,
    imageUrl: item.imageUrl,
    rarity: item.rarity,
    active: item.active,
  })
);

function mapItem(id: string, data: DocumentData): ShopItem {
  return {
    id,
    name: data.name,
    description: data.description ?? "",
    type: data.type,
    price: data.price ?? 0,
    previewUrl: data.previewUrl ?? "🎁",
    imageUrl: data.imageUrl ?? null,
    rarity: data.rarity ?? "common",
    active: data.active !== false,
    weekKey: data.weekKey,
    createdByAdmin: data.createdByAdmin ?? false,
  };
}

/** Always merge local catalog so shop never appears empty */
export async function ensureShopSeeded(): Promise<void> {
  const wk = weekKey();
  const metaRef = doc(db, "shopMeta", "catalog");
  const meta = await getDoc(metaRef);

  // Seed fixed IDs so images stay stable
  const batch = writeBatch(db);
  for (const item of CATALOG) {
    const { id, ...rest } = item;
    const ref = doc(db, "shopItems", id);
    batch.set(
      ref,
      {
        ...rest,
        weekKey: wk,
        updatedAt: serverTimestamp(),
        createdAt: serverTimestamp(),
      },
      { merge: true }
    );
  }
  batch.set(
    metaRef,
    { weekKey: wk, updatedAt: serverTimestamp() },
    { merge: true }
  );
  try {
    await batch.commit();
  } catch (e) {
    console.warn("shop seed", e);
  }
  void meta;
}

function localCatalog(): ShopItem[] {
  return CATALOG.map((item) => ({
    ...item,
    weekKey: weekKey(),
  })).sort((a, b) => a.price - b.price);
}

export async function getShopItems(): Promise<ShopItem[]> {
  const fallback = localCatalog();
  try {
    await ensureShopSeeded();
    const snap = await getDocs(query(collection(db, "shopItems"), limit(60)));
    const fromDb = snap.docs
      .map((d) => mapItem(d.id, d.data()))
      .filter((i) => i.active);

    // Prefer local imageUrl when DB is missing/outdated
    const byId = new Map(fromDb.map((i) => [i.id, i]));
    for (const local of fallback) {
      const dbItem = byId.get(local.id);
      if (!dbItem) {
        byId.set(local.id, local);
      } else if (!dbItem.imageUrl && local.imageUrl) {
        byId.set(local.id, { ...dbItem, imageUrl: local.imageUrl });
      }
    }
    const merged = [...byId.values()].sort((a, b) => a.price - b.price);
    if (merged.length > 0) return merged;
  } catch (e) {
    console.warn("getShopItems firestore", e);
  }

  return fallback;
}

export async function getOwnedItemIds(uid: string): Promise<string[]> {
  try {
    const snap = await getDoc(doc(db, "users", uid));
    return (snap.data()?.ownedItemIds as string[]) || [];
  } catch {
    return [];
  }
}

export async function purchaseItem(
  userId: string,
  itemId: string
): Promise<void> {
  const itemSnap = await getDoc(doc(db, "shopItems", itemId));
  let item: ShopItem;
  if (itemSnap.exists()) {
    item = mapItem(itemSnap.id, itemSnap.data());
  } else {
    const fallback = (await getShopItems()).find((i) => i.id === itemId);
    if (!fallback) throw new Error("Item not found");
    item = fallback;
    await setDoc(doc(db, "shopItems", itemId), {
      ...fallback,
      createdAt: serverTimestamp(),
    });
  }

  const userRef = doc(db, "users", userId);
  const userSnap = await getDoc(userRef);
  if (!userSnap.exists()) throw new Error("User not found");
  const owned: string[] = userSnap.data().ownedItemIds || [];
  if (owned.includes(itemId)) throw new Error("You already own this item");

  const coins = userSnap.data().coins ?? 0;
  if (coins < item.price) throw new Error("Not enough Flux Coins");

  const decorations: UserDecorations = {
    ...(userSnap.data().decorations || {}),
  };
  if (item.type === "badge" || item.type === "effect")
    decorations.badgeId = item.id;
  if (item.type === "theme") decorations.themeId = item.id;
  if (item.type === "frame") decorations.frameId = item.id;
  if (item.type === "banner") decorations.bannerDecorationId = item.id;

  const batch = writeBatch(db);
  batch.update(userRef, {
    coins: coins - item.price,
    ownedItemIds: arrayUnion(itemId),
    decorations,
    updatedAt: serverTimestamp(),
  });
  batch.set(doc(collection(db, "purchases")), {
    userId,
    itemId,
    price: item.price,
    createdAt: serverTimestamp(),
  });
  await batch.commit();
}

export async function equipItem(userId: string, itemId: string): Promise<void> {
  let item: ShopItem | undefined;
  const itemSnap = await getDoc(doc(db, "shopItems", itemId));
  if (itemSnap.exists()) item = mapItem(itemSnap.id, itemSnap.data());
  else item = (await getShopItems()).find((i) => i.id === itemId);
  if (!item) throw new Error("Item not found");

  const userRef = doc(db, "users", userId);
  const userSnap = await getDoc(userRef);
  if (!userSnap.exists()) throw new Error("User not found");
  const owned: string[] = userSnap.data().ownedItemIds || [];
  if (!owned.includes(itemId)) throw new Error("You don't own this item");

  const decorations: UserDecorations = {
    ...(userSnap.data().decorations || {}),
  };
  if (item.type === "badge" || item.type === "effect")
    decorations.badgeId = item.id;
  if (item.type === "theme") decorations.themeId = item.id;
  if (item.type === "frame") decorations.frameId = item.id;
  if (item.type === "banner") decorations.bannerDecorationId = item.id;

  await updateDoc(userRef, {
    decorations,
    updatedAt: serverTimestamp(),
  });
}

export async function unequipItem(
  userId: string,
  itemId: string
): Promise<void> {
  const items = await getShopItems();
  const item = items.find((i) => i.id === itemId);
  if (!item) throw new Error("Item not found");

  const userRef = doc(db, "users", userId);
  const userSnap = await getDoc(userRef);
  if (!userSnap.exists()) throw new Error("User not found");
  const decorations: UserDecorations = {
    ...(userSnap.data().decorations || {}),
  };
  if (
    (item.type === "badge" || item.type === "effect") &&
    decorations.badgeId === itemId
  )
    delete decorations.badgeId;
  if (item.type === "theme" && decorations.themeId === itemId)
    delete decorations.themeId;
  if (item.type === "frame" && decorations.frameId === itemId)
    delete decorations.frameId;
  if (item.type === "banner" && decorations.bannerDecorationId === itemId)
    delete decorations.bannerDecorationId;

  await updateDoc(userRef, {
    decorations,
    updatedAt: serverTimestamp(),
  });
}

/** Daily check-in streak — rewards Flux Coins */
export async function claimDailyCheckIn(uid: string): Promise<{
  reward: number;
  streak: number;
  alreadyClaimed: boolean;
}> {
  const today = new Date().toISOString().slice(0, 10);
  const ref = doc(db, "userCheckIns", uid);
  const snap = await getDoc(ref);
  const data = snap.exists() ? snap.data() : {};
  if (data.lastClaimDate === today) {
    return {
      reward: 0,
      streak: data.streak || 0,
      alreadyClaimed: true,
    };
  }

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yKey = yesterday.toISOString().slice(0, 10);
  const prevStreak = data.lastClaimDate === yKey ? data.streak || 0 : 0;
  const streak = prevStreak + 1;
  // 10 base + 2 per streak day, cap 50
  const reward = Math.min(50, 10 + (streak - 1) * 2);

  await setDoc(
    ref,
    {
      lastClaimDate: today,
      streak,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
  await updateDoc(doc(db, "users", uid), {
    coins: increment(reward),
  });
  return { reward, streak, alreadyClaimed: false };
}

export async function getCheckInStatus(uid: string) {
  const today = new Date().toISOString().slice(0, 10);
  try {
    const snap = await getDoc(doc(db, "userCheckIns", uid));
    if (!snap.exists())
      return { streak: 0, claimedToday: false, nextReward: 10 };
    const data = snap.data();
    const claimedToday = data.lastClaimDate === today;
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yKey = yesterday.toISOString().slice(0, 10);
    const streak =
      data.lastClaimDate === today || data.lastClaimDate === yKey
        ? data.streak || 0
        : 0;
    const nextStreak = claimedToday ? streak : streak + 1;
    const nextReward = Math.min(50, 10 + (nextStreak - 1) * 2);
    return { streak, claimedToday, nextReward };
  } catch {
    return { streak: 0, claimedToday: false, nextReward: 10 };
  }
}

export async function giftItem(
  fromId: string,
  toId: string,
  itemId: string,
  message = ""
): Promise<void> {
  const items = await getShopItems();
  const item = items.find((i) => i.id === itemId);
  if (!item) throw new Error("Item not found");
  const fromRef = doc(db, "users", fromId);
  const fromSnap = await getDoc(fromRef);
  if (!fromSnap.exists()) throw new Error("User not found");
  const coins = fromSnap.data().coins ?? 0;
  if (coins < item.price) throw new Error("Not enough Flux Coins");

  const batch = writeBatch(db);
  batch.update(fromRef, {
    coins: coins - item.price,
    updatedAt: serverTimestamp(),
  });
  batch.update(doc(db, "users", toId), {
    ownedItemIds: arrayUnion(itemId),
    updatedAt: serverTimestamp(),
  });
  batch.set(doc(collection(db, "gifts")), {
    fromId,
    toId,
    itemId,
    message,
    createdAt: serverTimestamp(),
  });
  await batch.commit();

  await createNotification({
    userId: toId,
    actorId: fromId,
    type: "gift",
    message: `gifted you ${item.name}`,
  });
}

export async function adminGrantItem(
  adminId: string,
  toId: string,
  itemId: string
) {
  await updateDoc(doc(db, "users", toId), {
    ownedItemIds: arrayUnion(itemId),
    updatedAt: serverTimestamp(),
  });
  await addDoc(collection(db, "adminLogs"), {
    adminId,
    action: "grant_item",
    targetUid: toId,
    meta: { itemId },
    createdAt: serverTimestamp(),
  });
}

export async function adminPublishShopItem(
  adminId: string,
  item: Omit<ShopItem, "id" | "active">
) {
  const ref = await addDoc(collection(db, "shopItems"), {
    ...item,
    active: true,
    createdByAdmin: true,
    weekKey: weekKey(),
    createdAt: serverTimestamp(),
    createdBy: adminId,
  });
  return ref.id;
}

const CHALLENGE_POOL = [
  {
    id: "post1",
    title: "Share a thought",
    description: "Create 1 post today",
    target: 1,
    type: "post",
    reward: 25,
  },
  {
    id: "like5",
    title: "Spread the love",
    description: "Like 5 posts",
    target: 5,
    type: "like",
    reward: 20,
  },
  {
    id: "reply2",
    title: "Join the convo",
    description: "Reply to 2 posts",
    target: 2,
    type: "reply",
    reward: 30,
  },
  {
    id: "follow1",
    title: "Make a friend",
    description: "Follow 1 new person",
    target: 1,
    type: "follow",
    reward: 15,
  },
  {
    id: "media1",
    title: "Show something",
    description: "Post with an image or GIF",
    target: 1,
    type: "media",
    reward: 35,
  },
];

function pickDailyChallenges(dateKey: string) {
  let seed = 0;
  for (let i = 0; i < dateKey.length; i++) seed += dateKey.charCodeAt(i);
  const shuffled = [...CHALLENGE_POOL].sort(
    (a, b) =>
      ((seed + a.id.charCodeAt(0)) % 7) - ((seed + b.id.charCodeAt(0)) % 7)
  );
  return shuffled.slice(0, 3);
}

export async function getDailyChallenges(uid: string) {
  const dateKey = new Date().toISOString().slice(0, 10);
  const challenges = pickDailyChallenges(dateKey);
  try {
    const dailyRef = doc(db, "dailyChallenges", dateKey);
    const dailySnap = await getDoc(dailyRef);
    if (!dailySnap.exists()) {
      await setDoc(dailyRef, {
        date: dateKey,
        challenges,
        createdAt: serverTimestamp(),
      });
    }
    const progressRef = doc(db, "userChallenges", `${uid}_${dateKey}`);
    const progressSnap = await getDoc(progressRef);
    const progress = progressSnap.exists()
      ? (progressSnap.data().progress as Record<string, number>)
      : {};
    const claimed = progressSnap.exists()
      ? ((progressSnap.data().claimed as string[]) ?? [])
      : [];
    return { dateKey, challenges, progress, claimed };
  } catch {
    return { dateKey, challenges, progress: {}, claimed: [] as string[] };
  }
}

export async function bumpChallengeProgress(
  uid: string,
  type: "post" | "like" | "reply" | "follow" | "media",
  amount = 1
) {
  const dateKey = new Date().toISOString().slice(0, 10);
  const { challenges, progress, claimed } = await getDailyChallenges(uid);
  const next = { ...progress };
  for (const c of challenges) {
    if (c.type === type) next[c.id] = (next[c.id] || 0) + amount;
  }
  await setDoc(
    doc(db, "userChallenges", `${uid}_${dateKey}`),
    stripUndefined({
      uid,
      date: dateKey,
      progress: next,
      claimed,
      updatedAt: serverTimestamp(),
    }),
    { merge: true }
  );
}

export async function claimChallenge(
  uid: string,
  challengeId: string
): Promise<number> {
  const { dateKey, challenges, progress, claimed } =
    await getDailyChallenges(uid);
  const challenge = challenges.find((c) => c.id === challengeId);
  if (!challenge) throw new Error("Challenge not found");
  if (claimed.includes(challengeId)) throw new Error("Already claimed");
  if ((progress[challengeId] || 0) < challenge.target) {
    throw new Error("Challenge not complete");
  }
  await setDoc(
    doc(db, "userChallenges", `${uid}_${dateKey}`),
    {
      claimed: [...claimed, challengeId],
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
  await updateDoc(doc(db, "users", uid), {
    coins: increment(challenge.reward),
  });
  return challenge.reward;
}

export { COIN_REWARDS, weekKey };
