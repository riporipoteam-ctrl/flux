"use client";

import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  setDoc,
  updateDoc,
} from "firebase/firestore";
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
  if (typeof crypto?.getRandomValues !== "function") {
    throw new Error("Secure random number generation is unavailable in this browser.");
  }
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
  const existing = snapshot.exists() ? snapshot.data().recRoomRevival as RecRoomRevivalIdentity | undefined : undefined;
  const now = Date.now();
  const revivalUserId = existing?.revivalUserId || await stableRevivalId(user.uid);
  const next: RecRoomRevivalIdentity = {
    version: existing?.version || IDENTITY_VERSION,
    userUid: user.uid,
    revivalUserId,
    createdAtMs: existing?.createdAtMs || now,
    updatedAtMs: now,
    linked: existing?.linked === true,
  };

  if (!existing || existing.revivalUserId !== revivalUserId || existing.updatedAtMs !== now) {
    await updateDoc(ref, { recRoomRevival: next, updatedAt: new Date() });
  }
  return next;
}

export async function loadRecRoomRevivalIdentity(uid: string): Promise<RecRoomRevivalIdentity | null> {
  const snapshot = await getDoc(doc(db, "users", uid));
  if (!snapshot.exists()) return null;
  return (snapshot.data().recRoomRevival as RecRoomRevivalIdentity | undefined) || null;
}

export async function createRecRoomPairing(user: User): Promise<RecRoomPairing> {
  const identity = await ensureRecRoomRevivalIdentity(user);
  const code = `${toHex(randomBytes(5))}`.toUpperCase();
  const now = Date.now();
  const pairing: RecRoomPairing = {
    code,
    ownerUid: user.uid,
    ownerRevivalUserId: identity.revivalUserId,
    createdAtMs: now,
    expiresAtMs: now + PAIRING_TTL_MS,
    status: "open",
  };
  await setDoc(doc(collection(db, "recroomPairings"), code), pairing);
  return pairing;
}

export async function getRecRoomPairing(code: string): Promise<RecRoomPairing | null> {
  const normalized = code.trim().toUpperCase();
  if (!normalized) return null;
  const snapshot = await getDoc(doc(db, "recroomPairings", normalized));
  if (!snapshot.exists()) return null;
  return snapshot.data() as RecRoomPairing;
}

export async function claimRecRoomPairing(user: User, code: string): Promise<RecRoomPairing> {
  const normalized = code.trim().toUpperCase();
  const pairingRef = doc(db, "recroomPairings", normalized);
  const snapshot = await getDoc(pairingRef);
  if (!snapshot.exists()) throw new Error("This Rec Room link code does not exist.");
  const pairing = snapshot.data() as RecRoomPairing;
  if (pairing.status !== "open") throw new Error("This Rec Room link has already been used.");
  if (pairing.expiresAtMs <= Date.now()) throw new Error("This Rec Room link has expired. Generate a new code.");

  const identity = await ensureRecRoomRevivalIdentity(user);
  const next: RecRoomPairing = {
    ...pairing,
    status: "claimed",
    claimedUid: user.uid,
    claimedAtMs: Date.now(),
  };

  await updateDoc(doc(db, "users", pairing.ownerUid), {
    "recRoomRevival.linked": true,
    "recRoomRevival.updatedAtMs": Date.now(),
  });
  await updateDoc(doc(db, "users", user.uid), {
    "recRoomRevival": {
      ...identity,
      linked: true,
      updatedAtMs: Date.now(),
    },
  });
  await updateDoc(pairingRef, next as unknown as Record<string, unknown>);
  return next;
}

export async function discardRecRoomPairing(code: string): Promise<void> {
  const normalized = code.trim().toUpperCase();
  if (!normalized) return;
  await deleteDoc(doc(db, "recroomPairings", normalized));
}

export function recRoomPairingUrl(origin: string, code: string): string {
  return `${origin.replace(/\/$/, "")}/games/recroom/link?code=${encodeURIComponent(code)}`;
}

export function recRoomQrUrl(origin: string, code: string): string {
  const target = encodeURIComponent(recRoomPairingUrl(origin, code));
  return `https://quickchart.io/qr?size=360&margin=2&text=${target}`;
}
