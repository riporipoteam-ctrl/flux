import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { createNotification } from "@/services/notifications";
import { getUser } from "@/services/users";
import type { UserProfile } from "@/types";

export type GiftContextType = "user" | "post" | "story" | "live";
export type GiftVisual = "heart" | "orb" | "rocket" | "coins" | "dragon" | "galaxy" | "crown" | "titan";

export interface AnimatedGiftDefinition {
  id: string;
  name: string;
  visual: GiftVisual;
  price: number;
  creatorValue: number;
  rarity: "common" | "rare" | "epic" | "legendary";
  animation: "burst" | "float" | "spin" | "rain" | "pulse";
  description: string;
}

export const ANIMATED_GIFTS: AnimatedGiftDefinition[] = [
  { id: "flux-heart", name: "Flux Heart", visual: "heart", price: 25, creatorValue: 18, rarity: "common", animation: "pulse", description: "A hand-drawn neon heart that pulses across the screen." },
  { id: "energy-orb", name: "Energy Orb", visual: "orb", price: 75, creatorValue: 55, rarity: "common", animation: "float", description: "A rotating cyan-violet energy sphere with orbiting rings." },
  { id: "rocket-launch", name: "Rocket Launch", visual: "rocket", price: 180, creatorValue: 130, rarity: "rare", animation: "burst", description: "A custom rocket scene with animated exhaust and stars." },
  { id: "coin-storm", name: "Coin Storm", visual: "coins", price: 350, creatorValue: 260, rarity: "rare", animation: "rain", description: "A shower of individually animated Flux coins." },
  { id: "neon-dragon", name: "Neon Dragon", visual: "dragon", price: 900, creatorValue: 675, rarity: "epic", animation: "spin", description: "An original neon dragon silhouette with glowing fire." },
  { id: "galaxy", name: "Pocket Galaxy", visual: "galaxy", price: 1_750, creatorValue: 1_320, rarity: "epic", animation: "spin", description: "A rotating miniature galaxy with stars and an orbital ring." },
  { id: "creator-crown", name: "Creator Crown", visual: "crown", price: 4_000, creatorValue: 3_100, rarity: "legendary", animation: "float", description: "A jeweled golden crown with animated light bursts." },
  { id: "flux-titan", name: "Flux Titan", visual: "titan", price: 10_000, creatorValue: 8_000, rarity: "legendary", animation: "pulse", description: "A custom armored Flux robot with alternating neon eyes." },
];

export interface FluxGift {
  id: string;
  fromId: string;
  toId: string;
  giftId: string;
  message: string;
  price: number;
  creatorValue: number;
  contextType: GiftContextType;
  contextId: string | null;
  createdAt: { toMillis?: () => number; toDate?: () => Date } | null;
  sender?: UserProfile | null;
  recipient?: UserProfile | null;
  definition?: AnimatedGiftDefinition;
  claimed?: boolean;
}

export async function sendAnimatedGift(input: {
  fromId: string;
  toId: string;
  giftId: string;
  message?: string;
  contextType?: GiftContextType;
  contextId?: string | null;
}): Promise<string> {
  if (input.fromId === input.toId) throw new Error("You cannot send a gift to yourself.");
  const definition = ANIMATED_GIFTS.find((gift) => gift.id === input.giftId);
  if (!definition) throw new Error("Gift not found.");
  const senderRef = doc(db, "users", input.fromId);
  const recipientRef = doc(db, "users", input.toId);
  const giftRef = doc(collection(db, "gifts"));

  await runTransaction(db, async (transaction) => {
    const [sender, recipient] = await Promise.all([
      transaction.get(senderRef),
      transaction.get(recipientRef),
    ]);
    if (!sender.exists() || !recipient.exists()) throw new Error("Sender or recipient account was not found.");
    const coins = Number(sender.data().coins || 0);
    if (coins < definition.price) throw new Error(`You need ${definition.price.toLocaleString()} Flux Coins.`);
    transaction.update(senderRef, {
      coins: coins - definition.price,
      updatedAt: serverTimestamp(),
    });
    transaction.set(giftRef, {
      fromId: input.fromId,
      toId: input.toId,
      giftId: definition.id,
      message: (input.message || "").trim().slice(0, 180),
      price: definition.price,
      creatorValue: definition.creatorValue,
      contextType: input.contextType || "user",
      contextId: input.contextId || null,
      animation: definition.animation,
      visual: definition.visual,
      createdAt: serverTimestamp(),
    });
  });

  await createNotification({
    userId: input.toId,
    actorId: input.fromId,
    type: "gift",
    message: `sent you ${definition.name}`,
  });
  return giftRef.id;
}

export async function claimAnimatedGift(giftId: string, recipientId: string): Promise<number> {
  const giftRef = doc(db, "gifts", giftId);
  const recipientRef = doc(db, "users", recipientId);
  const claimRef = doc(db, "purchases", `giftclaim_${giftId}_${recipientId}`);

  return runTransaction(db, async (transaction) => {
    const [gift, recipient, claim] = await Promise.all([
      transaction.get(giftRef),
      transaction.get(recipientRef),
      transaction.get(claimRef),
    ]);
    if (!gift.exists()) throw new Error("Gift was not found.");
    if (gift.data().toId !== recipientId) throw new Error("This gift belongs to another account.");
    if (!recipient.exists()) throw new Error("Recipient account was not found.");
    if (claim.exists()) throw new Error("This gift was already claimed.");
    const value = Math.max(0, Number(gift.data().creatorValue || 0));
    transaction.update(recipientRef, {
      coins: Number(recipient.data().coins || 0) + value,
      updatedAt: serverTimestamp(),
    });
    transaction.set(claimRef, {
      userId: recipientId,
      itemId: `gift:${giftId}`,
      source: "animated-gift",
      price: 0,
      value,
      createdAt: serverTimestamp(),
    });
    return value;
  });
}

async function enrichGift(id: string, data: Record<string, unknown>, viewerId: string): Promise<FluxGift> {
  const [sender, recipient, claim] = await Promise.all([
    getUser(String(data.fromId || "")),
    getUser(String(data.toId || "")),
    getDoc(doc(db, "purchases", `giftclaim_${id}_${viewerId}`)),
  ]);
  return {
    id,
    fromId: String(data.fromId || ""),
    toId: String(data.toId || ""),
    giftId: String(data.giftId || ""),
    message: String(data.message || ""),
    price: Number(data.price || 0),
    creatorValue: Number(data.creatorValue || 0),
    contextType: (data.contextType as GiftContextType) || "user",
    contextId: data.contextId ? String(data.contextId) : null,
    createdAt: (data.createdAt as FluxGift["createdAt"]) || null,
    sender,
    recipient,
    definition: ANIMATED_GIFTS.find((gift) => gift.id === data.giftId),
    claimed: claim.exists(),
  };
}

export async function getReceivedAnimatedGifts(uid: string, max = 60): Promise<FluxGift[]> {
  const snap = await getDocs(query(
    collection(db, "gifts"),
    where("toId", "==", uid),
    orderBy("createdAt", "desc"),
    limit(Math.max(1, Math.min(max, 100)))
  ));
  return Promise.all(snap.docs.map((item) => enrichGift(item.id, item.data(), uid)));
}

export async function getSentAnimatedGifts(uid: string, max = 40): Promise<FluxGift[]> {
  const snap = await getDocs(query(
    collection(db, "gifts"),
    where("fromId", "==", uid),
    orderBy("createdAt", "desc"),
    limit(Math.max(1, Math.min(max, 80)))
  ));
  return Promise.all(snap.docs.map((item) => enrichGift(item.id, item.data(), uid)));
}
