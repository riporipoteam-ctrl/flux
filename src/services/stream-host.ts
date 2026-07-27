/**
 * Free host mode: someone runs Rec Room + Moonlight on their PC and
 * publishes a public tunnel URL to Firestore so Flux users can join.
 */
import {
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  serverTimestamp,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { stripUndefined } from "@/lib/firestore-safe";

export type StreamHostInfo = {
  active: boolean;
  url: string | null;
  hostUid: string | null;
  hostName: string | null;
  message: string | null;
  updatedAt?: unknown;
};

const HOST_DOC = doc(db, "streamHosts", "live");

export async function publishStreamHost(opts: {
  uid: string;
  displayName: string;
  url: string;
  message?: string;
}) {
  const url = opts.url.trim();
  if (!/^https?:\/\//i.test(url)) {
    throw new Error("URL must start with http:// or https://");
  }
  await setDoc(
    HOST_DOC,
    stripUndefined({
      active: true,
      url,
      hostUid: opts.uid,
      hostName: opts.displayName,
      message: opts.message || "Live Rec Room stream — join in browser!",
      updatedAt: serverTimestamp(),
    })
  );
}

export async function clearStreamHost(uid: string) {
  // Only clear if we are the host (best-effort; rules enforce)
  await setDoc(
    HOST_DOC,
    {
      active: false,
      url: null,
      hostUid: uid,
      hostName: null,
      message: null,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

export function subscribeStreamHost(
  cb: (info: StreamHostInfo | null) => void
): Unsubscribe {
  return onSnapshot(
    HOST_DOC,
    (snap) => {
      if (!snap.exists()) {
        cb(null);
        return;
      }
      const d = snap.data();
      cb({
        active: !!d.active && !!d.url,
        url: (d.url as string) || null,
        hostUid: (d.hostUid as string) || null,
        hostName: (d.hostName as string) || null,
        message: (d.message as string) || null,
        updatedAt: d.updatedAt,
      });
    },
    () => cb(null)
  );
}
