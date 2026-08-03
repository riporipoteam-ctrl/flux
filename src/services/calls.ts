import {
  addDoc,
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type DocumentData,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { canCallUser } from "@/services/chats";

export type CallMode = "voice" | "video";
export type CallStatus = "ringing" | "connecting" | "active" | "declined" | "ended";

export interface FluxCall {
  id: string;
  conversationId: string;
  callerId: string;
  calleeId: string;
  participantIds: string[];
  mode: CallMode;
  status: CallStatus;
  offer: RTCSessionDescriptionInit | null;
  answer: RTCSessionDescriptionInit | null;
  createdAt: unknown;
  answeredAt: unknown;
  endedAt: unknown;
  updatedAt: unknown;
  expiresAt: unknown;
}

function mapCall(id: string, data: DocumentData): FluxCall {
  return {
    id,
    conversationId: String(data.conversationId || ""),
    callerId: String(data.callerId || ""),
    calleeId: String(data.calleeId || ""),
    participantIds: Array.isArray(data.participantIds) ? data.participantIds : [],
    mode: data.mode === "video" ? "video" : "voice",
    status: ["ringing", "connecting", "active", "declined", "ended"].includes(data.status) ? data.status : "ringing",
    offer: data.offer || null,
    answer: data.answer || null,
    createdAt: data.createdAt || null,
    answeredAt: data.answeredAt || null,
    endedAt: data.endedAt || null,
    updatedAt: data.updatedAt || null,
    expiresAt: data.expiresAt || null,
  };
}

function timestampMs(value: unknown): number {
  if (value && typeof value === "object" && "toMillis" in value && typeof (value as { toMillis?: unknown }).toMillis === "function") {
    return (value as { toMillis: () => number }).toMillis();
  }
  if (value instanceof Date) return value.getTime();
  return Number(value || 0);
}

export async function createCall(input: {
  conversationId: string;
  callerId: string;
  calleeId: string;
  mode: CallMode;
}): Promise<string> {
  if (!(await canCallUser(input.callerId, input.calleeId))) {
    throw new Error("Calls are only available between mutual personal-account friends");
  }
  const ref = doc(collection(db, "calls"));
  await setDoc(ref, {
    conversationId: input.conversationId,
    callerId: input.callerId,
    calleeId: input.calleeId,
    participantIds: [input.callerId, input.calleeId],
    mode: input.mode,
    status: "ringing",
    offer: null,
    answer: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    expiresAt: new Date(Date.now() + 90_000),
    answeredAt: null,
    endedAt: null,
  });
  return ref.id;
}

export async function getCall(callId: string): Promise<FluxCall | null> {
  const snap = await getDoc(doc(db, "calls", callId));
  return snap.exists() ? mapCall(snap.id, snap.data()) : null;
}

export function subscribeCall(callId: string, callback: (call: FluxCall | null) => void): Unsubscribe {
  return onSnapshot(
    doc(db, "calls", callId),
    (snap) => callback(snap.exists() ? mapCall(snap.id, snap.data()) : null),
    () => callback(null)
  );
}

export function subscribeIncomingCalls(uid: string, callback: (calls: FluxCall[]) => void): Unsubscribe {
  const callsQuery = query(collection(db, "calls"), where("calleeId", "==", uid));
  return onSnapshot(
    callsQuery,
    (snap) => {
      const now = Date.now();
      const calls = snap.docs
        .map((item) => mapCall(item.id, item.data()))
        .filter((call) => call.status === "ringing")
        .filter((call) => {
          const expires = timestampMs(call.expiresAt);
          const created = timestampMs(call.createdAt);
          return expires ? expires > now : !created || now - created < 90_000;
        })
        .sort((a, b) => timestampMs(b.createdAt) - timestampMs(a.createdAt));
      callback(calls);
    },
    () => callback([])
  );
}

export async function setCallOffer(callId: string, offer: RTCSessionDescriptionInit): Promise<void> {
  await updateDoc(doc(db, "calls", callId), {
    offer,
    status: "connecting",
    updatedAt: serverTimestamp(),
    expiresAt: new Date(Date.now() + 120_000),
  });
}

export async function setCallAnswer(callId: string, answer: RTCSessionDescriptionInit): Promise<void> {
  await updateDoc(doc(db, "calls", callId), {
    answer,
    status: "active",
    answeredAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    expiresAt: new Date(Date.now() + 6 * 60 * 60 * 1000),
  });
}

export async function setCallStatus(callId: string, status: CallStatus): Promise<void> {
  await updateDoc(doc(db, "calls", callId), {
    status,
    updatedAt: serverTimestamp(),
    ...(status === "ended" || status === "declined" ? { endedAt: serverTimestamp(), expiresAt: new Date() } : {}),
  });
}

export async function addCallCandidate(callId: string, side: "caller" | "callee", candidate: RTCIceCandidateInit): Promise<void> {
  await addDoc(collection(db, "calls", callId, `${side}Candidates`), {
    candidate,
    createdAt: serverTimestamp(),
  });
}

export function subscribeCallCandidates(
  callId: string,
  side: "caller" | "callee",
  callback: (candidate: RTCIceCandidateInit) => void
): Unsubscribe {
  const candidatesQuery = query(collection(db, "calls", callId, `${side}Candidates`), orderBy("createdAt", "asc"));
  const seen = new Set<string>();
  return onSnapshot(candidatesQuery, (snap) => {
    for (const change of snap.docChanges()) {
      if (change.type !== "added" || seen.has(change.doc.id)) continue;
      seen.add(change.doc.id);
      callback(change.doc.data().candidate as RTCIceCandidateInit);
    }
  });
}
