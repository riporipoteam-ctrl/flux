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
import type { LiveSourceMode } from "@/lib/webrtc";

export interface FluxLiveStream {
  id: string;
  hostId: string;
  title: string;
  description: string;
  category: string;
  sourceType: LiveSourceMode;
  status: "live" | "ended";
  viewersCount: number;
  peakViewers: number;
  uniqueViewers: number;
  commentsCount: number;
  likesCount: number;
  sharesCount: number;
  totalWatchSeconds: number;
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
  status: "waiting" | "offered" | "answered" | "connected" | "failed";
  attempt: number;
  createdAt: unknown;
  updatedAt: unknown;
}

export interface LiveViewerAnalytics {
  activeViewers: number;
  uniqueViewers: number;
  totalWatchSeconds: number;
  likesCount: number;
  sharesCount: number;
}

function mapStream(id: string, data: DocumentData): FluxLiveStream {
  return {
    id,
    hostId: String(data.hostId || ""),
    title: String(data.title || "Untitled live"),
    description: String(data.description || ""),
    category: String(data.category || "Chatting"),
    sourceType: data.sourceType === "screen" ? "screen" : "camera",
    status: data.status === "ended" ? "ended" : "live",
    viewersCount: Number(data.viewersCount || 0),
    peakViewers: Number(data.peakViewers || 0),
    uniqueViewers: Number(data.uniqueViewers || 0),
    commentsCount: Number(data.commentsCount || 0),
    likesCount: Number(data.likesCount || 0),
    sharesCount: Number(data.sharesCount || 0),
    totalWatchSeconds: Number(data.totalWatchSeconds || 0),
    startedAt: data.startedAt || null,
    endedAt: data.endedAt || null,
  };
}

function mapPeer(id: string, data: DocumentData): LivePeer {
  const statuses: LivePeer["status"][] = ["waiting", "offered", "answered", "connected", "failed"];
  return {
    id,
    viewerId: String(data.viewerId || id),
    offer: data.offer || null,
    answer: data.answer || null,
    status: statuses.includes(data.status) ? data.status : "waiting",
    attempt: Math.max(1, Number(data.attempt || 1)),
    createdAt: data.createdAt || null,
    updatedAt: data.updatedAt || null,
  };
}

function timestampMs(value: unknown): number {
  if (!value || typeof value !== "object") return 0;
  if ("toMillis" in value && typeof value.toMillis === "function") return value.toMillis();
  if ("toDate" in value && typeof value.toDate === "function") return value.toDate().getTime();
  return 0;
}

export async function createLiveStream(input: {
  hostId: string;
  title: string;
  description?: string;
  category?: string;
  sourceType?: LiveSourceMode;
}): Promise<string> {
  const ref = doc(collection(db, "liveStreams"));
  await setDoc(ref, {
    hostId: input.hostId,
    title: input.title.trim().slice(0, 100) || "Live on Flux",
    description: (input.description || "").trim().slice(0, 500),
    category: (input.category || "Chatting").slice(0, 40),
    sourceType: input.sourceType === "screen" ? "screen" : "camera",
    status: "live",
    viewersCount: 0,
    peakViewers: 0,
    uniqueViewers: 0,
    commentsCount: 0,
    likesCount: 0,
    sharesCount: 0,
    totalWatchSeconds: 0,
    startedAt: serverTimestamp(),
    endedAt: null,
    signalingVersion: 2,
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
  return { ...stream, host: await getUser(stream.hostId).catch(() => null) };
}

export async function listLiveStreams(): Promise<FluxLiveStream[]> {
  let docs;
  try {
    docs = (await getDocs(query(collection(db, "liveStreams"), where("status", "==", "live"), limit(40)))).docs;
  } catch {
    docs = (await getDocs(query(collection(db, "liveStreams"), limit(60)))).docs
      .filter((item) => item.data().status === "live");
  }
  const streams = docs.map((item) => mapStream(item.id, item.data()));
  const hosts = await Promise.all([...new Set(streams.map((stream) => stream.hostId))].map((uid) => getUser(uid).catch(() => null)));
  const hostMap = new Map(hosts.filter(Boolean).map((host) => [host!.uid, host!]));
  return streams
    .map((stream) => ({ ...stream, host: hostMap.get(stream.hostId) || null }))
    .sort((a, b) => timestampMs(b.startedAt) - timestampMs(a.startedAt));
}

export function subscribeLiveStream(streamId: string, callback: (stream: FluxLiveStream | null) => void): Unsubscribe {
  return onSnapshot(doc(db, "liveStreams", streamId), async (snap) => {
    if (!snap.exists()) return callback(null);
    const stream = mapStream(snap.id, snap.data());
    const host = await getUser(stream.hostId).catch(() => null);
    callback({ ...stream, host });
  }, (error) => {
    console.error("Live stream subscription failed", error);
    callback(null);
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
    const authors = await Promise.all([...new Set(comments.map((comment) => comment.authorId))].map((uid) => getUser(uid).catch(() => null)));
    const authorMap = new Map(authors.filter(Boolean).map((author) => [author!.uid, author!]));
    callback(comments.map((comment) => ({ ...comment, author: authorMap.get(comment.authorId) || null })));
  }, (error) => {
    console.error("Live comments subscription failed", error);
    callback([]);
  });
}

export async function joinLiveStream(streamId: string, viewerId: string): Promise<void> {
  const viewerRef = doc(db, "liveStreams", streamId, "viewers", viewerId);
  const existing = await getDoc(viewerRef);
  await setDoc(viewerRef, {
    viewerId,
    active: true,
    joinedAt: serverTimestamp(),
    lastSeenAt: serverTimestamp(),
    sessionsCount: increment(1),
    ...(existing.exists() ? {} : {
      firstJoinedAt: serverTimestamp(),
      watchedSeconds: 0,
      liked: false,
      sharesCount: 0,
    }),
  }, { merge: true });
}

export async function heartbeatLiveViewer(streamId: string, viewerId: string): Promise<void> {
  await setDoc(doc(db, "liveStreams", streamId, "viewers", viewerId), {
    viewerId,
    active: true,
    lastSeenAt: serverTimestamp(),
  }, { merge: true });
}

export async function leaveLiveStream(streamId: string, viewerId: string, watchedSeconds = 0): Promise<void> {
  await setDoc(doc(db, "liveStreams", streamId, "viewers", viewerId), {
    active: false,
    leftAt: serverTimestamp(),
    lastSeenAt: serverTimestamp(),
    watchedSeconds: increment(Math.max(0, Math.floor(watchedSeconds))),
  }, { merge: true }).catch(() => undefined);
}

export function subscribeLiveViewerAnalytics(
  streamId: string,
  callback: (analytics: LiveViewerAnalytics) => void
): Unsubscribe {
  return onSnapshot(collection(db, "liveStreams", streamId, "viewers"), (snap) => {
    const now = Date.now();
    let activeViewers = 0;
    let totalWatchSeconds = 0;
    let likesCount = 0;
    let sharesCount = 0;
    for (const viewer of snap.docs) {
      const data = viewer.data();
      const lastSeen = timestampMs(data.lastSeenAt);
      if (data.active === true && lastSeen > now - 70_000) activeViewers += 1;
      totalWatchSeconds += Number(data.watchedSeconds || 0);
      if (data.liked === true) likesCount += 1;
      sharesCount += Number(data.sharesCount || 0);
    }
    callback({ activeViewers, uniqueViewers: snap.size, totalWatchSeconds, likesCount, sharesCount });
  }, (error) => {
    console.error("Live analytics subscription failed", error);
    callback({ activeViewers: 0, uniqueViewers: 0, totalWatchSeconds: 0, likesCount: 0, sharesCount: 0 });
  });
}

export async function syncLiveAnalytics(streamId: string, analytics: LiveViewerAnalytics): Promise<void> {
  const ref = doc(db, "liveStreams", streamId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const peak = Math.max(Number(snap.data().peakViewers || 0), analytics.activeViewers);
  await updateDoc(ref, {
    viewersCount: analytics.activeViewers,
    peakViewers: peak,
    uniqueViewers: analytics.uniqueViewers,
    totalWatchSeconds: analytics.totalWatchSeconds,
    likesCount: analytics.likesCount,
    sharesCount: analytics.sharesCount,
  });
}

export async function toggleLiveLike(streamId: string, uid: string): Promise<boolean> {
  const viewerRef = doc(db, "liveStreams", streamId, "viewers", uid);
  const snap = await getDoc(viewerRef);
  const liked = snap.data()?.liked === true;
  await setDoc(viewerRef, { viewerId: uid, liked: !liked, lastSeenAt: serverTimestamp() }, { merge: true });
  return !liked;
}

export async function recordLiveShare(streamId: string, uid: string): Promise<void> {
  await setDoc(doc(db, "liveStreams", streamId, "viewers", uid), {
    viewerId: uid,
    sharesCount: increment(1),
    lastSeenAt: serverTimestamp(),
  }, { merge: true });
}

export async function createLivePeer(streamId: string, viewerId: string, attempt = 1): Promise<void> {
  await setDoc(doc(db, "liveStreams", streamId, "peers", viewerId), {
    viewerId,
    offer: null,
    answer: null,
    status: "waiting",
    attempt,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export function subscribeLivePeers(streamId: string, callback: (peers: LivePeer[]) => void): Unsubscribe {
  return onSnapshot(collection(db, "liveStreams", streamId, "peers"), (snap) => {
    callback(snap.docs.map((item) => mapPeer(item.id, item.data())));
  }, (error) => {
    console.error("Live peer list subscription failed", error);
    callback([]);
  });
}

export function subscribeLivePeer(streamId: string, viewerId: string, callback: (peer: LivePeer | null) => void): Unsubscribe {
  return onSnapshot(doc(db, "liveStreams", streamId, "peers", viewerId), (snap) => {
    callback(snap.exists() ? mapPeer(snap.id, snap.data()) : null);
  }, (error) => {
    console.error("Live peer subscription failed", error);
    callback(null);
  });
}

export async function setLivePeerOffer(streamId: string, viewerId: string, offer: RTCSessionDescriptionInit): Promise<void> {
  await setDoc(doc(db, "liveStreams", streamId, "peers", viewerId), {
    offer,
    answer: null,
    status: "offered",
    updatedAt: serverTimestamp(),
  }, { merge: true });
}

export async function setLivePeerAnswer(streamId: string, viewerId: string, answer: RTCSessionDescriptionInit): Promise<void> {
  await setDoc(doc(db, "liveStreams", streamId, "peers", viewerId), {
    answer,
    status: "answered",
    updatedAt: serverTimestamp(),
  }, { merge: true });
}

export async function setLivePeerStatus(
  streamId: string,
  viewerId: string,
  status: LivePeer["status"]
): Promise<void> {
  await setDoc(doc(db, "liveStreams", streamId, "peers", viewerId), {
    status,
    updatedAt: serverTimestamp(),
  }, { merge: true });
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
      const candidate = change.doc.data().candidate as RTCIceCandidateInit | undefined;
      if (candidate) callback(candidate);
    }
  }, (error) => console.error(`Live ${side} candidate subscription failed`, error));
}

export async function removeLivePeer(streamId: string, viewerId: string): Promise<void> {
  await deleteDoc(doc(db, "liveStreams", streamId, "peers", viewerId)).catch(() => undefined);
}
