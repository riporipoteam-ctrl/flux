"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Gamepad2 } from "lucide-react";
import ProfilePage from "../[username]/page-client";
import { LoadingScreen } from "@/components/shared/loading-screen";
import { useAuth } from "@/contexts/auth-context";
import { profileGamesPath } from "@/lib/routes";

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
  return (
    <div className="relative">
      <ProfilePage usernameOverride={username} />
      {username ? (
        <Link
          href={profileGamesPath(username)}
          className="fixed bottom-[calc(5.5rem+env(safe-area-inset-bottom))] right-4 z-40 inline-flex h-11 items-center gap-2 rounded-full border border-border bg-background/95 px-4 text-sm font-bold shadow-lg backdrop-blur transition hover:bg-muted sm:bottom-6 sm:right-6"
          aria-label="Open game captures"
        >
          <Gamepad2 className="h-4 w-4 text-primary" />
          Game captures
        </Link>
      ) : null}
    </div>
  );
}
