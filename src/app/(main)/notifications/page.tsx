"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AtSign, Bell, CheckCheck, Heart, MessageCircle, Repeat2, UserPlus } from "lucide-react";
import { formatDistanceToNowStrict } from "date-fns";
import { useAuth } from "@/contexts/auth-context";
import {
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/services/notifications";
import type { Notification, UserProfile } from "@/types";
import { UserAvatar } from "@/components/shared/user-avatar";
import { XEmpty, XHeader, XPage, XRowSkeleton, XSwitch, XTabs } from "@/components/x/x-ui";
import { cn } from "@/lib/utils";
import { groupPath, postPath, profilePath } from "@/lib/routes";

type NotifRow = Notification & { actor?: UserProfile | null };
type Tab = "all" | "mentions";

const BADGES: Record<string, { icon: typeof Heart; tint: string }> = {
  like: { icon: Heart, tint: "var(--v8-pink)" },
  reply: { icon: MessageCircle, tint: "var(--v8-accent)" },
  mention: { icon: AtSign, tint: "var(--v8-accent)" },
  repost: { icon: Repeat2, tint: "var(--v8-green)" },
  quote: { icon: Repeat2, tint: "var(--v8-green)" },
  follow: { icon: UserPlus, tint: "var(--v8-accent)" },
};

export default function NotificationsPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<NotifRow[]>([]);
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
  const visible = useMemo(
    () => (tab === "mentions" ? items.filter((row) => row.type === "mention" || row.type === "reply") : items),
    [items, tab]
  );

  return (
    <XPage>
      <XHeader
        title="Notifications"
        subtitle={unread ? `${unread} unread` : "All caught up"}
        icon={Bell}
        hideOnMobile
        actions={
          <button type="button" className="x-header-action" onClick={() => void markAll()} aria-label="Mark all as read">
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
        ]}
      />

      <XSwitch id={tab}>
        {loading ? (
          <XRowSkeleton rows={7} />
        ) : visible.length === 0 ? (
          <XEmpty
            icon={Bell}
            title={tab === "mentions" ? "No mentions yet" : "You're all caught up"}
            description={
              tab === "mentions"
                ? "When someone @mentions you or replies to your post it lands here."
                : "Likes, replies, follows and gifts will show up here."
            }
          />
        ) : (
          <ul className="x-stagger">
            {visible.map((row, index) => {
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

              return (
                <li key={row.id} style={{ ["--i" as string]: Math.min(index, 14) }}>
                  <Link
                    href={href}
                    onClick={() => void open(row)}
                    className={cn("x-row items-start", !row.read && "bg-[var(--v8-accent-soft)]")}
                  >
                    <span className="relative flex-none">
                      <UserAvatar user={row.actor} />
                      {Icon ? (
                        <span
                          className="absolute -bottom-0.5 -right-0.5 grid h-5 w-5 place-items-center rounded-full"
                          style={{ background: "var(--v8-panel)", color: badge.tint, boxShadow: "0 0 0 2px var(--v8-panel)" }}
                        >
                          <Icon className="h-3 w-3" />
                        </span>
                      ) : null}
                    </span>
                    <span className="x-row-main">
                      <strong className="!font-normal text-[15px]">
                        <b className="font-bold">{row.actor?.displayName || "Someone"}</b>{" "}
                        <span className="text-[var(--v8-muted)]">{row.message}</span>
                      </strong>
                      <span className="capitalize">
                        {row.type}
                        {time ? ` · ${time}` : ""}
                      </span>
                    </span>
                    {!row.read ? (
                      <span className="mt-2 h-2 w-2 flex-none rounded-full bg-[var(--v8-accent)] x-anim-pop" />
                    ) : null}
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
