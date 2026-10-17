"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  Eye,
  Radio,
  RefreshCw,
  Search,
  Video,
} from "lucide-react";
import { type FluxLiveStream } from "@/services/live";
import { subscribeLiveDirectory } from "@/services/live-directory";
import { UserAvatar } from "@/components/shared/user-avatar";
import { XEmpty, XHeader, XPage } from "@/components/x/x-ui";

export default function LivePage() {
  const [streams, setStreams] = useState<FluxLiveStream[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [query, setQuery] = useState("");
  const [attempt, setAttempt] = useState(0);
  const totalViewers = useMemo(
    () =>
      streams.reduce(
        (sum, stream) => sum + Math.max(0, Number(stream.viewersCount || 0)),
        0,
      ),
    [streams],
  );
  const visible = useMemo(
    () =>
      streams.filter((stream) =>
        `${stream.title} ${stream.host?.displayName || ""} ${stream.category}`
          .toLowerCase()
          .includes(query.trim().toLowerCase()),
      ),
    [streams, query],
  );

  useEffect(() => {
    setLoading(true);
    const unsubscribe = subscribeLiveDirectory(
      (next) => {
        setStreams(next);
        setLoading(false);
        setError(false);
      },
      () => {
        setLoading(false);
        setError(true);
      },
    );
    return unsubscribe;
  }, [attempt]);

  return (
    <XPage className="flux-live-directory">
      <XHeader
        title="Live"
        subtitle="Good conversations, happening right now."
        actions={
          <Link href="/live/create" className="x-btn">
            <Video size={16} /> Go live
          </Link>
        }
      />
      <div className="flux-live-toolbar">
        <div>
          <span className="flux-live-indicator" />{" "}
          <strong>{streams.length}</strong> live <span>·</span>{" "}
          <Eye size={15} /> <strong>{totalViewers}</strong> watching
        </div>
        <label>
          <Search size={17} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Find a broadcast"
            aria-label="Find a broadcast"
          />
        </label>
      </div>
      {loading ? (
        <div
          className="flux-broadcast-grid"
          aria-label="Loading broadcasts"
          aria-busy="true"
        >
          {Array.from({ length: 4 }, (_, index) => (
            <div key={index} className="skeleton aspect-video rounded-xl" />
          ))}
        </div>
      ) : error ? (
        <XEmpty
          icon={RefreshCw}
          title="Let’s reconnect"
          description="We couldn’t reach the live directory. Try again to see who’s on air."
          action={
            <button
              className="x-btn"
              onClick={() => setAttempt((value) => value + 1)}
            >
              Try again
            </button>
          }
        />
      ) : !streams.length ? (
        <XEmpty
          icon={Radio}
          title="Make a little noise."
          description="It’s quiet here right now. Start a broadcast and bring your people together."
          action={
            <Link href="/live/create" className="x-btn">
              Start broadcasting <ArrowUpRight size={16} />
            </Link>
          }
        />
      ) : !visible.length ? (
        <XEmpty
          icon={Search}
          title="No broadcasts found"
          description="Try another name, topic, or category."
          action={
            <button className="x-btn x-btn-hollow" onClick={() => setQuery("")}>
              Clear search
            </button>
          }
        />
      ) : (
        <div className="flux-broadcast-grid">
          {visible.map((stream) => (
            <Link
              key={stream.id}
              href={`/live/view?id=${encodeURIComponent(stream.id)}`}
              className="flux-broadcast-card"
            >
              <div className="flux-broadcast-preview">
                <Video size={40} />
                <span>LIVE</span>
                <small>
                  <Eye size={13} /> {stream.viewersCount}
                </small>
              </div>
              <div className="flux-broadcast-info">
                <UserAvatar user={stream.host} size="sm" clickable={false} />
                <div>
                  <h2>{stream.title}</h2>
                  <p>{stream.host?.displayName || "Flux creator"}</p>
                  <small>{stream.category}</small>
                </div>
                <ArrowUpRight size={17} />
              </div>
            </Link>
          ))}
        </div>
      )}
    </XPage>
  );
}
