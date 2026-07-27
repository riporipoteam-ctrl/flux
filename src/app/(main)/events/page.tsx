"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Calendar, Loader2, MapPin, Plus, Users } from "lucide-react";
import { format, parseISO } from "date-fns";
import { useAuth } from "@/contexts/auth-context";
import {
  createEvent,
  getEvents,
  type FluxEvent,
} from "@/services/events";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { toast } from "sonner";

export default function EventsPage() {
  const { user } = useAuth();
  const [events, setEvents] = useState<FluxEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");
  const [creating, setCreating] = useState(false);

  const load = () =>
    getEvents()
      .then(setEvents)
      .finally(() => setLoading(false));

  useEffect(() => {
    load();
  }, []);

  const onCreate = async () => {
    if (!user || !title.trim() || !startAt) return;
    setCreating(true);
    try {
      const id = await createEvent({
        hostId: user.uid,
        title,
        description,
        location,
        startAt,
        endAt: endAt || startAt,
      });
      toast.success("Event created");
      setOpen(false);
      setTitle("");
      setDescription("");
      await load();
      // soft navigate path available
      void id;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 flex items-center justify-between glass border-b border-border px-4 py-3">
        <h1 className="text-lg font-bold">Events</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="h-4 w-4" />
              Create
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>New event</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Title</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Description</Label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Location / link</Label>
                <Input
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="Venue or Zoom link"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <Label>Starts</Label>
                  <Input
                    type="datetime-local"
                    value={startAt}
                    onChange={(e) => setStartAt(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Ends</Label>
                  <Input
                    type="datetime-local"
                    value={endAt}
                    onChange={(e) => setEndAt(e.target.value)}
                  />
                </div>
              </div>
              <Button className="w-full" loading={creating} onClick={onCreate}>
                Create event
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </header>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : events.length === 0 ? (
        <EmptyState
          icon={Calendar}
          title="No events yet"
          description="Host a meetup, AMA, or watch party."
        />
      ) : (
        <motion.ul
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="divide-y divide-border"
        >
          {events.map((ev) => {
            let when = ev.startAt;
            try {
              when = format(parseISO(ev.startAt), "MMM d · h:mm a");
            } catch {
              /* keep raw */
            }
            return (
              <li key={ev.id}>
                <Link
                  href={`/events/${ev.id}`}
                  className="block px-4 py-4 transition hover:bg-muted/40"
                >
                  <p className="text-xs font-medium text-primary">{when}</p>
                  <h2 className="mt-0.5 text-lg font-bold">{ev.title}</h2>
                  <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                    {ev.description}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
                    {ev.location ? (
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5" />
                        {ev.location}
                      </span>
                    ) : null}
                    <span className="inline-flex items-center gap-1">
                      <Users className="h-3.5 w-3.5" />
                      {ev.attendeeCount} going
                    </span>
                    <span>Hosted by @{ev.host?.username || "user"}</span>
                  </div>
                </Link>
              </li>
            );
          })}
        </motion.ul>
      )}
    </div>
  );
}
