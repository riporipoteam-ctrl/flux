"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatDistanceToNowStrict } from "date-fns";
import { motion } from "framer-motion";
import {
  MessageCircle,
  Repeat2,
  Heart,
  Bookmark,
  Share2,
  MoreHorizontal,
  Trash2,
  Pin,
  Quote,
  VolumeX,
  Ban,
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
  toggleLike,
  toggleBookmark,
  toggleRepost,
  deletePost,
  pinPost,
  votePoll,
} from "@/services/posts";
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
import { muteUser, blockUser } from "@/services/users";

export function PostCard({
  post,
  onChange,
  compact = false,
  disableNavigate = false,
}: {
  post: PostWithAuthor;
  onChange?: (post: PostWithAuthor) => void;
  /** Nested reply style */
  compact?: boolean;
  /** When true, body click won't navigate (used on detail page root) */
  disableNavigate?: boolean;
}) {
  const { user } = useAuth();
  const router = useRouter();
  const [liked, setLiked] = useState(!!post.likedByMe);
  const [likeCount, setLikeCount] = useState(post.likesCount);
  const [bookmarked, setBookmarked] = useState(!!post.bookmarkedByMe);
  const [reposted, setReposted] = useState(!!post.repostedByMe);
  const [repostCount, setRepostCount] = useState(post.repostsCount);
  const [likeAnim, setLikeAnim] = useState(false);
  const [replyOpen, setReplyOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [lightbox, setLightbox] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [quoteOpen, setQuoteOpen] = useState(false);

  const author = post.author;
  const time = post.createdAt?.toDate
    ? formatDistanceToNowStrict(post.createdAt.toDate(), { addSuffix: false })
    : "";

  const goToPost = () => {
    if (disableNavigate) return;
    router.push(postPath(post.id));
  };

  const onLike = async (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!user) return toast.error("Sign in to like");
    const next = !liked;
    setLiked(next);
    setLikeCount((c) => c + (next ? 1 : -1));
    if (next) {
      setLikeAnim(true);
      setTimeout(() => setLikeAnim(false), 350);
    }
    try {
      await toggleLike(post.id, user.uid);
    } catch {
      setLiked(!next);
      setLikeCount((c) => c + (next ? -1 : 1));
      toast.error("Could not update like");
    }
  };

  const onBookmark = async (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!user) return toast.error("Sign in to bookmark");
    const next = !bookmarked;
    setBookmarked(next);
    try {
      await toggleBookmark(post.id, user.uid);
      toast.success(next ? "Saved" : "Removed bookmark");
    } catch {
      setBookmarked(!next);
    }
  };

  const onRepost = async (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!user) return toast.error("Sign in to repost");
    // long-press style: hold shift to quote instead
    if (e?.shiftKey) {
      setQuoteOpen(true);
      return;
    }
    const next = !reposted;
    setReposted(next);
    setRepostCount((c) => c + (next ? 1 : -1));
    try {
      await toggleRepost(post.id, user.uid);
      toast.success(next ? "Reposted" : "Removed repost");
    } catch {
      setReposted(!next);
      setRepostCount((c) => c + (next ? -1 : 1));
    }
  };

  const onShare = async (e?: React.MouseEvent) => {
    e?.stopPropagation();
    const url = absoluteAppUrl(postPath(post.id));
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied");
    } catch {
      toast.message(url);
    }
  };

  const onDelete = async () => {
    if (!user) return;
    try {
      await deletePost(post.id, user.uid);
      toast.success("Post deleted");
      onChange?.({ ...post, isDeleted: true });
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

  // Repost shell — open original when possible
  if (post.type === "repost" && post.repostOfId) {
    return (
      <article className="border-b border-border px-4 py-3 transition-colors hover:bg-muted/30">
        <div className="mb-1 flex items-center gap-2 pl-10 text-xs font-medium text-muted-foreground">
          <Repeat2 className="h-3.5 w-3.5" />
          {author?.displayName || "Someone"} reposted
        </div>
        {post.quotedPost ? (
          <PostCard post={post.quotedPost} onChange={onChange} />
        ) : (
          <button
            type="button"
            onClick={() => router.push(postPath(post.repostOfId!))}
            className="w-full rounded-xl border border-border p-3 text-left text-sm text-muted-foreground hover:bg-muted/40"
          >
            View original post
          </button>
        )}
      </article>
    );
  }

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "post-row border-b border-border/70 px-4 py-3.5",
        !disableNavigate && "cursor-pointer",
        compact && "pl-6",
        disableNavigate && "bg-gradient-to-b from-accent/30 to-transparent"
      )}
      onClick={goToPost}
      role={disableNavigate ? undefined : "link"}
    >
      {post.author?.pinnedPostId === post.id ? (
        <div className="mb-1 flex items-center gap-1.5 pl-12 text-xs font-medium text-muted-foreground">
          <Pin className="h-3 w-3" />
          Pinned
        </div>
      ) : null}
      <div className="flex gap-3">
        <Link
          href={author?.username ? profilePath(author.username) : "#"}
          onClick={(e) => e.stopPropagation()}
        >
          <UserAvatar
            user={author}
            size={compact ? "sm" : "md"}
            decorations={author?.decorations}
          />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[15px]">
              <Link
                href={author?.username ? profilePath(author.username) : "#"}
                onClick={(e) => e.stopPropagation()}
                className="truncate font-bold hover:underline"
              >
                {author?.displayName || "User"}
              </Link>
              {author?.isVerified ? (
                <VerifiedBadge
                  type={
                    author.accountType === "business"
                      ? "business"
                      : author.verifiedType || "flux"
                  }
                />
              ) : null}
              {author?.accountType === "business" ? (
                <BusinessBadge className="scale-90" />
              ) : null}
              {(() => {
                const flair = flairForDecoration(author?.decorations?.badgeId);
                return flair ? (
                  <ShopFlairBadge emoji={flair.emoji} />
                ) : null;
              })()}
              <span className="truncate text-muted-foreground">
                @{author?.username || "user"}
              </span>
              {time ? (
                <>
                  <span className="text-muted-foreground">·</span>
                  <span className="text-muted-foreground">{time}</span>
                </>
              ) : null}
            </div>

            <div className="relative" onClick={(e) => e.stopPropagation()}>
              <button
                onClick={() => setMenuOpen((v) => !v)}
                className="rounded-full p-1.5 text-muted-foreground transition hover:bg-primary/10 hover:text-primary"
              >
                <MoreHorizontal className="h-4 w-4" />
              </button>
              {menuOpen ? (
                <div className="absolute right-0 z-20 mt-1 w-44 overflow-hidden rounded-xl border border-border bg-card py-1 shadow-soft">
                  {user?.uid === post.authorId ? (
                    <>
                      <button
                        onClick={() => {
                          setMenuOpen(false);
                          onPin();
                        }}
                        className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-muted"
                      >
                        <Pin className="h-4 w-4" /> Pin
                      </button>
                      <button
                        onClick={() => {
                          setMenuOpen(false);
                          onDelete();
                        }}
                        className="flex w-full items-center gap-2 px-3 py-2 text-sm text-destructive hover:bg-muted"
                      >
                        <Trash2 className="h-4 w-4" /> Delete
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => {
                          setMenuOpen(false);
                          setQuoteOpen(true);
                        }}
                        className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-muted"
                      >
                        <Quote className="h-4 w-4" /> Quote
                      </button>
                      <button
                        onClick={async () => {
                          setMenuOpen(false);
                          if (!user) return;
                          try {
                            await muteUser(user.uid, post.authorId);
                            toast.success("User muted");
                          } catch {
                            toast.error("Could not mute");
                          }
                        }}
                        className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-muted"
                      >
                        <VolumeX className="h-4 w-4" /> Mute user
                      </button>
                      <button
                        onClick={async () => {
                          setMenuOpen(false);
                          if (!user) return;
                          try {
                            await blockUser(user.uid, post.authorId);
                            toast.success("User blocked");
                            onChange?.({ ...post, isDeleted: true });
                          } catch {
                            toast.error("Could not block");
                          }
                        }}
                        className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-muted"
                      >
                        <Ban className="h-4 w-4" /> Block user
                      </button>
                      <button
                        onClick={async () => {
                          setMenuOpen(false);
                          if (!user) return toast.error("Sign in to report");
                          try {
                            await createReport({
                              reporterId: user.uid,
                              targetType: "post",
                              targetId: post.id,
                              reason: "spam_or_abuse",
                              details: "Reported from post menu",
                            });
                            toast.success("Report submitted");
                          } catch {
                            toast.error("Could not report");
                          }
                        }}
                        className="flex w-full items-center gap-2 px-3 py-2 text-sm text-destructive hover:bg-muted"
                      >
                        Report post
                      </button>
                    </>
                  )}
                </div>
              ) : null}
            </div>
          </div>

          {post.text ? (
            <p
              className={cn(
                "mt-1 whitespace-pre-wrap break-words leading-relaxed",
                compact ? "text-sm" : "text-[15px]",
                disableNavigate && "text-lg"
              )}
            >
              {post.text.split(/(\s+)/).map((part, i) => {
                if (part.startsWith("#")) {
                  return (
                    <Link
                      key={i}
                      href={`/explore?q=${encodeURIComponent(part)}`}
                      onClick={(e) => e.stopPropagation()}
                      className="text-primary hover:underline"
                    >
                      {part}
                    </Link>
                  );
                }
                if (part.startsWith("@")) {
                  return (
                    <Link
                      key={i}
                      href={profilePath(part.slice(1))}
                      onClick={(e) => e.stopPropagation()}
                      className="text-primary hover:underline"
                    >
                      {part}
                    </Link>
                  );
                }
                return <span key={i}>{part}</span>;
              })}
            </p>
          ) : null}

          {post.media?.length > 0 ? (
            <div
              className={cn(
                "mt-3 grid gap-1 overflow-hidden rounded-2xl border border-border",
                post.media.length === 1 ? "grid-cols-1" : "grid-cols-2"
              )}
              onClick={(e) => e.stopPropagation()}
            >
              {post.media.map((m, i) =>
                m.type === "video" ? (
                  <video
                    key={i}
                    src={m.url}
                    controls
                    className="max-h-80 w-full bg-black object-contain"
                  />
                ) : (
                  <div key={i} className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={m.url}
                      alt=""
                      className="max-h-80 w-full cursor-zoom-in object-cover transition hover:brightness-95"
                      onClick={() => {
                        setLightboxIndex(i);
                        setLightbox(true);
                      }}
                    />
                    {m.type === "gif" ? (
                      <span className="absolute left-2 top-2 rounded bg-black/75 px-1.5 py-0.5 text-[10px] font-bold text-white">
                        GIF
                      </span>
                    ) : null}
                  </div>
                )
              )}
            </div>
          ) : null}

          {post.poll ? (
            <div
              className="mt-3 space-y-2 rounded-2xl border border-border p-3"
              onClick={(e) => e.stopPropagation()}
            >
              {post.poll.options.map((opt) => {
                const total =
                  post.poll!.options.reduce((s, o) => s + o.votes, 0) || 1;
                const pct = Math.round((opt.votes / total) * 100);
                return (
                  <button
                    type="button"
                    key={opt.id}
                    className="relative w-full overflow-hidden rounded-xl border border-border px-3 py-2 text-left transition hover:border-primary/40"
                    onClick={async () => {
                      if (!user) return toast.error("Sign in to vote");
                      try {
                        const updated = await votePoll(
                          post.id,
                          user.uid,
                          opt.id
                        );
                        if (updated) onChange?.(updated);
                        else toast.success("Vote recorded");
                      } catch (e) {
                        toast.error(
                          e instanceof Error ? e.message : "Could not vote"
                        );
                      }
                    }}
                  >
                    <div
                      className="absolute inset-y-0 left-0 bg-primary/15"
                      style={{ width: `${pct}%` }}
                    />
                    <div className="relative flex justify-between text-sm font-medium">
                      <span>{opt.text}</span>
                      <span className="text-muted-foreground">{pct}%</span>
                    </div>
                  </button>
                );
              })}
              <p className="text-[11px] text-muted-foreground">
                Tap an option to vote ·{" "}
                {post.poll.options.reduce((s, o) => s + o.votes, 0)} votes
              </p>
            </div>
          ) : null}

          {post.quotedPost ? (
            <div
              className="mt-3 overflow-hidden rounded-2xl border border-border transition hover:bg-muted/40"
              onClick={(e) => {
                e.stopPropagation();
                router.push(postPath(post.quotedPost!.id));
              }}
            >
              <div className="p-3">
                <div className="mb-1 flex items-center gap-1.5 text-sm">
                  <UserAvatar
                    user={post.quotedPost.author}
                    size="sm"
                    className="h-5 w-5"
                  />
                  <span className="font-semibold">
                    {post.quotedPost.author?.displayName}
                  </span>
                  <span className="text-muted-foreground">
                    @{post.quotedPost.author?.username}
                  </span>
                </div>
                <p className="line-clamp-4 text-sm">{post.quotedPost.text}</p>
              </div>
            </div>
          ) : null}

          <div
            className="mt-3 flex max-w-md items-center justify-between text-muted-foreground"
            onClick={(e) => e.stopPropagation()}
          >
            <ActionBtn
              onClick={() => {
                if (disableNavigate) setReplyOpen(true);
                else router.push(postPath(post.id));
              }}
              label="Reply"
              count={post.repliesCount}
              hover="hover:text-primary"
            >
              <MessageCircle className="h-[18px] w-[18px]" />
            </ActionBtn>
            <ActionBtn
              onClick={onRepost}
              label="Repost"
              count={repostCount}
              active={reposted}
              activeClass="text-repost"
              hover="hover:text-repost"
            >
              <Repeat2 className="h-[18px] w-[18px]" />
            </ActionBtn>
            <ActionBtn
              onClick={onLike}
              label="Like"
              count={likeCount}
              active={liked}
              activeClass="text-like"
              hover="hover:text-like"
              className={likeAnim ? "like-burst" : ""}
            >
              <Heart
                className={cn(
                  "h-[18px] w-[18px]",
                  liked && "fill-like text-like"
                )}
              />
            </ActionBtn>
            <ActionBtn
              onClick={onBookmark}
              label="Bookmark"
              active={bookmarked}
              activeClass="text-primary"
              hover="hover:text-primary"
            >
              <Bookmark
                className={cn(
                  "h-[18px] w-[18px]",
                  bookmarked && "fill-primary text-primary"
                )}
              />
            </ActionBtn>
            <ActionBtn onClick={onShare} label="Share" hover="hover:text-primary">
              <Share2 className="h-[18px] w-[18px]" />
            </ActionBtn>
          </div>
        </div>
      </div>

      <Dialog open={replyOpen} onOpenChange={setReplyOpen}>
        <DialogContent className="max-w-lg p-0" onClick={(e) => e.stopPropagation()}>
          <DialogHeader className="border-b border-border px-4 py-3">
            <DialogTitle>Reply</DialogTitle>
          </DialogHeader>
          <div className="p-4">
            <ComposeBox
              parentId={post.id}
              placeholder="Post your reply"
              autofocus
              onSuccess={() => {
                setReplyOpen(false);
                onChange?.({
                  ...post,
                  repliesCount: post.repliesCount + 1,
                });
              }}
            />
          </div>
        </DialogContent>
      </Dialog>

      <MediaLightbox
        open={lightbox}
        urls={post.media?.filter((m) => m.type !== "video").map((m) => m.url) || []}
        index={lightboxIndex}
        onClose={() => setLightbox(false)}
        onIndex={setLightboxIndex}
      />

      <QuoteDialog
        open={quoteOpen}
        onOpenChange={setQuoteOpen}
        post={post}
      />
    </motion.article>
  );
}

function ActionBtn({
  children,
  onClick,
  label,
  count,
  active,
  activeClass,
  hover,
  className,
}: {
  children: React.ReactNode;
  onClick: (e: React.MouseEvent) => void;
  label: string;
  count?: number;
  active?: boolean;
  activeClass?: string;
  hover?: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={(e) => {
        e.stopPropagation();
        onClick(e);
      }}
      className={cn(
        "group flex items-center gap-1 rounded-full text-[13px] transition-colors",
        hover,
        active && activeClass,
        className
      )}
    >
      <span className="rounded-full p-1.5 transition-colors group-hover:bg-current/10">
        {children}
      </span>
      {typeof count === "number" && count > 0 ? (
        <span className="tabular-nums">{formatCount(count)}</span>
      ) : null}
    </button>
  );
}
