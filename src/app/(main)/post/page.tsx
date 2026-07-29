"use client";

import { useEffect, useState } from "react";
import PostDetailPage from "./[postId]/page-client";
import { LoadingScreen } from "@/components/shared/loading-screen";

export default function StaticPostPage() {
  const [postId, setPostId] = useState<string | null>(null);

  useEffect(() => {
    setPostId(new URLSearchParams(window.location.search).get("postId")?.trim() || "");
  }, []);

  if (postId === null) return <LoadingScreen label="Opening post…" />;
  return <PostDetailPage postIdOverride={postId} />;
}
