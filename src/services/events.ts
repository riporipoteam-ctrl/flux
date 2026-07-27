import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  updateDoc,
  query,
  orderBy,
  limit,
  serverTimestamp,
  writeBatch,
  increment,
  type DocumentData,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { getUser } from "./users";
import type { UserProfile } from "@/types";

export interface FluxEvent {
  id: string;
  title: string;
  description: string;
  hostId: string;
  startAt: string;
  endAt: string;
  location: string;
  coverUrl: string | null;
  attendeeCount: number;
  createdAt: unknown;
  host?: UserProfile | null;
}

function mapEvent(id: string, data: DocumentData): FluxEvent {
  return {
    id,
    title: data.title ?? "",
    description: data.description ?? "",
    hostId: data.hostId,
    startAt: data.startAt ?? "",
    endAt: data.endAt ?? "",
    location: data.location ?? "",
    coverUrl: data.coverUrl ?? null,
    attendeeCount: data.attendeeCount ?? 0,
    createdAt: data.createdAt,
  };
}

export async function createEvent(input: {
  hostId: string;
  title: string;
  description: string;
  startAt: string;
  endAt: string;
  location: string;
}): Promise<string> {
  const ref = await addDoc(collection(db, "events"), {
    ...input,
    title: input.title.trim(),
    description: input.description.trim(),
    coverUrl: null,
    attendeeCount: 1,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  const batch = writeBatch(db);
  batch.set(doc(db, "events", ref.id, "attendees", input.hostId), {
    uid: input.hostId,
    joinedAt: serverTimestamp(),
  });
  await batch.commit();
  return ref.id;
}

export async function getEvents(max = 40): Promise<FluxEvent[]> {
  try {
    const snap = await getDocs(
      query(collection(db, "events"), orderBy("startAt", "asc"), limit(max))
    );
    const events = snap.docs.map((d) => mapEvent(d.id, d.data()));
    return Promise.all(
      events.map(async (e) => ({
        ...e,
        host: await getUser(e.hostId),
      }))
    );
  } catch {
    const snap = await getDocs(query(collection(db, "events"), limit(max)));
    return Promise.all(
      snap.docs.map(async (d) => {
        const e = mapEvent(d.id, d.data());
        return { ...e, host: await getUser(e.hostId) };
      })
    );
  }
}

export async function getEvent(id: string): Promise<FluxEvent | null> {
  const snap = await getDoc(doc(db, "events", id));
  if (!snap.exists()) return null;
  const e = mapEvent(snap.id, snap.data());
  return { ...e, host: await getUser(e.hostId) };
}

export async function joinEvent(eventId: string, uid: string): Promise<void> {
  const att = await getDoc(doc(db, "events", eventId, "attendees", uid));
  if (att.exists()) return;
  const batch = writeBatch(db);
  batch.set(doc(db, "events", eventId, "attendees", uid), {
    uid,
    joinedAt: serverTimestamp(),
  });
  batch.update(doc(db, "events", eventId), {
    attendeeCount: increment(1),
  });
  await batch.commit();
}

export async function leaveEvent(eventId: string, uid: string): Promise<void> {
  const att = await getDoc(doc(db, "events", eventId, "attendees", uid));
  if (!att.exists()) return;
  const batch = writeBatch(db);
  batch.delete(doc(db, "events", eventId, "attendees", uid));
  batch.update(doc(db, "events", eventId), {
    attendeeCount: increment(-1),
  });
  await batch.commit();
}

export async function isAttending(
  eventId: string,
  uid: string
): Promise<boolean> {
  const att = await getDoc(doc(db, "events", eventId, "attendees", uid));
  return att.exists();
}

export async function getAttendees(eventId: string): Promise<UserProfile[]> {
  const snap = await getDocs(collection(db, "events", eventId, "attendees"));
  const users = await Promise.all(snap.docs.map((d) => getUser(d.id)));
  return users.filter(Boolean) as UserProfile[];
}
