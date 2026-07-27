"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { List, Loader2, Plus, Trash2 } from "lucide-react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  serverTimestamp,
  where,
  limit,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/shared/empty-state";
import { PageTransition } from "@/components/shared/page-transition";
import { toast } from "sonner";
import { stripUndefined } from "@/lib/firestore-safe";

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

  const load = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const snap = await getDocs(
        query(
          collection(db, "lists"),
          where("ownerId", "==", user.uid),
          limit(40)
        )
      );
      setLists(
        snap.docs.map((d) => ({
          id: d.id,
          name: d.data().name || "List",
          description: d.data().description || "",
          memberCount: d.data().memberCount || 0,
        }))
      );
    } catch {
      setLists([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid]);

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
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not create list");
    } finally {
      setCreating(false);
    }
  };

  const remove = async (id: string) => {
    try {
      await deleteDoc(doc(db, "lists", id));
      setLists((prev) => prev.filter((l) => l.id !== id));
      toast.success("List deleted");
    } catch {
      toast.error("Could not delete list");
    }
  };

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 glass-strong border-b border-border/70 px-4 py-3">
        <h1 className="text-lg font-bold">Lists</h1>
        <p className="text-xs text-muted-foreground">
          Curate custom people groups (private to you)
        </p>
      </header>

      <PageTransition className="space-y-4 p-4">
        <div className="surface-card flex gap-2 p-3">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="New list name…"
            onKeyDown={(e) => {
              if (e.key === "Enter") create();
            }}
          />
          <Button onClick={create} loading={creating} disabled={!name.trim()}>
            <Plus className="h-4 w-4" />
            Create
          </Button>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : lists.length === 0 ? (
          <EmptyState
            icon={List}
            title="No lists yet"
            description="Create a list for friends, creators, or news accounts."
          />
        ) : (
          <ul className="space-y-2">
            {lists.map((list, i) => (
              <motion.li
                key={list.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                className="surface-card flex items-center gap-3 p-4"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-accent text-primary">
                  <List className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{list.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {list.memberCount} members · Private
                  </p>
                </div>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  onClick={() => remove(list.id)}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </motion.li>
            ))}
          </ul>
        )}
      </PageTransition>
    </div>
  );
}
