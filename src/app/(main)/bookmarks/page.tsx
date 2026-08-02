"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Bookmark, Search } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { getBookmarkedPosts } from "@/services/posts";
import type { PostWithAuthor } from "@/types";
import { PostCard } from "@/components/posts/post-card";
import { XEmpty, XHeader, XPage, XRowSkeleton } from "@/components/x/x-ui";

export default function BookmarksPage() {
  const { user, profile } = useAuth();
  const [posts, setPosts] = useState<PostWithAuthor[]>([]);
  const [loading, setLoading] = useState(true);
  const [term, setTerm] = useState("");

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      setPosts(await getBookmarkedPosts(user.uid, user.uid));
    } catch {
      setPosts([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  const visible = useMemo(() => {
    const needle = term.trim().toLowerCase();
    if (!needle) return posts;
    return posts.filter(
      (post) =>
        post.text?.toLowerCase().includes(needle) ||
        post.author?.displayName?.toLowerCase().includes(needle) ||
        post.author?.username?.toLowerCase().includes(needle)
    );
  }, [posts, term]);

  return (
    <XPage>
      <XHeader
        title="Bookmarks"
        subtitle={profile?.username ? `@${profile.username}` : "Saved for later"}
        icon={Bookmark}
        hideOnMobile
      />

      <div className="border-b border-[var(--v8-line)] p-3">
        <label className="flux8-rail-search !static">
          <Search className="h-[18px] w-[18px] flex-none" />
          <input
            value={term}
            onChange={(event) => setTerm(event.target.value)}
            placeholder="Search Bookmarks"
            aria-label="Search bookmarks"
          />
        </label>
      </div>

      {loading ? (
        <XRowSkeleton rows={5} />
      ) : visible.length === 0 ? (
        <XEmpty
          icon={Bookmark}
          title={term ? "No matching bookmarks" : "Save posts for later"}
          description={
            term
              ? "Try a different word, or clear the search to see everything you saved."
              : "Tap the bookmark icon on any post and it will be waiting for you here."
          }
        />
      ) : (
        <div className="x-stagger">
          {visible.map((post, index) => (
            <div key={post.id} className="flux8-post-wrap" style={{ ["--i" as string]: Math.min(index, 12) }}>
              <PostCard
                post={post}
                onChange={(updated) => {
                  if (!updated.bookmarkedByMe || updated.isDeleted) {
                    setPosts((previous) => previous.filter((item) => item.id !== updated.id));
                  }
                }}
              />
            </div>
          ))}
        </div>
      )}
    </XPage>
  );
}
