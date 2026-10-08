"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Camera,
  Flame,
  Gamepad2,
  Heart,
  Image as ImageIcon,
  Link2,
  Loader2,
  Play,
  Star,
  Trophy,
  Users,
  X,
} from "lucide-react";
import { XHeader, XPage } from "@/components/x/x-ui";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import {
  fetchFluxRecRooms,
  fetchLinkedPhotos,
  fetchLinkedRooms,
  formatCompact,
  type FluxRecPhoto,
  type FluxRecRoom,
} from "@/data/flux-rec-rooms";
import {
  clearStoredFluxToken,
  exchangePairingCode,
  getFluxSocialMe,
  readStoredFluxToken,
  storeFluxToken,
  unlinkFluxSocial,
  type FluxSocialLinkedAccount,
} from "@/services/fluxrec-pairing";

function RoomCard({ room, onOpen }: { room: FluxRecRoom; onOpen: () => void }) {
  return (
    <button type="button" onClick={onOpen} className="frx-card" aria-label={`Open ${room.name}`}>
      <div className="frx-thumb">
        {room.imageUrl ? (
          <img src={room.imageUrl} alt={room.name} loading="lazy" />
        ) : (
          <div className="frx-thumb-fallback">
            <Gamepad2 className="h-10 w-10 text-white/30" />
          </div>
        )}
        {room.isRRO ? <span className="frx-rro">RRO</span> : null}
        {room.maxPlayers > 0 ? (
          <span className="frx-maxp">
            <Users className="h-3.5 w-3.5" /> up to {room.maxPlayers}
          </span>
        ) : null}
      </div>
      <div className="frx-body">
        <h3>{room.name}</h3>
        <p>{room.description || "A Flux Rec room."}</p>
        <div className="frx-stats">
          <span><Trophy className="h-3.5 w-3.5" /> {formatCompact(room.visits)}</span>
          <span><Heart className="h-3.5 w-3.5" /> {formatCompact(room.cheers)}</span>
        </div>
      </div>
    </button>
  );
}

function RoomDetail({ room, onClose }: { room: FluxRecRoom; onClose: () => void }) {
  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-h-[92dvh] max-w-2xl overflow-y-auto p-0">
        <DialogTitle className="sr-only">{room.name}</DialogTitle>
        <div className="frx-detail-hero">
          {room.imageUrl ? (
            <img src={room.imageUrl} alt={room.name} />
          ) : (
            <div className="frx-thumb-fallback">
              <Gamepad2 className="h-16 w-16 text-white/30" />
            </div>
          )}
          <button type="button" onClick={onClose} aria-label="Close" className="frx-detail-close">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="frx-detail-body">
          <h2>{room.name}</h2>
          {room.isRRO ? <span className="frx-tag" style={{ marginBottom: 10, display: "inline-block" }}>Official RRO room</span> : null}
          <p>{room.description || "A Flux Rec room."}</p>
          <div className="frx-detail-stats">
            <div><strong>{formatCompact(room.visits)}</strong><span>Visits</span></div>
            <div><strong>{formatCompact(room.cheers)}</strong><span>Cheers</span></div>
            <div><strong>{formatCompact(room.favorites)}</strong><span>Favorites</span></div>
            <div><strong>{room.maxPlayers || "–"}</strong><span>Max players</span></div>
          </div>
          {room.tags.length > 0 ? (
            <div className="frx-tags">
              {room.tags.map((t) => (
                <span key={t} className="frx-tag">{t}</span>
              ))}
            </div>
          ) : null}
          <button type="button" className="frx-play-btn" disabled>
            <Play className="h-5 w-5 fill-current" /> Play in Flux Rec
          </button>
          <p className="frx-note">Open Flux Rec on your PC to jump into this room.</p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function PairDialog({
  open,
  onClose,
  onLinked,
}: {
  open: boolean;
  onClose: () => void;
  onLinked: (token: string, account: FluxSocialLinkedAccount) => void;
}) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    setErr(null);
    setBusy(true);
    try {
      const result = await exchangePairingCode(code);
      storeFluxToken(result.token);
      const me = await getFluxSocialMe(result.token);
      onLinked(result.token, me);
      setCode("");
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Linking failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { setCode(""); setErr(null); onClose(); } }}>
      <DialogContent className="max-w-md">
        <DialogTitle>Connect Flux Rec account</DialogTitle>
        <p className="mt-2 text-[15px] leading-6 text-foreground/80">
          In Flux Rec, open <strong>Settings → Connect Flux account</strong> and
          enter the 6-digit code shown there.
        </p>
        <div className="frx-code-row">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            placeholder="••••••"
            inputMode="numeric"
            aria-label="6-digit pairing code"
            onKeyDown={(e) => { if (e.key === "Enter" && code.length === 6 && !busy) void submit(); }}
          />
        </div>
        {err ? <p className="frx-dialog-err">{err}</p> : null}
        <button
          type="button"
          className="frx-play-btn"
          disabled={code.length !== 6 || busy}
          onClick={() => void submit()}
        >
          {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Link2 className="h-5 w-5" />}
          Link accounts
        </button>
      </DialogContent>
    </Dialog>
  );
}

function SkeletonGrid() {
  return (
    <div className="frx-grid">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="frx-skel">
          <div className="frx-skel-thumb" />
          <div style={{ padding: 16 }}>
            <div style={{ height: 18, width: "60%", borderRadius: 6, background: "var(--xx-hover)" }} />
            <div style={{ height: 12, width: "90%", borderRadius: 6, background: "var(--xx-hover)", marginTop: 10 }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function FluxRecPage() {
  const [rooms, setRooms] = useState<FluxRecRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<FluxRecRoom | null>(null);
  const [pairOpen, setPairOpen] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [linked, setLinked] = useState<FluxSocialLinkedAccount | null>(null);
  const [myRooms, setMyRooms] = useState<FluxRecRoom[]>([]);
  const [myPhotos, setMyPhotos] = useState<FluxRecPhoto[]>([]);
  const [mineLoading, setMineLoading] = useState(false);

  useEffect(() => {
    let alive = true;
    fetchFluxRecRooms().then((r) => {
      if (alive) { setRooms(r); setLoading(false); }
    });
    const stored = readStoredFluxToken();
    if (stored) {
      setToken(stored);
      getFluxSocialMe(stored)
        .then((me) => { if (alive) setLinked(me); })
        .catch(() => { clearStoredFluxToken(); if (alive) setToken(null); });
    }
    return () => { alive = false; };
  }, []);

  const loadMine = useCallback(
    async (t: string) => {
      setMineLoading(true);
      try {
        const [r, p] = await Promise.all([fetchLinkedRooms(t), fetchLinkedPhotos(t)]);
        setMyRooms(r);
        setMyPhotos(p);
      } finally {
        setMineLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    if (token && linked) void loadMine(token);
  }, [token, linked, loadMine]);

  const handleLinked = useCallback(
    (t: string, account: FluxSocialLinkedAccount) => {
      setToken(t);
      setLinked(account);
    },
    []
  );

  const handleUnlink = useCallback(async () => {
    if (token) {
      try { await unlinkFluxSocial(token); } catch { /* ignore */ }
    }
    clearStoredFluxToken();
    setToken(null);
    setLinked(null);
    setMyRooms([]);
    setMyPhotos([]);
  }, [token]);

  const totalVisits = rooms.reduce((n, r) => n + r.visits, 0);

  return (
    <XPage className="frx-page">
      <XHeader
        title="Flux Rec"
        subtitle="Rooms, photos and your game account"
        icon={Gamepad2}
        hideOnMobile
      />

      {/* Hero — real Flux Rec logo */}
      <section className="frx-hero">
        <div className="frx-hero-logo">
          <img src="/brand/flux-rec-logo.png" alt="Flux Rec" />
        </div>
        <div className="frx-hero-text">
          <p className="frx-hero-kicker">The private Rec Room revival</p>
          <h1>Welcome to Flux Rec</h1>
          <p>
            Ripo Team&apos;s private revival of Rec Room — the social hangout, the
            games, the maker pen chaos, all running on our own servers. Browse live
            rooms below, and link your game account to see your own rooms and photos
            right here.
          </p>
          <div className="frx-hero-actions">
            {linked ? (
              <span className="frx-linked">
                <span className="dot" />
                Linked as {linked.displayName || linked.username}
                <button type="button" className="frx-unlink" onClick={() => void handleUnlink()}>
                  Unlink
                </button>
              </span>
            ) : (
              <button type="button" className="frx-connect-btn" onClick={() => setPairOpen(true)}>
                <Link2 className="h-4 w-4" /> Connect Flux Rec account
              </button>
            )}
            <span className="frx-hero-live" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 14, fontWeight: 700, color: "#f97316" }}>
              <Flame className="h-4 w-4" />
              {loading ? "…" : `${formatCompact(totalVisits)} total visits`}
            </span>
          </div>
        </div>
      </section>

      {/* Linked account: my rooms */}
      {linked ? (
        <section className="frx-section">
          <div className="frx-section-head">
            <h2>Your rooms</h2>
            <span>{mineLoading ? "Loading…" : `${myRooms.length} rooms`}</span>
          </div>
          {mineLoading ? (
            <SkeletonGrid />
          ) : myRooms.length === 0 ? (
            <p className="frx-empty">No rooms on your Flux Rec account yet.</p>
          ) : (
            <div className="frx-grid">
              {myRooms.map((room) => (
                <RoomCard key={room.id} room={room} onOpen={() => setSelected(room)} />
              ))}
            </div>
          )}
        </section>
      ) : null}

      {/* Linked account: my photos */}
      {linked ? (
        <section className="frx-section">
          <div className="frx-section-head">
            <h2><Camera className="mr-1 inline h-4 w-4" /> Your in-game photos</h2>
            <span>{mineLoading ? "Loading…" : `${myPhotos.length} photos`}</span>
          </div>
          {mineLoading ? (
            <p className="frx-empty">Loading…</p>
          ) : myPhotos.length === 0 ? (
            <p className="frx-empty">
              <ImageIcon className="mr-1 inline h-4 w-4" />
              Photos you snap in Flux Rec will show up here.
            </p>
          ) : (
            <div className="frx-photo-grid">
              {myPhotos.map((p) => (
                <img key={p.id} src={p.url} alt={p.caption || "In-game photo"} loading="lazy" title={p.caption} />
              ))}
            </div>
          )}
        </section>
      ) : null}

      {/* All rooms — real data */}
      <section className="frx-section">
        <div className="frx-section-head">
          <h2>Rooms</h2>
          <span>{loading ? "Loading…" : `${rooms.length} rooms`}</span>
        </div>
        {loading ? (
          <SkeletonGrid />
        ) : rooms.length === 0 ? (
          <p className="frx-empty">Couldn&apos;t reach the game backend — try again in a bit.</p>
        ) : (
          <div className="frx-grid">
            {rooms.map((room) => (
              <RoomCard key={room.id} room={room} onOpen={() => setSelected(room)} />
            ))}
          </div>
        )}
      </section>

      {/* Link strip for guests */}
      {!linked ? (
        <section className="frx-section">
          <div
            style={{
              border: "1px solid var(--xx-line)",
              borderRadius: 18,
              padding: 20,
              display: "flex",
              gap: 14,
              alignItems: "center",
            }}
          >
            <Star className="h-6 w-6 flex-none text-amber-400" />
            <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5 }}>
              <strong>Link your Flux Rec account</strong> to see your private rooms
              and in-game photos here.
            </p>
            <button
              type="button"
              className="frx-connect-btn secondary"
              style={{ marginLeft: "auto", flex: "none" }}
              onClick={() => setPairOpen(true)}
            >
              <Link2 className="h-4 w-4" /> Link
            </button>
          </div>
        </section>
      ) : null}

      {selected ? <RoomDetail room={selected} onClose={() => setSelected(null)} /> : null}
      <PairDialog
        open={pairOpen}
        onClose={() => setPairOpen(false)}
        onLinked={handleLinked}
      />
    </XPage>
  );
}
