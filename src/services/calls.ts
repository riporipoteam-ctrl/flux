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
}

function mapCall(id: string, data: DocumentData): FluxCall {
  return {
    id,
    conversationId: String(data.conversationId || ""),
    callerId: String(data.callerId || ""),
    calleeId: String(data.calleeId || ""),
    participantIds: data.participantIds || [],
    mode: data.mode === "video" ? "video" : "voice",
    status: data.status || "ringing",
    offer: data.offer || null,
    answer: data.answer || null,
    createdAt: data.createdAt || null,
    answeredAt: data.answeredAt || null,
    endedAt: data.endedAt || null,
  };
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
  return onSnapshot(doc(db, "calls", callId), (snap) => callback(snap.exists() ? mapCall(snap.id, snap.data()) : null));
}

export function subscribeIncomingCalls(uid: string, callback: (calls: FluxCall[]) => void): Unsubscribe {
  const callsQuery = query(collection(db, "calls"), where("calleeId", "==", uid), where("status", "==", "ringing"));
  return onSnapshot(callsQuery, (snap) => callback(snap.docs.map((item) => mapCall(item.id, item.data()))), () => callback([]));
}

export async function setCallOffer(callId: string, offer: RTCSessionDescriptionInit): Promise<void> {
  await updateDoc(doc(db, "calls", callId), { offer, status: "connecting" });
}

export async function setCallAnswer(callId: string, answer: RTCSessionDescriptionInit): Promise<void> {
  await updateDoc(doc(db, "calls", callId), { answer, status: "active", answeredAt: serverTimestamp() });
}

export async function setCallStatus(callId: string, status: CallStatus): Promise<void> {
  await updateDoc(doc(db, "calls", callId), {
    status,
    ...(status === "ended" || status === "declined" ? { endedAt: serverTimestamp() } : {}),
  });
}

export async function addCallCandidate(
  callId: string,
  side: "caller" | "callee",
  candidate: RTCIceCandidateInit
): Promise<void> {
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
