"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ComponentType,
} from "react";
import {
  Maximize2,
  Minimize2,
  MessageCircle,
  LogOut,
  Users,
  Coins,
  Zap,
  Home,
  Trophy,
} from "lucide-react";
import { toast } from "sonner";
import type { UserProfile } from "@/types";
import {
  HangoutChat,
  HangoutPlayer,
  Pickup,
  RoomState,
  WORLD_H,
  WORLD_W,
  collectPickup,
  joinHangout,
  leaveHangout,
  playerColor,
  sendHangoutChat,
  setRoomMode,
  subscribeHangoutChat,
  subscribeHangoutPlayers,
  subscribePickups,
  subscribeRoomState,
  tagPlayer,
  updateHangoutPos,
  type GameMode,
} from "@/services/game-multiplayer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const SPEED = 260;
const EMOJIS = ["🙂", "😎", "🔥", "🎮", "✨", "🚀", "👾", "🦊", "⚡", "👑"];
const TAG_RANGE = 42;
const PICKUP_RANGE = 36;

export function FluxArena({
  profile,
  roomCode,
  onLeave,
  className,
  autoFullscreen = false,
}: {
  profile: UserProfile;
  roomCode: string;
  onLeave?: () => void;
  className?: string;
  autoFullscreen?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const playersRef = useRef<HangoutPlayer[]>([]);
  const pickupsRef = useRef<Pickup[]>([]);
  const roomRef = useRef<RoomState | null>(null);
  const meRef = useRef({
    x: 600,
    y: 450,
    facing: "right" as "left" | "right",
    score: 0,
    isIt: false,
  });
  const keysRef = useRef<Record<string, boolean>>({});
  const lastSync = useRef(0);
  const lastTag = useRef(0);
  const lastCollect = useRef(0);
  const avatarsRef = useRef<Map<string, HTMLImageElement>>(new Map());
  const bubblesRef = useRef<Map<string, { text: string; until: number }>>(
    new Map()
  );

  const [players, setPlayers] = useState<HangoutPlayer[]>([]);
  const [chat, setChat] = useState<HangoutChat[]>([]);
  const [room, setRoom] = useState<RoomState | null>(null);
  const [chatText, setChatText] = useState("");
  const [emoji, setEmoji] = useState("🙂");
  const [fullscreen, setFullscreen] = useState(false);
  const [joined, setJoined] = useState(false);
  const [joining, setJoining] = useState(true);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [joinAttempt, setJoinAttempt] = useState(0);
  const [nowTs, setNowTs] = useState(Date.now());

  // Join + subscribe
  useEffect(() => {
    let unsubP: (() => void) | undefined;
    let unsubC: (() => void) | undefined;
    let unsubR: (() => void) | undefined;
    setJoining(true);
    setJoinError(null);
    let unsubPick: (() => void) | undefined;
    let alive = true;

    (async () => {
      try {
        await joinHangout(roomCode, {
          uid: profile.uid,
          username: profile.username,
          displayName: profile.displayName,
          avatarUrl: profile.avatarUrl,
          color: playerColor(profile.uid),
          emoji,
          x: 520 + Math.random() * 100,
          y: 400 + Math.random() * 80,
        });
        if (!alive) return;
        setJoined(true);
        setJoining(false);
        unsubP = subscribeHangoutPlayers(roomCode, (list) => {
          playersRef.current = list;
          setPlayers(list);
          const me = list.find((p) => p.uid === profile.uid);
          if (me) {
            meRef.current.score = me.score;
            meRef.current.isIt = me.isIt;
          }
          for (const p of list) {
            if (p.avatarUrl && !avatarsRef.current.has(p.uid)) {
              const img = new Image();
              img.crossOrigin = "anonymous";
              img.src = p.avatarUrl;
              avatarsRef.current.set(p.uid, img);
            }
          }
        });
        unsubC = subscribeHangoutChat(roomCode, (msgs) => {
          setChat(msgs);
          const last = msgs[msgs.length - 1];
          if (last) {
            bubblesRef.current.set(last.uid, {
              text: last.text,
              until: performance.now() + 4500,
            });
          }
        });
        unsubR = subscribeRoomState(roomCode, (s) => {
          roomRef.current = s;
          setRoom(s);
        });
        unsubPick = subscribePickups(roomCode, (list) => {
          pickupsRef.current = list;
        });
        toast.success(`Joined room ${roomCode.toUpperCase()}`);
      } catch (e) {
        console.error(e);
        setJoining(false);
        setJoinError("Flux Plays could not reach the room service.");
        toast.error("Could not join the room. You can retry without leaving the game.");
      }
    })();

    return () => {
      alive = false;
      unsubP?.();
      unsubC?.();
      unsubR?.();
      unsubPick?.();
      void leaveHangout(roomCode, profile.uid);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomCode, profile.uid, joinAttempt]);

  useEffect(() => {
    if (!autoFullscreen || !wrapRef.current) return;
    const t = setTimeout(() => {
      wrapRef.current?.requestFullscreen?.().catch(() => undefined);
    }, 400);
    return () => clearTimeout(t);
  }, [autoFullscreen]);

  useEffect(() => {
    const t = setInterval(() => setNowTs(Date.now()), 500);
    return () => clearInterval(t);
  }, []);

  // Keyboard
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      )
        return;
      keysRef.current[e.key.toLowerCase()] = true;
      if (
        ["arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(
          e.key.toLowerCase()
        )
      ) {
        e.preventDefault();
      }
    };
    const up = (e: KeyboardEvent) => {
      keysRef.current[e.key.toLowerCase()] = false;
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  // Touch / virtual stick
  const touchDir = useRef({ x: 0, y: 0 });
  const onTouchMove = (e: React.TouchEvent) => {
    const t = e.touches[0];
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!t || !rect) return;
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = t.clientX - cx;
    const dy = t.clientY - cy;
    const len = Math.hypot(dx, dy) || 1;
    // only if touch is away from center (joystick feel from center)
    if (len > 30) {
      touchDir.current = { x: dx / len, y: dy / len };
    }
  };
  const onTouchEnd = () => {
    touchDir.current = { x: 0, y: 0 };
  };

  // Game loop
  useEffect(() => {
    let raf = 0;
    let last = performance.now();

    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const keys = keysRef.current;
      let dx = touchDir.current.x;
      let dy = touchDir.current.y;
      if (keys["w"] || keys["arrowup"]) dy -= 1;
      if (keys["s"] || keys["arrowdown"]) dy += 1;
      if (keys["a"] || keys["arrowleft"]) dx -= 1;
      if (keys["d"] || keys["arrowright"]) dx += 1;

      // tag mode: "it" is slightly faster
      const speedMul = meRef.current.isIt ? 1.18 : 1;
      if (dx || dy) {
        const len = Math.hypot(dx, dy) || 1;
        dx = (dx / len) * SPEED * speedMul * dt;
        dy = (dy / len) * SPEED * speedMul * dt;
        meRef.current.x = Math.max(
          40,
          Math.min(WORLD_W - 40, meRef.current.x + dx)
        );
        meRef.current.y = Math.max(
          60,
          Math.min(WORLD_H - 40, meRef.current.y + dy)
        );
        if (dx < 0) meRef.current.facing = "left";
        if (dx > 0) meRef.current.facing = "right";
      }

      const others = playersRef.current.filter((p) => p.uid !== profile.uid);
      const mePlayer: HangoutPlayer = {
        uid: profile.uid,
        username: profile.username,
        displayName: profile.displayName,
        avatarUrl: profile.avatarUrl,
        x: meRef.current.x,
        y: meRef.current.y,
        color: playerColor(profile.uid),
        emoji,
        facing: meRef.current.facing,
        score: meRef.current.score,
        isIt: meRef.current.isIt,
      };

      const remoteMe = playersRef.current.find((p) => p.uid === profile.uid);
      if (remoteMe && !dx && !dy) {
        if (
          Math.hypot(
            remoteMe.x - meRef.current.x,
            remoteMe.y - meRef.current.y
          ) > 100
        ) {
          meRef.current.x = remoteMe.x;
          meRef.current.y = remoteMe.y;
        }
      }

      // Tag collision
      const mode = roomRef.current?.mode || "hangout";
      if (
        mode === "tag" &&
        meRef.current.isIt &&
        now - lastTag.current > 800
      ) {
        for (const o of others) {
          if (
            Math.hypot(o.x - meRef.current.x, o.y - meRef.current.y) < TAG_RANGE
          ) {
            lastTag.current = now;
            void tagPlayer(roomCode, profile.uid, o.uid).catch(() => undefined);
            break;
          }
        }
      }

      // Coin collect
      if (mode === "coins" && now - lastCollect.current > 200) {
        for (const pk of pickupsRef.current) {
          if (
            Math.hypot(pk.x - meRef.current.x, pk.y - meRef.current.y) <
            PICKUP_RANGE
          ) {
            lastCollect.current = now;
            const next = meRef.current.score + pk.value;
            meRef.current.score = next;
            void collectPickup(
              roomCode,
              pk.id,
              profile.uid,
              pk.value,
              meRef.current.score - pk.value
            ).catch(() => undefined);
            break;
          }
        }
      }

      draw([...others, mePlayer], now, mode);

      if (now - lastSync.current > 100 && joined) {
        lastSync.current = now;
        void updateHangoutPos(roomCode, profile.uid, {
          x: meRef.current.x,
          y: meRef.current.y,
          facing: meRef.current.facing,
          emoji,
        }).catch(() => undefined);
      }

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [joined, roomCode, profile, emoji]);

  const draw = useCallback(
    (list: HangoutPlayer[], now: number, mode: GameMode) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (canvas.width !== Math.floor(w * dpr) || canvas.height !== Math.floor(h * dpr)) {
        canvas.width = Math.floor(w * dpr);
        canvas.height = Math.floor(h * dpr);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const camX = meRef.current.x - w / 2;
      const camY = meRef.current.y - h / 2;
      const ox = Math.max(0, Math.min(WORLD_W - w, camX));
      const oy = Math.max(0, Math.min(WORLD_H - h, camY));

      // sky
      const grd = ctx.createLinearGradient(0, 0, 0, h);
      if (mode === "tag") {
        grd.addColorStop(0, "#1a0a0a");
        grd.addColorStop(1, "#0f172a");
      } else if (mode === "coins") {
        grd.addColorStop(0, "#0c1a12");
        grd.addColorStop(1, "#0f172a");
      } else {
        grd.addColorStop(0, "#0b1220");
        grd.addColorStop(1, "#111827");
      }
      ctx.fillStyle = grd;
      ctx.fillRect(0, 0, w, h);

      ctx.save();
      ctx.translate(-ox, -oy);

      // floor tiles
      for (let x = 0; x < WORLD_W; x += 80) {
        for (let y = 0; y < WORLD_H; y += 80) {
          const alt = ((x / 80 + y / 80) | 0) % 2 === 0;
          ctx.fillStyle = alt
            ? "rgba(29,155,240,0.04)"
            : "rgba(255,255,255,0.02)";
          ctx.fillRect(x, y, 80, 80);
        }
      }

      // zones
      drawZone(ctx, 200, 200, 100, "Lounge", "rgba(29,155,240,0.12)");
      drawZone(ctx, 1100, 220, 110, "Disco", "rgba(168,85,247,0.14)");
      drawZone(ctx, 700, 650, 120, "Arena", "rgba(244,63,94,0.12)");
      drawZone(ctx, 300, 650, 90, "Shop", "rgba(245,158,11,0.12)");
      drawZone(ctx, 1000, 650, 95, "Park", "rgba(16,185,129,0.12)");

      // stage
      ctx.fillStyle = "rgba(29,155,240,0.18)";
      roundRect(ctx, WORLD_W / 2 - 140, WORLD_H / 2 - 50, 280, 100, 24);
      ctx.fill();
      ctx.strokeStyle = "rgba(29,155,240,0.4)";
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = "rgba(255,255,255,0.7)";
      ctx.font = "bold 18px system-ui";
      ctx.textAlign = "center";
      ctx.fillText("FLUX ARENA", WORLD_W / 2, WORLD_H / 2 + 6);

      // pickups
      for (const pk of pickupsRef.current) {
        const pulse = 1 + Math.sin(now / 150 + pk.x) * 0.12;
        ctx.save();
        ctx.translate(pk.x, pk.y);
        ctx.scale(pulse, pulse);
        if (pk.type === "star") {
          ctx.fillStyle = "#fbbf24";
          ctx.font = "28px system-ui";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText("⭐", 0, 0);
        } else {
          ctx.fillStyle = "#f59e0b";
          ctx.beginPath();
          ctx.arc(0, 0, 12, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "#fde68a";
          ctx.font = "bold 12px system-ui";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText("$", 0, 1);
        }
        ctx.restore();
      }

      // players
      const sorted = [...list].sort((a, b) => a.y - b.y);
      for (const p of sorted) {
        drawPlayer(ctx, p, now, avatarsRef.current.get(p.uid));
        const bubble = bubblesRef.current.get(p.uid);
        if (bubble && bubble.until > now) {
          drawBubble(ctx, p.x, p.y - 78, bubble.text);
        } else if (bubble) {
          bubblesRef.current.delete(p.uid);
        }
      }

      ctx.restore();

      // edge vignette
      const vg = ctx.createRadialGradient(
        w / 2,
        h / 2,
        Math.min(w, h) * 0.25,
        w / 2,
        h / 2,
        Math.max(w, h) * 0.75
      );
      vg.addColorStop(0, "transparent");
      vg.addColorStop(1, "rgba(0,0,0,0.4)");
      ctx.fillStyle = vg;
      ctx.fillRect(0, 0, w, h);

      // mode banner
      if (mode !== "hangout") {
        ctx.fillStyle = "rgba(0,0,0,0.45)";
        roundRect(ctx, w / 2 - 120, 12, 240, 36, 12);
        ctx.fill();
        ctx.fillStyle = "#fff";
        ctx.font = "bold 14px system-ui";
        ctx.textAlign = "center";
        ctx.fillText(
          mode === "tag" ? "🔥 TAG MODE" : "🪙 COIN RUSH",
          w / 2,
          35
        );
      }
    },
    []
  );

  const changeMode = async (mode: GameMode) => {
    try {
      await setRoomMode(roomCode, mode, profile.uid, playersRef.current);
      toast.success(
        mode === "hangout"
          ? "Hangout mode"
          : mode === "tag"
            ? "Tag started!"
            : "Coin Rush started!"
      );
    } catch {
      toast.error("Could not change mode");
    }
  };

  const sendChat = async () => {
    const text = chatText.trim();
    if (!text) return;
    setChatText("");
    try {
      await sendHangoutChat(roomCode, {
        uid: profile.uid,
        displayName: profile.displayName,
        text,
      });
    } catch {
      toast.error("Chat failed");
    }
  };

  const toggleFs = async () => {
    const el = wrapRef.current;
    if (!el) return;
    try {
      if (!document.fullscreenElement) {
        await el.requestFullscreen();
        setFullscreen(true);
      } else {
        await document.exitFullscreen();
        setFullscreen(false);
      }
    } catch {
      setFullscreen((f) => !f);
    }
  };

  useEffect(() => {
    const onFs = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  const timeLeft =
    room?.roundEndsAt != null
      ? Math.max(0, Math.ceil((room.roundEndsAt - nowTs) / 1000))
      : null;

  const leaderboard = [...players].sort((a, b) => b.score - a.score).slice(0, 5);

  return (
    <div
      ref={wrapRef}
      className={cn(
        "relative flex flex-col overflow-hidden rounded-3xl border border-border bg-black shadow-2xl",
        fullscreen && "!fixed inset-0 z-[200] rounded-none border-0",
        className
      )}
    >
      {/* Top bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 bg-gradient-to-r from-[#0b1220] to-black px-3 py-2">
        <div className="flex min-w-0 flex-wrap items-center gap-2 text-sm font-bold text-white">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#1d9bf0] text-white">
            <Zap className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="truncate">Flux Arena · {roomCode}</p>
            <p className="text-[10px] font-medium text-white/50">
              {players.length} online
              {timeLeft != null ? ` · ${timeLeft}s left` : ""}
              {room?.message ? ` · ${room.message}` : ""}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1">
          <ModeBtn
            active={!room || room.mode === "hangout"}
            onClick={() => changeMode("hangout")}
            icon={Home}
            label="Hangout"
          />
          <ModeBtn
            active={room?.mode === "tag"}
            onClick={() => changeMode("tag")}
            icon={Zap}
            label="Tag"
          />
          <ModeBtn
            active={room?.mode === "coins"}
            onClick={() => changeMode("coins")}
            icon={Coins}
            label="Coins"
          />
          <Button
            size="sm"
            variant="ghost"
            className="text-white hover:bg-white/10"
            onClick={toggleFs}
          >
            {fullscreen ? (
              <Minimize2 className="h-4 w-4" />
            ) : (
              <Maximize2 className="h-4 w-4" />
            )}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="text-white hover:bg-white/10"
            onClick={() => {
              void leaveHangout(roomCode, profile.uid);
              onLeave?.();
            }}
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="relative flex min-h-0 flex-1">
        {/* Room transition / join loading screen */}
        {joining && (
          <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-4 bg-gradient-to-b from-[#0a1020] via-[#0b1220] to-black">
            <div className="relative">
              <div className="h-20 w-20 animate-pulse rounded-3xl bg-gradient-to-br from-[#ff6b35]/50 to-[#1d9bf0]/50" />
              <div className="absolute inset-0 m-auto h-10 w-10 animate-spin rounded-full border-2 border-white/20 border-t-[#1d9bf0]" />
            </div>
            <div className="text-center">
              <p className="text-lg font-extrabold text-white">
                Loading room…
              </p>
              <p className="mt-1 text-sm text-white/50">
                Joining <span className="font-bold text-[#1d9bf0]">{roomCode.toUpperCase()}</span>
              </p>
            </div>
            <p className="max-w-xs text-center text-[11px] text-white/35">
              Hang tight — connecting players and room state.
            </p>
          </div>
        )}
        {!joining && joinError ? (
          <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-gradient-to-b from-[#0a1020] to-black p-6 text-center">
            <div className="grid h-16 w-16 place-items-center rounded-2xl bg-white/10"><Zap className="h-7 w-7 text-[#1d9bf0]" /></div>
            <h2 className="mt-5 text-xl font-extrabold text-white">Room connection lost</h2>
            <p className="mt-2 max-w-sm text-sm leading-6 text-white/55">{joinError} Your game library and farming save are still safe.</p>
            <div className="mt-5 flex gap-2">
              <Button variant="secondary" onClick={() => setJoinAttempt((value) => value + 1)}>Try again</Button>
              <Button variant="ghost" className="text-white hover:bg-white/10" onClick={onLeave}>Back to games</Button>
            </div>
          </div>
        ) : null}
        {/* Canvas */}
        <div className="relative min-h-[min(70vh,560px)] flex-1">
          <canvas
            ref={canvasRef}
            className="absolute inset-0 h-full w-full touch-none"
            style={{ width: "100%", height: "100%" }}
            onTouchStart={onTouchMove}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
          />
          <div className="pointer-events-none absolute bottom-3 left-3 rounded-xl bg-black/55 px-3 py-2 text-[11px] text-white/75 backdrop-blur">
            <kbd className="rounded bg-white/10 px-1">WASD</kbd> move ·{" "}
            <kbd className="rounded bg-white/10 px-1">Tag</kbd> bump players ·{" "}
            <kbd className="rounded bg-white/10 px-1">Coins</kbd> walk over gold
            · Mobile: drag on screen
          </div>
          {meRef.current.isIt ? (
            <div className="pointer-events-none absolute left-1/2 top-16 -translate-x-1/2 rounded-full bg-red-500/90 px-4 py-1.5 text-xs font-extrabold text-white shadow-lg">
              YOU ARE IT — TAG SOMEONE!
            </div>
          ) : null}
        </div>

        {/* Side panel desktop */}
        <aside className="hidden w-56 shrink-0 flex-col border-l border-white/10 bg-black/80 md:flex">
          <div className="border-b border-white/10 p-3">
            <p className="mb-2 flex items-center gap-1 text-xs font-bold uppercase tracking-wide text-white/50">
              <Trophy className="h-3 w-3" /> Scores
            </p>
            <ul className="space-y-1.5">
              {leaderboard.length === 0 ? (
                <li className="text-xs text-white/40">No players yet</li>
              ) : (
                leaderboard.map((p, i) => (
                  <li
                    key={p.uid}
                    className="flex items-center justify-between text-xs text-white"
                  >
                    <span className="truncate">
                      {i + 1}. {p.displayName}
                      {p.isIt ? " 🔥" : ""}
                    </span>
                    <span className="font-bold text-[#1d9bf0]">{p.score}</span>
                  </li>
                ))
              )}
            </ul>
          </div>
          <div className="flex-1 overflow-y-auto p-3">
            <p className="mb-2 flex items-center gap-1 text-xs font-bold uppercase tracking-wide text-white/50">
              <Users className="h-3 w-3" /> In room
            </p>
            <ul className="space-y-1">
              {players.map((p) => (
                <li
                  key={p.uid}
                  className="truncate text-xs text-white/80"
                  style={{ borderLeft: `3px solid ${p.color}`, paddingLeft: 6 }}
                >
                  {p.displayName}
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>

      {/* Chat bar */}
      <div className="border-t border-white/10 bg-black/95 p-2">
        <div className="mb-2 flex flex-wrap gap-1">
          {EMOJIS.map((e) => (
            <button
              key={e}
              type="button"
              onClick={() => setEmoji(e)}
              className={cn(
                "rounded-lg px-2 py-1 text-sm transition",
                emoji === e
                  ? "bg-[#1d9bf0]/30 ring-1 ring-[#1d9bf0]"
                  : "hover:bg-white/10"
              )}
            >
              {e}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <MessageCircle className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
            <Input
              value={chatText}
              onChange={(e) => setChatText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void sendChat();
              }}
              placeholder="Chat with the room…"
              className="border-white/10 bg-white/5 pl-9 text-white placeholder:text-white/40"
              maxLength={140}
            />
          </div>
          <Button variant="sky" size="sm" onClick={() => void sendChat()}>
            Send
          </Button>
        </div>
        {chat.length > 0 ? (
          <ul className="mt-2 max-h-16 space-y-0.5 overflow-y-auto text-xs text-white/70 md:max-h-20">
            {chat.slice(-6).map((m) => (
              <li key={m.id}>
                <span className="font-semibold text-white/90">
                  {m.displayName}
                </span>
                : {m.text}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
}

function ModeBtn({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold transition",
        active
          ? "bg-[#1d9bf0] text-white"
          : "bg-white/10 text-white/70 hover:bg-white/15"
      )}
    >
      <Icon className="h-3 w-3" />
      {label}
    </button>
  );
}

function drawZone(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  label: string,
  color: string
) {
  ctx.beginPath();
  ctx.fillStyle = color;
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.08)";
  ctx.stroke();
  ctx.fillStyle = "rgba(255,255,255,0.45)";
  ctx.font = "bold 12px system-ui";
  ctx.textAlign = "center";
  ctx.fillText(label, x, y + 4);
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawPlayer(
  ctx: CanvasRenderingContext2D,
  p: HangoutPlayer,
  now: number,
  img?: HTMLImageElement
) {
  const bounce = Math.sin(now / 180 + p.uid.length) * 2.5;
  const x = p.x;
  const y = p.y + bounce;

  if (p.isIt) {
    ctx.strokeStyle = "rgba(239,68,68,0.6)";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(x, y - 10, 34 + Math.sin(now / 100) * 3, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.beginPath();
  ctx.ellipse(x, p.y + 28, 22, 8, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = p.color;
  roundRect(ctx, x - 16, y - 8, 32, 36, 10);
  ctx.fill();

  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y - 22, 20, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();
  if (img && img.complete && img.naturalWidth > 0) {
    ctx.drawImage(img, x - 20, y - 42, 40, 40);
  } else {
    ctx.fillStyle = "#1f2937";
    ctx.fillRect(x - 20, y - 42, 40, 40);
    ctx.fillStyle = "#fff";
    ctx.font = "20px system-ui";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(p.emoji || "🙂", x, y - 22);
  }
  ctx.restore();

  ctx.strokeStyle = p.isIt ? "#ef4444" : p.color;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(x, y - 22, 21, 0, Math.PI * 2);
  ctx.stroke();

  ctx.font = "bold 11px system-ui";
  ctx.textAlign = "center";
  const label = `${p.displayName.slice(0, 14)}${p.score ? ` · ${p.score}` : ""}`;
  const tw = ctx.measureText(label).width;
  ctx.fillStyle = "rgba(0,0,0,0.6)";
  roundRect(ctx, x - tw / 2 - 6, y - 58, tw + 12, 18, 8);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.fillText(label, x, y - 45);
}

function drawBubble(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  text: string
) {
  const label = text.length > 36 ? text.slice(0, 34) + "…" : text;
  ctx.font = "12px system-ui";
  const tw = ctx.measureText(label).width;
  const bw = tw + 16;
  const bh = 26;
  ctx.fillStyle = "rgba(255,255,255,0.95)";
  roundRect(ctx, x - bw / 2, y - bh, bw, bh, 10);
  ctx.fill();
  ctx.fillStyle = "#0f172a";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, x, y - bh / 2);
}
