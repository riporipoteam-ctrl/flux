"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Bookmark, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { getBookmarkedPosts } from "@/services/posts";
import type { PostWithAuthor } from "@/types";
import { PostCard } from "@/components/posts/post-card";
import { EmptyState } from "@/components/shared/empty-state";
import { PageTransition } from "@/components/shared/page-transition";

export default function BookmarksPage() {
  const { user } = useAuth();
  const [posts, setPosts] = useState<PostWithAuthor[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      setPosts(await getBookmarkedPosts(user.uid, user.uid));
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="min-h-screen">
      <header className="relative z-20 lg:sticky lg:top-0 lg:z-30 glass-strong border-b border-border/70 px-4 py-3">
        <h1 className="text-lg font-bold tracking-tight">Bookmarks</h1>
        <p className="text-xs text-muted-foreground">Posts you saved for later</p>
      </header>

      <PageTransition>
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : posts.length === 0 ? (
          <EmptyState
            icon={Bookmark}
            title="No bookmarks yet"
            description="Tap the bookmark icon on any post to save it here."
          />
        ) : (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            {posts.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                onChange={(updated) => {
                  if (!updated.bookmarkedByMe || updated.isDeleted) {
                    setPosts((prev) => prev.filter((p) => p.id !== updated.id));
                  }
                }}
              />
            ))}
          </motion.div>
        )}
      </PageTransition>
    </div>
  );
}
