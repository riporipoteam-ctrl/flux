"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Calendar,
  Camera,
  FileText,
  Heart,
  Image as ImageIcon,
  AtSign,
  Link as LinkIcon,
  Loader2,
  LockKeyhole,
  MapPin,
  MessageCircle,
  Share2,
} from "lucide-react";
import { format } from "date-fns";
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
import { Button } from "@/components/ui/button";
import { PostCard } from "@/components/posts/post-card";
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
import { absoluteAppUrl, profilePath } from "@/lib/routes";
import {
  XEmpty,
  XHeader,
  XRowSkeleton,
  XSwitch,
  XTabs,
} from "@/components/x/x-ui";

type ProfileTab = "posts" | "replies" | "media" | "photos" | "likes";

const TAB_DEFS: { id: ProfileTab; label: string }[] = [
  { id: "posts", label: "Posts" },
  { id: "replies", label: "Replies" },
  { id: "media", label: "Media" },
  { id: "photos", label: "Photos" },
  { id: "likes", label: "Likes" },
];

export default function ProfilePage(
  { usernameOverride }: { usernameOverride?: string } = {}
) {
  const params = useParams();
  const username = usernameOverride || String(params.username || "");
  const { user, profile: me } = useAuth();
  const router = useRouter();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [posts, setPosts] = useState<PostWithAuthor[]>([]);
  const [tab, setTab] = useState<ProfileTab>("posts");
  const [photoVisibility, setPhotoVisibility] = useState<"public" | "private">("public");
  const [loading, setLoading] = useState(true);
  const [tabLoading, setTabLoading] = useState(false);
  const [following, setFollowing] = useState(false);
  const [followsMe, setFollowsMe] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [listOpen, setListOpen] = useState<"followers" | "following" | null>(
    null
  );
  const [listUsers, setListUsers] = useState<UserProfile[]>([]);
  const [bannerView, setBannerView] = useState(false);

  // Reset to a clean state when navigating between profiles so stale data
  // never renders as the new profile while it loads.
  useEffect(() => {
    setProfile(null);
    setPosts([]);
    setTab("posts");
    setPhotoVisibility("public");
  }, [username]);

  const profileRef = useRef<UserProfile | null>(null);
  profileRef.current = profile;

  const load = useCallback(async () => {
    const tabSwitch = profileRef.current !== null;
    if (tabSwitch) {
      setTabLoading(true);
    } else {
      setLoading(true);
    }
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
      setTabLoading(false);
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

  if (loading && !profile) {
    return (
      <div>
        <XHeader back title={username ? `@${username}` : "Profile"} />
        <XRowSkeleton rows={8} />
      </div>
    );
  }

  if (!profile) {
    return (
      <div>
        <XHeader back title="Profile" />
        <XEmpty
          icon={FileText}
          title="This account doesn't exist"
          description={`@${username} doesn't exist on Flux. Try searching for something else.`}
          action={
            <Button variant="outline" className="rounded-full" onClick={() => router.push("/home")}>
              Back home
            </Button>
          }
        />
      </div>
    );
  }

  const joined = profile.createdAt?.toDate
    ? format(profile.createdAt.toDate(), "MMMM yyyy")
    : null;

  const bannerDeco = getCatalogItem(profile.decorations?.bannerDecorationId);
  const shopFlair = flairForDecoration(profile.decorations?.badgeId);
  const themeItem = getCatalogItem(profile.decorations?.themeId);
  const isBusiness = profile.accountType === "business";
  const accent = profile.profileAccent || "#1d9bf0";

  const accentWash: React.CSSProperties =
    profile.bannerUrl || bannerDeco?.imageUrl
      ? {}
      : {
          background: `linear-gradient(180deg, color-mix(in srgb, ${accent} 22%, var(--v8-panel-2)) 0%, var(--v8-panel-2) 100%)`,
        };

  const lastActive = profile.lastActiveAt?.toDate?.();
  const onlineNow = followsMe && lastActive ? Date.now() - lastActive.getTime() < 120000 : false;

  return (
    <div
      className={cn(
        themeItem?.id === "midnight-card-theme" && "bg-[#0a0a0c]",
        themeItem?.id === "ocean-theme" && "bg-[#061018]"
      )}
    >
      <XHeader
        back
        title={profile.displayName}
        subtitle={`${formatCount(profile.postsCount)} posts`}
      />

      <PageTransition>
        {/* Banner */}
        <button
          type="button"
          className="relative block h-32 w-full overflow-hidden sm:h-48"
          style={accentWash}
          onClick={() => {
            if (profile.bannerUrl || bannerDeco?.imageUrl) setBannerView(true);
          }}
          aria-label={profile.bannerUrl || bannerDeco?.imageUrl ? "View banner" : undefined}
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

        {/* Avatar + actions */}
        <div className="px-4">
          <div className="-mt-10 flex items-end justify-between sm:-mt-[68px]">
            <UserAvatar
              user={profile}
              size="xl"
              className="h-20 w-20 text-xl sm:h-[134px] sm:w-[134px] sm:text-4xl"
              decorations={profile.decorations}
              ring
            />
            <div className="flex min-w-0 flex-wrap items-center justify-end gap-2 pb-1">
              {isOwn ? (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-full"
                    aria-label="Share profile"
                    onClick={async () => {
                      const url = absoluteAppUrl(profilePath(profile.username));
                      try {
                        await navigator.clipboard.writeText(url);
                        toast.success("Profile link copied");
                      } catch {
                        toast.message(url);
                      }
                    }}
                  >
                    <Share2 className="h-4 w-4" />
                    <span className="hidden sm:inline">Share</span>
                  </Button>
                  <Link
                    href="/settings/profile"
                    className="inline-flex h-8 items-center rounded-full border border-border bg-transparent px-4 text-sm font-bold transition hover:bg-muted"
                  >
                    Edit profile
                  </Link>
                </>
              ) : (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-full"
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
                    <span className="hidden sm:inline">Message</span>
                  </Button>
                  <button
                    type="button"
                    disabled={followLoading}
                    onClick={onFollow}
                    className={cn(
                      "group inline-flex h-8 min-w-[76px] items-center justify-center rounded-full px-4 text-sm font-bold transition active:scale-95 disabled:opacity-60",
                      following
                        ? "border border-border text-foreground hover:border-red-500/50 hover:text-red-500"
                        : "bg-foreground text-background hover:opacity-90"
                    )}
                  >
                    {followLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : following ? (
                      <>
                        <span className="group-hover:hidden">Following</span>
                        <span className="hidden group-hover:inline">Unfollow</span>
                      </>
                    ) : (
                      "Follow"
                    )}
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Identity */}
          <div className="mt-3">
            <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
              <h2 className="text-xl font-extrabold leading-tight tracking-tight">
                {profile.displayName}
              </h2>
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
              {followsMe && !isOwn ? (
                <span className="rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
                  Follows you
                </span>
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
            <p className="text-[15px] text-muted-foreground">
              @{profile.username}
              {isBusiness && profile.businessName
                ? ` · ${profile.businessName}`
                : ""}
            </p>
            {onlineNow ? (
              <p className="mt-1.5 inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                Online now
              </p>
            ) : null}
            {profile.bio ? (
              <p className="mt-3 whitespace-pre-wrap text-[15px] leading-snug">
                {profile.bio}
              </p>
            ) : null}

            {/* Meta row */}
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
              {profile.location ? (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-4 w-4 shrink-0" />
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
                  <LinkIcon className="h-4 w-4 shrink-0" />
                  {(profile.website || profile.socialLinks?.website || "")
                    .replace(/^https?:\/\//, "")
                    .slice(0, 32)}
                </a>
              ) : null}
              {joined ? (
                <span className="inline-flex items-center gap-1">
                  <Calendar className="h-4 w-4 shrink-0" />
                  Joined {joined}
                </span>
              ) : null}
            </div>

            {/* Social links */}
            {profile.socialLinks?.instagram ||
            profile.socialLinks?.tiktok ||
            profile.socialLinks?.youtube ||
            profile.socialLinks?.x ? (
              <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-sm">
                {profile.socialLinks?.instagram ? (
                  <SocialLink label="Instagram" value={profile.socialLinks.instagram} />
                ) : null}
                {profile.socialLinks?.tiktok ? (
                  <SocialLink label="TikTok" value={profile.socialLinks.tiktok} />
                ) : null}
                {profile.socialLinks?.youtube ? (
                  <SocialLink label="YouTube" value={profile.socialLinks.youtube} />
                ) : null}
                {profile.socialLinks?.x ? (
                  <SocialLink label="X" value={profile.socialLinks.x} />
                ) : null}
              </div>
            ) : null}

            {/* Stats */}
            <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm">
              <button
                type="button"
                onClick={() => openList("following")}
                className="transition hover:underline"
              >
                <span className="font-bold text-foreground">
                  {formatCount(profile.followingCount)}
                </span>{" "}
                <span className="text-muted-foreground">Following</span>
              </button>
              <button
                type="button"
                onClick={() => openList("followers")}
                className="transition hover:underline"
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

        {/* Tabs + content */}
        {!canSeePrivate ? (
          <div className="px-4 py-10">
            <XEmpty
              icon={LockKeyhole}
              title="These posts are protected"
              description="Only approved followers can see this account's posts. Follow them and wait for approval to see everything."
              action={
                !isOwn && user && !following ? (
                  <button
                    type="button"
                    onClick={onFollow}
                    className="inline-flex h-9 items-center rounded-full bg-foreground px-5 text-sm font-bold text-background transition hover:opacity-90"
                  >
                    Follow
                  </button>
                ) : undefined
              }
            />
          </div>
        ) : (
          <>
            <XTabs
              tabs={TAB_DEFS}
              value={tab}
              onChange={setTab}
              scrollable
              className="mt-3"
            />
            <XSwitch id={tab}>
              {tabLoading ? (
                <XRowSkeleton rows={5} />
              ) : tab === "photos" ? (
                <PhotosPanel
                  visibility={photoVisibility}
                  onVisibilityChange={setPhotoVisibility}
                  isOwn={isOwn}
                />
              ) : posts.length === 0 ? (
                <TabEmpty
                  tab={tab}
                  username={profile.username}
                  isOwn={isOwn}
                />
              ) : (
                <div>
                  {posts.map((post) => (
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
                  ))}
                </div>
              )}
            </XSwitch>
          </>
        )}
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
          <div className="max-h-80 overflow-y-auto">
            {listUsers.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No users yet
              </p>
            ) : (
              listUsers.map((u) => (
                <Link
                  key={u.uid}
                  href={profilePath(u.username)}
                  onClick={() => setListOpen(null)}
                  className="flex items-center gap-3 px-3 py-2.5 transition hover:bg-muted/60"
                >
                  <UserAvatar user={u} decorations={u.decorations} />
                  <div className="min-w-0">
                    <p className="truncate text-[15px] font-bold leading-tight">
                      {u.displayName}
                    </p>
                    <p className="truncate text-sm text-muted-foreground">
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

function TabEmpty({
  tab,
  username,
  isOwn,
}: {
  tab: Exclude<ProfileTab, "photos">;
  username: string;
  isOwn: boolean;
}) {
  const who = isOwn ? "You" : `@${username}`;
  switch (tab) {
    case "replies":
      return (
        <XEmpty
          icon={AtSign}
          title="No replies yet"
          description={
            isOwn
              ? "When you reply to posts, they'll show up here."
              : `${who} hasn't replied to any posts yet.`
          }
        />
      );
    case "media":
      return (
        <XEmpty
          icon={ImageIcon}
          title="No media yet"
          description={
            isOwn
              ? "Photos and videos you share will show up here."
              : `${who} hasn't shared any photos or videos yet.`
          }
        />
      );
    case "likes":
      return (
        <XEmpty
          icon={Heart}
          title="No likes yet"
          description={
            isOwn
              ? "Tap the heart on any post to show appreciation. Posts you like will live here."
              : `${who} hasn't liked any posts yet.`
          }
        />
      );
    default:
      return (
        <XEmpty
          icon={FileText}
          title="No posts yet"
          description={
            isOwn
              ? "Share your first post and start the conversation."
              : `${who} hasn't posted anything yet.`
          }
        />
      );
  }
}

function PhotosPanel({
  visibility,
  onVisibilityChange,
  isOwn,
}: {
  visibility: "public" | "private";
  onVisibilityChange: (v: "public" | "private") => void;
  isOwn: boolean;
}) {
  return (
    <div className="px-4 py-4">
      <div
        className="mb-4 inline-flex rounded-full bg-muted p-1 text-sm font-bold"
        role="tablist"
        aria-label="Photo visibility"
      >
        <button
          type="button"
          role="tab"
          aria-selected={visibility === "public"}
          onClick={() => onVisibilityChange("public")}
          className={cn(
            "rounded-full px-4 py-1.5 transition",
            visibility === "public"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          Public
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={visibility === "private"}
          onClick={() => onVisibilityChange("private")}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 transition",
            visibility === "private"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <LockKeyhole className="h-3.5 w-3.5" />
          Private
        </button>
      </div>
      <XEmpty
        icon={Camera}
        title={
          visibility === "public" ? "No public photos yet" : "No private photos yet"
        }
        description={
          visibility === "public"
            ? isOwn
              ? "Photos marked Public in Flux Rec will appear here for everyone to see."
              : "Public Flux Rec photos will appear here."
            : isOwn
              ? "Only you can see these. Snap a photo in Flux Rec and mark it Private."
              : "Private photos are only visible to the account owner."
        }
      />
    </div>
  );
}

function SocialLink({ label, value }: { label: string; value: string }) {
  return (
    <a
      href={normalizeUrl(value)}
      target="_blank"
      rel="noreferrer"
      className="font-medium text-muted-foreground transition hover:text-primary hover:underline"
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
