"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatDistanceToNowStrict } from "date-fns";
import {
  Ban,
  BarChart3,
  Bookmark,
  Heart,
  Loader2,
  MessageCircle,
  MoreHorizontal,
  Pin,
  Quote,
  Repeat2,
  Share2,
  Trash2,
  VolumeX,
} from "lucide-react";
import { toast } from "sonner";
import type { PostWithAuthor } from "@/types";
import { UserAvatar } from "@/components/shared/user-avatar";
import {
  BusinessBadge,
  ShopFlairBadge,
  VerifiedBadge,
} from "@/components/shared/verified-badge";
import { useAuth } from "@/contexts/auth-context";
import {
  deletePost,
  pinPost,
  toggleBookmark,
  toggleLike,
  votePoll,
} from "@/services/posts";
import { setRepostState } from "@/services/reposts";
import { cn, formatCount } from "@/lib/utils";
import { absoluteAppUrl, postPath, profilePath } from "@/lib/routes";
import { flairForDecoration } from "@/lib/shop-catalog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ComposeBox } from "@/components/posts/compose-box";
import { MediaLightbox } from "@/components/posts/media-lightbox";
import { QuoteDialog } from "@/components/posts/quote-dialog";
import { createReport } from "@/services/admin";
import { blockUser, muteUser } from "@/services/users";

export function PostCard({
  post,
  onChange,
  disableNavigate = false,
}: {
  post: PostWithAuthor;
  onChange?: (post: PostWithAuthor) => void;
  compact?: boolean;
  disableNavigate?: boolean;
}) {
  const { user } = useAuth();
  const router = useRouter();
  const [liked, setLiked] = useState(Boolean(post.likedByMe));
  const [likeCount, setLikeCount] = useState(Math.max(0, post.likesCount));
  const [bookmarked, setBookmarked] = useState(Boolean(post.bookmarkedByMe));
  const [reposted, setReposted] = useState(Boolean(post.repostedByMe));
  const [repostCount, setRepostCount] = useState(Math.max(0, post.repostsCount));
  const [likeAnim, setLikeAnim] = useState(false);
  const [unlikeAnim, setUnlikeAnim] = useState(false);
  const [likeBusy, setLikeBusy] = useState(false);
  const [bookmarkBusy, setBookmarkBusy] = useState(false);
  const [repostBusy, setRepostBusy] = useState(false);
  const [replyOpen, setReplyOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [lightbox, setLightbox] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [quoteOpen, setQuoteOpen] = useState(false);

  const author = post.author;
  const time = post.createdAt?.toDate
    ? formatDistanceToNowStrict(post.createdAt.toDate(), { addSuffix: false })
    : "";
  const imageUrls = useMemo(
    () => post.media?.filter((item) => item.type !== "video").map((item) => item.url) || [],
    [post.media]
  );

  const emit = (patch: Partial<PostWithAuthor>) => onChange?.({ ...post, ...patch });

  const goToPost = () => {
    if (!disableNavigate) router.push(postPath(post.id));
  };

  const onLike = async (event?: React.MouseEvent) => {
    event?.stopPropagation();
    if (!user) return toast.error("Sign in to like");
    if (likeBusy) return;
    const desired = !liked;
    setLikeBusy(true);
    setLiked(desired);
    setLikeCount((count) => Math.max(0, count + (desired ? 1 : -1)));
    if (desired) {
      setLikeAnim(true);
      window.setTimeout(() => setLikeAnim(false), 460);
    } else {
      setUnlikeAnim(true);
      window.setTimeout(() => setUnlikeAnim(false), 240);
    }
    try {
      const saved = await toggleLike(post.id, user.uid);
      setLiked(saved);
      const nextCount = Math.max(0, post.likesCount + (saved ? 1 : 0) - (post.likedByMe ? 1 : 0));
      setLikeCount(nextCount);
      emit({ likedByMe: saved, likesCount: nextCount });
    } catch {
      setLiked(!desired);
      setLikeCount((count) => Math.max(0, count + (desired ? -1 : 1)));
      toast.error("Could not update like");
    } finally {
      setLikeBusy(false);
    }
  };

  const onBookmark = async (event?: React.MouseEvent) => {
    event?.stopPropagation();
    if (!user) return toast.error("Sign in to bookmark");
    if (bookmarkBusy) return;
    const desired = !bookmarked;
    setBookmarkBusy(true);
    setBookmarked(desired);
    try {
      const saved = await toggleBookmark(post.id, user.uid);
      setBookmarked(saved);
      emit({ bookmarkedByMe: saved });
      toast.success(saved ? "Saved" : "Removed bookmark");
    } catch {
      setBookmarked(!desired);
      toast.error("Could not update bookmark");
    } finally {
      setBookmarkBusy(false);
    }
  };

  const onRepost = async (event?: React.MouseEvent) => {
    event?.stopPropagation();
    if (!user) return toast.error("Sign in to repost");
    if (event?.shiftKey) {
      setQuoteOpen(true);
      return;
    }
    if (repostBusy) return;

    const desired = !reposted;
    setRepostBusy(true);
    setReposted(desired);
    setRepostCount((count) => Math.max(0, count + (desired ? 1 : -1)));
    try {
      const saved = await setRepostState(post.id, user.uid, desired);
      const nextCount = Math.max(0, post.repostsCount + (saved ? 1 : 0) - (post.repostedByMe ? 1 : 0));
      setReposted(saved);
      setRepostCount(nextCount);
      emit({ repostedByMe: saved, repostsCount: nextCount });
      toast.success(saved ? "Reposted" : "Repost removed");
    } catch (error) {
      setReposted(!desired);
      setRepostCount((count) => Math.max(0, count + (desired ? -1 : 1)));
      toast.error(error instanceof Error ? error.message : "Could not update repost");
    } finally {
      setRepostBusy(false);
    }
  };

  const onShare = async (event?: React.MouseEvent) => {
    event?.stopPropagation();
    const url = absoluteAppUrl(postPath(post.id));
    try {
      if (navigator.share) {
        await navigator.share({ title: author?.displayName || "Flux post", text: post.text, url });
      } else {
        await navigator.clipboard.writeText(url);
        toast.success("Link copied");
      }
    } catch (error) {
      if ((error as DOMException)?.name !== "AbortError") toast.message(url);
    }
  };

  const onDelete = async () => {
    if (!user) return;
    try {
      await deletePost(post.id, user.uid);
      toast.success("Post deleted");
      emit({ isDeleted: true });
    } catch {
      toast.error("Could not delete");
    }
  };

  const onPin = async () => {
    if (!user) return;
    try {
      await pinPost(user.uid, post.id);
      toast.success("Pinned to profile");
    } catch {
      toast.error("Could not pin");
    }
  };

  if (post.isDeleted) return null;

  if (post.type === "repost" && post.repostOfId) {
    return (
      <article className="xxpost" onClick={() => router.push(postPath(post.repostOfId!))}>
        <div className="xxpost-repostline">
          <Repeat2 />
          <span>{author?.displayName || "Someone"} reposted</span>
        </div>
        {post.quotedPost ? (
          <PostCard post={post.quotedPost} onChange={onChange} />
        ) : (
          <div className="xxpost-quote">View the original post</div>
        )}
      </article>
    );
  }

  return (
    <article
      className="xxpost"
      onClick={goToPost}
      role={disableNavigate ? undefined : "link"}
      tabIndex={disableNavigate ? undefined : 0}
      onKeyDown={(event) => {
        if (!disableNavigate && (event.key === "Enter" || event.key === " ")) goToPost();
      }}
    >
      {post.author?.pinnedPostId === post.id ? (
        <div className="xxpost-pinline">
          <Pin className="h-3.5 w-3.5" />
          <span>Pinned</span>
        </div>
      ) : null}

      <div className="xxpost-row">
        <Link
          href={author?.username ? profilePath(author.username) : "#"}
          onClick={(event) => event.stopPropagation()}
          className="xxpost-avatar"
          aria-label={`${author?.displayName || "User"} profile`}
        >
          <UserAvatar user={author} size="md" decorations={author?.decorations} clickable={false} />
        </Link>

        <div className="xxpost-main">
          <div className="xxpost-head">
            <Link
              href={author?.username ? profilePath(author.username) : "#"}
              onClick={(event) => event.stopPropagation()}
              className="xxpost-name"
            >
              {author?.displayName || "User"}
            </Link>
            {author?.isVerified ? (
              <span className="xxpost-badge">
                <VerifiedBadge type={author.accountType === "business" ? "business" : author.verifiedType || "flux"} />
              </span>
            ) : null}
            {author?.accountType === "business" ? <BusinessBadge className="scale-90" /> : null}
            {(() => {
              const flair = flairForDecoration(author?.decorations?.badgeId);
              return flair ? <ShopFlairBadge emoji={flair.emoji} /> : null;
            })()}
            <span className="xxpost-meta">
              @{author?.username || "user"}{time ? ` · ${time}` : ""}
            </span>

            <div className="xxpost-menuwrap" onClick={(event) => event.stopPropagation()}>
              <button
                type="button"
                onClick={() => setMenuOpen((value) => !value)}
                className="xxpost-menubtn"
                aria-label="More"
                aria-expanded={menuOpen}
              >
                <MoreHorizontal className="h-[18px] w-[18px]" />
              </button>
              {menuOpen ? (
                <>
                  <button
                    type="button"
                    aria-label="Close menu"
                    style={{ position: "fixed", inset: 0, background: "transparent", border: "none", cursor: "default", zIndex: 49, padding: 0 }}
                    onClick={(e) => { e.stopPropagation(); setMenuOpen(false); }}
                  />
                  <div className="xxpost-menu" role="menu" style={{ zIndex: 50 }}>
                  {user?.uid === post.authorId ? (
                    <>
                      <button type="button" onClick={() => { setMenuOpen(false); void onPin(); }}>
                        <Pin />Pin to profile
                      </button>
                      <button type="button" className="danger" onClick={() => { setMenuOpen(false); void onDelete(); }}>
                        <Trash2 />Delete
                      </button>
                    </>
                  ) : (
                    <>
                      <button type="button" onClick={() => { setMenuOpen(false); setQuoteOpen(true); }}>
                        <Quote />Quote
                      </button>
                      <button type="button" onClick={async () => {
                        setMenuOpen(false);
                        if (!user) return;
                        try { await muteUser(user.uid, post.authorId); toast.success("User muted"); }
                        catch { toast.error("Could not mute"); }
                      }}>
                        <VolumeX />Mute @{author?.username}
                      </button>
                      <button type="button" onClick={async () => {
                        setMenuOpen(false);
                        if (!user) return;
                        try { await blockUser(user.uid, post.authorId); toast.success("User blocked"); emit({ isDeleted: true }); }
                        catch { toast.error("Could not block"); }
                      }}>
                        <Ban />Block @{author?.username}
                      </button>
                      <button type="button" className="danger" onClick={async () => {
                        setMenuOpen(false);
                        if (!user) return toast.error("Sign in to report");
                        try {
                          await createReport({ reporterId: user.uid, targetType: "post", targetId: post.id, reason: "spam_or_abuse", details: "Reported from post menu" });
                          toast.success("Report submitted");
                        } catch { toast.error("Could not report"); }
                      }}>
                        Report post
                      </button>
                    </>
                  )}
                </div>
                </>
              ) : null}
            </div>
          </div>

          {post.text ? <PostText text={post.text} /> : null}

          {post.media?.length ? (
            <div
              className={cn("xxpost-media", post.media.length > 1 && "xxpost-media-grid cols-2")}
              onClick={(event) => event.stopPropagation()}
            >
              {post.media.map((media, index) => media.type === "video" ? (
                <video key={`${media.url}-${index}`} src={media.url} controls playsInline preload="metadata" />
              ) : (
                <button
                  type="button"
                  key={`${media.url}-${index}`}
                  style={{ padding: 0, border: "none", background: "transparent", cursor: "zoom-in", display: "block", width: "100%" }}
                  onClick={() => {
                    const imageIndex = post.media.slice(0, index + 1).filter((item) => item.type !== "video").length - 1;
                    setLightboxIndex(Math.max(0, imageIndex));
                    setLightbox(true);
                  }}
                  aria-label="View image"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={media.url} alt="" loading="lazy" />
                  {media.type === "gif" ? <span style={{ position: "absolute" }} /> : null}
                </button>
              ))}
            </div>
          ) : null}

          {post.poll ? (
            <div className="xxpost-quote" style={{ cursor: "default" }} onClick={(event) => event.stopPropagation()}>
              {post.poll.options.map((option) => {
                const total = post.poll!.options.reduce((sum, item) => sum + item.votes, 0) || 1;
                const percentage = Math.round((option.votes / total) * 100);
                return (
                  <button
                    type="button"
                    key={option.id}
                    style={{ position: "relative", width: "100%", overflow: "hidden", borderRadius: 16, border: "1px solid var(--xx-line)", padding: "10px 12px", textAlign: "left", marginBottom: 8, background: "transparent", cursor: "pointer", color: "var(--xx-text)", fontSize: 15 }}
                    onClick={async () => {
                      if (!user) return toast.error("Sign in to vote");
                      try {
                        const updated = await votePoll(post.id, user.uid, option.id);
                        if (updated) onChange?.(updated);
                        else toast.success("Vote recorded");
                      } catch (error) {
                        toast.error(error instanceof Error ? error.message : "Could not vote");
                      }
                    }}
                  >
                    <span style={{ position: "absolute", inset: 0, background: "color-mix(in srgb, var(--xx-blue) 12%, transparent)", width: `${percentage}%` }} />
                    <span style={{ position: "relative", display: "flex", justifyContent: "space-between" }}>
                      <span>{option.text}</span>
                      <span style={{ color: "var(--xx-gray)" }}>{percentage}%</span>
                    </span>
                  </button>
                );
              })}
              <p style={{ fontSize: 13, color: "var(--xx-gray)", margin: "4px 0 0" }}>
                {post.poll.options.reduce((sum, item) => sum + item.votes, 0)} votes · Final results
              </p>
            </div>
          ) : null}

          {post.quotedPost ? (
            <button
              type="button"
              className="xxpost-quote"
              onClick={(event) => { event.stopPropagation(); router.push(postPath(post.quotedPost!.id)); }}
            >
              <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 15, marginBottom: 4 }}>
                <strong>{post.quotedPost.author?.displayName}</strong>
                <span style={{ color: "var(--xx-gray)" }}>@{post.quotedPost.author?.username}</span>
              </span>
              <span style={{ fontSize: 15, display: "-webkit-box", WebkitLineClamp: 4, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                {post.quotedPost.text}
              </span>
            </button>
          ) : null}

          <div className="xxpost-actions" onClick={(event) => event.stopPropagation()}>
            <ActionButton
              kind="reply"
              label="Reply"
              count={post.repliesCount}
              onClick={() => disableNavigate ? setReplyOpen(true) : router.push(postPath(post.id))}
            >
              <MessageCircle />
            </ActionButton>
            <ActionButton
              kind="repost"
              label={reposted ? "Undo repost" : "Repost"}
              count={repostCount}
              active={reposted}
              busy={repostBusy}
              onClick={onRepost}
            >
              <Repeat2 />
            </ActionButton>
            <ActionButton
              kind="like"
              label={liked ? "Unlike" : "Like"}
              count={likeCount}
              active={liked}
              busy={likeBusy}
              className={likeAnim ? "like-burst" : unlikeAnim ? "like-unburst" : ""}
              onClick={onLike}
            >
              <Heart />
            </ActionButton>
            <ActionButton kind="views" label="Views" count={post.viewsCount}>
              <BarChart3 />
            </ActionButton>
            <ActionButton
              kind="bm"
              label={bookmarked ? "Remove bookmark" : "Bookmark"}
              active={bookmarked}
              busy={bookmarkBusy}
              onClick={onBookmark}
            >
              <Bookmark />
            </ActionButton>
            <ActionButton kind="share" label="Share" onClick={onShare}>
              <Share2 />
            </ActionButton>
          </div>
        </div>
      </div>

      <Dialog open={replyOpen} onOpenChange={setReplyOpen}>
        <DialogContent className="max-w-lg overflow-hidden rounded-2xl p-0" onClick={(event) => event.stopPropagation()}>
          <DialogHeader className="px-4 py-3" style={{ borderBottom: "1px solid var(--xx-line)" }}><DialogTitle>Reply</DialogTitle></DialogHeader>
          <div className="p-4">
            <ComposeBox parentId={post.id} placeholder="Post your reply" autofocus onSuccess={() => {
              setReplyOpen(false);
              emit({ repliesCount: post.repliesCount + 1 });
            }} />
          </div>
        </DialogContent>
      </Dialog>

      <MediaLightbox open={lightbox} urls={imageUrls} index={lightboxIndex} onClose={() => setLightbox(false)} onIndex={setLightboxIndex} />
      <QuoteDialog open={quoteOpen} onOpenChange={setQuoteOpen} post={post} />
    </article>
  );
}

function PostText({ text }: { text: string }) {
  return (
    <p className="xxpost-text">
      {text.split(/(\s+)/).map((part, index) => {
        if (part.startsWith("#")) return <Link key={index} href={`/explore?q=${encodeURIComponent(part)}`} onClick={(event) => event.stopPropagation()}>{part}</Link>;
        if (part.startsWith("@") && part.length > 1) return <Link key={index} href={profilePath(part.slice(1))} onClick={(event) => event.stopPropagation()}>{part}</Link>;
        return <span key={index}>{part}</span>;
      })}
    </p>
  );
}

function ActionButton({
  children,
  onClick,
  label,
  count,
  kind,
  active,
  className,
  busy = false,
}: {
  children: React.ReactNode;
  onClick?: (event?: React.MouseEvent) => void;
  label: string;
  count?: number;
  kind: "reply" | "repost" | "like" | "views" | "bm" | "share";
  active?: boolean;
  className?: string;
  busy?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={typeof active === "boolean" ? active : undefined}
      disabled={busy || !onClick}
      onClick={(event) => { event.stopPropagation(); onClick?.(event); }}
      className={cn("xxact", `xxact-${kind}`, active && "is-on", className)}
      style={!onClick ? { cursor: "default" } : undefined}
    >
      <span className="xxact-ic">
        {busy ? <Loader2 className="h-[18px] w-[18px] animate-spin" /> : children}
      </span>
      {typeof count === "number" && count > 0 ? <span className="xxact-count">{formatCount(count)}</span> : null}
    </button>
  );
}
