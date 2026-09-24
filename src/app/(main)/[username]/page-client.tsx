"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Calendar,
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
import { PostCard } from "@/components/posts/post-card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn, formatCount } from "@/lib/utils";
import { MOOD_OPTIONS } from "@/lib/default-avatars";
import { ImageViewer } from "@/components/shared/image-viewer";
import {
  flairForDecoration,
  getCatalogItem,
} from "@/lib/shop-catalog";
import { assetUrl } from "@/lib/asset-url";
import { absoluteAppUrl, profilePath } from "@/lib/routes";

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

  const shareProfile = async () => {
    if (!profile) return;
    const url = absoluteAppUrl(profilePath(profile.username));
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Profile link copied");
    } catch {
      toast.message(url);
    }
  };

  const openDm = async () => {
    if (!user || !profile) return;
    try {
      const { getOrCreateDm } = await import("@/services/chats");
      const id = await getOrCreateDm(user.uid, profile.uid);
      router.push(`/messages?c=${id}`);
    } catch {
      toast.error("Could not open chat");
    }
  };

  if (loading && !profile) {
    return (
      <div>
        <div className="xxprof-head">
          <button type="button" className="xxprof-back" onClick={() => router.back()} aria-label="Go back">
            <ArrowLeft />
          </button>
          <div><h1>{username ? `@${username}` : "Profile"}</h1></div>
        </div>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="xxskel" aria-hidden="true">
            <div className="xxskel-ava" />
            <div className="xxskel-main">
              <div className="xxskel-line" style={{ width: "35%" }} />
              <div className="xxskel-line" style={{ width: "95%" }} />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!profile) {
    return (
      <div>
        <div className="xxprof-head">
          <button type="button" className="xxprof-back" onClick={() => router.back()} aria-label="Go back">
            <ArrowLeft />
          </button>
          <div><h1>Profile</h1></div>
        </div>
        <div className="xxempty">
          <h3>This account doesn&apos;t exist</h3>
          <p>Try searching for something else.</p>
        </div>
      </div>
    );
  }

  const joined = profile.createdAt?.toDate
    ? format(profile.createdAt.toDate(), "MMMM yyyy")
    : null;

  const bannerDeco = getCatalogItem(profile.decorations?.bannerDecorationId);
  const shopFlair = flairForDecoration(profile.decorations?.badgeId);
  const isBusiness = profile.accountType === "business";
  const accent = profile.profileAccent || "#1d9bf0";
  const bannerSrc = profile.bannerUrl ? assetUrl(profile.bannerUrl) : bannerDeco?.imageUrl ? assetUrl(bannerDeco.imageUrl) : null;

  const lastActive = profile.lastActiveAt?.toDate?.();
  const onlineNow = followsMe && lastActive ? Date.now() - lastActive.getTime() < 120000 : false;

  return (
    <div>
      {/* Sticky header: back + name + post count */}
      <div className="xxprof-head">
        <button type="button" className="xxprof-back" onClick={() => router.back()} aria-label="Go back">
          <ArrowLeft />
        </button>
        <div>
          <h1>
            {profile.displayName}{" "}
            {profile.isVerified ? (
              <VerifiedBadge className="inline h-5 w-5 align-[-3px]" type={isBusiness ? "business" : profile.verifiedType || "flux"} />
            ) : null}
          </h1>
          <p>{formatCount(profile.postsCount)} posts</p>
        </div>
      </div>

      {/* Banner */}
      <button
        type="button"
        className="xxprof-banner"
        style={!bannerSrc ? { background: `color-mix(in srgb, ${accent} 16%, var(--xx-card))`, cursor: "default" } : undefined}
        onClick={() => { if (bannerSrc) setBannerView(true); }}
        aria-label={bannerSrc ? "View banner" : undefined}
      >
        {bannerSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={bannerSrc} alt="" />
        ) : null}
      </button>

      {/* Avatar + actions */}
      <div className="xxprof-ava-row">
        <div className="xxprof-ava">
          <UserAvatar
            user={profile}
            size="xl"
            className="xxprof-ava-img"
            decorations={profile.decorations}
            clickable={false}
          />
        </div>
        <div className="xxprof-actions">
          {isOwn ? (
            <>
              <button type="button" className="xxprof-icobtn" onClick={shareProfile} aria-label="Share profile">
                <Share2 />
              </button>
              <Link href="/settings/profile" className="xxbtn xxbtn-outline">
                Edit profile
              </Link>
            </>
          ) : (
            <>
              <button type="button" className="xxprof-icobtn" onClick={shareProfile} aria-label="Share profile">
                <Share2 />
              </button>
              <button type="button" className="xxprof-icobtn" onClick={openDm} aria-label="Message">
                <MessageCircle />
              </button>
              <button
                type="button"
                disabled={followLoading}
                onClick={onFollow}
                className={cn("xxbtn", following ? "xxbtn-outline" : "xxbtn-black")}
                style={following ? { borderColor: "var(--xx-border)" } : undefined}
              >
                {followLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : following ? (
                  "Following"
                ) : followsMe ? (
                  "Follow back"
                ) : (
                  "Follow"
                )}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Identity */}
      <div className="xxprof-body">
        <h2 className="xxprof-name">
          {profile.displayName}
          {profile.isVerified ? (
            <VerifiedBadge type={isBusiness ? "business" : profile.verifiedType || "flux"} />
          ) : null}
          {isBusiness ? <BusinessBadge /> : null}
          {shopFlair ? <ShopFlairBadge emoji={shopFlair.emoji} label={shopFlair.label} /> : null}
        </h2>
        <p className="xxprof-handle">
          @{profile.username}
          {followsMe && !isOwn ? <span className="xxprof-followsyou">Follows you</span> : null}
        </p>
        {onlineNow ? (
          <p className="xxprof-meta" style={{ marginTop: 8 }}>
            <span><span style={{ width: 8, height: 8, borderRadius: 999, background: "#00ba7c", display: "inline-block" }} /> Online now</span>
          </p>
        ) : null}
        {profile.bio ? <p className="xxprof-bio">{profile.bio}</p> : null}

        <div className="xxprof-meta">
          {profile.location ? (
            <span><MapPin />{profile.location}</span>
          ) : null}
          {profile.website || profile.socialLinks?.website ? (
            <span>
              <LinkIcon />
              <a
                href={normalizeUrl(profile.website || profile.socialLinks?.website || "")}
                target="_blank"
                rel="noreferrer"
              >
                {(profile.website || profile.socialLinks?.website || "").replace(/^https?:\/\//, "").slice(0, 32)}
              </a>
            </span>
          ) : null}
          {joined ? (
            <span><Calendar />Joined {joined}</span>
          ) : null}
        </div>

        {profile.socialLinks?.instagram || profile.socialLinks?.tiktok || profile.socialLinks?.youtube || profile.socialLinks?.x ? (
          <div className="xxprof-meta" style={{ marginTop: 6 }}>
            {profile.socialLinks?.instagram ? <SocialLink label="Instagram" value={profile.socialLinks.instagram} /> : null}
            {profile.socialLinks?.tiktok ? <SocialLink label="TikTok" value={profile.socialLinks.tiktok} /> : null}
            {profile.socialLinks?.youtube ? <SocialLink label="YouTube" value={profile.socialLinks.youtube} /> : null}
            {profile.socialLinks?.x ? <SocialLink label="X" value={profile.socialLinks.x} /> : null}
          </div>
        ) : null}

        <div className="xxprof-stats">
          <button type="button" onClick={() => openList("following")}>
            <b>{formatCount(profile.followingCount)}</b> <span className="lbl">Following</span>
          </button>
          <button type="button" onClick={() => openList("followers")}>
            <b>{formatCount(profile.followersCount)}</b> <span className="lbl">Followers</span>
          </button>
        </div>

        {profile.mood ? (() => {
          const m = MOOD_OPTIONS.find((x) => x.id === profile.mood);
          return m?.emoji ? (
            <p className="xxprof-meta" style={{ marginTop: 8 }}>
              <span>{m.emoji} {m.label}</span>
            </p>
          ) : null;
        })() : null}
      </div>

      {/* Tabs */}
      {!canSeePrivate ? (
        <div className="xxempty">
          <h3>These posts are protected</h3>
          <p>Only approved followers can see @{profile.username}&apos;s posts.</p>
        </div>
      ) : (
        <>
          <div className="xxtabs" role="tablist" aria-label="Profile" style={{ borderBottom: "1px solid var(--xx-line)" }}>
            {TAB_DEFS.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={tab === t.id}
                onClick={() => setTab(t.id)}
                className={cn("xxtab", tab === t.id && "is-active")}
              >
                <span className="xxtab-inner">
                  <span className="xxtab-label">{t.label}</span>
                  <span className="xxtab-bar" aria-hidden="true" />
                </span>
              </button>
            ))}
          </div>

          {tabLoading ? (
            <div aria-label="Loading">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="xxskel" aria-hidden="true">
                  <div className="xxskel-ava" />
                  <div className="xxskel-main">
                    <div className="xxskel-line" style={{ width: "35%" }} />
                    <div className="xxskel-line" style={{ width: "95%" }} />
                  </div>
                </div>
              ))}
            </div>
          ) : tab === "photos" ? (
            <PhotosPanel
              visibility={photoVisibility}
              onVisibilityChange={setPhotoVisibility}
              isOwn={isOwn}
            />
          ) : posts.length === 0 ? (
            <TabEmpty tab={tab} username={profile.username} isOwn={isOwn} />
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
                        : prev.map((p) => (p.id === updated.id ? updated : p))
                    )
                  }
                />
              ))}
            </div>
          )}
        </>
      )}

      <ImageViewer
        open={bannerView}
        src={bannerSrc}
        alt="Banner"
        onClose={() => setBannerView(false)}
      />

      <Dialog open={!!listOpen} onOpenChange={() => setListOpen(null)}>
        <DialogContent className="overflow-hidden rounded-2xl p-0 sm:max-w-md">
          <DialogHeader className="px-4 py-3" style={{ borderBottom: "1px solid var(--xx-line)" }}>
            <DialogTitle className="text-left text-[17px] font-extrabold">
              {listOpen === "followers" ? "Followers" : "Following"}
            </DialogTitle>
          </DialogHeader>
          <div className="max-h-96 overflow-y-auto py-2">
            {listUsers.length === 0 ? (
              <p className="py-8 text-center text-sm" style={{ color: "var(--xx-gray)" }}>
                No users yet
              </p>
            ) : (
              listUsers.map((u) => (
                <Link
                  key={u.uid}
                  href={profilePath(u.username)}
                  onClick={() => setListOpen(null)}
                  className="flex items-center gap-3 px-4 py-2.5 transition"
                  style={{ textDecoration: "none", color: "inherit" }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "var(--xx-card-hover)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  <UserAvatar user={u} decorations={u.decorations} size="md" clickable={false} />
                  <div className="min-w-0">
                    <p className="truncate text-[15px] font-bold leading-tight">
                      {u.displayName}
                    </p>
                    <p className="truncate text-sm" style={{ color: "var(--xx-gray)" }}>
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
  const copy: Record<string, { title: string; description: string }> = {
    replies: {
      title: "No replies yet",
      description: isOwn ? "When you reply to posts, they'll show up here." : `${who} hasn't replied to any posts yet.`,
    },
    media: {
      title: "No media yet",
      description: isOwn ? "Photos and videos you share will show up here." : `${who} hasn't shared any photos or videos yet.`,
    },
    likes: {
      title: "No likes yet",
      description: isOwn ? "Tap the heart on any post to show appreciation." : `${who} hasn't liked any posts yet.`,
    },
    posts: {
      title: "No posts yet",
      description: isOwn ? "Share your first post and start the conversation." : `${who} hasn't posted anything yet.`,
    },
  };
  const c = copy[tab] || copy.posts;
  return (
    <div className="xxempty">
      <h3>{c.title}</h3>
      <p>{c.description}</p>
    </div>
  );
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
    <div style={{ padding: "16px" }}>
      <div
        className="mb-4 inline-flex rounded-full p-1 text-sm font-bold"
        role="tablist"
        aria-label="Photo visibility"
        style={{ background: "var(--xx-line)" }}
      >
        <button
          type="button"
          role="tab"
          aria-selected={visibility === "public"}
          onClick={() => onVisibilityChange("public")}
          className={cn(
            "rounded-full px-4 py-1.5 transition",
            visibility === "public"
              ? "text-[var(--xx-text)]"
              : "text-[var(--xx-gray)]"
          )}
          style={visibility === "public" ? { background: "var(--xx-bg)", boxShadow: "0 1px 2px rgba(0,0,0,.12)" } : undefined}
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
              ? "text-[var(--xx-text)]"
              : "text-[var(--xx-gray)]"
          )}
          style={visibility === "private" ? { background: "var(--xx-bg)", boxShadow: "0 1px 2px rgba(0,0,0,.12)" } : undefined}
        >
          <LockKeyhole className="h-3.5 w-3.5" />
          Private
        </button>
      </div>
      <div className="xxempty" style={{ padding: "32px 16px" }}>
        <h3 style={{ fontSize: 24 }}>{visibility === "public" ? "No public photos yet" : "No private photos yet"}</h3>
        <p>
          {visibility === "public"
            ? isOwn
              ? "Photos marked Public in Flux Rec will appear here for everyone to see."
              : "Public Flux Rec photos will appear here."
            : isOwn
              ? "Only you can see these. Snap a photo in Flux Rec and mark it Private."
              : "Private photos are only visible to the account owner."}
        </p>
      </div>
    </div>
  );
}

function SocialLink({ label, value }: { label: string; value: string }) {
  return (
    <a
      href={normalizeUrl(value)}
      target="_blank"
      rel="noreferrer"
      style={{ fontWeight: 500, color: "var(--xx-gray)" }}
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
