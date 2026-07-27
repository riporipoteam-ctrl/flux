import {
  collection,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { ensureUserDocument, getUser } from "./users";
import { stripUndefined } from "@/lib/firestore-safe";

export const MAX_LINKED = 5;

/**
 * Secure account linking:
 * - Shared accountLinkId across members
 * - Switching always requires password (no stored credentials)
 */
export async function ensureAccountLink(uid: string): Promise<string> {
  const user = await getUser(uid);
  if (!user) throw new Error("User not found");
  if (user.accountLinkId) return user.accountLinkId;

  const linkId = `link_${uid}`;
  await updateDoc(doc(db, "users", uid), {
    accountLinkId: linkId,
    linkedUids: [uid],
    updatedAt: serverTimestamp(),
  });
  await setDoc(doc(db, "accountLinks", linkId), {
    ownerUid: uid,
    memberUids: [uid],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return linkId;
}

export async function getLinkedProfiles(uid: string) {
  const user = await getUser(uid);
  if (!user) return [];
  if (!user.accountLinkId) return [user];
  const ids = user.linkedUids?.length ? user.linkedUids : [uid];
  const profiles = await Promise.all(ids.map((id) => getUser(id)));
  return profiles.filter(Boolean);
}

export async function createLinkedAccount(input: {
  primaryUid: string;
  email: string;
  password: string;
  displayName: string;
}): Promise<string> {
  const primary = await getUser(input.primaryUid);
  if (!primary) throw new Error("Primary account missing");
  if (primary.moderationStatus === "banned") throw new Error("Account banned");

  const linkId = await ensureAccountLink(input.primaryUid);
  const linkSnap = await getDoc(doc(db, "accountLinks", linkId));
  const members: string[] = linkSnap.data()?.memberUids || [input.primaryUid];
  if (members.length >= MAX_LINKED) {
    throw new Error(`Max ${MAX_LINKED} linked accounts`);
  }

  const cred = await createUserWithEmailAndPassword(
    auth,
    input.email.trim(),
    input.password
  );
  await updateProfile(cred.user, { displayName: input.displayName });
  await ensureUserDocument(
    cred.user.uid,
    input.email.trim(),
    input.displayName,
    null
  );

  const newUid = cred.user.uid;
  const all = Array.from(new Set([...members, newUid]));

  await updateDoc(doc(db, "accountLinks", linkId), {
    memberUids: all,
    updatedAt: serverTimestamp(),
  });

  await Promise.all(
    all.map((id) =>
      updateDoc(doc(db, "users", id), {
        accountLinkId: linkId,
        linkedUids: all,
        updatedAt: serverTimestamp(),
      })
    )
  );

  await setDoc(
    doc(db, "accountLinks", linkId, "publicMembers", newUid),
    stripUndefined({
      uid: newUid,
      email: input.email.trim().toLowerCase(),
      displayName: input.displayName,
      createdAt: serverTimestamp(),
    }),
    { merge: true }
  );
  await setDoc(
    doc(db, "accountLinks", linkId, "publicMembers", input.primaryUid),
    stripUndefined({
      uid: input.primaryUid,
      email: primary.email.toLowerCase(),
      displayName: primary.displayName,
      createdAt: serverTimestamp(),
    }),
    { merge: true }
  );

  return newUid;
}

export async function listLinkedPublicMembers(linkId: string) {
  const snap = await getDocs(
    collection(db, "accountLinks", linkId, "publicMembers")
  );
  return snap.docs.map(
    (d) =>
      d.data() as {
        uid: string;
        email: string;
        displayName: string;
      }
  );
}

export async function switchLinkedAccount(email: string, password: string) {
  // Full re-auth with password — never auto-switch without credentials
  await signOut(auth);
  const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
  return cred.user.uid;
}
