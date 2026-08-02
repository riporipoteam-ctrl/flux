"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Activity,
  Bookmark,
  Heart,
  MessageCircle,
  Repeat2,
  UserPlus,
} from "lucide-react";
import { formatDistanceToNowStrict } from "date-fns";
import { useAuth } from "@/contexts/auth-context";
import { getNotifications } from "@/services/notifications";
import type { Notification, UserProfile } from "@/types";
import { UserAvatar } from "@/components/shared/user-avatar";
import { XEmpty, XHeader, XPage, XRowSkeleton, XSwitch, XTabs } from "@/components/x/x-ui";
import { cn } from "@/lib/utils";
import { postPath, profilePath } from "@/lib/routes";

type Row = Notification & { actor?: UserProfile | null };
type Filter = "all" | "likes" | "replies" | "follows";

const ICONS: Record<string, typeof Heart> = {
  like: Heart,
  reply: MessageCircle,
  mention: MessageCircle,
  repost: Repeat2,
  quote: Repeat2,
  follow: UserPlus,
  gift: Bookmark,
};

const TINTS: Record<string, string> = {
  like: "var(--v8-pink)",
  reply: "var(--v8-accent)",
  mention: "var(--v8-accent)",
  repost: "var(--v8-green)",
  quote: "var(--v8-green)",
  follow: "var(--v8-accent)",
  gift: "var(--v8-orange)",
};

const MATCHES: Record<Filter, (type: string) => boolean> = {
  all: () => true,
  likes: (type) => type === "like",
  replies: (type) => type === "reply" || type === "mention" || type === "quote",
  follows: (type) => type === "follow",
};

export default function ActivityPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");

  useEffect(() => {
    if (!user) return;
    getNotifications(user.uid, 80)
      .then(setItems)
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [user]);

  const visible = useMemo(() => items.filter((row) => MATCHES[filter](row.type)), [items, filter]);

  return (
    <XPage>
      <XHeader title="Activity" subtitle="Every like, follow and reply in one timeline" icon={Activity} hideOnMobile />

      <XTabs
        value={filter}
        onChange={setFilter}
        tabs={[
          { id: "all", label: "All" },
          { id: "likes", label: "Likes" },
          { id: "replies", label: "Replies" },
          { id: "follows", label: "Follows" },
        ]}
      />

      <XSwitch id={filter}>
        {loading ? (
          <XRowSkeleton rows={8} />
        ) : visible.length === 0 ? (
          <XEmpty
            icon={Activity}
            title="Nothing here yet"
            description="When people interact with you it lands here, newest first."
          />
        ) : (
          <ul className="x-stagger">
            {visible.map((row, index) => {
              const Icon = ICONS[row.type] || Activity;
              const tint = TINTS[row.type] || "var(--v8-muted)";
              const href = row.postId
                ? postPath(row.postId)
                : row.actor?.username
                  ? profilePath(row.actor.username)
                  : "/activity";
              const time = row.createdAt?.toDate ? formatDistanceToNowStrict(row.createdAt.toDate()) : "";

              return (
                <li key={row.id} style={{ ["--i" as string]: Math.min(index, 14) }}>
                  <Link
                    href={href}
                    className={cn("x-row", !row.read && "bg-[var(--v8-accent-soft)]")}
                  >
                    <span className="relative flex-none">
                      <UserAvatar user={row.actor} />
                      <span
                        className="absolute -bottom-0.5 -right-0.5 grid h-5 w-5 place-items-center rounded-full ring-2"
                        style={{ background: "var(--v8-panel)", color: tint, ["--tw-ring-color" as string]: "var(--v8-panel)" }}
                      >
                        <Icon className="h-3 w-3" />
                      </span>
                    </span>
                    <span className="x-row-main">
                      <strong className="!font-normal text-[15px]">
                        <b className="font-bold">{row.actor?.displayName || "Someone"}</b>{" "}
                        <span className="text-[var(--v8-muted)]">{row.message}</span>
                      </strong>
                      <span className="capitalize">
                        {row.type}
                        {time ? ` · ${time} ago` : ""}
                      </span>
                    </span>
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
