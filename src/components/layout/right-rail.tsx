"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Hash, Search, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { UserAvatar } from "@/components/shared/user-avatar";
import { useAuth } from "@/contexts/auth-context";
import { getSuggestedUsers } from "@/services/users";
import { followUser, isFollowing } from "@/services/follows";
import { getTrendingHashtags, type HashtagInfo } from "@/services/hashtags";
import type { UserProfile } from "@/types";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

export function RightRail() {
  const { user, profile } = useAuth();
  const router = useRouter();
  const [suggestions, setSuggestions] = useState<UserProfile[]>([]);
  const [followingMap, setFollowingMap] = useState<Record<string, boolean>>({});
  const [tags, setTags] = useState<HashtagInfo[]>([]);
  const [q, setQ] = useState("");

  useEffect(() => {
    if (!user) return;
    const t = window.setTimeout(() => {
      getSuggestedUsers(user.uid, 4).then(async (users) => {
        setSuggestions(users);
        const map: Record<string, boolean> = {};
        await Promise.all(
          users.map(async (u) => {
            map[u.uid] = await isFollowing(user.uid, u.uid);
          })
        );
        setFollowingMap(map);
      });
    }, 120);
    return () => clearTimeout(t);
  }, [user]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      getTrendingHashtags(5).then(setTags).catch(() => setTags([]));
    }, 80);
    return () => clearTimeout(t);
  }, []);

  const onFollow = async (target: UserProfile) => {
    if (!user) return;
    try {
      await followUser(user.uid, target.uid);
      setFollowingMap((m) => ({ ...m, [target.uid]: true }));
      toast.success(`Following @${target.username}`);
    } catch {
      toast.error("Could not follow user");
    }
  };

  return (
    <aside className="sticky top-0 hidden h-screen w-[320px] shrink-0 overflow-y-auto py-4 pl-6 no-scrollbar xl:block">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="space-y-4"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (q.trim())
              router.push(`/explore?q=${encodeURIComponent(q.trim())}`);
          }}
          className="relative"
        >
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search Flux"
            className="h-11 rounded-full border-border/70 bg-card pl-10"
          />
        </form>

        {profile ? (
          <div className="surface-card flex items-center justify-between gap-3 p-4">
            <div className="flex min-w-0 items-center gap-3">
              <UserAvatar
                user={profile}
                size="md"
                decorations={profile.decorations}
              />
              <div className="min-w-0">
                <p className="truncate font-bold">{profile.displayName}</p>
                <p className="truncate text-xs text-muted-foreground">
                  @{profile.username}
                </p>
              </div>
            </div>
            <Link
              href={`/${profile.username}`}
              className="shrink-0 text-xs font-bold text-[#1d9bf0] hover:underline"
            >
              Profile
            </Link>
          </div>
        ) : null}

        <div className="surface-card p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-bold">
            <Hash className="h-4 w-4 text-[#1d9bf0]" />
            Trending hashtags
          </div>
          {tags.length === 0 ? (
            <p className="px-2 py-3 text-sm text-muted-foreground">
              No hashtags yet. Post with #tags to start trends.
            </p>
          ) : (
            <ul className="space-y-1">
              {tags.map((t, i) => (
                <li key={t.tag}>
                  <Link
                    href={`/explore?q=${encodeURIComponent("#" + t.tag)}`}
                    className="block rounded-xl px-2 py-2 transition-colors hover:bg-muted"
                  >
                    <p className="text-xs text-muted-foreground">
                      Trending · #{i + 1}
                    </p>
                    <p className="font-bold">#{t.tag}</p>
                    <p className="text-xs text-muted-foreground">
                      {t.postsCount} {t.postsCount === 1 ? "post" : "posts"}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="surface-card p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-bold">
            <UserPlus className="h-4 w-4 text-[#1d9bf0]" />
            Who to follow
          </div>
          <ul className="space-y-3">
            {suggestions.length === 0 ? (
              <li className="text-sm text-muted-foreground">
                {profile ? "No suggestions yet" : "Sign in"}
              </li>
            ) : (
              suggestions.map((u) => (
                <li key={u.uid} className="flex items-center gap-2.5">
                  <Link href={`/${u.username}`}>
                    <UserAvatar
                      user={u}
                      size="sm"
                      decorations={u.decorations}
                    />
                  </Link>
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/${u.username}`}
                      className="block truncate text-sm font-bold hover:underline"
                    >
                      {u.displayName}
                    </Link>
                    <p className="truncate text-xs text-muted-foreground">
                      @{u.username}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant={followingMap[u.uid] ? "outline" : "sky"}
                    disabled={followingMap[u.uid]}
                    onClick={() => onFollow(u)}
                  >
                    {followingMap[u.uid] ? "Following" : "Follow"}
                  </Button>
                </li>
              ))
            )}
          </ul>
        </div>

        <p className="px-2 text-[11px] text-muted-foreground">
          © {new Date().getFullYear()} Flux by Ripo Team
        </p>
      </motion.div>
    </aside>
  );
}
