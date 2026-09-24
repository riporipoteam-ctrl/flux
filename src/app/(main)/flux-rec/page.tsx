"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Camera,
  Flame,
  Gamepad2,
  Heart,
  Link2,
  Lock,
  Play,
  Sparkles,
  Trophy,
  Users,
  X,
} from "lucide-react";
import { XHeader, XPage } from "@/components/x/x-ui";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import {
  fetchFluxRecRooms,
  formatCompact,
  type FluxRecRoom,
} from "@/data/flux-rec-rooms";

function RoomCard({ room, onOpen }: { room: FluxRecRoom; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="fluxrec-room-card group text-left"
      aria-label={`Open ${room.name}`}
    >
      <div className="fluxrec-room-thumb" style={{ background: room.gradient }}>
        <span className="fluxrec-room-players">
          <Users className="h-3.5 w-3.5" />
          {room.playersNow}
        </span>
        {room.isRRO ? <span className="fluxrec-room-rro">RRO</span> : null}
        <span className="fluxrec-room-play">
          <Play className="h-5 w-5 fill-current" />
        </span>
      </div>
      <div className="fluxrec-room-body">
        <h3>{room.name}</h3>
        <p className="fluxrec-room-stats">
          <span><Trophy className="h-3 w-3" /> {formatCompact(room.visits)} visits</span>
          <span><Heart className="h-3 w-3" /> {formatCompact(room.cheers)}</span>
        </p>
      </div>
    </button>
  );
}

function RoomDetail({ room, onClose }: { room: FluxRecRoom; onClose: () => void }) {
  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="flux8-dialog max-h-[92dvh] max-w-2xl overflow-y-auto p-0">
        <DialogTitle className="sr-only">{room.name}</DialogTitle>
        <div className="fluxrec-detail-hero" style={{ background: room.gradient }}>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close room details"
            className="fluxrec-detail-close"
          >
            <X className="h-5 w-5" />
          </button>
          <div className="fluxrec-detail-hero-text">
            <h2>{room.name}</h2>
            <p>
              <span className="fluxrec-live-dot" /> {room.playersNow} playing now
            </p>
          </div>
        </div>
        <div className="p-5">
          <p className="text-[15px] leading-6 text-foreground/90">{room.description}</p>

          <div className="fluxrec-detail-stats">
            <div><Trophy className="h-4 w-4 text-amber-500" /><strong>{formatCompact(room.visits)}</strong><span>Visits</span></div>
            <div><Heart className="h-4 w-4 text-rose-500" /><strong>{formatCompact(room.cheers)}</strong><span>Cheers</span></div>
            <div><Users className="h-4 w-4 text-sky-500" /><strong>{room.playersNow}/{room.maxPlayers}</strong><span>In room</span></div>
          </div>

          {room.tags.length > 0 ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {room.tags.map((t) => (
                <span key={t} className="fluxrec-tag">{t}</span>
              ))}
            </div>
          ) : null}

          <h3 className="fluxrec-section-title"><Camera className="h-4 w-4" /> Room photos</h3>
          {room.photos.length === 0 ? (
            <p className="fluxrec-empty">No photos yet — be the first to snap one in game.</p>
          ) : (
            <div className="fluxrec-photo-grid">
              {room.photos.map((p) => (
                <figure key={p.id} className="fluxrec-photo" style={{ background: p.gradient }}>
                  <figcaption>
                    <strong>{p.caption}</strong>
                    <span>{p.author}</span>
                  </figcaption>
                </figure>
              ))}
            </div>
          )}

          <button type="button" className="fluxrec-play-btn" disabled>
            <Gamepad2 className="h-5 w-5" /> Open in Flux Rec
          </button>
          <p className="fluxrec-note">Link your Flux Rec account to jump straight into rooms from here.</p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function FluxRecPage() {
  const [rooms, setRooms] = useState<FluxRecRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<FluxRecRoom | null>(null);

  useEffect(() => {
    let alive = true;
    fetchFluxRecRooms().then((r) => {
      if (alive) { setRooms(r); setLoading(false); }
    });
    return () => { alive = false; };
  }, []);

  const totalPlayers = rooms.reduce((n, r) => n + r.playersNow, 0);

  return (
    <XPage className="fluxrec-page">
      <XHeader
        title="Flux Rec"
        subtitle="Rooms, photos and your game account"
        icon={Gamepad2}
        hideOnMobile
      />

      {/* Hero */}
      <section className="fluxrec-hero">
        <div className="fluxrec-hero-thumb" aria-hidden>
          <span className="fluxrec-hero-logo">FR</span>
          <span className="fluxrec-hero-glow" />
        </div>
        <div className="fluxrec-hero-text">
          <p className="fluxrec-hero-kicker"><Sparkles className="h-3.5 w-3.5" /> The private Rec Room revival</p>
          <h1>Welcome to Flux Rec</h1>
          <p>
            Flux Rec is Ripo Team&apos;s private revival of Rec Room — the social hangout,
            the games, the maker pen chaos, all running on our own servers. Browse live
            rooms, check out photos players snapped in game, and link your account to
            jump in from right here.
          </p>
          <div className="fluxrec-hero-actions">
            <Link href="/settings?link=fluxrec" className="fluxrec-connect-btn">
              <Link2 className="h-4 w-4" /> Connect Flux Rec account
            </Link>
            <span className="fluxrec-hero-live"><Flame className="h-4 w-4" /> {loading ? "…" : `${formatCompact(totalPlayers)} in game now`}</span>
          </div>
        </div>
      </section>

      {/* Rooms */}
      <section>
        <div className="fluxrec-rooms-head">
          <h2>Rooms</h2>
          <span>{loading ? "Loading…" : `${rooms.length} rooms`}</span>
        </div>
        {loading ? (
          <div className="fluxrec-rooms-grid">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="fluxrec-room-card"><div className="fluxrec-skeleton-thumb" /><div className="fluxrec-skeleton-line" /></div>
            ))}
          </div>
        ) : (
          <div className="fluxrec-rooms-grid">
            {rooms.map((room) => (
              <RoomCard key={room.id} room={room} onOpen={() => setSelected(room)} />
            ))}
          </div>
        )}
      </section>

      {/* Coming soon strip */}
      <section className="fluxrec-link-strip">
        <Lock className="h-4 w-4" />
        <p>
          <strong>Photos you take in game</strong> will appear on your profile —
          public shots on your public grid, private ones only for you.
        </p>
        <Link href="/settings?link=fluxrec">Link account</Link>
      </section>

      {selected ? <RoomDetail room={selected} onClose={() => setSelected(null)} /> : null}
    </XPage>
  );
}
