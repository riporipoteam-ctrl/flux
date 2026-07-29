"use client";

import { useEffect, useState } from "react";
import ProfilePage from "../[username]/page-client";
import { LoadingScreen } from "@/components/shared/loading-screen";
import { useAuth } from "@/contexts/auth-context";

export default function StaticProfilePage() {
  const { profile } = useAuth();
  const [queryUsername, setQueryUsername] = useState<string | null>(null);

  useEffect(() => {
    const value = new URLSearchParams(window.location.search).get("username");
    setQueryUsername(value?.trim() || "");
  }, []);

  if (queryUsername === null) {
    return <LoadingScreen label="Opening profile…" />;
  }

  const username = queryUsername || profile?.username || "";
  return <ProfilePage usernameOverride={username} />;
}
