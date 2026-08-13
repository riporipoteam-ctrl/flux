import {
  collection,
  limit,
  onSnapshot,
  query,
  where,
  type DocumentData,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { getUser } from "@/services/users";
import type { FluxLiveStream } from "@/services/live";

function timestampMs(value: unknown): number {
  if (!value || typeof value !== "object") return 0;
  if ("toMillis" in value && typeof value.toMillis === "function") return value.toMillis();
  if ("toDate" in value && typeof value.toDate === "function") return value.toDate().getTime();
  return 0;
}

function mapDirectoryStream(id: string, data: DocumentData): FluxLiveStream {
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

/**
 * Keeps the public Live directory fresh while avoiding stale async host lookups
 * from overwriting a newer Firestore snapshot.
 */
export function subscribeLiveDirectory(
  callback: (streams: FluxLiveStream[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  let generation = 0;
  const liveQuery = query(
    collection(db, "liveStreams"),
    where("status", "==", "live"),
    limit(60)
  );

  return onSnapshot(liveQuery, (snapshot) => {
    const currentGeneration = ++generation;
    const streams = snapshot.docs
      .map((item) => mapDirectoryStream(item.id, item.data()))
      .sort((a, b) => timestampMs(b.startedAt) - timestampMs(a.startedAt));

    const hostIds = [...new Set(streams.map((stream) => stream.hostId).filter(Boolean))];
    void Promise.all(hostIds.map((uid) => getUser(uid).catch(() => null))).then((hosts) => {
      if (currentGeneration !== generation) return;
      const hostMap = new Map(hosts.filter(Boolean).map((host) => [host!.uid, host!]));
      callback(streams.map((stream) => ({ ...stream, host: hostMap.get(stream.hostId) || null })));
    });
  }, (error) => {
    console.error("Live directory subscription failed", error);
    callback([]);
    onError?.(error instanceof Error ? error : new Error("Live directory subscription failed"));
  });
}
