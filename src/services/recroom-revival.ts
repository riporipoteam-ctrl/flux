"use client";

import { doc, getDoc, updateDoc } from "firebase/firestore";
import type { User } from "firebase/auth";
import { db } from "@/lib/firebase";

const IDENTITY_VERSION = 1;
const PAIRING_TTL_MS = 10 * 60_000;

export interface RecRoomRevivalIdentity {
  version: number;
  userUid: string;
  revivalUserId: string;
  createdAtMs: number;
  updatedAtMs: number;
  linked: boolean;
  linkedFromUid?: string | null;
  linkedAtMs?: number | null;
}

export interface RecRoomPairing {
  code: string;
  ownerUid: string;
  ownerRevivalUserId: string;
  createdAtMs: number;
  expiresAtMs: number;
  status: "open" | "claimed" | "expired";
  claimedUid?: string;
  claimedAtMs?: number;
}

function randomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  if (typeof crypto?.getRandomValues !== "function") throw new Error("Secure random number generation is unavailable in this browser.");
  crypto.getRandomValues(bytes);
  return bytes;
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
}

async function stableRevivalId(uid: string): Promise<string> {
  if (!crypto?.subtle) throw new Error("Web Crypto is unavailable.");
  const encoded = new TextEncoder().encode(`ripo-recroom-revival-v1:${uid}`);
  const digest = await crypto.subtle.digest("SHA-256", encoded);
  return `rr_${toHex(new Uint8Array(digest)).slice(0, 32)}`;
}

export async function ensureRecRoomRevivalIdentity(user: User): Promise<RecRoomRevivalIdentity> {
  const ref = doc(db, "users", user.uid);
  const snapshot = await getDoc(ref);
  const existing = snapshot.exists() ? (snapshot.data().recRoomRevival as RecRoomRevivalIdentity | undefined) : undefined;
  const now = Date.now();
  const revivalUserId = existing?.revivalUserId || await stableRevivalId(user.uid);
  const next: RecRoomRevivalIdentity = {
    version: existing?.version || IDENTITY_VERSION,
    userUid: user.uid,
    revivalUserId,
    createdAtMs: existing?.createdAtMs || now,
    updatedAtMs: now,
    linked: existing?.linked === true,
    linkedFromUid: existing?.linkedFromUid ?? null,
    linkedAtMs: existing?.linkedAtMs ?? null,
  };
  if (!existing || existing.revivalUserId !== revivalUserId) await updateDoc(ref, { recRoomRevival: next, updatedAt: new Date() });
  return next;
}

export async function loadRecRoomRevivalIdentity(uid: string): Promise<RecRoomRevivalIdentity | null> {
  const snapshot = await getDoc(doc(db, "users", uid));
  if (!snapshot.exists()) return null;
  return (snapshot.data().recRoomRevival as RecRoomRevivalIdentity | undefined) || null;
}

export async function createRecRoomPairing(user: User): Promise<RecRoomPairing> {
  const identity = await ensureRecRoomRevivalIdentity(user);
  const code = toHex(randomBytes(10)).toUpperCase();
  const now = Date.now();
  return {
    code,
    ownerUid: user.uid,
    ownerRevivalUserId: identity.revivalUserId,
    createdAtMs: now,
    expiresAtMs: now + PAIRING_TTL_MS,
    status: "open",
  };
}

export async function claimRecRoomPairing(user: User, ownerUid: string, ownerRevivalUserId: string, code: string): Promise<RecRoomPairing> {
  const normalized = code.trim().toUpperCase();
  if (!normalized || !ownerUid || !ownerRevivalUserId) throw new Error("Invalid Rec Room device link.");
  const identity = await ensureRecRoomRevivalIdentity(user);
  const now = Date.now();
  const next: RecRoomRevivalIdentity = {
    ...identity,
    linked: true,
    linkedFromUid: ownerUid,
    linkedAtMs: now,
    updatedAtMs: now,
  };
  await updateDoc(doc(db, "users", user.uid), { recRoomRevival: next, updatedAt: new Date() });
  return {
    code: normalized,
    ownerUid,
    ownerRevivalUserId,
    createdAtMs: now,
    expiresAtMs: now + PAIRING_TTL_MS,
    status: "claimed",
    claimedUid: user.uid,
    claimedAtMs: now,
  };
}

export function recRoomPairingUrl(origin: string, code: string, ownerUid = "", ownerRevivalUserId = ""): string {
  const query = new URLSearchParams({ code });
  if (ownerUid) query.set("owner", ownerUid);
  if (ownerRevivalUserId) query.set("revival", ownerRevivalUserId);
  return `${origin.replace(/\/$/, "")}/games/recroom/link?${query.toString()}`;
}

export function recRoomQrUrl(origin: string, code: string, ownerUid = "", ownerRevivalUserId = ""): string {
  const target = encodeURIComponent(recRoomPairingUrl(origin, code, ownerUid, ownerRevivalUserId));
  return `https://quickchart.io/qr?size=360&margin=2&text=${target}`;
}
