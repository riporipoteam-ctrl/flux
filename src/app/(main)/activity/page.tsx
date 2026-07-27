"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Activity,
  Heart,
  MessageCircle,
  Repeat2,
  UserPlus,
  Bookmark,
  Loader2,
} from "lucide-react";
import { formatDistanceToNowStrict } from "date-fns";
import { useAuth } from "@/contexts/auth-context";
import { getNotifications } from "@/services/notifications";
import type { Notification, UserProfile } from "@/types";
import { UserAvatar } from "@/components/shared/user-avatar";
import { EmptyState } from "@/components/shared/empty-state";
import { PageTransition } from "@/components/shared/page-transition";
import { cn } from "@/lib/utils";

type Row = Notification & { actor?: UserProfile | null };

const iconFor = (type: string) => {
  switch (type) {
    case "like":
      return Heart;
    case "reply":
    case "mention":
      return MessageCircle;
    case "repost":
    case "quote":
      return Repeat2;
    case "follow":
      return UserPlus;
    case "gift":
      return Bookmark;
    default:
      return Activity;
  }
};

export default function ActivityPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    getNotifications(user.uid, 80)
      .then(setItems)
      .finally(() => setLoading(false));
  }, [user]);

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 glass-strong border-b border-border/70 px-4 py-3">
        <h1 className="text-lg font-bold tracking-tight">Activity</h1>
        <p className="text-xs text-muted-foreground">
          Your full history of likes, follows, replies, and more
        </p>
      </header>

      <PageTransition>
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            icon={Activity}
            title="No activity yet"
            description="When people interact with you, it shows up here as a timeline."
          />
        ) : (
          <ul>
            {items.map((n, i) => {
              const Icon = iconFor(n.type);
              const href = n.postId
                ? `/post/${n.postId}`
                : n.actor?.username
                  ? `/${n.actor.username}`
                  : "/activity";
              const time = n.createdAt?.toDate
                ? formatDistanceToNowStrict(n.createdAt.toDate())
                : "";
              return (
                <motion.li
                  key={n.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: Math.min(i * 0.02, 0.3) }}
                >
                  <Link
                    href={href}
                    className={cn(
                      "flex items-center gap-3 border-b border-border/60 px-4 py-3.5 transition hover:bg-muted/40",
                      !n.read && "bg-accent/25"
                    )}
                  >
                    <div className="relative">
                      <UserAvatar user={n.actor} />
                      <span className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-card shadow-sm ring-1 ring-border">
                        <Icon className="h-3 w-3 text-primary" />
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[15px]">
                        <span className="font-bold">
                          {n.actor?.displayName || "Someone"}
                        </span>{" "}
                        <span className="text-muted-foreground">{n.message}</span>
                      </p>
                      <p className="mt-0.5 text-xs capitalize text-muted-foreground">
                        {n.type}
                        {time ? ` · ${time} ago` : ""}
                      </p>
                    </div>
                  </Link>
                </motion.li>
              );
            })}
          </ul>
        )}
      </PageTransition>
    </div>
  );
}
