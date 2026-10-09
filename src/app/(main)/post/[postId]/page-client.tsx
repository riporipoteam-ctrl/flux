"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowLeft, Loader2, MessageCircle } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { getPost, getReplies } from "@/services/posts";
import type { PostWithAuthor } from "@/types";
import { PostCard } from "@/components/posts/post-card";
import { ComposeBox } from "@/components/posts/compose-box";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";

export default function PostDetailPage(
  { postIdOverride }: { postIdOverride?: string } = {}
) {
  const params = useParams();
  const postId = postIdOverride || String(params.postId || "");
  const { user } = useAuth();
  const router = useRouter();

  const [post, setPost] = useState<PostWithAuthor | null>(null);
  const [replies, setReplies] = useState<PostWithAuthor[]>([]);
  const [loading, setLoading] = useState(true);
  const [replyLoading, setReplyLoading] = useState(false);

  const load = useCallback(async () => {
    if (!postId) return;
    setLoading(true);
    try {
      const [p, r] = await Promise.all([
        getPost(postId, user?.uid),
        getReplies(postId, user?.uid),
      ]);
      setPost(p);
      setReplies(r);
    } catch (e) {
      console.error(e);
      setPost(null);
      setReplies([]);
    } finally {
      setLoading(false);
    }
  }, [postId, user?.uid]);

  useEffect(() => {
    load();
  }, [load]);

  // A new reply appears instantly at the top of the thread — no full-page reload.
  const handleReplySuccess = useCallback(async (newReplyId: string) => {
    setPost((p) =>
      p ? { ...p, repliesCount: p.repliesCount + 1 } : p
    );
    setReplyLoading(true);
    try {
      const reply = await getPost(newReplyId, user?.uid);
      if (reply) {
        setReplies((prev) =>
          prev.some((r) => r.id === reply.id) ? prev : [reply, ...prev]
        );
      }
    } catch (e) {
      console.error(e);
    } finally {
      setReplyLoading(false);
    }
  }, [user?.uid]);

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!post) {
    return (
      <EmptyState
        icon={MessageCircle}
        title="Post not found"
        description="This post may have been deleted or the link is invalid."
        action={
          <Button variant="outline" onClick={() => router.push("/home")}>
            Back to Home
          </Button>
        }
      />
    );
  }

  return (
    <div className="min-h-screen">
      <header className="x-header">
        <button
          onClick={() => router.back()}
          className="rounded-full p-2 transition hover:bg-muted"
          aria-label="Back"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-lg font-bold">Post</h1>
          <p className="text-xs text-muted-foreground">
            {post.repliesCount} {post.repliesCount === 1 ? "reply" : "replies"}
          </p>
        </div>
      </header>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <PostCard
          post={post}
          disableNavigate
          onChange={(updated) => {
            if (updated.isDeleted) {
              router.push("/home");
              return;
            }
            setPost(updated);
          }}
        />

        <div className="xxreply-composer">
          <p className="xxreply-composer-title">
            Reply to @{post.author?.username || "user"}
          </p>
          <ComposeBox
            parentId={post.id}
            placeholder="Post your reply"
            onSuccess={handleReplySuccess}
          />
        </div>

        <div className="xxthread">
          <div className="xxthread-header">
            <h2>
              Comments & replies
              {replies.length > 0 ? (
                <span className="xxthread-count">({replies.length})</span>
              ) : null}
            </h2>
          </div>

          {replyLoading && replies.length === 0 ? (
            <div className="xxthread-loading">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : replies.length === 0 ? (
            <EmptyState
              icon={MessageCircle}
              title="No replies yet"
              description="Be the first to comment on this post."
            />
          ) : (
            replies.map((reply) => (
              <PostCard
                key={reply.id}
                post={reply}
                compact
                onChange={(updated) => {
                  if (updated.isDeleted) {
                    setReplies((prev) =>
                      prev.filter((r) => r.id !== updated.id)
                    );
                    setPost((p) =>
                      p
                        ? {
                            ...p,
                            repliesCount: Math.max(0, p.repliesCount - 1),
                          }
                        : p
                    );
                  } else {
                    setReplies((prev) =>
                      prev.map((r) => (r.id === updated.id ? updated : r))
                    );
                  }
                }}
              />
            ))
          )}
        </div>
      </motion.div>
    </div>
  );
}
