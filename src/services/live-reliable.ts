import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  type DocumentData,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { LivePeer } from "@/services/live";

function peerPath(streamId: string, viewerId: string) {
  return doc(db, "liveStreams", streamId, "peers", viewerId);
}

function mapPeer(id: string, data: DocumentData): LivePeer {
  const allowed: LivePeer["status"][] = ["waiting", "offered", "answered", "connected", "failed"];
  return {
    id,
    viewerId: String(data.viewerId || id),
    offer: data.offer || null,
    answer: data.answer || null,
    status: allowed.includes(data.status) ? data.status : "waiting",
    attempt: Math.max(1, Number(data.attempt || 1)),
    createdAt: data.createdAt || null,
    updatedAt: data.updatedAt || null,
  };
}

export async function resetReliableLivePeer(
  streamId: string,
  viewerId: string,
  attempt: number
): Promise<void> {
  const ref = peerPath(streamId, viewerId);
  await deleteDoc(ref).catch(() => undefined);
  await setDoc(ref, {
    viewerId,
    offer: null,
    answer: null,
    status: "waiting",
    attempt,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function removeReliableLivePeer(
  streamId: string,
  viewerId: string,
  attempt?: number
): Promise<void> {
  // Cleanup from an older component version may not include its attempt. In
  // that case we deliberately leave the document for the host connection-state
  // handler rather than risk deleting a newer retry that is already starting.
  if (!attempt) return;
  const ref = peerPath(streamId, viewerId);
  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists()) return;
    if (Number(snapshot.data().attempt || 1) !== attempt) return;
    transaction.delete(ref);
  }).catch(() => undefined);
}

export function subscribeReliableLivePeers(
  streamId: string,
  callback: (peers: LivePeer[]) => void
): Unsubscribe {
  return onSnapshot(collection(db, "liveStreams", streamId, "peers"), (snapshot) => {
    callback(snapshot.docs.map((item) => mapPeer(item.id, item.data())));
  }, (error) => {
    console.error("Reliable live peer list failed", error);
    callback([]);
  });
}

export function subscribeReliableLivePeer(
  streamId: string,
  viewerId: string,
  attempt: number,
  callback: (peer: LivePeer | null) => void
): Unsubscribe {
  return onSnapshot(peerPath(streamId, viewerId), (snapshot) => {
    if (!snapshot.exists()) return callback(null);
    const peer = mapPeer(snapshot.id, snapshot.data());
    callback(peer.attempt === attempt ? peer : null);
  }, (error) => {
    console.error("Reliable live peer failed", error);
    callback(null);
  });
}

export async function setReliableLiveOffer(
  streamId: string,
  viewerId: string,
  attempt: number,
  offer: RTCSessionDescriptionInit
): Promise<void> {
  await setDoc(peerPath(streamId, viewerId), {
    viewerId,
    attempt,
    offer,
    answer: null,
    status: "offered",
    updatedAt: serverTimestamp(),
  }, { merge: true });
}

export async function setReliableLiveAnswer(
  streamId: string,
  viewerId: string,
  attempt: number,
  answer: RTCSessionDescriptionInit
): Promise<void> {
  await setDoc(peerPath(streamId, viewerId), {
    viewerId,
    attempt,
    answer,
    status: "answered",
    updatedAt: serverTimestamp(),
  }, { merge: true });
}

export async function setReliableLiveStatus(
  streamId: string,
  viewerId: string,
  attempt: number,
  status: LivePeer["status"]
): Promise<void> {
  const ref = peerPath(streamId, viewerId);
  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists()) return;
    if (Number(snapshot.data().attempt || 1) !== attempt) return;
    transaction.set(ref, {
      status,
      updatedAt: serverTimestamp(),
    }, { merge: true });
  });
}

export async function addReliableLiveCandidate(
  streamId: string,
  viewerId: string,
  side: "host" | "viewer",
  attempt: number,
  candidate: RTCIceCandidateInit
): Promise<void> {
  await addDoc(
    collection(db, "liveStreams", streamId, "peers", viewerId, `${side}Candidates`),
    {
      attempt,
      candidate,
      createdAt: serverTimestamp(),
    }
  );
}

export function subscribeReliableLiveCandidates(
  streamId: string,
  viewerId: string,
  side: "host" | "viewer",
  attempt: number,
  callback: (candidate: RTCIceCandidateInit) => void
): Unsubscribe {
  const seen = new Set<string>();
  const candidates = query(
    collection(db, "liveStreams", streamId, "peers", viewerId, `${side}Candidates`),
    orderBy("createdAt", "asc")
  );
  return onSnapshot(candidates, (snapshot) => {
    for (const change of snapshot.docChanges()) {
      if (change.type !== "added" || seen.has(change.doc.id)) continue;
      seen.add(change.doc.id);
      const data = change.doc.data();
      if (Number(data.attempt || 0) !== attempt) continue;
      const candidate = data.candidate as RTCIceCandidateInit | undefined;
      if (candidate) callback(candidate);
    }
  }, (error) => console.error("Reliable live candidate subscription failed", error));
}
