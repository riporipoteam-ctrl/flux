"use client";

import { useEffect, useState } from "react";
import GroupDetailPage from "../groups/[groupId]/page-client";
import { LoadingScreen } from "@/components/shared/loading-screen";

export default function StaticGroupPage() {
  const [groupId, setGroupId] = useState<string | null>(null);

  useEffect(() => {
    setGroupId(new URLSearchParams(window.location.search).get("groupId")?.trim() || "");
  }, []);

  if (groupId === null) return <LoadingScreen label="Opening group…" />;
  return <GroupDetailPage groupIdOverride={groupId} />;
}
