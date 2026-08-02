"use client";

import { useCallback, useEffect, useState } from "react";
import { List, Lock, Plus, Trash2 } from "lucide-react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  where,
} from "firebase/firestore";
import { toast } from "sonner";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/auth-context";
import { stripUndefined } from "@/lib/firestore-safe";
import { XEmpty, XHeader, XPage, XRowSkeleton } from "@/components/x/x-ui";

interface UserList {
  id: string;
  name: string;
  description: string;
  memberCount: number;
}

export default function ListsPage() {
  const { user } = useAuth();
  const [lists, setLists] = useState<UserList[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const snapshot = await getDocs(
        query(collection(db, "lists"), where("ownerId", "==", user.uid), limit(40))
      );
      setLists(
        snapshot.docs.map((entry) => ({
          id: entry.id,
          name: entry.data().name || "List",
          description: entry.data().description || "",
          memberCount: entry.data().memberCount || 0,
        }))
      );
    } catch {
      setLists([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  const create = async () => {
    if (!user || !name.trim()) return;
    setCreating(true);
    try {
      await addDoc(
        collection(db, "lists"),
        stripUndefined({
          ownerId: user.uid,
          name: name.trim(),
          description: "",
          isPrivate: true,
          memberCount: 0,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        })
      );
      setName("");
      toast.success("List created");
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not create list");
    } finally {
      setCreating(false);
    }
  };

  const remove = async (id: string) => {
    try {
      await deleteDoc(doc(db, "lists", id));
      setLists((previous) => previous.filter((item) => item.id !== id));
      toast.success("List deleted");
    } catch {
      toast.error("Could not delete list");
    }
  };

  return (
    <XPage>
      <XHeader title="Lists" subtitle="Private groups of people you follow" icon={List} hideOnMobile />

      <div className="flex gap-2 border-b border-[var(--v8-line)] p-3">
        <label className="flux8-rail-search !static flex-1">
          <Plus className="h-[18px] w-[18px] flex-none" />
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") void create();
            }}
            placeholder="Name a new list"
            aria-label="New list name"
          />
        </label>
        <button type="button" className="x-btn" onClick={() => void create()} disabled={creating || !name.trim()}>
          {creating ? "Creating…" : "Create"}
        </button>
      </div>

      {loading ? (
        <XRowSkeleton rows={4} />
      ) : lists.length === 0 ? (
        <XEmpty
          icon={List}
          title="No lists yet"
          description="Lists keep separate timelines for friends, creators or news accounts — and only you can see them."
        />
      ) : (
        <ul className="x-stagger">
          {lists.map((list, index) => (
            <li key={list.id} className="x-row" style={{ ["--i" as string]: Math.min(index, 12) }}>
              <span className="x-row-icon">
                <List className="h-[18px] w-[18px]" />
              </span>
              <span className="x-row-main">
                <strong>{list.name}</strong>
                <span className="flex items-center gap-1">
                  <Lock className="h-3 w-3" /> Private · {list.memberCount} members
                </span>
              </span>
              <button
                type="button"
                className="x-header-action"
                aria-label={`Delete ${list.name}`}
                onClick={() => void remove(list.id)}
              >
                <Trash2 className="h-[18px] w-[18px] text-[var(--v8-red)]" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </XPage>
  );
}
