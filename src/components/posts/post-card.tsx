"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatDistanceToNowStrict } from "date-fns";
import { motion } from "framer-motion";
import {
  Ban,
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
  compact = false,
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
      window.setTimeout(() => setLikeAnim(false), 380);
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
      <motion.article
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="border-b border-border/70 px-4 py-3 transition-colors hover:bg-muted/30"
      >
        <div className="mb-2 flex items-center gap-2 pl-10 text-xs font-semibold text-muted-foreground">
          <Repeat2 className="h-3.5 w-3.5 text-repost" />
          {author?.displayName || "Someone"} reposted
        </div>
        {post.quotedPost ? (
          <PostCard post={post.quotedPost} onChange={onChange} />
        ) : (
          <button
            type="button"
            onClick={() => router.push(postPath(post.repostOfId!))}
            className="w-full rounded-2xl border border-border bg-background/70 p-4 text-left text-sm text-muted-foreground shadow-sm hover:border-primary/30 hover:bg-muted/50"
          >
            View the original post
          </button>
        )}
      </motion.article>
    );
  }

  return (
    <motion.article
      layout="position"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        "post-row border-b border-border/70 px-4 py-3.5",
        !disableNavigate && "cursor-pointer",
        compact && "pl-6",
        disableNavigate && "bg-gradient-to-b from-accent/30 to-transparent"
      )}
      onPointerMove={(event) => {
        const bounds = event.currentTarget.getBoundingClientRect();
        event.currentTarget.style.setProperty("--post-x", `${event.clientX - bounds.left}px`);
        event.currentTarget.style.setProperty("--post-y", `${event.clientY - bounds.top}px`);
      }}
      onClick={goToPost}
      role={disableNavigate ? undefined : "link"}
      tabIndex={disableNavigate ? undefined : 0}
      onKeyDown={(event) => {
        if (!disableNavigate && (event.key === "Enter" || event.key === " ")) goToPost();
      }}
    >
      {post.author?.pinnedPostId === post.id ? (
        <div className="mb-1 flex items-center gap-1.5 pl-12 text-xs font-medium text-muted-foreground">
          <Pin className="h-3 w-3" />Pinned
        </div>
      ) : null}

      <div className="flex gap-3">
        <Link
          href={author?.username ? profilePath(author.username) : "#"}
          onClick={(event) => event.stopPropagation()}
          className="shrink-0"
        >
          <UserAvatar user={author} size={compact ? "sm" : "md"} decorations={author?.decorations} />
        </Link>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[15px]">
              <Link
                href={author?.username ? profilePath(author.username) : "#"}
                onClick={(event) => event.stopPropagation()}
                className="truncate font-bold hover:underline"
              >
                {author?.displayName || "User"}
              </Link>
              {author?.isVerified ? (
                <VerifiedBadge type={author.accountType === "business" ? "business" : author.verifiedType || "flux"} />
              ) : null}
              {author?.accountType === "business" ? <BusinessBadge className="scale-90" /> : null}
              {(() => {
                const flair = flairForDecoration(author?.decorations?.badgeId);
                return flair ? <ShopFlairBadge emoji={flair.emoji} /> : null;
              })()}
              <span className="truncate text-muted-foreground">@{author?.username || "user"}</span>
              {time ? <><span className="text-muted-foreground">·</span><span className="text-muted-foreground">{time}</span></> : null}
            </div>

            <div className="relative" onClick={(event) => event.stopPropagation()}>
              <button
                type="button"
                onClick={() => setMenuOpen((value) => !value)}
                className="rounded-full p-1.5 text-muted-foreground hover:bg-primary/10 hover:text-primary"
                aria-label="Post menu"
                aria-expanded={menuOpen}
              >
                <MoreHorizontal className="h-4 w-4" />
              </button>
              {menuOpen ? (
                <div className="absolute right-0 z-30 mt-1 w-48 overflow-hidden rounded-2xl border border-border bg-card py-1.5 shadow-soft">
                  {user?.uid === post.authorId ? (
                    <>
                      <MenuButton icon={Pin} label="Pin to profile" onClick={() => { setMenuOpen(false); void onPin(); }} />
                      <MenuButton destructive icon={Trash2} label="Delete post" onClick={() => { setMenuOpen(false); void onDelete(); }} />
                    </>
                  ) : (
                    <>
                      <MenuButton icon={Quote} label="Quote post" onClick={() => { setMenuOpen(false); setQuoteOpen(true); }} />
                      <MenuButton icon={VolumeX} label="Mute user" onClick={async () => {
                        setMenuOpen(false);
                        if (!user) return;
                        try { await muteUser(user.uid, post.authorId); toast.success("User muted"); }
                        catch { toast.error("Could not mute"); }
                      }} />
                      <MenuButton icon={Ban} label="Block user" onClick={async () => {
                        setMenuOpen(false);
                        if (!user) return;
                        try { await blockUser(user.uid, post.authorId); toast.success("User blocked"); emit({ isDeleted: true }); }
                        catch { toast.error("Could not block"); }
                      }} />
                      <MenuButton destructive label="Report post" onClick={async () => {
                        setMenuOpen(false);
                        if (!user) return toast.error("Sign in to report");
                        try {
                          await createReport({ reporterId: user.uid, targetType: "post", targetId: post.id, reason: "spam_or_abuse", details: "Reported from post menu" });
                          toast.success("Report submitted");
                        } catch { toast.error("Could not report"); }
                      }} />
                    </>
                  )}
                </div>
              ) : null}
            </div>
          </div>

          {post.text ? <PostText text={post.text} /> : null}

          {post.media?.length ? (
            <div
              className={cn(
                "mt-3 grid gap-1 overflow-hidden rounded-2xl border border-border bg-muted/20",
                post.media.length === 1 ? "grid-cols-1" : "grid-cols-2"
              )}
              onClick={(event) => event.stopPropagation()}
            >
              {post.media.map((media, index) => media.type === "video" ? (
                <video key={`${media.url}-${index}`} src={media.url} controls playsInline preload="metadata" className="max-h-96 w-full bg-black object-contain" />
              ) : (
                <button
                  type="button"
                  key={`${media.url}-${index}`}
                  className="group relative overflow-hidden bg-muted"
                  onClick={() => {
                    const imageIndex = post.media.slice(0, index + 1).filter((item) => item.type !== "video").length - 1;
                    setLightboxIndex(Math.max(0, imageIndex));
                    setLightbox(true);
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={media.url} alt="" loading="lazy" className="max-h-96 w-full object-cover transition duration-300 group-hover:scale-[1.015] group-hover:brightness-95" />
                  {media.type === "gif" ? <span className="absolute left-2 top-2 rounded-md bg-black/75 px-1.5 py-0.5 text-[10px] font-bold text-white">GIF</span> : null}
                </button>
              ))}
            </div>
          ) : null}

          {post.poll ? (
            <div className="mt-3 space-y-2 rounded-2xl border border-border p-3" onClick={(event) => event.stopPropagation()}>
              {post.poll.options.map((option) => {
                const total = post.poll!.options.reduce((sum, item) => sum + item.votes, 0) || 1;
                const percentage = Math.round((option.votes / total) * 100);
                return (
                  <button
                    type="button"
                    key={option.id}
                    className="relative w-full overflow-hidden rounded-xl border border-border px-3 py-2 text-left hover:border-primary/40"
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
                    <span className="absolute inset-y-0 left-0 bg-primary/15 transition-[width] duration-500" style={{ width: `${percentage}%` }} />
                    <span className="relative flex justify-between text-sm font-medium"><span>{option.text}</span><span className="text-muted-foreground">{percentage}%</span></span>
                  </button>
                );
              })}
              <p className="text-[11px] text-muted-foreground">Tap an option to vote · {post.poll.options.reduce((sum, item) => sum + item.votes, 0)} votes</p>
            </div>
          ) : null}

          {post.quotedPost ? (
            <button
              type="button"
              className="mt-3 block w-full overflow-hidden rounded-2xl border border-border p-3 text-left hover:bg-muted/40"
              onClick={(event) => { event.stopPropagation(); router.push(postPath(post.quotedPost!.id)); }}
            >
              <span className="mb-1 flex items-center gap-1.5 text-sm">
                <UserAvatar user={post.quotedPost.author} size="sm" className="h-5 w-5" />
                <strong>{post.quotedPost.author?.displayName}</strong>
                <span className="truncate text-muted-foreground">@{post.quotedPost.author?.username}</span>
              </span>
              <span className="line-clamp-4 text-sm">{post.quotedPost.text}</span>
            </button>
          ) : null}

          <div className="mt-3 flex max-w-md items-center justify-between text-muted-foreground" onClick={(event) => event.stopPropagation()}>
            <ActionButton label="Reply" count={post.repliesCount} hover="hover:text-primary" onClick={() => disableNavigate ? setReplyOpen(true) : router.push(postPath(post.id))}>
              <MessageCircle className="h-[18px] w-[18px]" />
            </ActionButton>
            <ActionButton
              label={reposted ? "Remove repost" : "Repost"}
              count={repostCount}
              active={reposted}
              activeClass="text-repost"
              hover="hover:text-repost"
              busy={repostBusy}
              onClick={onRepost}
            >
              <Repeat2 className="h-[18px] w-[18px]" />
            </ActionButton>
            <ActionButton
              label={liked ? "Unlike" : "Like"}
              count={likeCount}
              active={liked}
              activeClass="text-like"
              hover="hover:text-like"
              busy={likeBusy}
              className={likeAnim ? "like-burst" : ""}
              onClick={onLike}
            >
              <Heart className={cn("h-[18px] w-[18px]", liked && "fill-like text-like")} />
            </ActionButton>
            <ActionButton
              label={bookmarked ? "Remove bookmark" : "Bookmark"}
              active={bookmarked}
              activeClass="text-primary"
              hover="hover:text-primary"
              busy={bookmarkBusy}
              onClick={onBookmark}
            >
              <Bookmark className={cn("h-[18px] w-[18px]", bookmarked && "fill-primary text-primary")} />
            </ActionButton>
            <ActionButton label="Share" hover="hover:text-primary" onClick={onShare}>
              <Share2 className="h-[18px] w-[18px]" />
            </ActionButton>
          </div>
        </div>
      </div>

      <Dialog open={replyOpen} onOpenChange={setReplyOpen}>
        <DialogContent className="max-w-lg p-0" onClick={(event) => event.stopPropagation()}>
          <DialogHeader className="border-b border-border px-4 py-3"><DialogTitle>Reply</DialogTitle></DialogHeader>
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
    </motion.article>
  );
}

function PostText({ text }: { text: string }) {
  return (
    <p className="mt-1 whitespace-pre-wrap break-words text-[15px] leading-relaxed">
      {text.split(/(\s+)/).map((part, index) => {
        if (part.startsWith("#")) return <Link key={index} href={`/explore?q=${encodeURIComponent(part)}`} onClick={(event) => event.stopPropagation()} className="text-primary hover:underline">{part}</Link>;
        if (part.startsWith("@")) return <Link key={index} href={profilePath(part.slice(1))} onClick={(event) => event.stopPropagation()} className="text-primary hover:underline">{part}</Link>;
        return <span key={index}>{part}</span>;
      })}
    </p>
  );
}

function MenuButton({
  icon: Icon,
  label,
  onClick,
  destructive = false,
}: {
  icon?: typeof Pin;
  label: string;
  onClick: () => void;
  destructive?: boolean;
}) {
  return (
    <button type="button" onClick={onClick} className={cn("flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm hover:bg-muted", destructive && "text-destructive")}>
      {Icon ? <Icon className="h-4 w-4" /> : <span className="h-4 w-4" />}{label}
    </button>
  );
}

function ActionButton({
  children,
  onClick,
  label,
  count,
  active,
  activeClass,
  hover,
  className,
  busy = false,
}: {
  children: React.ReactNode;
  onClick: (event?: React.MouseEvent) => void;
  label: string;
  count?: number;
  active?: boolean;
  activeClass?: string;
  hover?: string;
  className?: string;
  busy?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={typeof active === "boolean" ? active : undefined}
      aria-busy={busy}
      disabled={busy}
      onClick={(event) => { event.stopPropagation(); onClick(event); }}
      className={cn("group flex items-center gap-1 rounded-full text-[13px]", hover, active && activeClass, busy && "flux-action-pending", className)}
    >
      <span className="rounded-full p-1.5 transition-colors group-hover:bg-current/10">
        {busy ? <Loader2 className="h-[18px] w-[18px]" /> : children}
      </span>
      {typeof count === "number" && count > 0 ? <span className="tabular-nums">{formatCount(count)}</span> : null}
    </button>
  );
}
