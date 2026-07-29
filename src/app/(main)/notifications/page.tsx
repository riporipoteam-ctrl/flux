"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Bell, CheckCheck, Loader2 } from "lucide-react";
import { formatDistanceToNowStrict } from "date-fns";
import { useAuth } from "@/contexts/auth-context";
import {
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/services/notifications";
import type { Notification, UserProfile } from "@/types";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import { cn } from "@/lib/utils";
import { groupPath, postPath, profilePath } from "@/lib/routes";

type NotifRow = Notification & { actor?: UserProfile | null };

export default function NotificationsPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<NotifRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      setItems(await getNotifications(user.uid));
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  const markAll = async () => {
    if (!user) return;
    await markAllNotificationsRead(user.uid);
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const onOpen = async (n: NotifRow) => {
    if (!n.read) {
      await markNotificationRead(n.id);
      setItems((prev) =>
        prev.map((x) => (x.id === n.id ? { ...x, read: true } : x))
      );
    }
  };

  return (
    <div className="min-h-screen">
      <header className="relative z-20 lg:sticky lg:top-0 lg:z-30 flex items-center justify-between glass border-b border-border px-4 py-3">
        <h1 className="text-lg font-bold">Notifications</h1>
        <Button variant="ghost" size="sm" onClick={markAll}>
          <CheckCheck className="h-4 w-4" />
          Mark all read
        </Button>
      </header>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={Bell}
          title="You're all caught up"
          description="Likes, replies, follows, and gifts will show up here."
        />
      ) : (
        <motion.ul initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          {items.map((n) => {
            const href = n.postId
              ? postPath(n.postId)
              : n.groupId
                ? groupPath(n.groupId)
                : n.actor?.username
                  ? profilePath(n.actor.username)
                  : "/notifications";
            const time = n.createdAt?.toDate
              ? formatDistanceToNowStrict(n.createdAt.toDate())
              : "";
            return (
              <li key={n.id}>
                <Link
                  href={href}
                  onClick={() => onOpen(n)}
                  className={cn(
                    "flex gap-3 border-b border-border px-4 py-3 transition hover:bg-muted/40",
                    !n.read && "bg-accent/40"
                  )}
                >
                  <UserAvatar user={n.actor} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[15px]">
                      <span className="font-bold">
                        {n.actor?.displayName || "Someone"}
                      </span>{" "}
                      <span className="text-muted-foreground">{n.message}</span>
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {n.type}
                      {time ? ` · ${time}` : ""}
                    </p>
                  </div>
                  {!n.read ? (
                    <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-primary" />
                  ) : null}
                </Link>
              </li>
            );
          })}
        </motion.ul>
      )}
    </div>
  );
}
