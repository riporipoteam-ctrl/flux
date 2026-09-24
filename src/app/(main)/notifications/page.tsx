"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AtSign,
  Bell,
  CheckCheck,
  Gift,
  Heart,
  MessageCircle,
  Repeat2,
  UserPlus,
  type LucideIcon,
} from "lucide-react";
import { formatDistanceToNowStrict } from "date-fns";
import { useAuth } from "@/contexts/auth-context";
import {
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/services/notifications";
import { getPost } from "@/services/posts";
import type { Notification, UserProfile } from "@/types";
import { UserAvatar } from "@/components/shared/user-avatar";
import { XEmpty, XHeader, XPage, XRowSkeleton, XSwitch, XTabs } from "@/components/x/x-ui";
import { cn } from "@/lib/utils";
import { groupPath, postPath, profilePath } from "@/lib/routes";

type NotifRow = Notification & { actor?: UserProfile | null };
type Tab = "all" | "mentions" | "likes" | "follows";

const BADGES: Record<string, { icon: LucideIcon; tint: string }> = {
  like: { icon: Heart, tint: "var(--v8-pink)" },
  reply: { icon: MessageCircle, tint: "var(--v8-accent)" },
  mention: { icon: AtSign, tint: "var(--v8-accent)" },
  repost: { icon: Repeat2, tint: "var(--v8-green)" },
  quote: { icon: Repeat2, tint: "var(--v8-green)" },
  follow: { icon: UserPlus, tint: "var(--v8-accent)" },
  gift: { icon: Gift, tint: "var(--v8-purple)" },
};

const TYPE_LABEL: Record<string, string> = {
  like: "Like",
  reply: "Reply",
  mention: "Mention",
  repost: "Repost",
  quote: "Quote",
  follow: "Follow",
  gift: "Gift",
  group_invite: "Group invite",
  event: "Event",
  system: "System",
  challenge: "Challenge",
};

const EMPTY_COPY: Record<Tab, { title: string; description: string }> = {
  all: {
    title: "Nothing here yet",
    description: "Likes, replies, mentions and follows will show up here.",
  },
  mentions: {
    title: "No mentions yet",
    description: "When someone mentions you or replies to your post, you'll see it here.",
  },
  likes: {
    title: "No likes yet",
    description: "When someone likes your post, you'll see it here.",
  },
  follows: {
    title: "No new followers",
    description: "When someone follows you, you'll see it here.",
  },
};

export default function NotificationsPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<NotifRow[]>([]);
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("all");

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      setItems(await getNotifications(user.uid));
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  // Fetch a short text preview for notifications that reference a post.
  // Display-only: uses the existing post service, changes no data logic.
  useEffect(() => {
    const ids = [...new Set(items.filter((row) => row.postId).map((row) => row.postId as string))]
      .filter((id) => !(id in previews))
      .slice(0, 24);
    if (!ids.length) return;
    let cancelled = false;
    (async () => {
      const entries = await Promise.all(
        ids.map(async (id) => {
          try {
            const post = await getPost(id);
            const text = (post?.text || "").trim();
            return [id, text.length > 180 ? `${text.slice(0, 180)}…` : text] as const;
          } catch {
            return [id, ""] as const;
          }
        })
      );
      if (!cancelled) {
        setPreviews((previous) => ({ ...previous, ...Object.fromEntries(entries) }));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [items, previews]);

  const markAll = async () => {
    if (!user) return;
    await markAllNotificationsRead(user.uid);
    setItems((previous) => previous.map((row) => ({ ...row, read: true })));
  };

  const open = async (row: NotifRow) => {
    if (row.read) return;
    await markNotificationRead(row.id);
    setItems((previous) => previous.map((item) => (item.id === row.id ? { ...item, read: true } : item)));
  };

  const unread = useMemo(() => items.filter((row) => !row.read).length, [items]);

  const visible = useMemo(() => {
    switch (tab) {
      case "mentions":
        return items.filter((row) => row.type === "mention" || row.type === "reply");
      case "likes":
        return items.filter((row) => row.type === "like");
      case "follows":
        return items.filter((row) => row.type === "follow");
      default:
        return items;
    }
  }, [items, tab]);

  const empty = EMPTY_COPY[tab];

  return (
    <XPage>
      <XHeader
        title="Notifications"
        subtitle={unread > 0 ? `${unread} unread` : "You're all caught up"}
        icon={Bell}
        hideOnMobile
        actions={
          <button
            type="button"
            className="x-header-action"
            onClick={() => void markAll()}
            aria-label="Mark all as read"
            title="Mark all as read"
          >
            <CheckCheck className="h-[18px] w-[18px]" />
          </button>
        }
      />

      <XTabs
        value={tab}
        onChange={setTab}
        tabs={[
          { id: "all", label: "All", count: unread },
          { id: "mentions", label: "Mentions" },
          { id: "likes", label: "Likes" },
          { id: "follows", label: "Follows" },
        ]}
      />

      <XSwitch id={tab}>
        {loading ? (
          <XRowSkeleton rows={8} />
        ) : visible.length === 0 ? (
          <XEmpty icon={Bell} title={empty.title} description={empty.description} />
        ) : (
          <ul>
            {visible.map((row) => {
              const badge = BADGES[row.type];
              const Icon = badge?.icon;
              const href = row.postId
                ? postPath(row.postId)
                : row.groupId
                  ? groupPath(row.groupId)
                  : row.actor?.username
                    ? profilePath(row.actor.username)
                    : "/notifications";
              const time = row.createdAt?.toDate ? formatDistanceToNowStrict(row.createdAt.toDate()) : "";
              const preview = row.postId ? previews[row.postId] : "";

              return (
                <li key={row.id}>
                  <Link
                    href={href}
                    onClick={() => void open(row)}
                    className={cn("notif-row", !row.read && "is-unread")}
                  >
                    <span className="notif-badge" style={badge ? { color: badge.tint } : undefined} aria-hidden>
                      {Icon ? <Icon className="h-7 w-7" fill="currentColor" strokeWidth={0} /> : null}
                    </span>
                    <span className="notif-body">
                      <span className="notif-head">
                        <UserAvatar user={row.actor} size="xs" />
                        <b>{row.actor?.displayName || "Someone"}</b>
                        {row.actor?.username ? (
                          <span className="notif-handle">@{row.actor.username}</span>
                        ) : null}
                      </span>
                      <span className="notif-action">{row.message}</span>
                      <span className="notif-meta">
                        {TYPE_LABEL[row.type] || row.type}
                        {time ? ` · ${time} ago` : ""}
                      </span>
                      {preview ? <span className="notif-preview line-clamp-3">{preview}</span> : null}
                    </span>
                    {!row.read ? <span className="notif-dot" aria-label="Unread" /> : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </XSwitch>
    </XPage>
  );
}
