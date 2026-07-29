"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Calendar, Loader2, MapPin, Users } from "lucide-react";
import { format, parseISO } from "date-fns";
import { useAuth } from "@/contexts/auth-context";
import {
  getEvent,
  isAttending,
  joinEvent,
  leaveEvent,
  getAttendees,
  type FluxEvent,
} from "@/services/events";
import type { PostWithAuthor, UserProfile } from "@/types";
import { Button } from "@/components/ui/button";
import { ComposeBox } from "@/components/posts/compose-box";
import { PostCard } from "@/components/posts/post-card";
import { UserAvatar } from "@/components/shared/user-avatar";
import { EmptyState } from "@/components/shared/empty-state";
import { toast } from "sonner";
import {
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { getPost } from "@/services/posts";

export default function EventDetailPage(
  { eventIdOverride }: { eventIdOverride?: string } = {}
) {
  const params = useParams();
  const eventId = eventIdOverride || String(params.eventId || "");
  const { user } = useAuth();
  const router = useRouter();
  const [event, setEvent] = useState<FluxEvent | null>(null);
  const [attending, setAttending] = useState(false);
  const [attendees, setAttendees] = useState<UserProfile[]>([]);
  const [posts, setPosts] = useState<PostWithAuthor[]>([]);
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const ev = await getEvent(eventId);
      setEvent(ev);
      if (user) setAttending(await isAttending(eventId, user.uid));
      setAttendees(await getAttendees(eventId));
      try {
        const snap = await getDocs(
          query(
            collection(db, "posts"),
            where("eventId", "==", eventId),
            orderBy("createdAt", "desc"),
            limit(30)
          )
        );
        const list = await Promise.all(
          snap.docs.map((d) => getPost(d.id, user?.uid))
        );
        setPosts(list.filter(Boolean) as PostWithAuthor[]);
      } catch {
        const snap = await getDocs(
          query(
            collection(db, "posts"),
            where("eventId", "==", eventId),
            limit(30)
          )
        );
        const list = await Promise.all(
          snap.docs.map((d) => getPost(d.id, user?.uid))
        );
        setPosts(list.filter(Boolean) as PostWithAuthor[]);
      }
    } finally {
      setLoading(false);
    }
  }, [eventId, user, refresh]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!event) {
    return (
      <EmptyState
        icon={Calendar}
        title="Event not found"
        description="This event may have been removed."
      />
    );
  }

  let when = event.startAt;
  try {
    when = format(parseISO(event.startAt), "EEEE, MMM d · h:mm a");
  } catch {
    /* raw */
  }

  const toggle = async () => {
    if (!user) return;
    try {
      if (attending) {
        await leaveEvent(eventId, user.uid);
        setAttending(false);
        toast.success("Left event");
      } else {
        await joinEvent(eventId, user.uid);
        setAttending(true);
        toast.success("You're going!");
      }
      setRefresh((k) => k + 1);
    } catch {
      toast.error("Could not update RSVP");
    }
  };

  return (
    <div className="min-h-screen">
      <header className="relative z-20 lg:sticky lg:top-0 lg:z-30 flex items-center gap-3 glass border-b border-border px-4 py-2">
        <button
          onClick={() => router.push("/events")}
          className="rounded-full p-2 hover:bg-muted"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="truncate text-lg font-bold">{event.title}</h1>
      </header>

      <div className="space-y-4 border-b border-border p-4">
        <p className="text-sm font-medium text-primary">{when}</p>
        <h2 className="text-2xl font-bold tracking-tight">{event.title}</h2>
        <p className="text-[15px] leading-relaxed text-muted-foreground">
          {event.description}
        </p>
        {event.location ? (
          <p className="inline-flex items-center gap-1.5 text-sm">
            <MapPin className="h-4 w-4 text-primary" />
            {event.location}
          </p>
        ) : null}
        <div className="flex items-center justify-between">
          <p className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
            <Users className="h-4 w-4" />
            {event.attendeeCount} going
          </p>
          <Button
            variant={attending ? "outline" : "default"}
            onClick={toggle}
          >
            {attending ? "Cancel RSVP" : "Join event"}
          </Button>
        </div>
        <div className="flex -space-x-2">
          {attendees.slice(0, 8).map((a) => (
            <UserAvatar key={a.uid} user={a} size="sm" className="ring-2 ring-card" />
          ))}
        </div>
      </div>

      <div className="border-b border-border p-4">
        <p className="mb-3 text-sm font-semibold">Discussion</p>
        <ComposeBox
          eventId={eventId}
          placeholder="Share something about this event…"
          onSuccess={() => setRefresh((k) => k + 1)}
        />
      </div>

      {posts.length === 0 ? (
        <EmptyState
          icon={Calendar}
          title="No discussion yet"
          description="Start the conversation about this event."
        />
      ) : (
        posts.map((p) => <PostCard key={p.id} post={p} />)
      )}
    </div>
  );
}
