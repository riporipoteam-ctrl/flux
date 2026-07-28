"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Calendar,
  Link as LinkIcon,
  MapPin,
  Loader2,
  FileText,
  Share2,
  MessageCircle,
  LockKeyhole,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { useAuth } from "@/contexts/auth-context";
import { getUserByUsername } from "@/services/users";
import { getUserPosts } from "@/services/posts";
import {
  followUser,
  unfollowUser,
  isFollowing,
  getFollowers,
  getFollowing,
} from "@/services/follows";
import type { PostWithAuthor, UserProfile } from "@/types";
import { UserAvatar } from "@/components/shared/user-avatar";
import {
  BusinessBadge,
  ShopFlairBadge,
  VerifiedBadge,
} from "@/components/shared/verified-badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PostCard } from "@/components/posts/post-card";
import { EmptyState } from "@/components/shared/empty-state";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn, formatCount } from "@/lib/utils";
import { MOOD_OPTIONS } from "@/lib/default-avatars";
import { PageTransition } from "@/components/shared/page-transition";
import { ImageViewer } from "@/components/shared/image-viewer";
import {
  flairForDecoration,
  getCatalogItem,
} from "@/lib/shop-catalog";
import { assetUrl } from "@/lib/asset-url";

export default function ProfilePage() {
  const params = useParams();
  const username = String(params.username || "");
  const { user, profile: me } = useAuth();
  const router = useRouter();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [posts, setPosts] = useState<PostWithAuthor[]>([]);
  const [tab, setTab] = useState("posts");
  const [loading, setLoading] = useState(true);
  const [following, setFollowing] = useState(false);
  const [followsMe, setFollowsMe] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [listOpen, setListOpen] = useState<"followers" | "following" | null>(
    null
  );
  const [listUsers, setListUsers] = useState<UserProfile[]>([]);
  const [bannerView, setBannerView] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const p = await getUserByUsername(username);
      if (!p) {
        setProfile(null);
        setPosts([]);
        return;
      }
      setProfile(p);
      if (user) {
        const [iFollow, theyFollow] = await Promise.all([
          isFollowing(user.uid, p.uid),
          isFollowing(p.uid, user.uid),
        ]);
        setFollowing(iFollow);
        setFollowsMe(theyFollow);
      }
      const canSeePrivate = user?.uid === p.uid || !p.isPrivate || (user ? await isFollowing(p.uid, user.uid) : false);
      let list = canSeePrivate ? await getUserPosts(
        p.uid,
        tab as "posts" | "replies" | "media" | "likes",
        user?.uid
      ) : [];
      // Pin first on posts tab
      if (tab === "posts" && p.pinnedPostId) {
        const pin = list.find((x) => x.id === p.pinnedPostId);
        if (pin) {
          list = [pin, ...list.filter((x) => x.id !== pin.id)];
        } else {
          try {
            const { getPost } = await import("@/services/posts");
            const pinned = await getPost(p.pinnedPostId, user?.uid);
            if (pinned && !pinned.isDeleted) list = [pinned, ...list];
          } catch {
            /* ignore pin fetch */
          }
        }
      }
      setPosts(list);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [username, user, tab]);

  useEffect(() => {
    load();
  }, [load]);

  const isOwn = !!(me?.uid && profile?.uid === me.uid);
  const canSeePrivate = isOwn || !profile?.isPrivate || followsMe;

  const onFollow = async () => {
    if (!user || !profile) return;
    setFollowLoading(true);
    try {
      if (following) {
        await unfollowUser(user.uid, profile.uid);
        setFollowing(false);
        setProfile((p) =>
          p ? { ...p, followersCount: Math.max(0, p.followersCount - 1) } : p
        );
      } else {
        await followUser(user.uid, profile.uid);
        setFollowing(true);
        setProfile((p) =>
          p ? { ...p, followersCount: p.followersCount + 1 } : p
        );
      }
    } catch {
      toast.error("Could not update follow");
    } finally {
      setFollowLoading(false);
    }
  };

  const openList = async (type: "followers" | "following") => {
    if (!profile) return;
    setListOpen(type);
    const users =
      type === "followers"
        ? await getFollowers(profile.uid)
        : await getFollowing(profile.uid);
    setListUsers(users);
  };

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!profile) {
    return (
      <EmptyState
        icon={FileText}
        title="User not found"
        description={`@${username} doesn't exist on Flux.`}
        action={
          <Button variant="outline" onClick={() => router.push("/home")}>
            Back home
          </Button>
        }
      />
    );
  }

  const joined = profile.createdAt?.toDate
    ? format(profile.createdAt.toDate(), "MMMM yyyy")
    : null;

  const bannerDeco = getCatalogItem(profile.decorations?.bannerDecorationId);
  const shopFlair = flairForDecoration(profile.decorations?.badgeId);
  const themeItem = getCatalogItem(profile.decorations?.themeId);
  const isBusiness = profile.accountType === "business";

  const bannerStyle: { background?: string } = {
    background: bannerDeco
      ? undefined
      : `linear-gradient(120deg, ${profile.profileAccent || "#1d9bf0"}55, #16181c 100%)`,
  };

  return (
    <div
      className={cn(
        "min-h-screen",
        themeItem?.id === "midnight-card-theme" && "bg-[#0a0a0c]",
        themeItem?.id === "ocean-theme" && "bg-[#061018]"
      )}
    >
      <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-border bg-background/80 px-4 py-2 backdrop-blur-xl">
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-full p-2 transition hover:bg-muted"
          aria-label="Back"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="min-w-0">
          <h1 className="truncate text-[15px] font-bold leading-tight">
            {profile.displayName}
          </h1>
          <p className="text-xs text-muted-foreground">
            {formatCount(profile.postsCount)} posts
          </p>
        </div>
      </header>

      <PageTransition>
        <button
          type="button"
          className="relative block h-36 w-full overflow-hidden sm:h-48"
          style={bannerStyle}
          onClick={() => {
            if (profile.bannerUrl || bannerDeco?.imageUrl) setBannerView(true);
          }}
        >
          {profile.bannerUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={assetUrl(profile.bannerUrl)}
              alt=""
              className="h-full w-full cursor-zoom-in object-cover"
            />
          ) : bannerDeco?.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={assetUrl(bannerDeco.imageUrl)}
              alt=""
              className="h-full w-full object-cover opacity-90"
            />
          ) : null}
          {bannerDeco && profile.bannerUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={assetUrl(bannerDeco.imageUrl)}
              alt=""
              className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-35 mix-blend-screen"
            />
          ) : null}
        </button>

        <div className="px-4">
          <div className="flex items-end justify-between">
            <div className="-mt-14 sm:-mt-16">
              <UserAvatar
                user={profile}
                size="xl"
                className="h-28 w-28 sm:h-32 sm:w-32"
                decorations={profile.decorations}
                ring
              />
            </div>
            <div className="mb-1 flex flex-wrap justify-end gap-2">
              {isOwn ? (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      const url = `${window.location.origin}/${profile.username}`;
                      try {
                        await navigator.clipboard.writeText(url);
                        toast.success("Profile link copied");
                      } catch {
                        toast.message(url);
                      }
                    }}
                  >
                    <Share2 className="h-4 w-4" />
                    Share
                  </Button>
                  <Link
                    href="/settings/profile"
                    className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                  >
                    Edit profile
                  </Link>
                </>
              ) : (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      if (!user || !profile) return;
                      try {
                        const { getOrCreateDm } = await import(
                          "@/services/chats"
                        );
                        const id = await getOrCreateDm(user.uid, profile.uid);
                        router.push(`/messages?c=${id}`);
                      } catch {
                        toast.error("Could not open chat");
                      }
                    }}
                  >
                    <MessageCircle className="h-4 w-4" />
                    Message
                  </Button>
                  <Button
                    size="sm"
                    onClick={onFollow}
                    loading={followLoading}
                    variant={following ? "outline" : "default"}
                  >
                    {following ? "Following" : "Follow"}
                  </Button>
                </>
              )}
            </div>
          </div>

          <div className="mt-3">
            <div className="flex flex-wrap items-center gap-1.5">
              <h2 className="text-xl font-bold">{profile.displayName}</h2>
              {profile.isVerified ? (
                <VerifiedBadge
                  className="h-5 w-5"
                  type={
                    isBusiness
                      ? "business"
                      : profile.verifiedType || "flux"
                  }
                />
              ) : null}
              {isBusiness ? <BusinessBadge /> : null}
              {shopFlair ? (
                <ShopFlairBadge emoji={shopFlair.emoji} label={shopFlair.label} />
              ) : null}
              {profile.mood
                ? (() => {
                    const m = MOOD_OPTIONS.find((x) => x.id === profile.mood);
                    return m?.emoji ? (
                      <span className="rounded-full border border-border bg-muted/60 px-2 py-0.5 text-xs font-medium">
                        {m.emoji} {m.label}
                      </span>
                    ) : null;
                  })()
                : null}
            </div>
            <p className="text-muted-foreground">
              @{profile.username}
              {isBusiness && profile.businessName
                ? ` · ${profile.businessName}`
                : ""}
            </p>
            {followsMe && profile.lastActiveAt?.toDate ? (
              <p className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                <span className={cn("h-2 w-2 rounded-full", Date.now() - profile.lastActiveAt.toDate().getTime() < 120000 ? "bg-emerald-500" : "bg-muted-foreground/45")} />
                {Date.now() - profile.lastActiveAt.toDate().getTime() < 120000 ? "Online now" : `Offline ${formatDistanceToNow(profile.lastActiveAt.toDate(), { addSuffix: true })}`}
              </p>
            ) : null}
            {profile.bio ? (
              <p className="mt-3 whitespace-pre-wrap text-[15px] leading-relaxed">
                {profile.bio}
              </p>
            ) : null}

            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
              {profile.location ? (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-4 w-4" />
                  {profile.location}
                </span>
              ) : null}
              {profile.website || profile.socialLinks?.website ? (
                <a
                  href={normalizeUrl(
                    profile.website || profile.socialLinks?.website || ""
                  )}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-primary hover:underline"
                >
                  <LinkIcon className="h-4 w-4" />
                  {(profile.website || profile.socialLinks?.website || "")
                    .replace(/^https?:\/\//, "")
                    .slice(0, 32)}
                </a>
              ) : null}
              {joined ? (
                <span className="inline-flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  Joined {joined}
                </span>
              ) : null}
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              {profile.socialLinks?.instagram ? (
                <SocialChip
                  label="Instagram"
                  value={profile.socialLinks.instagram}
                />
              ) : null}
              {profile.socialLinks?.tiktok ? (
                <SocialChip label="TikTok" value={profile.socialLinks.tiktok} />
              ) : null}
              {profile.socialLinks?.youtube ? (
                <SocialChip
                  label="YouTube"
                  value={profile.socialLinks.youtube}
                />
              ) : null}
              {profile.socialLinks?.x ? (
                <SocialChip label="X" value={profile.socialLinks.x} />
              ) : null}
            </div>

            <div className="mt-4 flex flex-wrap gap-4 text-sm">
              <button
                type="button"
                onClick={() => openList("following")}
                className="hover:underline"
              >
                <span className="font-bold text-foreground">
                  {formatCount(profile.followingCount)}
                </span>{" "}
                <span className="text-muted-foreground">Following</span>
              </button>
              <button
                type="button"
                onClick={() => openList("followers")}
                className="hover:underline"
              >
                <span className="font-bold text-foreground">
                  {formatCount(profile.followersCount)}
                </span>{" "}
                <span className="text-muted-foreground">Followers</span>
              </button>
              <span>
                <span className="font-bold text-foreground">
                  {formatCount(profile.likesCount)}
                </span>{" "}
                <span className="text-muted-foreground">Likes</span>
              </span>
              {typeof profile.coins === "number" && isOwn ? (
                <span>
                  <span className="font-bold text-foreground">
                    {formatCount(profile.coins)}
                  </span>{" "}
                  <span className="text-muted-foreground">Coins</span>
                </span>
              ) : null}
            </div>
          </div>
        </div>

        {!canSeePrivate ? (
          <div className="mx-4 my-8 rounded-2xl border border-border bg-muted/35 p-8 text-center">
            <LockKeyhole className="mx-auto h-8 w-8 text-muted-foreground" />
            <h3 className="mt-3 font-bold">This account is private</h3>
            <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">Their posts become visible when they approve you by following you back.</p>
          </div>
        ) : <Tabs value={tab} onValueChange={setTab} className="mt-4 w-full">
          <TabsList>
            <TabsTrigger value="posts">Posts</TabsTrigger>
            <TabsTrigger value="replies">Replies</TabsTrigger>
            <TabsTrigger value="media">Media</TabsTrigger>
            <TabsTrigger value="likes">Likes</TabsTrigger>
          </TabsList>
          {(["posts", "replies", "media", "likes"] as const).map((t) => (
            <TabsContent key={t} value={t}>
              {posts.length === 0 ? (
                <EmptyState
                  icon={FileText}
                  title="Nothing here yet"
                  description="Posts will show up in this tab."
                />
              ) : (
                posts.map((post) => (
                  <PostCard
                    key={post.id}
                    post={post}
                    onChange={(updated) =>
                      setPosts((prev) =>
                        updated.isDeleted
                          ? prev.filter((p) => p.id !== updated.id)
                          : prev.map((p) =>
                              p.id === updated.id ? updated : p
                            )
                      )
                    }
                  />
                ))
              )}
            </TabsContent>
          ))}
        </Tabs>}
      </PageTransition>

      <ImageViewer
        open={bannerView}
        src={profile.bannerUrl || bannerDeco?.imageUrl}
        alt="Banner"
        onClose={() => setBannerView(false)}
      />

      <Dialog open={!!listOpen} onOpenChange={() => setListOpen(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {listOpen === "followers" ? "Followers" : "Following"}
            </DialogTitle>
          </DialogHeader>
          <div className="max-h-80 space-y-2 overflow-y-auto">
            {listUsers.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No users yet
              </p>
            ) : (
              listUsers.map((u) => (
                <Link
                  key={u.uid}
                  href={`/${u.username}`}
                  onClick={() => setListOpen(null)}
                  className="flex items-center gap-3 rounded-xl p-2 transition hover:bg-muted"
                >
                  <UserAvatar user={u} decorations={u.decorations} />
                  <div>
                    <p className="font-semibold">{u.displayName}</p>
                    <p className="text-sm text-muted-foreground">
                      @{u.username}
                    </p>
                  </div>
                </Link>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SocialChip({ label, value }: { label: string; value: string }) {
  const href = normalizeUrl(value);
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="rounded-full border border-border bg-muted/50 px-2.5 py-1 text-xs font-medium transition hover:border-primary/40 hover:bg-accent"
    >
      {label}
    </a>
  );
}

function normalizeUrl(value: string) {
  if (!value) return "#";
  if (value.startsWith("http://") || value.startsWith("https://")) return value;
  if (value.includes(".")) return `https://${value}`;
  return `https://${value}`;
}
