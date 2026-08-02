"use client";

/**
 * Flux Farm — game shell.
 *
 * Owns the canvas, the requestAnimationFrame loop, input (keyboard, mouse,
 * touch joystick), the HUD and every panel. All simulation lives in
 * `@/lib/flux-farm/*`; this file is the presentation and I/O layer.
 */

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Award,
  Backpack,
  Coins,
  Droplets,
  Hammer,
  Home,
  Leaf,
  Loader2,
  Moon,
  Pause,
  Play,
  Scissors,
  ScrollText,
  Settings2,
  ShoppingBasket,
  Sparkles,
  Sprout,
  Sun,
  Trophy,
  Users,
  Volume2,
  VolumeX,
  Wind,
  X,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import type { UserProfile } from "@/types";
import { cn } from "@/lib/utils";
import {
  CROPS,
  CROP_IDS,
  DAYS_PER_SEASON,
  SEASON_INFO,
  STORY,
  TILE,
  UPGRADES,
  UPGRADE_ORDER,
  WEATHER_INFO,
  WORKERS,
  WORKER_IDS,
  cropInSeason,
  cropValue,
  dayOfSeason,
  rankForXp,
  seasonForDay,
  seedPrice,
  yearForDay,
  type CropId,
  type UpgradeId,
  type WorkerId,
} from "@/lib/flux-farm/content";
import {
  activeEventInfo,
  advance,
  buyUpgrade,
  buySeeds,
  createRuntime,
  drainEvents,
  formatClock,
  hireWorker,
  isNight,
  movePlayer,
  performAction,
  resolveAction,
  sellBarn,
  sleep,
  upgradeLevel,
  type FarmRuntime,
  type GameEvent,
  type ToolId,
} from "@/lib/flux-farm/simulation";
import { addFloater, burst, createRenderState, render, type RenderState } from "@/lib/flux-farm/renderer";
import { FarmAudio } from "@/lib/flux-farm/audio";
import { barnCapacity, totalBarnCount, type FarmSaveV2 } from "@/lib/flux-farm/world";
import {
  listFarmLeaderboard,
  loadFarmSave,
  saveFarmProgress,
  type FluxFarmLeaderboardEntry,
} from "@/services/flux-farm";

type PanelId = "shop" | "upgrades" | "workers" | "story" | "leaderboard" | "barn" | "settings" | null;

const TOOLS: Array<{ id: ToolId; label: string; icon: typeof Hammer; key: string }> = [
  { id: "auto", label: "Auto", icon: Sparkles, key: "1" },
  { id: "hoe", label: "Hoe", icon: Hammer, key: "2" },
  { id: "seed", label: "Seeds", icon: Sprout, key: "3" },
  { id: "can", label: "Water", icon: Droplets, key: "4" },
  { id: "scythe", label: "Harvest", icon: Scissors, key: "5" },
];

const AUTOSAVE_MS = 20_000;

export function FluxFarmGame({ profile }: { profile: UserProfile }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const runtimeRef = useRef<FarmRuntime | null>(null);
  const renderRef = useRef<RenderState | null>(null);
  const audioRef = useRef<FarmAudio | null>(null);
  const keysRef = useRef<Set<string>>(new Set());
  const stickRef = useRef({ active: false, id: -1, baseX: 0, baseY: 0, dx: 0, dy: 0 });
  const holdActionRef = useRef(false);
  const lastStepSoundRef = useRef(0);
  const lastNightRef = useRef(false);

  const [ready, setReady] = useState(false);
  const [panel, setPanel] = useState<PanelId>(null);
  const [paused, setPaused] = useState(false);
  const [tool, setTool] = useState<ToolId>("auto");
  const [muted, setMuted] = useState(false);
  const [zoom, setZoom] = useState(2);
  const [leaderboard, setLeaderboard] = useState<FluxFarmLeaderboardEntry[]>([]);
  const [loadingBoard, setLoadingBoard] = useState(false);
  const [saving, setSaving] = useState(false);
  const [banner, setBanner] = useState<{ title: string; detail?: string; tone: string } | null>(null);

  /** Mirrored slice of the save that the HUD re-renders from (~8fps). */
  const [hud, setHud] = useState({
    coins: 0,
    xp: 0,
    energy: 0,
    maxEnergy: 120,
    day: 1,
    minute: 360,
    weather: "clear" as FarmSaveV2["weather"],
    windSpeed: 0,
    barnCount: 0,
    barnMax: 60,
    seeds: {} as Partial<Record<CropId, number>>,
    selectedCrop: "wheat" as CropId,
    storyStep: 0,
    upgrades: {} as Partial<Record<UpgradeId, number>>,
    workers: [] as FarmSaveV2["workers"],
    activeEvent: null as FarmSaveV2["activeEvent"],
    hint: "",
  });

  /* ---------------------------------------------------------------------- */
  /* Boot                                                                    */
  /* ---------------------------------------------------------------------- */

  useEffect(() => {
    let cancelled = false;

    loadFarmSave(profile.uid, profile.displayName || "Flux Farmer", profile.avatarUrl || null)
      .then((save) => {
        if (cancelled) return;
        runtimeRef.current = createRuntime(save);
        renderRef.current = createRenderState(seasonForDay(save.day));
        renderRef.current.camera.x = save.playerX;
        renderRef.current.camera.y = save.playerY;
        setReady(true);
      })
      .catch(() => {
        if (!cancelled) toast.error("Could not open your farm. Check your connection and reload.");
      });

    return () => {
      cancelled = true;
    };
  }, [profile.avatarUrl, profile.displayName, profile.uid]);

  /* ---------------------------------------------------------------------- */
  /* Persistence                                                             */
  /* ---------------------------------------------------------------------- */

  const persist = useCallback(async (announce = false) => {
    const runtime = runtimeRef.current;
    if (!runtime) return;
    setSaving(true);
    try {
      await saveFarmProgress(runtime.save);
      if (announce) toast.success("Farm saved to your Flux account");
    } catch {
      if (announce) toast.error("Cloud save failed — progress is kept on this device");
    } finally {
      setSaving(false);
    }
  }, []);

  useEffect(() => {
    if (!ready) return;
    const timer = window.setInterval(() => void persist(false), AUTOSAVE_MS);
    const onHide = () => {
      if (document.visibilityState === "hidden") void persist(false);
    };
    window.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", onHide);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", onHide);
      void persist(false);
    };
  }, [persist, ready]);

  /* ---------------------------------------------------------------------- */
  /* Audio                                                                   */
  /* ---------------------------------------------------------------------- */

  const ensureAudio = useCallback(() => {
    if (!audioRef.current) audioRef.current = new FarmAudio();
    void audioRef.current.start();
  }, []);

  useEffect(() => {
    return () => {
      audioRef.current?.stop();
      audioRef.current = null;
    };
  }, []);

  useEffect(() => {
    audioRef.current?.setSettings({ muted });
  }, [muted]);

  /* ---------------------------------------------------------------------- */
  /* Game events → toasts, sound, particles                                  */
  /* ---------------------------------------------------------------------- */

  const handleEvents = useCallback((events: GameEvent[]) => {
    const runtime = runtimeRef.current;
    const state = renderRef.current;
    const audio = audioRef.current;
    if (!runtime || !state) return;

    for (const event of events) {
      const worldX = (event.x ?? 0) * TILE + TILE / 2;
      const worldY = (event.y ?? 0) * TILE;

      switch (event.kind) {
        case "till":
          audio?.play("till", 0.9 + Math.random() * 0.2);
          burst(state, worldX, worldY + TILE / 2, 6, "#7a5f43", "dust");
          break;
        case "plant":
          audio?.play("plant");
          burst(state, worldX, worldY + TILE / 2, 5, "#8fd07a");
          break;
        case "water":
          audio?.play("water");
          burst(state, worldX, worldY + TILE / 2, 10, "#7fc4ff", "splash");
          break;
        case "harvest":
          if (event.crop) {
            audio?.play("harvest", 0.95 + Math.random() * 0.15);
            burst(state, worldX, worldY, 12, CROPS[event.crop].palette[2]);
            addFloater(state, worldX, worldY, `+${event.value ?? 0} XP${event.detail ? ` · ${event.detail}` : ""}`, "#c7f284");
          }
          break;
        case "sell":
          audio?.play("coin");
          addFloater(state, runtime.player.x, runtime.player.y, `+${(event.value ?? 0).toLocaleString()}`, "#ffd45e");
          toast.success(event.message ?? "Sold");
          break;
        case "levelup":
          audio?.play("levelup");
          burst(state, runtime.player.x + TILE / 2, runtime.player.y, 26, "#ffe066");
          setBanner({ title: event.message ?? "Rank up", detail: event.detail, tone: "#ffd45e" });
          break;
        case "story":
          audio?.play("levelup");
          setBanner({ title: event.message ?? "Chapter complete", detail: event.detail, tone: "#c7f284" });
          break;
        case "worldevent":
          setBanner({ title: event.message ?? "World event", detail: event.detail, tone: "#8fd0ff" });
          break;
        case "season":
        case "day":
          setBanner({ title: event.message ?? "", detail: event.detail, tone: "#ffffff" });
          break;
        case "weather":
          setBanner({ title: event.message ?? "", detail: event.detail, tone: "#8fd0ff" });
          if (runtime.save.weather === "storm") audio?.play("thunder");
          break;
        case "wither":
          if (event.message) toast.error(event.message);
          state.shake = Math.max(state.shake, 0.3);
          break;
        case "deny":
        case "energy":
          audio?.play("deny");
          if (event.message) toast.error(event.message);
          break;
        case "purchase":
        case "hire":
          audio?.play("coin");
          if (event.message) toast.success(event.message);
          break;
        default:
          break;
      }
    }
  }, []);

  useEffect(() => {
    if (!banner) return;
    const timer = window.setTimeout(() => setBanner(null), 3600);
    return () => window.clearTimeout(timer);
  }, [banner]);

  /* ---------------------------------------------------------------------- */
  /* Main loop                                                               */
  /* ---------------------------------------------------------------------- */

  useEffect(() => {
    if (!ready) return;
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;

    let frame = 0;
    let last = performance.now();
    let hudTimer = 0;
    let dpr = Math.min(2, window.devicePixelRatio || 1);

    const resize = () => {
      const rect = wrap.getBoundingClientRect();
      dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.max(1, Math.floor(rect.width * dpr));
      canvas.height = Math.max(1, Math.floor(rect.height * dpr));
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;

      // Keep roughly the same number of tiles visible on every screen size.
      if (renderRef.current) {
        // Aim for a similar slice of the world regardless of screen size, then
        // apply the player's zoom preference on top.
        const target = rect.width < 520 ? 13 : rect.width < 900 ? 18 : rect.width < 1400 ? 24 : 30;
        const fit = rect.width / (target * TILE);
        renderRef.current.camera.zoom = Math.max(0.9, Math.min(4, fit)) * (zoom / 2);
      }
    };

    const observer = new ResizeObserver(resize);
    observer.observe(wrap);
    resize();

    const loop = (now: number) => {
      const runtime = runtimeRef.current;
      const state = renderRef.current;
      if (!runtime || !state) return;

      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;

      runtime.paused = paused || panel !== null;

      // Movement input: keyboard + virtual stick, combined.
      let inputX = 0;
      let inputY = 0;
      const keys = keysRef.current;
      if (keys.has("a") || keys.has("arrowleft")) inputX -= 1;
      if (keys.has("d") || keys.has("arrowright")) inputX += 1;
      if (keys.has("w") || keys.has("arrowup")) inputY -= 1;
      if (keys.has("s") || keys.has("arrowdown")) inputY += 1;
      if (stickRef.current.active) {
        inputX += stickRef.current.dx;
        inputY += stickRef.current.dy;
      }

      if (!runtime.paused) {
        movePlayer(runtime, inputX, inputY, dt);

        if (runtime.player.moving) {
          lastStepSoundRef.current += dt;
          const cadence = 0.34;
          if (lastStepSoundRef.current > cadence) {
            lastStepSoundRef.current = 0;
            audioRef.current?.play("step", 0.85 + Math.random() * 0.3);
          }
        }

        if (runtime.player.action) {
          runtime.player.action.timer -= dt;
          if (runtime.player.action.timer <= 0) runtime.player.action = null;
        }

        if (holdActionRef.current && !runtime.player.action) performAction(runtime, tool);

        advance(runtime, dt);
        handleEvents(drainEvents(runtime));

        const night = isNight(runtime.save.minute);
        if (night !== lastNightRef.current) {
          lastNightRef.current = night;
          audioRef.current?.wildlife(night ? "crickets" : "birds");
        }
        audioRef.current?.update(
          seasonForDay(runtime.save.day),
          night,
          runtime.save.weather,
          runtime.save.windSpeed
        );
      }

      render(ctx, runtime, state, runtime.paused ? 0 : dt, canvas.width, canvas.height, dpr);

      hudTimer += dt;
      if (hudTimer > 0.12) {
        hudTimer = 0;
        const resolved = resolveAction(runtime, tool);
        setHud({
          coins: Math.floor(runtime.save.coins),
          xp: Math.floor(runtime.save.xp),
          energy: Math.round(runtime.save.energy),
          maxEnergy: runtime.save.maxEnergy,
          day: runtime.save.day,
          minute: runtime.save.minute,
          weather: runtime.save.weather,
          windSpeed: runtime.save.windSpeed,
          barnCount: totalBarnCount(runtime.save.barn),
          barnMax: barnCapacity(upgradeLevel(runtime.save, "barn")),
          seeds: { ...runtime.save.seeds },
          selectedCrop: runtime.save.selectedCrop,
          storyStep: runtime.save.storyStep,
          upgrades: { ...runtime.save.upgrades },
          workers: [...runtime.save.workers],
          activeEvent: runtime.save.activeEvent,
          hint: resolved.valid ? ACTION_LABEL[resolved.action] : "",
        });
      }

      frame = requestAnimationFrame(loop);
    };

    frame = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [handleEvents, panel, paused, ready, tool, zoom]);

  /* ---------------------------------------------------------------------- */
  /* Keyboard                                                                */
  /* ---------------------------------------------------------------------- */

  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if (["arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(key)) event.preventDefault();
      keysRef.current.add(key);
      ensureAudio();

      if (key === " " || key === "e") {
        const runtime = runtimeRef.current;
        if (runtime && !runtime.paused) performAction(runtime, tool);
      }
      if (key === "escape") setPanel((current) => (current ? null : current)), setPaused((value) => !value);
      if (key === "q") cycleCrop(-1);
      if (key === "tab") {
        event.preventDefault();
        cycleCrop(1);
      }
      const toolIndex = TOOLS.findIndex((entry) => entry.key === key);
      if (toolIndex >= 0) setTool(TOOLS[toolIndex].id);
      if (key === "b") setPanel((current) => (current === "barn" ? null : "barn"));
      if (key === "m") setPanel((current) => (current === "shop" ? null : "shop"));
    };

    const up = (event: KeyboardEvent) => keysRef.current.delete(event.key.toLowerCase());
    const blur = () => keysRef.current.clear();

    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ensureAudio, tool]);

  const cycleCrop = useCallback((direction: number) => {
    const runtime = runtimeRef.current;
    if (!runtime) return;
    const rank = rankForXp(runtime.save.xp).rank;
    const available = CROP_IDS.filter((crop) => CROPS[crop].unlockRank <= rank);
    if (!available.length) return;
    const current = available.indexOf(runtime.save.selectedCrop);
    const next = available[(current + direction + available.length) % available.length];
    runtime.save.selectedCrop = next;
    audioRef.current?.play("click");
  }, []);

  /* ---------------------------------------------------------------------- */
  /* Pointer input                                                           */
  /* ---------------------------------------------------------------------- */

  const onCanvasPointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    ensureAudio();
    const runtime = runtimeRef.current;
    const state = renderRef.current;
    const canvas = canvasRef.current;
    if (!runtime || !state || !canvas || runtime.paused) return;

    const rect = canvas.getBoundingClientRect();
    const viewW = rect.width / state.camera.zoom;
    const viewH = rect.height / state.camera.zoom;
    const worldX = state.camera.x - viewW / 2 + (event.clientX - rect.left) / state.camera.zoom;
    const worldY = state.camera.y - viewH / 2 + (event.clientY - rect.top) / state.camera.zoom;

    const tileX = Math.floor(worldX / TILE);
    const tileY = Math.floor(worldY / TILE);
    const playerTileX = Math.floor((runtime.player.x + TILE / 2) / TILE);
    const playerTileY = Math.floor((runtime.player.y + TILE / 2) / TILE);

    // Close enough to reach: act on it. Otherwise walk there.
    if (Math.abs(tileX - playerTileX) <= 1 && Math.abs(tileY - playerTileY) <= 1) {
      const dx = tileX - playerTileX;
      const dy = tileY - playerTileY;
      if (dx !== 0 || dy !== 0) {
        runtime.player.facing = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 2 : 1) : dy > 0 ? 0 : 3;
      }
      performAction(runtime, tool);
      return;
    }

    // Walk-to: nudge the player toward the tap for a moment.
    const angle = Math.atan2(worldY - runtime.player.y, worldX - runtime.player.x);
    stickRef.current = { active: true, id: -2, baseX: 0, baseY: 0, dx: Math.cos(angle), dy: Math.sin(angle) };
    window.setTimeout(() => {
      if (stickRef.current.id === -2) stickRef.current.active = false;
    }, 320);
  };

  const onStickStart = (event: React.PointerEvent<HTMLDivElement>) => {
    ensureAudio();
    const rect = event.currentTarget.getBoundingClientRect();
    stickRef.current = {
      active: true,
      id: event.pointerId,
      baseX: rect.left + rect.width / 2,
      baseY: rect.top + rect.height / 2,
      dx: 0,
      dy: 0,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onStickMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const stick = stickRef.current;
    if (!stick.active || stick.id !== event.pointerId) return;
    const dx = event.clientX - stick.baseX;
    const dy = event.clientY - stick.baseY;
    const distance = Math.hypot(dx, dy);
    const max = 46;
    const scale = distance > max ? max / distance : 1;
    stick.dx = (dx * scale) / max;
    stick.dy = (dy * scale) / max;
  };

  const onStickEnd = (event: React.PointerEvent<HTMLDivElement>) => {
    if (stickRef.current.id !== event.pointerId) return;
    stickRef.current = { active: false, id: -1, baseX: 0, baseY: 0, dx: 0, dy: 0 };
  };

  /* ---------------------------------------------------------------------- */
  /* Panel actions                                                           */
  /* ---------------------------------------------------------------------- */

  const openPanel = (id: PanelId) => {
    ensureAudio();
    audioRef.current?.play("click");
    setPanel(id);
    if (id === "leaderboard") void refreshLeaderboard();
  };

  const refreshLeaderboard = useCallback(async () => {
    setLoadingBoard(true);
    try {
      await persist(false);
      setLeaderboard(await listFarmLeaderboard(50));
    } catch {
      setLeaderboard([]);
    } finally {
      setLoadingBoard(false);
    }
  }, [persist]);

  const withRuntime = (fn: (runtime: FarmRuntime) => void) => {
    const runtime = runtimeRef.current;
    if (!runtime) return;
    fn(runtime);
    handleEvents(drainEvents(runtime));
  };

  /* ---------------------------------------------------------------------- */
  /* Derived HUD values                                                      */
  /* ---------------------------------------------------------------------- */

  const rank = useMemo(() => rankForXp(hud.xp), [hud.xp]);
  const season = seasonForDay(hud.day);
  const seasonInfo = SEASON_INFO[season];
  const weatherInfo = WEATHER_INFO[hud.weather];
  const night = isNight(hud.minute);
  const eventInfo = runtimeRef.current ? activeEventInfo(runtimeRef.current.save) : null;
  const chapter = STORY[Math.min(hud.storyStep, STORY.length - 1)];

  if (!ready) {
    return (
      <div className="grid min-h-[100dvh] place-items-center bg-[#0d2818] text-white">
        <div className="text-center">
          <Leaf className="mx-auto h-12 w-12 animate-bounce text-[#c7f284]" />
          <p className="mt-4 text-lg font-black">Waking the valley…</p>
          <p className="mt-1 text-sm text-white/50">Loading your farm from your Flux account</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-[100dvh] w-full overflow-hidden bg-[#0d2818] text-white select-none">
      <div ref={wrapRef} className="absolute inset-0">
        <canvas
          ref={canvasRef}
          className="h-full w-full touch-none"
          onPointerDown={onCanvasPointerDown}
          aria-label="Flux Farm world"
        />
      </div>

      {/* ---------------------------------------------------------------- */}
      {/* Top HUD                                                           */}
      {/* ---------------------------------------------------------------- */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 p-2 sm:p-3">
        <div className="pointer-events-auto mx-auto flex w-full max-w-5xl flex-col gap-1.5 sm:flex-row sm:flex-wrap sm:items-center sm:gap-2">
          {/* Two stacked rows on phones; `sm:contents` folds them into one row
              on wider screens so the chips share a single flex line. */}
          <div className="flex items-center gap-1.5 sm:contents">
          <Link href="/games" className="farm-hud-button" aria-label="Back to games">
            <ArrowLeft className="h-4 w-4" />
          </Link>

          <div className="farm-hud-chip">
            <Coins className="h-4 w-4 text-[#ffd45e]" />
            <b>{hud.coins.toLocaleString()}</b>
          </div>

          <button type="button" className="farm-hud-chip min-w-0" onClick={() => openPanel("story")}>
            <Award className="h-4 w-4 text-[#c7f284]" />
            <span className="flex min-w-0 flex-col items-start leading-none">
              <b className="truncate text-[11px]">
                {rank.rank} · {rank.title}
              </b>
              <span className="mt-1 block h-1 w-16 overflow-hidden rounded-full bg-white/20 sm:w-24">
                <span className="block h-full rounded-full bg-[#c7f284]" style={{ width: `${rank.progress * 100}%` }} />
              </span>
            </span>
          </button>

          <div className="farm-hud-chip">
            {night ? <Moon className="h-4 w-4 text-[#9fd8ff]" /> : <Sun className="h-4 w-4 text-[#ffd45e]" />}
            <span className="flex flex-col items-start leading-none">
              <b className="text-[11px]">{formatClock(hud.minute)}</b>
              <small className="mt-0.5 text-[9px] text-white/55">
                {seasonInfo.name} {dayOfSeason(hud.day)}/{DAYS_PER_SEASON} · Y{yearForDay(hud.day)}
              </small>
            </span>
          </div>

          </div>

          <div className="flex items-center gap-1.5 sm:contents">
          <div className="farm-hud-chip" title={weatherInfo.description}>
            <Wind className="h-4 w-4 text-[#8fd0ff]" />
            <span className="flex flex-col items-start leading-none">
              <b className="text-[11px]">{weatherInfo.name}</b>
              <small className="mt-0.5 text-[9px] text-white/55">{hud.windSpeed.toFixed(1)} wind</small>
            </span>
          </div>

          <div className="farm-hud-chip">
            <Zap className="h-4 w-4 text-[#ffb15e]" />
            <span className="block h-1.5 w-12 overflow-hidden rounded-full bg-white/20 sm:w-20">
              <span
                className="block h-full rounded-full bg-[#ffb15e] transition-[width] duration-300"
                style={{ width: `${(hud.energy / Math.max(1, hud.maxEnergy)) * 100}%` }}
              />
            </span>
          </div>

          <div className="ml-auto flex items-center gap-1.5">
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin text-white/45" /> : null}
            <button type="button" className="farm-hud-button" onClick={() => setMuted((value) => !value)} aria-label={muted ? "Unmute" : "Mute"}>
              {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </button>
            <button type="button" className="farm-hud-button" onClick={() => setPaused((value) => !value)} aria-label={paused ? "Resume" : "Pause"}>
              {paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
            </button>
            <button type="button" className="farm-hud-button" onClick={() => openPanel("settings")} aria-label="Settings">
              <Settings2 className="h-4 w-4" />
            </button>
          </div>
          </div>
        </div>

        {eventInfo ? (
          <div className="pointer-events-none mx-auto mt-2 w-full max-w-5xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#8fd0ff]/30 bg-[#0a1a2e]/80 px-3 py-1.5 text-[11px] font-bold backdrop-blur-md">
              <span>{eventInfo.emoji}</span>
              <b>{eventInfo.name}</b>
              <span className="hidden text-white/60 sm:inline">{eventInfo.text}</span>
            </div>
          </div>
        ) : null}
      </div>

      {/* Event banner */}
      {banner ? (
        <div className="pointer-events-none absolute left-1/2 top-1/4 z-30 w-[min(92vw,420px)] -translate-x-1/2 text-center">
          <div
            className="rounded-2xl border border-white/12 bg-black/62 px-5 py-4 backdrop-blur-xl"
            style={{ boxShadow: `0 0 40px ${banner.tone}22` }}
          >
            <p className="text-lg font-black" style={{ color: banner.tone }}>
              {banner.title}
            </p>
            {banner.detail ? <p className="mt-1 text-xs text-white/65">{banner.detail}</p> : null}
          </div>
        </div>
      ) : null}

      {/* ---------------------------------------------------------------- */}
      {/* Side rail: panels                                                 */}
      {/* ---------------------------------------------------------------- */}
      <div className="absolute right-2 top-[108px] z-20 grid gap-1.5 sm:top-[72px]">
        {(
          [
            ["shop", ShoppingBasket, "Seed shop"],
            ["barn", Backpack, "Barn"],
            ["upgrades", Hammer, "Build and upgrade"],
            ["workers", Users, "Farmhands"],
            ["story", ScrollText, "Story"],
            ["leaderboard", Trophy, "Leaderboard"],
          ] as const
        ).map(([id, Icon, label]) => (
          <button
            key={id}
            type="button"
            className="farm-hud-button relative"
            onClick={() => openPanel(id)}
            aria-label={label}
            title={label}
          >
            <Icon className="h-4 w-4" />
            {id === "barn" && hud.barnCount > 0 ? (
              <em className="absolute -right-1 -top-1 rounded-full bg-[#c7f284] px-1 text-[9px] font-black not-italic text-black">
                {hud.barnCount}
              </em>
            ) : null}
          </button>
        ))}
      </div>

      {/* ---------------------------------------------------------------- */}
      {/* Bottom HUD: tools and seeds                                       */}
      {/* ---------------------------------------------------------------- */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        <div className="pointer-events-auto mx-auto w-full max-w-3xl">
          {hud.hint ? <p className="mb-1.5 text-center text-[11px] font-bold text-white/70">{hud.hint}</p> : null}

          <div className="no-scrollbar flex gap-1.5 overflow-x-auto">
            {TOOLS.map((entry) => {
              const Icon = entry.icon;
              return (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => {
                    setTool(entry.id);
                    audioRef.current?.play("click");
                  }}
                  className={cn("farm-tool", tool === entry.id && "is-active")}
                  title={`${entry.label} (${entry.key})`}
                >
                  <Icon className="h-4 w-4" />
                  <span>{entry.label}</span>
                </button>
              );
            })}
          </div>

          <div className="no-scrollbar mt-1.5 flex gap-1.5 overflow-x-auto">
            {CROP_IDS.filter((crop) => CROPS[crop].unlockRank <= rank.rank).map((crop) => {
              const count = hud.seeds[crop] ?? 0;
              const usable = cropInSeason(crop, season, hud.upgrades.greenhouse ?? 0);
              return (
                <button
                  key={crop}
                  type="button"
                  onClick={() =>
                    withRuntime((runtime) => {
                      runtime.save.selectedCrop = crop;
                      audioRef.current?.play("click");
                    })
                  }
                  className={cn("farm-seed", hud.selectedCrop === crop && "is-active", !usable && "opacity-45")}
                  title={usable ? CROPS[crop].name : `${CROPS[crop].name} is out of season`}
                >
                  <span aria-hidden>{CROPS[crop].emoji}</span>
                  <b>{count}</b>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ---------------------------------------------------------------- */}
      {/* Touch controls — placed above the tool bar so nothing overlaps     */}
      {/* ---------------------------------------------------------------- */}
      <div
        className="absolute bottom-[calc(104px+env(safe-area-inset-bottom))] left-3 z-20 h-28 w-28 touch-none rounded-full border border-white/12 bg-black/25 backdrop-blur-md lg:hidden"
        onPointerDown={onStickStart}
        onPointerMove={onStickMove}
        onPointerUp={onStickEnd}
        onPointerCancel={onStickEnd}
        aria-label="Movement joystick"
        role="application"
      >
        <span className="pointer-events-none absolute left-1/2 top-1/2 h-11 w-11 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/25" />
      </div>

      <button
        type="button"
        className="absolute bottom-[calc(112px+env(safe-area-inset-bottom))] right-4 z-20 grid h-[72px] w-[72px] touch-none place-items-center rounded-full border border-white/15 bg-[#2f7d42]/85 text-white shadow-[0_10px_30px_rgba(0,0,0,0.4)] backdrop-blur-md active:scale-95 lg:hidden"
        onPointerDown={(event) => {
          event.preventDefault();
          ensureAudio();
          holdActionRef.current = true;
          const runtime = runtimeRef.current;
          if (runtime && !runtime.paused) performAction(runtime, tool);
        }}
        onPointerUp={() => {
          holdActionRef.current = false;
        }}
        onPointerCancel={() => {
          holdActionRef.current = false;
        }}
        aria-label="Use tool"
      >
        <Sparkles className="h-7 w-7" />
      </button>

      {/* ---------------------------------------------------------------- */}
      {/* Pause overlay                                                     */}
      {/* ---------------------------------------------------------------- */}
      {paused && !panel ? (
        <div className="absolute inset-0 z-40 grid place-items-center bg-black/62 backdrop-blur-sm">
          <div className="w-[min(92vw,380px)] rounded-3xl border border-white/12 bg-[#0d2818]/95 p-6 text-center">
            <Leaf className="mx-auto h-9 w-9 text-[#c7f284]" />
            <h2 className="mt-3 text-2xl font-black">Paused</h2>
            <p className="mt-1 text-sm text-white/55">Day {hud.day} · {seasonInfo.name}</p>
            <div className="mt-5 grid gap-2">
              <button type="button" className="farm-button" onClick={() => setPaused(false)}>
                <Play className="h-4 w-4" /> Resume
              </button>
              <button type="button" className="farm-button farm-button-ghost" onClick={() => void persist(true)}>
                Save now
              </button>
              <button
                type="button"
                className="farm-button farm-button-ghost"
                onClick={() => withRuntime((runtime) => sleep(runtime))}
              >
                <Home className="h-4 w-4" /> Sleep until dawn
              </button>
              <Link href="/games" className="farm-button farm-button-ghost">
                <ArrowLeft className="h-4 w-4" /> Leave the farm
              </Link>
            </div>
          </div>
        </div>
      ) : null}

      {/* ---------------------------------------------------------------- */}
      {/* Panels                                                            */}
      {/* ---------------------------------------------------------------- */}
      {panel ? (
        <div className="absolute inset-0 z-40 flex items-end justify-center bg-black/55 backdrop-blur-sm sm:items-center">
          <div className="farm-panel">
            <header className="flex items-center gap-3 border-b border-white/10 px-4 py-3">
              <h2 className="min-w-0 flex-1 truncate text-lg font-black">{PANEL_TITLES[panel]}</h2>
              <span className="flex items-center gap-1.5 rounded-full bg-white/8 px-3 py-1.5 text-xs font-black">
                <Coins className="h-3.5 w-3.5 text-[#ffd45e]" />
                {hud.coins.toLocaleString()}
              </span>
              <button type="button" className="farm-hud-button" onClick={() => setPanel(null)} aria-label="Close">
                <X className="h-4 w-4" />
              </button>
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              {panel === "shop" ? (
                <ShopPanel hud={hud} rank={rank.rank} season={season} onBuy={(crop, count) => withRuntime((runtime) => buySeeds(runtime, crop, count))} />
              ) : null}

              {panel === "barn" ? (
                <BarnPanel
                  runtime={runtimeRef.current}
                  hud={hud}
                  onSell={() => withRuntime((runtime) => sellBarn(runtime))}
                />
              ) : null}

              {panel === "upgrades" ? (
                <UpgradesPanel hud={hud} rank={rank.rank} onBuy={(id) => withRuntime((runtime) => buyUpgrade(runtime, id))} />
              ) : null}

              {panel === "workers" ? (
                <WorkersPanel hud={hud} rank={rank.rank} onHire={(id) => withRuntime((runtime) => hireWorker(runtime, id))} />
              ) : null}

              {panel === "story" ? <StoryPanel step={hud.storyStep} chapter={chapter} /> : null}

              {panel === "leaderboard" ? (
                <LeaderboardPanel
                  entries={leaderboard}
                  loading={loadingBoard}
                  uid={profile.uid}
                  onRefresh={() => void refreshLeaderboard()}
                />
              ) : null}

              {panel === "settings" ? (
                <SettingsPanel
                  muted={muted}
                  zoom={zoom}
                  onMuted={setMuted}
                  onZoom={setZoom}
                  onSave={() => void persist(true)}
                  audio={audioRef.current}
                />
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      <style jsx global>{`
        .farm-hud-button {
          display: grid;
          height: 38px;
          width: 38px;
          flex: none;
          place-items: center;
          border-radius: 999px;
          border: 1px solid rgba(255, 255, 255, 0.12);
          background: rgba(6, 18, 12, 0.62);
          color: #fff;
          backdrop-filter: blur(14px);
          transition: background 140ms ease, transform 120ms ease;
        }
        .farm-hud-button:hover { background: rgba(255, 255, 255, 0.16); }
        .farm-hud-button:active { transform: scale(0.92); }

        .farm-hud-chip {
          display: flex;
          min-height: 38px;
          align-items: center;
          gap: 7px;
          border-radius: 999px;
          border: 1px solid rgba(255, 255, 255, 0.12);
          background: rgba(6, 18, 12, 0.62);
          padding: 0 12px;
          font-size: 12px;
          font-weight: 800;
          backdrop-filter: blur(14px);
        }

        .farm-tool {
          display: inline-flex;
          min-height: 34px;
          flex: none;
          align-items: center;
          gap: 6px;
          border-radius: 999px;
          border: 1px solid rgba(255, 255, 255, 0.12);
          background: rgba(6, 18, 12, 0.62);
          padding: 0 12px;
          font-size: 11px;
          font-weight: 800;
          backdrop-filter: blur(14px);
          transition: background 140ms ease, transform 120ms ease;
        }
        .farm-tool.is-active { background: #2f7d42; border-color: #c7f284; }
        .farm-tool:active { transform: scale(0.94); }

        .farm-seed {
          display: inline-flex;
          height: 34px;
          min-width: 46px;
          flex: none;
          align-items: center;
          justify-content: center;
          gap: 4px;
          border-radius: 12px;
          border: 1px solid rgba(255, 255, 255, 0.12);
          background: rgba(6, 18, 12, 0.62);
          font-size: 14px;
          backdrop-filter: blur(14px);
          transition: background 140ms ease, transform 120ms ease;
        }
        .farm-seed b { font-size: 10px; font-weight: 800; color: rgba(255, 255, 255, 0.72); }
        .farm-seed.is-active { border-color: #c7f284; background: rgba(47, 125, 66, 0.7); }
        .farm-seed:active { transform: scale(0.94); }

        .farm-panel {
          display: flex;
          width: min(100vw, 560px);
          max-height: min(88dvh, 720px);
          flex-direction: column;
          overflow: hidden;
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 26px 26px 0 0;
          background: rgba(9, 26, 17, 0.97);
          color: #fff;
          animation: farm-sheet 240ms cubic-bezier(0.16, 1, 0.3, 1) both;
        }
        @media (min-width: 640px) {
          .farm-panel { border-radius: 26px; }
        }
        @keyframes farm-sheet {
          from { opacity: 0; transform: translateY(28px); }
          to { opacity: 1; transform: none; }
        }

        .farm-button {
          display: inline-flex;
          min-height: 46px;
          width: 100%;
          align-items: center;
          justify-content: center;
          gap: 8px;
          border-radius: 999px;
          border: 0;
          background: #2f7d42;
          color: #fff;
          font-size: 14px;
          font-weight: 800;
          transition: background 140ms ease, transform 120ms ease;
        }
        .farm-button:hover { background: #3a9553; }
        .farm-button:active { transform: scale(0.97); }
        .farm-button:disabled { opacity: 0.45; pointer-events: none; }
        .farm-button-ghost { background: rgba(255, 255, 255, 0.08); }
        .farm-button-ghost:hover { background: rgba(255, 255, 255, 0.14); }

        .farm-row {
          display: flex;
          align-items: center;
          gap: 12px;
          border-radius: 16px;
          border: 1px solid rgba(255, 255, 255, 0.09);
          background: rgba(255, 255, 255, 0.04);
          padding: 12px;
        }
      `}</style>
    </div>
  );
}

const ACTION_LABEL: Record<string, string> = {
  till: "Till this ground",
  plant: "Plant a seed here",
  water: "Water this plot",
  harvest: "Harvest",
};

const PANEL_TITLES: Record<NonNullable<PanelId>, string> = {
  shop: "Seed shop",
  upgrades: "Build and upgrade",
  workers: "Farmhands",
  story: "Story",
  leaderboard: "Global leaderboard",
  barn: "Barn",
  settings: "Settings",
};

type Hud = Parameters<typeof ShopPanel>[0]["hud"];

/* -------------------------------------------------------------------------- */
/* Panels                                                                      */
/* -------------------------------------------------------------------------- */

function ShopPanel({
  hud,
  rank,
  season,
  onBuy,
}: {
  hud: {
    coins: number;
    seeds: Partial<Record<CropId, number>>;
    upgrades: Partial<Record<UpgradeId, number>>;
    activeEvent: FarmSaveV2["activeEvent"];
  };
  rank: number;
  season: ReturnType<typeof seasonForDay>;
  onBuy: (crop: CropId, count: number) => void;
}) {
  const silo = hud.upgrades.silo ?? 0;

  return (
    <div className="space-y-2">
      <p className="text-xs leading-5 text-white/55">
        Seeds get cheaper with each silo level, and a Merchant Caravan halves every price while it is parked.
      </p>
      {CROP_IDS.map((crop) => {
        const info = CROPS[crop];
        const locked = rank < info.unlockRank;
        const price = seedPrice(crop, silo, 0);
        const inSeason = cropInSeason(crop, season, hud.upgrades.greenhouse ?? 0);

        return (
          <div key={crop} className={cn("farm-row", locked && "opacity-45")}>
            <span className="grid h-11 w-11 flex-none place-items-center rounded-xl bg-white/8 text-xl" aria-hidden>
              {info.emoji}
            </span>
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-2 text-sm font-black">
                {info.name}
                <span className="rounded-full bg-white/10 px-2 py-0.5 text-[9px] uppercase tracking-wider">{info.rarity}</span>
                {!inSeason && !locked ? (
                  <span className="rounded-full bg-[#ffb15e]/20 px-2 py-0.5 text-[9px] font-black text-[#ffb15e]">
                    Off season
                  </span>
                ) : null}
              </p>
              <p className="mt-1 text-[11px] text-white/50">
                {locked
                  ? `Unlocks at rank ${info.unlockRank}`
                  : `${info.growHours}h · sells ${info.sellPrice} · ${info.seasons.join(", ")}${info.regrow ? " · regrows" : ""}`}
              </p>
            </div>
            <div className="flex flex-none items-center gap-1.5">
              <span className="text-[11px] font-black text-white/60">×{hud.seeds[crop] ?? 0}</span>
              <button
                type="button"
                className="farm-button !min-h-9 !w-auto px-3 text-[11px]"
                disabled={locked || hud.coins < price}
                onClick={() => onBuy(crop, 1)}
              >
                {price}
              </button>
              <button
                type="button"
                className="farm-button farm-button-ghost !min-h-9 !w-auto px-3 text-[11px]"
                disabled={locked || hud.coins < price * 10}
                onClick={() => onBuy(crop, 10)}
              >
                ×10
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function BarnPanel({
  runtime,
  hud,
  onSell,
}: {
  runtime: FarmRuntime | null;
  hud: { barnCount: number; barnMax: number; upgrades: Partial<Record<UpgradeId, number>> };
  onSell: () => void;
}) {
  const barn = runtime?.save.barn ?? [];
  const market = hud.upgrades.market ?? 0;
  const eventInfo = runtime ? activeEventInfo(runtime.save) : null;
  const multiplier = eventInfo?.priceMultiplier ?? 1;
  const windBonus =
    (hud.upgrades.windmill ?? 0) > 0 && runtime
      ? Math.min(0.25, runtime.save.windSpeed * 0.06 * (hud.upgrades.windmill ?? 0))
      : 0;

  const total = barn.reduce(
    (sum, item) => sum + cropValue(item.crop, item.quality, market, multiplier, windBonus) * item.count,
    0
  );

  return (
    <div className="space-y-3">
      <div className="farm-row">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-black">
            {hud.barnCount} / {hud.barnMax} stored
          </p>
          <p className="mt-1 text-[11px] text-white/50">
            {multiplier > 1 ? `Prices boosted ×${multiplier.toFixed(2)} by the current event. ` : ""}
            {windBonus > 0 ? `Windmill adds ${(windBonus * 100).toFixed(0)}%.` : ""}
          </p>
        </div>
        <span className="flex flex-none items-center gap-1.5 text-lg font-black text-[#ffd45e]">
          <Coins className="h-4 w-4" />
          {total.toLocaleString()}
        </span>
      </div>

      {barn.length === 0 ? (
        <p className="py-10 text-center text-sm text-white/45">
          The barn is empty. Harvest ripe crops and they land here.
        </p>
      ) : (
        <>
          <div className="space-y-2">
            {barn.map((item) => (
              <div key={`${item.crop}:${item.quality}`} className="farm-row">
                <span className="grid h-10 w-10 flex-none place-items-center rounded-xl bg-white/8 text-lg" aria-hidden>
                  {CROPS[item.crop].emoji}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-black">
                    {CROPS[item.crop].name}
                    {item.quality > 0 ? (
                      <span className="ml-2 rounded-full bg-[#ffd45e]/18 px-2 py-0.5 text-[9px] font-black text-[#ffd45e]">
                        {["Standard", "Silver", "Gold", "Iridium"][Math.min(3, item.quality)]}
                      </span>
                    ) : null}
                  </p>
                  <p className="mt-0.5 text-[11px] text-white/50">
                    ×{item.count} · {cropValue(item.crop, item.quality, market, multiplier, windBonus)} each
                  </p>
                </div>
              </div>
            ))}
          </div>
          <button type="button" className="farm-button" onClick={onSell}>
            <Coins className="h-4 w-4" /> Sell everything for {total.toLocaleString()}
          </button>
        </>
      )}
    </div>
  );
}

function UpgradesPanel({
  hud,
  rank,
  onBuy,
}: {
  hud: { coins: number; upgrades: Partial<Record<UpgradeId, number>> };
  rank: number;
  onBuy: (id: UpgradeId) => void;
}) {
  return (
    <div className="space-y-2">
      {UPGRADE_ORDER.map((id) => {
        const info = UPGRADES[id];
        const level = hud.upgrades[id] ?? 0;
        const maxed = level >= info.maxLevel;
        const locked = rank < info.unlockRank;
        const cost = maxed ? 0 : info.cost(level + 1);

        return (
          <div key={id} className={cn("farm-row", locked && "opacity-45")}>
            <span className="grid h-11 w-11 flex-none place-items-center rounded-xl bg-white/8 text-xl" aria-hidden>
              {info.emoji}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-black">
                {info.name}
                <span className="ml-2 text-[11px] font-bold text-white/45">
                  Lv {level}/{info.maxLevel}
                </span>
              </p>
              <p className="mt-1 text-[11px] leading-4 text-white/50">
                {locked ? `Unlocks at rank ${info.unlockRank}` : info.description}
              </p>
            </div>
            <button
              type="button"
              className="farm-button !min-h-9 !w-auto flex-none px-3 text-[11px]"
              disabled={maxed || locked || hud.coins < cost}
              onClick={() => onBuy(id)}
            >
              {maxed ? "Maxed" : cost.toLocaleString()}
            </button>
          </div>
        );
      })}
    </div>
  );
}

function WorkersPanel({
  hud,
  rank,
  onHire,
}: {
  hud: { coins: number; workers: FarmSaveV2["workers"] };
  rank: number;
  onHire: (id: WorkerId) => void;
}) {
  return (
    <div className="space-y-2">
      <p className="text-xs leading-5 text-white/55">
        Farmhands work the field while you do anything else. Each takes a daily wage at dawn — leave the coffers
        empty and the newest hire walks.
      </p>
      {WORKER_IDS.map((id) => {
        const info = WORKERS[id];
        const hired = hud.workers.some((worker) => worker.id === id && worker.hired);
        const locked = rank < info.unlockRank;

        return (
          <div key={id} className={cn("farm-row", locked && !hired && "opacity-45")}>
            <span
              className="grid h-11 w-11 flex-none place-items-center rounded-full text-sm font-black"
              style={{ background: info.shirt }}
            >
              {info.name[0]}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-black">
                {info.name}
                {hired ? (
                  <span className="ml-2 rounded-full bg-[#c7f284]/20 px-2 py-0.5 text-[9px] font-black text-[#c7f284]">
                    Hired
                  </span>
                ) : null}
              </p>
              <p className="mt-1 text-[11px] text-white/50">
                {locked ? `Available at rank ${info.unlockRank}` : `${info.role} · ${info.wage}/day`}
              </p>
            </div>
            <button
              type="button"
              className="farm-button !min-h-9 !w-auto flex-none px-3 text-[11px]"
              disabled={hired || locked || hud.coins < info.cost}
              onClick={() => onHire(id)}
            >
              {hired ? "On staff" : info.cost.toLocaleString()}
            </button>
          </div>
        );
      })}
    </div>
  );
}

function StoryPanel({ step, chapter }: { step: number; chapter: (typeof STORY)[number] }) {
  const complete = step >= STORY.length;

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-[#c7f284]/25 bg-[#c7f284]/8 p-4">
        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#c7f284]">
          {complete ? "Story complete" : `Chapter ${step + 1} of ${STORY.length}`}
        </p>
        <h3 className="mt-2 text-xl font-black">{complete ? "Keeper of the Valley" : chapter.title}</h3>
        <p className="mt-2 text-sm leading-6 text-white/65">
          {complete ? "Rowan's valley is yours, and everyone in Flux knows it." : chapter.text}
        </p>
        {!complete ? (
          <p className="mt-4 flex items-center gap-2 text-sm font-black">
            <Sprout className="h-4 w-4 text-[#c7f284]" />
            {chapter.objective}
            <span className="ml-auto text-[11px] font-bold text-white/50">
              +{chapter.reward.coins} coins · +{chapter.reward.xp} XP
            </span>
          </p>
        ) : null}
      </div>

      <div className="space-y-1.5">
        {STORY.map((entry, index) => (
          <div
            key={entry.id}
            className={cn(
              "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm",
              index < step ? "bg-white/5 text-white/45" : index === step ? "bg-white/8" : "text-white/28"
            )}
          >
            <span
              className={cn(
                "grid h-6 w-6 flex-none place-items-center rounded-full text-[10px] font-black",
                index < step ? "bg-[#c7f284] text-black" : "bg-white/10"
              )}
            >
              {index < step ? "✓" : index + 1}
            </span>
            <span className="min-w-0 flex-1 truncate font-bold">{entry.title}</span>
            <span className="flex-none text-[10px] text-white/35">{entry.objective}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function LeaderboardPanel({
  entries,
  loading,
  uid,
  onRefresh,
}: {
  entries: FluxFarmLeaderboardEntry[];
  loading: boolean;
  uid: string;
  onRefresh: () => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <p className="min-w-0 flex-1 text-xs leading-5 text-white/55">
          Every Flux farmer, ranked by experience. Your position updates each time the game saves.
        </p>
        <button type="button" className="farm-button farm-button-ghost !min-h-9 !w-auto px-4 text-[11px]" onClick={onRefresh}>
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="grid place-items-center py-14">
          <Loader2 className="h-6 w-6 animate-spin text-white/40" />
        </div>
      ) : entries.length === 0 ? (
        <p className="py-12 text-center text-sm text-white/45">
          No farms have been ranked yet. Play a few days and you will be first.
        </p>
      ) : (
        <div className="space-y-1.5">
          {entries.map((entry, index) => (
            <div
              key={entry.uid}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5",
                entry.uid === uid ? "bg-[#2f7d42]/35 ring-1 ring-[#c7f284]/40" : "bg-white/4"
              )}
            >
              <span
                className={cn(
                  "grid h-8 w-8 flex-none place-items-center rounded-full text-xs font-black",
                  index === 0
                    ? "bg-[#ffd45e] text-black"
                    : index === 1
                      ? "bg-[#d5dbe0] text-black"
                      : index === 2
                        ? "bg-[#c98b52] text-black"
                        : "bg-white/10"
                )}
              >
                {index + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-black">{entry.displayName}</p>
                <p className="truncate text-[11px] text-white/45">
                  Rank {entry.rank} · {entry.rankTitle} · day {entry.day}
                </p>
              </div>
              <div className="flex-none text-right">
                <p className="text-sm font-black text-[#c7f284]">{entry.xp.toLocaleString()} XP</p>
                <p className="text-[10px] text-white/40">{entry.harvested.toLocaleString()} harvested</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SettingsPanel({
  muted,
  zoom,
  onMuted,
  onZoom,
  onSave,
  audio,
}: {
  muted: boolean;
  zoom: number;
  onMuted: (value: boolean) => void;
  onZoom: (value: number) => void;
  onSave: () => void;
  audio: FarmAudio | null;
}) {
  const [music, setMusic] = useState(audio?.settings.music ?? 0.5);
  const [sfx, setSfx] = useState(audio?.settings.sfx ?? 0.85);
  const [ambience, setAmbience] = useState(audio?.settings.ambience ?? 0.6);

  return (
    <div className="space-y-3">
      <div className="farm-row">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-black">Sound</p>
          <p className="mt-1 text-[11px] text-white/50">
            Music, weather and effects are synthesised live in your browser — nothing is downloaded.
          </p>
        </div>
        <button type="button" className="farm-hud-button" onClick={() => onMuted(!muted)} aria-label={muted ? "Unmute" : "Mute"}>
          {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
        </button>
      </div>

      {(
        [
          ["Music", music, setMusic, "music"],
          ["Effects", sfx, setSfx, "sfx"],
          ["Ambience", ambience, setAmbience, "ambience"],
        ] as const
      ).map(([label, value, setter, key]) => (
        <label key={key} className="block rounded-2xl border border-white/9 bg-white/4 p-3">
          <span className="flex items-center text-xs font-black">
            {label}
            <span className="ml-auto text-white/45">{Math.round(value * 100)}%</span>
          </span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={value}
            onChange={(event) => {
              const next = Number(event.target.value);
              setter(next);
              audio?.setSettings({ [key]: next });
            }}
            className="mt-2 w-full accent-[#c7f284]"
          />
        </label>
      ))}

      <label className="block rounded-2xl border border-white/9 bg-white/4 p-3">
        <span className="flex items-center text-xs font-black">
          Camera zoom
          <span className="ml-auto text-white/45">{zoom.toFixed(1)}×</span>
        </span>
        <input
          type="range"
          min={1.2}
          max={3.2}
          step={0.1}
          value={zoom}
          onChange={(event) => onZoom(Number(event.target.value))}
          className="mt-2 w-full accent-[#c7f284]"
        />
      </label>

      <div className="rounded-2xl border border-white/9 bg-white/4 p-3 text-[11px] leading-5 text-white/55">
        <p className="mb-2 text-xs font-black text-white">Controls</p>
        <p>Desktop — WASD or arrows to walk, Space/E to use the tool, 1–5 to switch tools, Tab to change seed, Esc to pause.</p>
        <p className="mt-1.5">Touch — drag the left stick to walk, hold the green button to work, or tap any nearby tile.</p>
      </div>

      <button type="button" className="farm-button" onClick={onSave}>
        Save to my Flux account
      </button>
    </div>
  );
}

export type { Hud };
