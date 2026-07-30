"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Hash, Search, Sprout, UserPlus } from "lucide-react";
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
import { profilePath } from "@/lib/routes";

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
    <aside className="sticky top-0 hidden h-[100dvh] w-[330px] shrink-0 overflow-y-auto py-4 pl-5 pr-1 no-scrollbar xl:block">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="space-y-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (q.trim()) router.push(`/explore?q=${encodeURIComponent(q.trim())}`);
          }}
          className="relative"
        >
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search Flux" className="h-11 rounded-full border-border/70 bg-card/75 pl-10 shadow-soft backdrop-blur-xl" />
        </form>

        <Link href="/games/flux-farm" className="group relative block min-h-[220px] overflow-hidden rounded-[26px] border border-emerald-100/10 bg-[#11291a] shadow-soft">
          <div className="absolute inset-0 bg-[linear-gradient(#87c9e8_0_42%,#74ad65_42%)]" />
          <div className="absolute bottom-0 right-0 h-[46%] w-[66%] -rotate-3 rounded-tl-[70%] bg-[#4f8b4b]" />
          <div className="absolute bottom-[12%] right-[6%] h-[36%] w-[52%] rotate-[-4deg] rounded-2xl bg-[#8a5a36]">
            {Array.from({ length: 8 }).map((_, index) => <span key={index} className="absolute h-4 w-2 rounded-full bg-amber-300" style={{ left: `${12 + (index % 4) * 22}%`, top: `${20 + Math.floor(index / 4) * 44}%` }} />)}
          </div>
          <div className="absolute bottom-[19%] left-[7%] h-[29%] w-[31%] rounded-lg bg-[#efd19e]"><div className="absolute -left-[8%] -top-[30%] h-[45%] w-[116%] -skew-x-12 bg-[#b64f43]" /></div>
          <div className="absolute inset-0 bg-gradient-to-r from-[#0d2115]/95 via-[#0d2115]/75 to-transparent" />
          <div className="relative p-5 text-white">
            <span className="grid h-9 w-9 place-items-center rounded-2xl bg-gradient-to-br from-emerald-300 to-lime-300 text-emerald-950 shadow-lg"><Sprout className="h-4 w-4" /></span>
            <h3 className="mt-4 text-xl font-black tracking-[-0.04em]">Flux Farm</h3>
            <p className="mt-1 max-w-[205px] text-xs leading-5 text-white/65">The first full Flux game. Farm, expand, hire workers and climb the rankings.</p>
            <span className="mt-4 inline-flex items-center gap-1 text-xs font-black text-emerald-200">Play now <ArrowRight className="h-3.5 w-3.5" /></span>
          </div>
        </Link>

        {profile ? (
          <div className="surface-card flex items-center justify-between gap-3 p-4">
            <div className="flex min-w-0 items-center gap-3">
              <UserAvatar user={profile} size="md" decorations={profile.decorations} />
              <div className="min-w-0">
                <p className="truncate font-bold">{profile.displayName}</p>
                <p className="truncate text-xs text-muted-foreground">@{profile.username}</p>
              </div>
            </div>
            <Link href={profilePath(profile.username)} className="shrink-0 text-xs font-black text-primary hover:underline">Profile</Link>
          </div>
        ) : null}

        <div className="surface-card p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-bold"><Hash className="h-4 w-4 text-primary" />Trending hashtags</div>
          {tags.length === 0 ? (
            <p className="px-2 py-3 text-sm text-muted-foreground">No hashtags yet. Post with #tags to start trends.</p>
          ) : (
            <ul className="space-y-1">
              {tags.map((t, i) => (
                <li key={t.tag}>
                  <Link href={`/explore?q=${encodeURIComponent("#" + t.tag)}`} className="block rounded-xl px-2 py-2 transition-colors hover:bg-muted">
                    <p className="text-xs text-muted-foreground">Trending · #{i + 1}</p>
                    <p className="font-bold">#{t.tag}</p>
                    <p className="text-xs text-muted-foreground">{t.postsCount} {t.postsCount === 1 ? "post" : "posts"}</p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="surface-card p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-bold"><UserPlus className="h-4 w-4 text-primary" />Who to follow</div>
          <ul className="space-y-3">
            {suggestions.length === 0 ? (
              <li className="text-sm text-muted-foreground">{profile ? "No suggestions yet" : "Sign in"}</li>
            ) : (
              suggestions.map((u) => (
                <li key={u.uid} className="flex items-center gap-2.5">
                  <Link href={profilePath(u.username)}><UserAvatar user={u} size="sm" decorations={u.decorations} /></Link>
                  <div className="min-w-0 flex-1">
                    <Link href={profilePath(u.username)} className="block truncate text-sm font-bold hover:underline">{u.displayName}</Link>
                    <p className="truncate text-xs text-muted-foreground">@{u.username}</p>
                  </div>
                  <Button size="sm" variant={followingMap[u.uid] ? "outline" : "sky"} disabled={followingMap[u.uid]} onClick={() => onFollow(u)}>{followingMap[u.uid] ? "Following" : "Follow"}</Button>
                </li>
              ))
            )}
          </ul>
        </div>

        <p className="px-2 text-[11px] text-muted-foreground">© {new Date().getFullYear()} Flux by Ripo Team</p>
      </motion.div>
    </aside>
  );
}
