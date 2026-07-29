"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { FluxPlaysWorld } from "@/components/game/flux-plays-world";
import { LoadingScreen } from "@/components/shared/loading-screen";
import { useAuth } from "@/contexts/auth-context";
import { getFluxPlayGame, type FluxPlayGame } from "@/services/flux-plays";

export default function FluxPlayPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, profile, loading: authLoading } = useAuth();
  const [game, setGame] = useState<FluxPlayGame | null>(null);
  const [loading, setLoading] = useState(true);
  const gameId = searchParams.get("gameId") || "flux-world";

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    let cancelled = false;
    setLoading(true);
    getFluxPlayGame(gameId)
      .then((result) => {
        if (cancelled) return;
        if (!result) router.replace("/games");
        else setGame(result);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [authLoading, gameId, router, user]);

  if (authLoading || loading || !profile || !game) {
    return <LoadingScreen label="Preparing Flux Plays…" />;
  }

  return <FluxPlaysWorld game={game} />;
}
