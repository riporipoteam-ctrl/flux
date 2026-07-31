import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  increment,
  limit,
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
import { getUser } from "@/services/users";
import type { UserProfile } from "@/types";

export interface FluxLiveStream {
  id: string;
  hostId: string;
  title: string;
  description: string;
  category: string;
  status: "live" | "ended";
  viewersCount: number;
  peakViewers: number;
  commentsCount: number;
  startedAt: unknown;
  endedAt: unknown;
  host?: UserProfile | null;
}

export interface LiveComment {
  id: string;
  authorId: string;
  text: string;
  createdAt: { toMillis?: () => number } | null;
  author?: UserProfile | null;
}

export interface LivePeer {
  id: string;
  viewerId: string;
  offer: RTCSessionDescriptionInit | null;
  answer: RTCSessionDescriptionInit | null;
  createdAt: unknown;
}

function mapStream(id: string, data: DocumentData): FluxLiveStream {
  return {
    id,
    hostId: String(data.hostId || ""),
    title: String(data.title || "Untitled live"),
    description: String(data.description || ""),
    category: String(data.category || "Chatting"),
    status: data.status === "ended" ? "ended" : "live",
    viewersCount: Number(data.viewersCount || 0),
    peakViewers: Number(data.peakViewers || 0),
    commentsCount: Number(data.commentsCount || 0),
    startedAt: data.startedAt || null,
    endedAt: data.endedAt || null,
  };
}

export async function createLiveStream(input: {
  hostId: string;
  title: string;
  description?: string;
  category?: string;
}): Promise<string> {
  const ref = doc(collection(db, "liveStreams"));
  await setDoc(ref, {
    hostId: input.hostId,
    title: input.title.trim().slice(0, 100) || "Live on Flux",
    description: (input.description || "").trim().slice(0, 500),
    category: (input.category || "Chatting").slice(0, 40),
    status: "live",
    viewersCount: 0,
    peakViewers: 0,
    commentsCount: 0,
    startedAt: serverTimestamp(),
    endedAt: null,
  });
  return ref.id;
}

export async function endLiveStream(streamId: string): Promise<void> {
  await updateDoc(doc(db, "liveStreams", streamId), {
    status: "ended",
    viewersCount: 0,
    endedAt: serverTimestamp(),
  });
}

export async function getLiveStream(streamId: string): Promise<FluxLiveStream | null> {
  const snap = await getDoc(doc(db, "liveStreams", streamId));
  if (!snap.exists()) return null;
  const stream = mapStream(snap.id, snap.data());
  return { ...stream, host: await getUser(stream.hostId) };
}

export async function listLiveStreams(): Promise<FluxLiveStream[]> {
  const snap = await getDocs(query(collection(db, "liveStreams"), where("status", "==", "live"), limit(40)));
  const streams = snap.docs.map((item) => mapStream(item.id, item.data()));
  const hosts = await Promise.all([...new Set(streams.map((stream) => stream.hostId))].map((uid) => getUser(uid)));
  const hostMap = new Map(hosts.filter(Boolean).map((host) => [host!.uid, host!]));
  return streams.map((stream) => ({ ...stream, host: hostMap.get(stream.hostId) || null }));
}

export function subscribeLiveStream(streamId: string, callback: (stream: FluxLiveStream | null) => void): Unsubscribe {
  return onSnapshot(doc(db, "liveStreams", streamId), async (snap) => {
    if (!snap.exists()) return callback(null);
    const stream = mapStream(snap.id, snap.data());
    callback({ ...stream, host: await getUser(stream.hostId) });
  });
}

export async function sendLiveComment(streamId: string, authorId: string, text: string): Promise<void> {
  const clean = text.trim().slice(0, 300);
  if (!clean) return;
  await addDoc(collection(db, "liveStreams", streamId, "comments"), {
    authorId,
    text: clean,
    createdAt: serverTimestamp(),
  });
  await updateDoc(doc(db, "liveStreams", streamId), { commentsCount: increment(1) });
}

export function subscribeLiveComments(streamId: string, callback: (comments: LiveComment[]) => void): Unsubscribe {
  const commentsQuery = query(collection(db, "liveStreams", streamId, "comments"), orderBy("createdAt", "asc"), limit(250));
  return onSnapshot(commentsQuery, async (snap) => {
    const comments = snap.docs.map((item) => ({
      id: item.id,
      authorId: String(item.data().authorId || ""),
      text: String(item.data().text || ""),
      createdAt: item.data().createdAt || null,
    }));
    const authors = await Promise.all([...new Set(comments.map((comment) => comment.authorId))].map((uid) => getUser(uid)));
    const authorMap = new Map(authors.filter(Boolean).map((author) => [author!.uid, author!]));
    callback(comments.map((comment) => ({ ...comment, author: authorMap.get(comment.authorId) || null })));
  }, () => callback([]));
}

export async function joinLiveStream(streamId: string, viewerId: string): Promise<void> {
  await setDoc(doc(db, "liveStreams", streamId, "viewers", viewerId), {
    viewerId,
    joinedAt: serverTimestamp(),
    lastSeenAt: serverTimestamp(),
  });
}

export async function leaveLiveStream(streamId: string, viewerId: string): Promise<void> {
  await deleteDoc(doc(db, "liveStreams", streamId, "viewers", viewerId)).catch(() => undefined);
}

export function subscribeLiveViewerCount(streamId: string, callback: (count: number) => void): Unsubscribe {
  return onSnapshot(collection(db, "liveStreams", streamId, "viewers"), (snap) => callback(snap.size), () => callback(0));
}

export async function syncLiveViewerCount(streamId: string, count: number): Promise<void> {
  const ref = doc(db, "liveStreams", streamId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const peak = Math.max(Number(snap.data().peakViewers || 0), count);
  await updateDoc(ref, { viewersCount: count, peakViewers: peak });
}

export async function createLivePeer(streamId: string, viewerId: string): Promise<void> {
  await setDoc(doc(db, "liveStreams", streamId, "peers", viewerId), {
    viewerId,
    offer: null,
    answer: null,
    createdAt: serverTimestamp(),
  });
}

export function subscribeLivePeers(streamId: string, callback: (peers: LivePeer[]) => void): Unsubscribe {
  return onSnapshot(collection(db, "liveStreams", streamId, "peers"), (snap) => {
    callback(snap.docs.map((item) => ({
      id: item.id,
      viewerId: String(item.data().viewerId || item.id),
      offer: item.data().offer || null,
      answer: item.data().answer || null,
      createdAt: item.data().createdAt || null,
    })));
  });
}

export function subscribeLivePeer(streamId: string, viewerId: string, callback: (peer: LivePeer | null) => void): Unsubscribe {
  return onSnapshot(doc(db, "liveStreams", streamId, "peers", viewerId), (snap) => {
    callback(snap.exists() ? {
      id: snap.id,
      viewerId: String(snap.data().viewerId || snap.id),
      offer: snap.data().offer || null,
      answer: snap.data().answer || null,
      createdAt: snap.data().createdAt || null,
    } : null);
  });
}

export async function setLivePeerOffer(streamId: string, viewerId: string, offer: RTCSessionDescriptionInit): Promise<void> {
  await updateDoc(doc(db, "liveStreams", streamId, "peers", viewerId), { offer });
}

export async function setLivePeerAnswer(streamId: string, viewerId: string, answer: RTCSessionDescriptionInit): Promise<void> {
  await updateDoc(doc(db, "liveStreams", streamId, "peers", viewerId), { answer });
}

export async function addLiveCandidate(
  streamId: string,
  viewerId: string,
  side: "host" | "viewer",
  candidate: RTCIceCandidateInit
): Promise<void> {
  await addDoc(collection(db, "liveStreams", streamId, "peers", viewerId, `${side}Candidates`), {
    candidate,
    createdAt: serverTimestamp(),
  });
}

export function subscribeLiveCandidates(
  streamId: string,
  viewerId: string,
  side: "host" | "viewer",
  callback: (candidate: RTCIceCandidateInit) => void
): Unsubscribe {
  const seen = new Set<string>();
  const candidateQuery = query(collection(db, "liveStreams", streamId, "peers", viewerId, `${side}Candidates`), orderBy("createdAt", "asc"));
  return onSnapshot(candidateQuery, (snap) => {
    for (const change of snap.docChanges()) {
      if (change.type !== "added" || seen.has(change.doc.id)) continue;
      seen.add(change.doc.id);
      callback(change.doc.data().candidate as RTCIceCandidateInit);
    }
  });
}

export async function removeLivePeer(streamId: string, viewerId: string): Promise<void> {
  await deleteDoc(doc(db, "liveStreams", streamId, "peers", viewerId)).catch(() => undefined);
}
