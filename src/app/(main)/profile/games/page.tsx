"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Gamepad2, Images, LockKeyhole, Play } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { getUserByUsername } from "@/services/users";
import { isFollowing } from "@/services/follows";
import { getUserGamePosts } from "@/services/game-posts";
import type { PostWithAuthor, UserProfile } from "@/types";
import { PostCard } from "@/components/posts/post-card";
import { UserAvatar } from "@/components/shared/user-avatar";
import { EmptyState } from "@/components/shared/empty-state";
import { LoadingScreen } from "@/components/shared/loading-screen";
import { profilePath } from "@/lib/routes";

export default function ProfileGameCapturesPage() {
  const router = useRouter();
  const { user, profile: me } = useAuth();
  const [queryUsername, setQueryUsername] = useState<string | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [posts, setPosts] = useState<PostWithAuthor[]>([]);
  const [loading, setLoading] = useState(true);
  const [privateLocked, setPrivateLocked] = useState(false);

  useEffect(() => {
    const value = new URLSearchParams(window.location.search).get("username");
    setQueryUsername(value?.trim() || "");
  }, []);

  const username = queryUsername || me?.username || "";

  const load = useCallback(async () => {
    if (queryUsername === null) return;
    setLoading(true);
    try {
      if (!username) {
        setProfile(null);
        setPosts([]);
        return;
      }

      const target = await getUserByUsername(username);
      if (!target) {
        setProfile(null);
        setPosts([]);
        setPrivateLocked(false);
        return;
      }
      setProfile(target);

      const isOwn = user?.uid === target.uid;
      // Match the existing profile's approved-private visibility behavior: the
      // current viewer must follow the target account, not the other way round.
      const approved = isOwn || !target.isPrivate || (user ? await isFollowing(user.uid, target.uid) : false);
      setPrivateLocked(!approved);
      if (!approved) {
        setPosts([]);
        return;
      }

      setPosts(await getUserGamePosts(target.uid, user?.uid));
    } catch (error) {
      console.error("Could not load game captures", error);
      setPosts([]);
    } finally {
      setLoading(false);
    }
  }, [queryUsername, username, user]);

  useEffect(() => {
    void load();
  }, [load]);

  if (queryUsername === null || loading) {
    return <LoadingScreen label="Opening game captures…" />;
  }

  if (!profile) {
    return (
      <EmptyState
        icon={Images}
        title="Profile not found"
        description="This Flux profile doesn't exist."
      />
    );
  }

  return (
    <main className="min-h-screen">
      <header className="x-header">
        <button
          type="button"
          onClick={() => router.push(profilePath(profile.username))}
          className="rounded-full p-2 transition hover:bg-muted"
          aria-label="Back to profile"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[15px] font-bold leading-tight">Game captures</h1>
          <p className="truncate text-xs text-muted-foreground">@{profile.username} · {posts.length} shared</p>
        </div>
        <Link
          href="/games/recroom"
          className="inline-flex h-9 items-center gap-1.5 rounded-full bg-foreground px-4 text-xs font-bold text-background transition hover:opacity-90"
        >
          <Play className="h-3.5 w-3.5" /> Play
        </Link>
      </header>

      <section className="border-b border-border bg-gradient-to-br from-primary/10 via-transparent to-transparent p-5 sm:p-6">
        <div className="flex items-center gap-3">
          <UserAvatar user={profile} decorations={profile.decorations} size="lg" />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Gamepad2 className="h-4 w-4 text-primary" />
              <p className="text-xs font-black uppercase tracking-[.12em] text-primary">Flux Games</p>
            </div>
            <h2 className="mt-1 truncate text-xl font-black tracking-[-.035em]">{profile.displayName}&apos;s game moments</h2>
            <p className="mt-1 text-sm text-muted-foreground">Screenshots the player explicitly chose to post from games inside Flux.</p>
          </div>
        </div>
      </section>

      {privateLocked ? (
        <div className="mx-4 my-8 rounded-2xl border border-border bg-muted/35 p-8 text-center">
          <LockKeyhole className="mx-auto h-8 w-8 text-muted-foreground" />
          <h3 className="mt-3 font-bold">This account is private</h3>
          <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">Game captures use the same profile privacy rules as posts.</p>
        </div>
      ) : posts.length === 0 ? (
        <EmptyState
          icon={Gamepad2}
          title="No game captures yet"
          description="When this player captures a game moment and chooses Post to Flux, it will appear here."
          action={user?.uid === profile.uid ? (
            <Link
              href="/games/recroom"
              className="inline-flex h-10 items-center gap-2 rounded-full bg-foreground px-5 text-sm font-bold text-background"
            >
              <Play className="h-4 w-4" /> Play Rec Room
            </Link>
          ) : undefined}
        />
      ) : (
        <div>
          {posts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              onChange={(updated) =>
                setPosts((previous) =>
                  updated.isDeleted
                    ? previous.filter((item) => item.id !== updated.id)
                    : previous.map((item) => (item.id === updated.id ? updated : item)),
                )
              }
            />
          ))}
        </div>
      )}
    </main>
  );
}
