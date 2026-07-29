"use client";

import { useEffect, useState } from "react";
import EventDetailPage from "../events/[eventId]/page-client";
import { LoadingScreen } from "@/components/shared/loading-screen";

export default function StaticEventPage() {
  const [eventId, setEventId] = useState<string | null>(null);

  useEffect(() => {
    setEventId(new URLSearchParams(window.location.search).get("eventId")?.trim() || "");
  }, []);

  if (eventId === null) return <LoadingScreen label="Opening event…" />;
  return <EventDetailPage eventIdOverride={eventId} />;
}
