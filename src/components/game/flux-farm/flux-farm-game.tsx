"use client";

import Link from "next/link";
import {
  ArrowLeft,
  Award,
  CloudRain,
  Coins,
  Expand,
  Hammer,
  HeartPulse,
  Leaf,
  Lock,
  Save,
  Settings,
  ShoppingBasket,
  Star,
  Sun,
  Trophy,
  Users,
  Volume2,
  VolumeX,
  Waves,
  Wind,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { UserProfile } from "@/types";
import {
  FARM_SEEDS,
  createDefaultFluxFarmSave,
  getFluxFarmRank,
  listFluxFarmLeaderboard,
  loadFluxFarmSave,
  saveFluxFarmProgress,
  type FluxFarmCrop,
  type FluxFarmLeaderboardEntry,
  type FluxFarmSave,
  type FluxFarmSeed,
  type FluxFarmWeather,
} from "@/services/flux-farm";
import { cn } from "@/lib/utils";

const WORLD_W = 960;
const WORLD_H = 640;
const PLOT_COLS = 8;
const PLOT_ROWS = 5;
const PLOT_X = 282;
const PLOT_Y = 166;
const PLOT_SIZE = 56;
const PLOT_GAP = 9;
const SAVE_EVERY_MS = 15_000;
const GAME_MINUTES_PER_SECOND = 4;

const WEATHER_LABEL: Record<FluxFarmWeather, string> = {
  clear: "Clear",
  cloudy: "Cloudy",
  rain: "Rain",
  storm: "Storm",
  fog: "Morning Fog",
  windy: "Windy",
};

const WEATHER_ICON: Record<FluxFarmWeather, typeof Sun> = {
  clear: Sun,
  cloudy: Wind,
  rain: CloudRain,
  storm: Waves,
  fog: CloudRain,
  windy: Wind,
};

const WORKERS = [
  { id: "mira" as const, name: "Mira", role: "Waters dry crops", unlock: 4, cost: 450, emoji: "🧑‍🌾" },
  { id: "leo" as const, name: "Leo", role: "Harvests ripe crops", unlock: 7, cost: 1200, emoji: "👨‍🌾" },
  { id: "nora" as const, name: "Nora", role: "Replants the selected seed", unlock: 10, cost: 2600, emoji: "👩‍🌾" },
];

const STORY = [
  { title: "A Field Left Behind", text: "Grandpa Rowan left you a quiet valley and one request: make the land alive again.", target: "Plant 3 crops", test: (s: FluxFarmSave) => s.stats.planted >= 3, reward: 50 },
  { title: "First Harvest", text: "The village bakery needs fresh grain before sunset.", target: "Harvest 3 crops", test: (s: FluxFarmSave) => s.stats.harvested >= 3, reward: 90 },
  { title: "Market Day", text: "Earn enough to repair the old bridge and reopen the village route.", target: "Earn 250 coins", test: (s: FluxFarmSave) => s.stats.coinsEarned >= 250, reward: 180 },
  { title: "More Hands", text: "The farm is growing. Hire Mira so the fields are never thirsty.", target: "Hire Mira", test: (s: FluxFarmSave) => Boolean(s.workers.find((w) => w.id === "mira")?.hired), reward: 300 },
  { title: "Beyond the Fence", text: "Open the north field and prove this valley can flourish again.", target: "Upgrade field to level 2", test: (s: FluxFarmSave) => s.upgrades.field >= 2, reward: 500 },
  { title: "Keeper of the Valley", text: "Reach rank 8 and become the farmer everyone in Flux knows.", target: "Reach rank 8", test: (s: FluxFarmSave) => getFluxFarmRank(s.xp).rank >= 8, reward: 1200 },
];

const EVENTS = [
  { id: "market", name: "Golden Market", text: "Crop prices are 35% higher until tomorrow.", icon: "🎪" },
  { id: "rainbow", name: "Rainbow Bloom", text: "All crops grow twice as fast today.", icon: "🌈" },
  { id: "migration", name: "Bird Migration", text: "Rare seeds may appear after every harvest.", icon: "🕊️" },
  { id: "lantern", name: "Lantern Night", text: "Night harvests grant bonus experience.", icon: "🏮" },
  { id: "drought", name: "Dry Wind", text: "Crops need extra water, but sell for more.", icon: "🌬️" },
];

type Panel = "shop" | "workers" | "story" | "leaderboard" | "upgrades" | null;
type Direction = "up" | "down" | "left" | "right";

type PlayerState = {
  x: number;
  y: number;
  facing: Direction;
  moving: boolean;
  target: { x: number; y: number } | null;
  step: number;
};

function cloneSave(save: FluxFarmSave): FluxFarmSave {
  return {
    ...save,
    seeds: { ...save.seeds },
    crops: save.crops.map((crop) => ({ ...crop })),
    workers: save.workers.map((worker) => ({ ...worker })),
    upgrades: { ...save.upgrades },
    stats: { ...save.stats },
  };
}

function pickWeather(day: number): FluxFarmWeather {
  const values: FluxFarmWeather[] = ["clear", "clear", "cloudy", "rain", "windy", "fog", "storm"];
  return values[(day * 7 + day * day * 3) % values.length];
}

function unlockedPlotCount(fieldLevel: number) {
  return Math.min(PLOT_COLS * PLOT_ROWS, 12 + Math.max(0, fieldLevel - 1) * 8);
}

function formatClock(minute: number) {
  const safe = ((Math.floor(minute) % 1440) + 1440) % 1440;
  const hours = Math.floor(safe / 60);
  const mins = safe % 60;
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}

function isNight(minute: number) {
  return minute < 360 || minute >= 1200;
}

function eventMultiplier(save: FluxFarmSave) {
  if (save.activeEvent === "market") return 1.35;
  if (save.activeEvent === "drought") return 1.2;
  return 1;
}

export function FluxFarmGame({ profile }: { profile: UserProfile }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const shellRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<PlayerState>({ x: 165, y: 370, facing: "down", moving: false, target: null, step: 0 });
  const keysRef = useRef(new Set<string>());
  const saveRef = useRef<FluxFarmSave>(createDefaultFluxFarmSave(profile.uid, profile.displayName, profile.avatarUrl));
  const lastFrameRef = useRef(0);
  const lastUiMinuteRef = useRef(-1);
  const workerClockRef = useRef(0);
  const leafParticlesRef = useRef(Array.from({ length: 34 }, (_, index) => ({
    x: (index * 83) % WORLD_W,
    y: (index * 47) % WORLD_H,
    speed: 18 + (index % 5) * 7,
    phase: index * 0.7,
  })));
  const rainParticlesRef = useRef(Array.from({ length: 90 }, (_, index) => ({
    x: (index * 67) % WORLD_W,
    y: (index * 29) % WORLD_H,
    speed: 230 + (index % 7) * 24,
  })));
  const audioRef = useRef<AudioContext | null>(null);
  const musicTimerRef = useRef<number | null>(null);

  const [save, setSave] = useState(saveRef.current);
  const [ready, setReady] = useState(false);
  const [panel, setPanel] = useState<Panel>(null);
  const [leaderboard, setLeaderboard] = useState<FluxFarmLeaderboardEntry[]>([]);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("Welcome home. The valley has been waiting for you.");
  const [messageVisible, setMessageVisible] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);

  const rank = useMemo(() => getFluxFarmRank(save.xp), [save.xp]);
  const WeatherIcon = WEATHER_ICON[save.weather];
  const story = STORY[Math.min(save.storyStep, STORY.length - 1)];

  const syncView = useCallback(() => {
    setSave(cloneSave(saveRef.current));
  }, []);

  const mutate = useCallback((update: (draft: FluxFarmSave) => void) => {
    const draft = cloneSave(saveRef.current);
    update(draft);
    draft.lastPlayedAt = Date.now();
    saveRef.current = draft;
    syncView();
  }, [syncView]);

  const announce = useCallback((text: string) => {
    setMessage(text);
    setMessageVisible(true);
    window.setTimeout(() => setMessageVisible(false), 4200);
  }, []);

  const ensureAudio = useCallback(() => {
    if (!soundEnabled || typeof window === "undefined") return null;
    const AudioCtor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtor) return null;
    if (!audioRef.current) audioRef.current = new AudioCtor();
    if (audioRef.current.state === "suspended") void audioRef.current.resume();
    return audioRef.current;
  }, [soundEnabled]);

  const playTone = useCallback((kind: "plant" | "water" | "harvest" | "coin" | "error" | "step") => {
    const ctx = ensureAudio();
    if (!ctx) return;
    const now = ctx.currentTime;
    const gain = ctx.createGain();
    const osc = ctx.createOscillator();
    const frequencies = { plant: 290, water: 520, harvest: 660, coin: 880, error: 130, step: 180 };
    osc.frequency.setValueAtTime(frequencies[kind], now);
    osc.type = kind === "water" ? "sine" : kind === "error" ? "sawtooth" : "triangle";
    gain.gain.setValueAtTime(kind === "step" ? 0.025 : 0.06, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + (kind === "coin" ? 0.42 : 0.22));
    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.45);
  }, [ensureAudio]);

  const playAmbientChord = useCallback(() => {
    const ctx = ensureAudio();
    if (!ctx || document.hidden) return;
    const root = isNight(saveRef.current.minuteOfDay) ? 196 : 220;
    [1, 1.25, 1.5].forEach((ratio, index) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = root * ratio;
      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.012 / (index + 1), ctx.currentTime + 0.5);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 3.6);
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 3.8);
    });
  }, [ensureAudio]);

  const persist = useCallback(async (quiet = true) => {
    const snapshot = cloneSave(saveRef.current);
    try {
      localStorage.setItem(`flux-farm:${profile.uid}`, JSON.stringify(snapshot));
      setSaving(true);
      await saveFluxFarmProgress(snapshot);
      if (!quiet) toast.success("Farm saved to Flux");
    } catch (error) {
      console.error(error);
      if (!quiet) toast.error("Cloud save failed — local save kept");
    } finally {
      setSaving(false);
    }
  }, [profile.uid]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const fallback = createDefaultFluxFarmSave(profile.uid, profile.displayName, profile.avatarUrl);
      let local = fallback;
      try {
        const stored = localStorage.getItem(`flux-farm:${profile.uid}`);
        if (stored) local = { ...fallback, ...JSON.parse(stored) } as FluxFarmSave;
      } catch {
        local = fallback;
      }
      try {
        const cloud = await loadFluxFarmSave(profile.uid, profile.displayName, profile.avatarUrl);
        const chosen = cloud.lastPlayedAt >= local.lastPlayedAt ? cloud : local;
        if (!cancelled) {
          saveRef.current = cloneSave(chosen);
          setSave(cloneSave(chosen));
          setReady(true);
        }
      } catch {
        if (!cancelled) {
          saveRef.current = cloneSave(local);
          setSave(cloneSave(local));
          setReady(true);
        }
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [profile.avatarUrl, profile.displayName, profile.uid]);

  useEffect(() => {
    if (!ready) return;
    const timer = window.setInterval(() => void persist(true), SAVE_EVERY_MS);
    const beforeUnload = () => {
      localStorage.setItem(`flux-farm:${profile.uid}`, JSON.stringify(saveRef.current));
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("beforeunload", beforeUnload);
      beforeUnload();
      void persist(true);
    };
  }, [persist, profile.uid, ready]);

  useEffect(() => {
    if (!soundEnabled) {
      if (musicTimerRef.current) window.clearInterval(musicTimerRef.current);
      musicTimerRef.current = null;
      return;
    }
    musicTimerRef.current = window.setInterval(playAmbientChord, 4600);
    return () => {
      if (musicTimerRef.current) window.clearInterval(musicTimerRef.current);
      musicTimerRef.current = null;
    };
  }, [playAmbientChord, soundEnabled]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if (["arrowup", "arrowdown", "arrowleft", "arrowright", "w", "a", "s", "d", " ", "e"].includes(key)) event.preventDefault();
      keysRef.current.add(key);
      if ((key === " " || key === "e") && !event.repeat) interactNearest();
    };
    const onKeyUp = (event: KeyboardEvent) => keysRef.current.delete(event.key.toLowerCase());
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  });

  const advanceStory = useCallback(() => {
    const current = STORY[saveRef.current.storyStep];
    if (!current || !current.test(saveRef.current)) return;
    mutate((draft) => {
      draft.coins += current.reward;
      draft.xp += Math.round(current.reward / 2);
      draft.storyStep = Math.min(STORY.length - 1, draft.storyStep + 1);
    });
    playTone("coin");
    announce(`Story complete: ${current.title}. +${current.reward} coins`);
  }, [announce, mutate, playTone]);

  const interactPlot = useCallback((plot: number) => {
    const current = saveRef.current;
    if (plot >= unlockedPlotCount(current.upgrades.field)) {
      playTone("error");
      announce("That field is still fenced off. Upgrade the field to unlock it.");
      return;
    }
    const existing = current.crops.find((crop) => crop.plot === plot);
    if (!existing) {
      const seedInfo = FARM_SEEDS[current.selectedSeed];
      if (getFluxFarmRank(current.xp).rank < seedInfo.unlockRank) {
        playTone("error");
        announce(`${seedInfo.name} unlocks at rank ${seedInfo.unlockRank}.`);
        return;
      }
      if (current.seeds[current.selectedSeed] <= 0) {
        playTone("error");
        announce(`You are out of ${seedInfo.name} seeds. Visit the farm shop.`);
        return;
      }
      if (current.energy < 2) {
        playTone("error");
        announce("You need a moment to rest. Energy returns over time.");
        return;
      }
      mutate((draft) => {
        draft.seeds[draft.selectedSeed] -= 1;
        draft.energy = Math.max(0, draft.energy - 2);
        draft.stats.planted += 1;
        draft.crops.push({
          id: `${Date.now()}-${plot}`,
          plot,
          seed: draft.selectedSeed,
          plantedAt: Date.now(),
          wateredAt: draft.minuteOfDay,
          growth: draft.weather === "rain" || draft.weather === "storm" ? 0.08 : 0,
          ready: false,
        });
      });
      playTone("plant");
      announce(`${seedInfo.name} planted. Keep the soil watered.`);
      window.setTimeout(advanceStory, 100);
      return;
    }
    if (existing.ready) {
      const info = FARM_SEEDS[existing.seed];
      mutate((draft) => {
        const crop = draft.crops.find((item) => item.id === existing.id);
        if (!crop) return;
        const barnBonus = 1 + (draft.upgrades.barn - 1) * 0.08;
        const nightXp = draft.activeEvent === "lantern" && isNight(draft.minuteOfDay) ? 1.5 : 1;
        const coins = Math.round(info.sellPrice * barnBonus * eventMultiplier(draft));
        draft.coins += coins;
        draft.xp += Math.round(info.xp * nightXp);
        draft.energy = Math.max(0, draft.energy - 1);
        draft.stats.harvested += 1;
        draft.stats.coinsEarned += coins;
        if (draft.activeEvent === "migration" && Math.random() > 0.55) draft.seeds[crop.seed] += 1;
        draft.crops = draft.crops.filter((item) => item.id !== crop.id);
      });
      playTone("harvest");
      window.setTimeout(() => playTone("coin"), 90);
      announce(`${info.name} sold at the farm gate.`);
      window.setTimeout(advanceStory, 100);
      return;
    }
    mutate((draft) => {
      const crop = draft.crops.find((item) => item.id === existing.id);
      if (!crop) return;
      crop.wateredAt = draft.minuteOfDay;
      crop.growth = Math.min(1, crop.growth + 0.025 * draft.upgrades.wateringCan);
      draft.energy = Math.max(0, draft.energy - 1);
    });
    playTone("water");
    announce(`${FARM_SEEDS[existing.seed].name} watered.`);
  }, [advanceStory, announce, mutate, playTone]);

  function plotCenter(plot: number) {
    const col = plot % PLOT_COLS;
    const row = Math.floor(plot / PLOT_COLS);
    return {
      x: PLOT_X + col * (PLOT_SIZE + PLOT_GAP) + PLOT_SIZE / 2,
      y: PLOT_Y + row * (PLOT_SIZE + PLOT_GAP) + PLOT_SIZE / 2,
    };
  }

  function nearestPlot() {
    const player = playerRef.current;
    let best = -1;
    let bestDistance = 92;
    for (let plot = 0; plot < PLOT_COLS * PLOT_ROWS; plot++) {
      const center = plotCenter(plot);
      const distance = Math.hypot(center.x - player.x, center.y - player.y);
      if (distance < bestDistance) {
        best = plot;
        bestDistance = distance;
      }
    }
    return best;
  }

  function interactNearest() {
    const plot = nearestPlot();
    if (plot >= 0) interactPlot(plot);
    else announce("Walk closer to a field plot, then press the action button.");
  }

  const buySeeds = useCallback((seed: FluxFarmSeed, amount: number) => {
    const info = FARM_SEEDS[seed];
    const total = info.seedCost * amount;
    if (getFluxFarmRank(saveRef.current.xp).rank < info.unlockRank) return announce(`${info.name} unlocks at rank ${info.unlockRank}.`);
    if (saveRef.current.coins < total) return announce("Not enough coins yet.");
    mutate((draft) => {
      draft.coins -= total;
      draft.seeds[seed] += amount;
    });
    playTone("coin");
  }, [announce, mutate, playTone]);

  const buyUpgrade = useCallback((type: keyof FluxFarmSave["upgrades"]) => {
    const level = saveRef.current.upgrades[type];
    const base = { wateringCan: 220, barn: 400, house: 550, field: 650 }[type];
    const cost = base * level;
    if (saveRef.current.coins < cost) return announce("Not enough coins for that upgrade.");
    mutate((draft) => {
      draft.coins -= cost;
      draft.upgrades[type] += 1;
    });
    playTone("coin");
    announce(`${type === "wateringCan" ? "Watering can" : type} upgraded to level ${level + 1}.`);
    window.setTimeout(advanceStory, 100);
  }, [advanceStory, announce, mutate, playTone]);

  const hireWorker = useCallback((id: "mira" | "leo" | "nora") => {
    const worker = WORKERS.find((item) => item.id === id);
    if (!worker) return;
    const currentRank = getFluxFarmRank(saveRef.current.xp).rank;
    if (currentRank < worker.unlock) return announce(`${worker.name} becomes available at rank ${worker.unlock}.`);
    if (saveRef.current.coins < worker.cost) return announce("You need more coins to hire this farmer.");
    mutate((draft) => {
      draft.coins -= worker.cost;
      const target = draft.workers.find((item) => item.id === id);
      if (target) {
        target.hired = true;
        target.hiredAt = Date.now();
      }
    });
    playTone("coin");
    announce(`${worker.name} joined the farm!`);
    window.setTimeout(advanceStory, 100);
  }, [advanceStory, announce, mutate, playTone]);

  const refreshLeaderboard = useCallback(async () => {
    await persist(true);
    try {
      setLeaderboard(await listFluxFarmLeaderboard(20));
    } catch {
      toast.error("Could not load the leaderboard");
    }
  }, [persist]);

  useEffect(() => {
    if (panel === "leaderboard") void refreshLeaderboard();
  }, [panel, refreshLeaderboard]);

  useEffect(() => {
    const onFullscreen = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onFullscreen);
    return () => document.removeEventListener("fullscreenchange", onFullscreen);
  }, []);

  const toggleFullscreen = async () => {
    if (!shellRef.current) return;
    if (document.fullscreenElement) await document.exitFullscreen();
    else await shellRef.current.requestFullscreen();
  };

  useEffect(() => {
    if (!ready) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let frame = 0;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.floor(rect.width * dpr));
      canvas.height = Math.max(1, Math.floor(rect.height * dpr));
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);

    const render = (time: number) => {
      const dt = Math.min(0.04, (time - (lastFrameRef.current || time)) / 1000);
      lastFrameRef.current = time;
      updatePlayer(dt);
      updateWorld(dt);
      drawWorld(ctx, canvas, time / 1000);
      frame = requestAnimationFrame(render);
    };
    frame = requestAnimationFrame(render);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [ready]);

  function updatePlayer(dt: number) {
    const player = playerRef.current;
    const keys = keysRef.current;
    let dx = 0;
    let dy = 0;
    if (keys.has("w") || keys.has("arrowup")) dy -= 1;
    if (keys.has("s") || keys.has("arrowdown")) dy += 1;
    if (keys.has("a") || keys.has("arrowleft")) dx -= 1;
    if (keys.has("d") || keys.has("arrowright")) dx += 1;
    if (!dx && !dy && player.target) {
      const tx = player.target.x - player.x;
      const ty = player.target.y - player.y;
      const distance = Math.hypot(tx, ty);
      if (distance < 7) player.target = null;
      else {
        dx = tx / distance;
        dy = ty / distance;
      }
    }
    if (dx || dy) {
      const length = Math.hypot(dx, dy) || 1;
      dx /= length;
      dy /= length;
      const speed = 142;
      player.x = Math.max(24, Math.min(WORLD_W - 24, player.x + dx * speed * dt));
      player.y = Math.max(90, Math.min(WORLD_H - 25, player.y + dy * speed * dt));
      player.moving = true;
      player.step += dt * 9;
      if (Math.abs(dx) > Math.abs(dy)) player.facing = dx > 0 ? "right" : "left";
      else player.facing = dy > 0 ? "down" : "up";
    } else {
      player.moving = false;
    }
  }

  function updateWorld(dt: number) {
    const current = saveRef.current;
    current.minuteOfDay += dt * GAME_MINUTES_PER_SECOND;
    current.energy = Math.min(100, current.energy + dt * 0.45);
    if (current.minuteOfDay >= 1440) {
      current.minuteOfDay -= 1440;
      current.day += 1;
      current.weather = pickWeather(current.day);
      if (current.weather === "rain" || current.weather === "storm") current.stats.rainyDays += 1;
      if (current.day % 3 === 0) {
        const event = EVENTS[(current.day / 3 + current.day) % EVENTS.length];
        current.activeEvent = event.id;
        current.stats.eventsSeen += 1;
        announce(`${event.icon} ${event.name}: ${event.text}`);
      } else {
        current.activeEvent = null;
      }
      syncView();
    }
    const rain = current.weather === "rain" || current.weather === "storm";
    for (const crop of current.crops) {
      if (crop.ready) continue;
      const info = FARM_SEEDS[crop.seed];
      const recentlyWatered = rain || Math.abs(current.minuteOfDay - crop.wateredAt) < 260;
      const eventBoost = current.activeEvent === "rainbow" ? 2 : 1;
      const droughtPenalty = current.activeEvent === "drought" ? 0.62 : 1;
      const waterFactor = recentlyWatered ? 1 : 0.18;
      crop.growth = Math.min(1, crop.growth + (dt * GAME_MINUTES_PER_SECOND / info.growMinutes) * eventBoost * droughtPenalty * waterFactor);
      crop.ready = crop.growth >= 1;
    }
    workerClockRef.current += dt;
    if (workerClockRef.current >= 7) {
      workerClockRef.current = 0;
      runWorkers();
    }
    const uiMinute = Math.floor(current.minuteOfDay);
    if (uiMinute !== lastUiMinuteRef.current && uiMinute % 4 === 0) {
      lastUiMinuteRef.current = uiMinute;
      syncView();
    }
  }

  function runWorkers() {
    const current = saveRef.current;
    const mira = current.workers.find((worker) => worker.id === "mira")?.hired;
    const leo = current.workers.find((worker) => worker.id === "leo")?.hired;
    const nora = current.workers.find((worker) => worker.id === "nora")?.hired;
    if (mira) {
      const thirsty = current.crops.find((crop) => !crop.ready && Math.abs(current.minuteOfDay - crop.wateredAt) > 180);
      if (thirsty) thirsty.wateredAt = current.minuteOfDay;
    }
    if (leo) {
      const readyCrop = current.crops.find((crop) => crop.ready);
      if (readyCrop) {
        const info = FARM_SEEDS[readyCrop.seed];
        const coins = Math.round(info.sellPrice * (1 + (current.upgrades.barn - 1) * 0.08) * eventMultiplier(current));
        current.coins += coins;
        current.xp += Math.round(info.xp * 0.75);
        current.stats.harvested += 1;
        current.stats.coinsEarned += coins;
        current.crops = current.crops.filter((crop) => crop.id !== readyCrop.id);
      }
    }
    if (nora) {
      const openPlot = Array.from({ length: unlockedPlotCount(current.upgrades.field) }, (_, index) => index)
        .find((plot) => !current.crops.some((crop) => crop.plot === plot));
      if (openPlot !== undefined && current.seeds[current.selectedSeed] > 0) {
        current.seeds[current.selectedSeed] -= 1;
        current.stats.planted += 1;
        current.crops.push({ id: `${Date.now()}-${openPlot}`, plot: openPlot, seed: current.selectedSeed, plantedAt: Date.now(), wateredAt: current.minuteOfDay, growth: 0, ready: false });
      }
    }
    syncView();
  }

  function canvasPoint(event: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * WORLD_W,
      y: ((event.clientY - rect.top) / rect.height) * WORLD_H,
    };
  }

  const onCanvasPointer = (event: React.PointerEvent<HTMLCanvasElement>) => {
    ensureAudio();
    const point = canvasPoint(event);
    if (!point) return;
    for (let plot = 0; plot < PLOT_COLS * PLOT_ROWS; plot++) {
      const col = plot % PLOT_COLS;
      const row = Math.floor(plot / PLOT_COLS);
      const x = PLOT_X + col * (PLOT_SIZE + PLOT_GAP);
      const y = PLOT_Y + row * (PLOT_SIZE + PLOT_GAP);
      if (point.x >= x && point.x <= x + PLOT_SIZE && point.y >= y && point.y <= y + PLOT_SIZE) {
        playerRef.current.target = { x: x - 25, y: y + PLOT_SIZE + 20 };
        window.setTimeout(() => interactPlot(plot), 250);
        return;
      }
    }
    playerRef.current.target = point;
  };

  const pressDirection = (direction: Direction, pressed: boolean) => {
    const key = { up: "arrowup", down: "arrowdown", left: "arrowleft", right: "arrowright" }[direction];
    if (pressed) keysRef.current.add(key);
    else keysRef.current.delete(key);
  };

  function drawWorld(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, time: number) {
    const dpr = canvas.width / canvas.getBoundingClientRect().width;
    const scaleX = canvas.getBoundingClientRect().width / WORLD_W;
    const scaleY = canvas.getBoundingClientRect().height / WORLD_H;
    ctx.setTransform(dpr * scaleX, 0, 0, dpr * scaleY, 0, 0);
    ctx.clearRect(0, 0, WORLD_W, WORLD_H);
    drawGround(ctx, time);
    drawPaths(ctx);
    drawPond(ctx, time);
    drawHouse(ctx);
    drawBarn(ctx);
    drawTrees(ctx, time);
    drawPlots(ctx, time);
    drawWorkers(ctx, time);
    drawPlayer(ctx, time);
    drawWeather(ctx, time);
    drawNight(ctx);
  }

  function drawGround(ctx: CanvasRenderingContext2D, time: number) {
    const gradient = ctx.createLinearGradient(0, 0, 0, WORLD_H);
    gradient.addColorStop(0, saveRef.current.weather === "fog" ? "#91b49a" : "#79b86a");
    gradient.addColorStop(1, "#4e8b4e");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, WORLD_W, WORLD_H);
    ctx.globalAlpha = 0.12;
    for (let x = 0; x < WORLD_W; x += 28) {
      for (let y = 0; y < WORLD_H; y += 28) {
        const sway = Math.sin(time * 1.8 + x * 0.04 + y * 0.03) * 2;
        ctx.strokeStyle = "#d9f5b5";
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(x, y + 8);
        ctx.quadraticCurveTo(x + sway, y + 2, x + 3 + sway, y - 2);
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
  }

  function drawPaths(ctx: CanvasRenderingContext2D) {
    ctx.strokeStyle = "#d8bd86";
    ctx.lineCap = "round";
    ctx.lineWidth = 42;
    ctx.beginPath();
    ctx.moveTo(170, 250);
    ctx.bezierCurveTo(220, 320, 220, 460, 330, 590);
    ctx.stroke();
    ctx.lineWidth = 28;
    ctx.beginPath();
    ctx.moveTo(170, 310);
    ctx.lineTo(690, 310);
    ctx.stroke();
    ctx.strokeStyle = "rgba(255,255,255,.18)";
    ctx.lineWidth = 3;
    ctx.setLineDash([10, 18]);
    ctx.beginPath();
    ctx.moveTo(170, 310);
    ctx.lineTo(690, 310);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  function drawHouse(ctx: CanvasRenderingContext2D) {
    ctx.save();
    ctx.shadowColor = "rgba(29,45,24,.35)";
    ctx.shadowBlur = 20;
    ctx.shadowOffsetY = 12;
    ctx.fillStyle = "#f5d9a5";
    roundRect(ctx, 54, 78, 206, 142, 18, true);
    ctx.fillStyle = "#b64f43";
    ctx.beginPath();
    ctx.moveTo(34, 104);
    ctx.lineTo(156, 26);
    ctx.lineTo(278, 104);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#6d352b";
    ctx.fillRect(132, 144, 48, 76);
    ctx.fillStyle = "#8ed2e9";
    ctx.fillRect(76, 128, 38, 38);
    ctx.fillRect(198, 128, 38, 38);
    ctx.strokeStyle = "rgba(255,255,255,.6)";
    ctx.lineWidth = 3;
    ctx.strokeRect(76, 128, 38, 38);
    ctx.strokeRect(198, 128, 38, 38);
    ctx.restore();
    ctx.fillStyle = "rgba(29,31,24,.7)";
    ctx.font = "700 13px system-ui";
    ctx.fillText("Rowan House", 92, 242);
  }

  function drawBarn(ctx: CanvasRenderingContext2D) {
    ctx.save();
    ctx.shadowColor = "rgba(31,28,20,.28)";
    ctx.shadowBlur = 16;
    ctx.shadowOffsetY = 10;
    ctx.fillStyle = "#a8443b";
    roundRect(ctx, 730, 78, 160, 132, 14, true);
    ctx.fillStyle = "#6c2b2a";
    ctx.beginPath();
    ctx.moveTo(710, 100);
    ctx.lineTo(810, 35);
    ctx.lineTo(910, 100);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#f3dfb2";
    ctx.fillRect(782, 130, 56, 80);
    ctx.strokeStyle = "#9e7752";
    ctx.lineWidth = 5;
    ctx.strokeRect(782, 130, 56, 80);
    ctx.restore();
    ctx.fillStyle = "rgba(29,31,24,.7)";
    ctx.font = "700 13px system-ui";
    ctx.fillText(`Barn Lv.${saveRef.current.upgrades.barn}`, 767, 232);
  }

  function drawPond(ctx: CanvasRenderingContext2D, time: number) {
    ctx.save();
    ctx.fillStyle = "#4aa4c5";
    ctx.beginPath();
    ctx.ellipse(770, 500, 125, 72, -0.08, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(208,245,255,.65)";
    ctx.lineWidth = 3;
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.ellipse(735 + i * 28, 494 + Math.sin(time + i) * 4, 18, 5, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.fillStyle = "#4c8a45";
    for (let i = 0; i < 7; i++) {
      ctx.beginPath();
      ctx.ellipse(680 + i * 31, 545 + (i % 2) * 8, 10, 6, 0.2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawTrees(ctx: CanvasRenderingContext2D, time: number) {
    const trees = [[25, 285], [80, 335], [36, 440], [95, 520], [910, 300], [905, 410], [610, 78], [650, 55]];
    const wind = saveRef.current.weather === "windy" || saveRef.current.weather === "storm" ? 6 : 2;
    for (const [x, y] of trees) {
      const sway = Math.sin(time * 2.2 + x) * wind;
      ctx.fillStyle = "#6d472e";
      roundRect(ctx, x - 7, y, 14, 46, 6, true);
      ctx.fillStyle = "#2d713e";
      ctx.beginPath();
      ctx.arc(x + sway, y - 4, 34, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#3f8d4e";
      ctx.beginPath();
      ctx.arc(x - 18 + sway, y + 5, 25, 0, Math.PI * 2);
      ctx.arc(x + 20 + sway, y + 6, 25, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawPlots(ctx: CanvasRenderingContext2D, time: number) {
    const unlocked = unlockedPlotCount(saveRef.current.upgrades.field);
    for (let plot = 0; plot < PLOT_COLS * PLOT_ROWS; plot++) {
      const col = plot % PLOT_COLS;
      const row = Math.floor(plot / PLOT_COLS);
      const x = PLOT_X + col * (PLOT_SIZE + PLOT_GAP);
      const y = PLOT_Y + row * (PLOT_SIZE + PLOT_GAP);
      const active = plot < unlocked;
      ctx.fillStyle = active ? "#8a5a36" : "rgba(45,63,44,.45)";
      roundRect(ctx, x, y, PLOT_SIZE, PLOT_SIZE, 10, true);
      ctx.strokeStyle = active ? "rgba(255,221,165,.24)" : "rgba(255,255,255,.08)";
      ctx.lineWidth = 2;
      roundRect(ctx, x + 2, y + 2, PLOT_SIZE - 4, PLOT_SIZE - 4, 8, false, true);
      if (!active) {
        ctx.fillStyle = "rgba(255,255,255,.35)";
        ctx.font = "700 16px system-ui";
        ctx.fillText("🔒", x + 18, y + 34);
        continue;
      }
      const crop = saveRef.current.crops.find((item) => item.plot === plot);
      if (crop) drawCrop(ctx, crop, x + PLOT_SIZE / 2, y + PLOT_SIZE / 2, time);
      else {
        ctx.strokeStyle = "rgba(62,33,16,.32)";
        ctx.lineWidth = 1;
        for (let line = 1; line < 4; line++) {
          ctx.beginPath();
          ctx.moveTo(x + 8, y + line * 12);
          ctx.lineTo(x + PLOT_SIZE - 8, y + line * 12);
          ctx.stroke();
        }
      }
    }
  }

  function drawCrop(ctx: CanvasRenderingContext2D, crop: FluxFarmCrop, x: number, y: number, time: number) {
    const stage = crop.ready ? 4 : Math.max(1, Math.ceil(crop.growth * 4));
    const sway = Math.sin(time * 2.5 + crop.plot) * (saveRef.current.weather === "windy" ? 4 : 1.5);
    const height = 8 + stage * 8;
    ctx.strokeStyle = "#2f7d3b";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(x, y + 19);
    ctx.quadraticCurveTo(x + sway, y, x + sway, y + 19 - height);
    ctx.stroke();
    const colors: Record<FluxFarmSeed, string> = {
      wheat: "#f5c94f",
      carrot: "#f47c2d",
      corn: "#f0d34f",
      tomato: "#ed4d43",
      strawberry: "#e83d59",
      pumpkin: "#e97825",
    };
    ctx.fillStyle = colors[crop.seed];
    const count = stage >= 4 ? 3 : 1;
    for (let i = 0; i < count; i++) {
      ctx.beginPath();
      ctx.arc(x + sway + (i - 1) * 8, y + 19 - height + (i % 2) * 4, 4 + stage, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = "#4b9b4c";
    ctx.beginPath();
    ctx.ellipse(x - 7 + sway, y + 6, 9, 4, -0.45, 0, Math.PI * 2);
    ctx.ellipse(x + 7 + sway, y + 2, 9, 4, 0.45, 0, Math.PI * 2);
    ctx.fill();
    if (crop.ready) {
      ctx.fillStyle = "#fff5b8";
      ctx.beginPath();
      ctx.arc(x + 19, y - 19, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#63430b";
      ctx.font = "900 13px system-ui";
      ctx.fillText("!", x + 17, y - 14);
    }
  }

  function drawWorkers(ctx: CanvasRenderingContext2D, time: number) {
    const hired = saveRef.current.workers.filter((worker) => worker.hired);
    hired.forEach((worker, index) => {
      const x = 235 + index * 48 + Math.sin(time + index) * 5;
      const y = 510 + Math.cos(time * 0.7 + index) * 8;
      drawAvatar(ctx, x, y, index % 2 ? "#598bd2" : "#d27c59", worker.id === "mira" ? "#85522c" : worker.id === "leo" ? "#3d3329" : "#bf934f", 0);
      ctx.fillStyle = "rgba(20,30,20,.72)";
      ctx.font = "700 10px system-ui";
      ctx.fillText(worker.id[0].toUpperCase() + worker.id.slice(1), x - 13, y + 35);
    });
  }

  function drawPlayer(ctx: CanvasRenderingContext2D, time: number) {
    const player = playerRef.current;
    const bob = player.moving ? Math.sin(player.step * Math.PI) * 2.5 : Math.sin(time * 2) * 0.5;
    drawAvatar(ctx, player.x, player.y + bob, "#6b5bf2", "#5b3828", player.step);
    const nearest = nearestPlot();
    if (nearest >= 0) {
      const center = plotCenter(nearest);
      ctx.strokeStyle = "rgba(255,255,255,.7)";
      ctx.lineWidth = 3;
      ctx.setLineDash([7, 7]);
      ctx.beginPath();
      ctx.arc(center.x, center.y, 34, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  function drawAvatar(ctx: CanvasRenderingContext2D, x: number, y: number, shirt: string, hair: string, step: number) {
    ctx.save();
    ctx.shadowColor = "rgba(14,31,19,.3)";
    ctx.shadowBlur = 9;
    ctx.shadowOffsetY = 5;
    ctx.fillStyle = "rgba(20,32,20,.2)";
    ctx.beginPath();
    ctx.ellipse(x, y + 25, 17, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowColor = "transparent";
    const leg = Math.sin(step * Math.PI) * 3;
    ctx.fillStyle = "#283449";
    roundRect(ctx, x - 12, y + 11, 9, 18 + leg, 4, true);
    roundRect(ctx, x + 3, y + 11, 9, 18 - leg, 4, true);
    ctx.fillStyle = shirt;
    roundRect(ctx, x - 16, y - 8, 32, 30, 10, true);
    ctx.fillStyle = "#efbd8e";
    ctx.beginPath();
    ctx.arc(x, y - 19, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = hair;
    ctx.beginPath();
    ctx.arc(x, y - 24, 14, Math.PI, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(x - 5, y - 18, 2.3, 0, Math.PI * 2);
    ctx.arc(x + 5, y - 18, 2.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawWeather(ctx: CanvasRenderingContext2D, time: number) {
    const weather = saveRef.current.weather;
    if (weather === "rain" || weather === "storm") {
      ctx.strokeStyle = weather === "storm" ? "rgba(205,229,255,.72)" : "rgba(210,238,255,.55)";
      ctx.lineWidth = weather === "storm" ? 2.1 : 1.4;
      for (const drop of rainParticlesRef.current) {
        drop.y += drop.speed / 60;
        drop.x -= weather === "storm" ? 2.5 : 0.8;
        if (drop.y > WORLD_H + 20) {
          drop.y = -20;
          drop.x = (drop.x + 173) % WORLD_W;
        }
        ctx.beginPath();
        ctx.moveTo(drop.x, drop.y);
        ctx.lineTo(drop.x - 8, drop.y + 18);
        ctx.stroke();
      }
    }
    if (weather === "windy" || weather === "storm") {
      ctx.fillStyle = "rgba(239,190,68,.72)";
      for (const leaf of leafParticlesRef.current) {
        leaf.x += leaf.speed / 60;
        leaf.y += Math.sin(time * 2 + leaf.phase) * 0.6;
        if (leaf.x > WORLD_W + 10) leaf.x = -10;
        ctx.save();
        ctx.translate(leaf.x, leaf.y);
        ctx.rotate(time * 2 + leaf.phase);
        ctx.beginPath();
        ctx.ellipse(0, 0, 5, 2.5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }
    if (weather === "fog") {
      const fog = ctx.createLinearGradient(0, 0, WORLD_W, 0);
      fog.addColorStop(0, "rgba(235,245,239,.18)");
      fog.addColorStop(0.5, "rgba(235,245,239,.43)");
      fog.addColorStop(1, "rgba(235,245,239,.2)");
      ctx.fillStyle = fog;
      ctx.fillRect(0, 0, WORLD_W, WORLD_H);
    }
  }

  function drawNight(ctx: CanvasRenderingContext2D) {
    const minute = saveRef.current.minuteOfDay;
    let alpha = 0;
    if (minute >= 1140) alpha = Math.min(0.55, (minute - 1140) / 300 * 0.55);
    else if (minute < 390) alpha = Math.min(0.55, (390 - minute) / 390 * 0.55);
    if (alpha <= 0) return;
    ctx.fillStyle = `rgba(20,28,75,${alpha})`;
    ctx.fillRect(0, 0, WORLD_W, WORLD_H);
    const player = playerRef.current;
    const glow = ctx.createRadialGradient(player.x, player.y, 10, player.x, player.y, 120);
    glow.addColorStop(0, `rgba(255,230,160,${alpha * 0.8})`);
    glow.addColorStop(1, "rgba(255,230,160,0)");
    ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(player.x, player.y, 120, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = "source-over";
  }

  if (!ready) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#152419] text-white">
        <div className="text-center"><Leaf className="mx-auto h-12 w-12 animate-bounce text-emerald-300" /><p className="mt-4 font-black">Loading your Flux farm…</p></div>
      </div>
    );
  }

  return (
    <div ref={shellRef} className="relative flex min-h-[100dvh] flex-col overflow-hidden bg-[#152419] text-white select-none">
      <header className="z-40 flex min-h-16 items-center gap-2 border-b border-white/10 bg-[#122118]/92 px-2.5 py-2 backdrop-blur-xl sm:px-4">
        <Link href="/games" className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-white/10 bg-white/8 transition hover:bg-white/14" aria-label="Back to games"><ArrowLeft className="h-5 w-5" /></Link>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2"><span className="text-lg">🌻</span><h1 className="truncate text-base font-black tracking-[-0.03em] sm:text-lg">Flux Farm</h1><span className="hidden rounded-full bg-emerald-400/15 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-emerald-200 sm:inline">Live save</span></div>
          <p className="truncate text-[10px] font-semibold text-white/50 sm:text-xs">Day {save.day} · {formatClock(save.minuteOfDay)} · {WEATHER_LABEL[save.weather]}</p>
        </div>
        <div className="hidden items-center gap-2 md:flex">
          <HudChip icon={Coins} value={save.coins.toLocaleString()} label="Coins" />
          <HudChip icon={Award} value={`${rank.rank}`} label={rank.title} />
          <HudChip icon={HeartPulse} value={`${Math.round(save.energy)}%`} label="Energy" />
        </div>
        <button type="button" onClick={() => { setSoundEnabled((value) => !value); ensureAudio(); }} className="grid h-10 w-10 place-items-center rounded-xl bg-white/8 hover:bg-white/14" aria-label="Toggle sound">{soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}</button>
        <button type="button" onClick={toggleFullscreen} className="grid h-10 w-10 place-items-center rounded-xl bg-white/8 hover:bg-white/14" aria-label="Toggle fullscreen"><Expand className="h-4 w-4" /></button>
        <button type="button" onClick={() => void persist(false)} className="grid h-10 w-10 place-items-center rounded-xl bg-white/8 hover:bg-white/14" aria-label="Save game">{saving ? <Save className="h-4 w-4 animate-pulse" /> : <Save className="h-4 w-4" />}</button>
      </header>

      <main className="relative flex min-h-0 flex-1">
        <canvas ref={canvasRef} onPointerDown={onCanvasPointer} className="h-[calc(100dvh-8rem)] min-h-[440px] w-full touch-none bg-[#5b9859] sm:h-[calc(100dvh-4rem)]" aria-label="Flux Farm game world" />

        <div className="pointer-events-none absolute left-2 top-2 z-20 flex flex-wrap gap-2 sm:left-4 sm:top-4 md:hidden">
          <HudChip icon={Coins} value={save.coins.toLocaleString()} label="Coins" compact />
          <HudChip icon={Award} value={`R${rank.rank}`} label={rank.title} compact />
          <HudChip icon={HeartPulse} value={`${Math.round(save.energy)}%`} label="Energy" compact />
        </div>

        <div className="pointer-events-none absolute right-2 top-2 z-20 flex flex-col items-end gap-2 sm:right-4 sm:top-4">
          <div className="pointer-events-auto flex items-center gap-2 rounded-2xl border border-white/12 bg-[#102016]/84 px-3 py-2 shadow-xl backdrop-blur-xl">
            <WeatherIcon className="h-4 w-4 text-sky-200" /><span className="text-xs font-black">{WEATHER_LABEL[save.weather]}</span><span className="text-[10px] text-white/45">{formatClock(save.minuteOfDay)}</span>
          </div>
          {save.activeEvent ? <button type="button" onClick={() => setPanel("story")} className="pointer-events-auto max-w-[230px] rounded-2xl border border-amber-200/20 bg-amber-400/12 px-3 py-2 text-left text-xs font-bold text-amber-100 backdrop-blur-xl">{EVENTS.find((event) => event.id === save.activeEvent)?.icon} {EVENTS.find((event) => event.id === save.activeEvent)?.name}</button> : null}
        </div>

        <div className={cn("absolute left-1/2 top-24 z-30 w-[min(90vw,520px)] -translate-x-1/2 transition duration-300", messageVisible ? "translate-y-0 opacity-100" : "pointer-events-none -translate-y-3 opacity-0")}>
          <div className="rounded-2xl border border-white/12 bg-[#102016]/92 px-4 py-3 text-center text-sm font-bold shadow-2xl backdrop-blur-xl">{message}</div>
        </div>

        <div className="absolute bottom-3 left-3 z-30 hidden w-36 grid-cols-3 gap-1 md:grid">
          <div />
          <ControlButton label="Up" onPress={(pressed) => pressDirection("up", pressed)}>▲</ControlButton>
          <div />
          <ControlButton label="Left" onPress={(pressed) => pressDirection("left", pressed)}>◀</ControlButton>
          <button type="button" onClick={interactNearest} className="grid h-12 place-items-center rounded-2xl border border-amber-200/30 bg-amber-400/90 text-xs font-black text-amber-950 shadow-xl active:scale-95">ACT</button>
          <ControlButton label="Right" onPress={(pressed) => pressDirection("right", pressed)}>▶</ControlButton>
          <div />
          <ControlButton label="Down" onPress={(pressed) => pressDirection("down", pressed)}>▼</ControlButton>
          <div />
        </div>

        <div className="absolute bottom-3 right-3 z-30 hidden flex-col gap-2 sm:flex">
          <QuickButton icon={ShoppingBasket} label="Seeds" onClick={() => setPanel("shop")} />
          <QuickButton icon={Users} label="Farmers" onClick={() => setPanel("workers")} />
          <QuickButton icon={Hammer} label="Upgrades" onClick={() => setPanel("upgrades")} />
          <QuickButton icon={Star} label="Story" onClick={() => setPanel("story")} />
          <QuickButton icon={Trophy} label="Ranks" onClick={() => setPanel("leaderboard")} />
        </div>

        <div className="absolute bottom-3 left-1/2 z-30 flex max-w-[calc(100vw-210px)] -translate-x-1/2 gap-1.5 overflow-x-auto rounded-2xl border border-white/12 bg-[#102016]/88 p-2 shadow-2xl backdrop-blur-xl no-scrollbar sm:max-w-[70vw]">
          {(Object.keys(FARM_SEEDS) as FluxFarmSeed[]).map((seed) => {
            const info = FARM_SEEDS[seed];
            const locked = rank.rank < info.unlockRank;
            return <button key={seed} type="button" disabled={locked} onClick={() => mutate((draft) => { draft.selectedSeed = seed; })} className={cn("relative min-w-14 rounded-xl px-2 py-1.5 text-center transition", save.selectedSeed === seed ? "bg-emerald-400 text-emerald-950 shadow-lg" : "bg-white/8 hover:bg-white/14", locked && "opacity-45")}><span className="block text-xl">{info.emoji}</span><span className="block text-[9px] font-black">{locked ? `R${info.unlockRank}` : save.seeds[seed]}</span></button>;
          })}
        </div>
      </main>

      <nav className="z-40 grid h-16 grid-cols-5 border-t border-white/10 bg-[#122118]/96 px-1 pb-[env(safe-area-inset-bottom)] sm:hidden">
        <MobileMenuButton icon={ShoppingBasket} label="Seeds" onClick={() => setPanel("shop")} />
        <MobileMenuButton icon={Users} label="Farmers" onClick={() => setPanel("workers")} />
        <button type="button" onClick={interactNearest} className="-mt-4 mx-auto grid h-14 w-14 place-items-center rounded-full bg-gradient-to-br from-amber-300 to-orange-500 text-xs font-black text-amber-950 shadow-2xl ring-4 ring-[#122118]">ACT</button>
        <MobileMenuButton icon={Hammer} label="Upgrade" onClick={() => setPanel("upgrades")} />
        <MobileMenuButton icon={Trophy} label="Ranks" onClick={() => setPanel("leaderboard")} />
      </nav>

      {panel ? <GamePanel panel={panel} onClose={() => setPanel(null)} save={save} rank={rank} leaderboard={leaderboard} onBuySeeds={buySeeds} onHire={hireWorker} onUpgrade={buyUpgrade} onRefreshLeaderboard={refreshLeaderboard} /> : null}

      {!fullscreen ? <div className="pointer-events-none absolute bottom-20 left-3 z-20 hidden rounded-xl bg-black/30 px-3 py-2 text-[10px] font-semibold text-white/65 lg:block">WASD / arrows to move · E or Space to farm · tap plots on mobile</div> : null}
    </div>
  );
}

function GamePanel({ panel, onClose, save, rank, leaderboard, onBuySeeds, onHire, onUpgrade, onRefreshLeaderboard }: {
  panel: Exclude<Panel, null>;
  onClose: () => void;
  save: FluxFarmSave;
  rank: ReturnType<typeof getFluxFarmRank>;
  leaderboard: FluxFarmLeaderboardEntry[];
  onBuySeeds: (seed: FluxFarmSeed, amount: number) => void;
  onHire: (id: "mira" | "leo" | "nora") => void;
  onUpgrade: (type: keyof FluxFarmSave["upgrades"]) => void;
  onRefreshLeaderboard: () => Promise<void>;
}) {
  return (
    <div className="absolute inset-0 z-50 flex items-end justify-center bg-black/45 p-0 backdrop-blur-sm sm:items-center sm:p-5" onPointerDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="max-h-[84dvh] w-full overflow-hidden rounded-t-[28px] border border-white/12 bg-[#14251a] shadow-2xl sm:max-w-2xl sm:rounded-[30px]">
        <header className="flex items-center justify-between border-b border-white/10 px-5 py-4"><div><h2 className="text-xl font-black">{panel === "shop" ? "Seed Market" : panel === "workers" ? "Hire Farmers" : panel === "upgrades" ? "Farm Upgrades" : panel === "story" ? "Valley Story" : "Flux Farm Rankings"}</h2><p className="mt-0.5 text-xs text-white/50">Coins: {save.coins.toLocaleString()} · Rank {rank.rank}</p></div><button type="button" onClick={onClose} className="grid h-10 w-10 place-items-center rounded-xl bg-white/8"><X className="h-5 w-5" /></button></header>
        <div className="max-h-[calc(84dvh-76px)] overflow-y-auto p-4 sm:p-5">
          {panel === "shop" ? <div className="grid gap-3 sm:grid-cols-2">{(Object.keys(FARM_SEEDS) as FluxFarmSeed[]).map((seed) => { const info = FARM_SEEDS[seed]; const locked = rank.rank < info.unlockRank; return <div key={seed} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-3"><span className="text-4xl">{info.emoji}</span><div className="min-w-0 flex-1"><p className="font-black">{info.name}</p><p className="text-xs text-white/50">Grows {info.growMinutes}m · sells {info.sellPrice}</p><p className="mt-1 text-xs font-bold text-emerald-300">Owned: {save.seeds[seed]}</p></div><Button disabled={locked} onClick={() => onBuySeeds(seed, 5)} size="sm" variant="flux" className="rounded-xl">{locked ? <><Lock className="h-3.5 w-3.5" /> R{info.unlockRank}</> : `${info.seedCost * 5} 🪙`}</Button></div>; })}</div> : null}
          {panel === "workers" ? <div className="space-y-3">{WORKERS.map((worker) => { const state = save.workers.find((item) => item.id === worker.id); const locked = rank.rank < worker.unlock; return <div key={worker.id} className="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/5 p-4"><span className="text-5xl">{worker.emoji}</span><div className="min-w-0 flex-1"><p className="font-black">{worker.name}</p><p className="text-sm text-white/55">{worker.role}</p><p className="mt-1 text-xs font-bold text-amber-200">Unlock rank {worker.unlock}</p></div><Button disabled={state?.hired || locked} onClick={() => onHire(worker.id)} variant={state?.hired ? "outline" : "flux"} className="rounded-xl">{state?.hired ? "Hired" : locked ? `Rank ${worker.unlock}` : `${worker.cost} 🪙`}</Button></div>; })}</div> : null}
          {panel === "upgrades" ? <div className="grid gap-3 sm:grid-cols-2">{([
            ["wateringCan", "Watering Can", "Water larger areas and boost growth.", "💧", 220],
            ["barn", "Harvest Barn", "Increase every crop sale price.", "🏚️", 400],
            ["house", "Farm House", "Unlock story rewards and faster energy.", "🏡", 550],
            ["field", "Field Expansion", "Unlock eight more farming plots.", "🌱", 650],
          ] as const).map(([key, name, text, emoji, base]) => { const level = save.upgrades[key]; return <div key={key} className="rounded-2xl border border-white/10 bg-white/5 p-4"><div className="flex items-center gap-3"><span className="text-4xl">{emoji}</span><div><p className="font-black">{name}</p><p className="text-xs text-white/50">Level {level}</p></div></div><p className="mt-3 text-sm text-white/60">{text}</p><Button onClick={() => onUpgrade(key)} variant="flux" className="mt-4 w-full rounded-xl">Upgrade · {base * level} 🪙</Button></div>; })}</div> : null}
          {panel === "story" ? <div className="space-y-4">{save.activeEvent ? <div className="rounded-2xl border border-amber-200/20 bg-amber-400/10 p-4"><p className="text-xs font-black uppercase tracking-wider text-amber-200">World event</p><h3 className="mt-1 text-xl font-black">{EVENTS.find((event) => event.id === save.activeEvent)?.icon} {EVENTS.find((event) => event.id === save.activeEvent)?.name}</h3><p className="mt-2 text-sm text-amber-50/70">{EVENTS.find((event) => event.id === save.activeEvent)?.text}</p></div> : null}{STORY.map((chapter, index) => { const complete = index < save.storyStep || chapter.test(save); const active = index === save.storyStep; return <div key={chapter.title} className={cn("rounded-2xl border p-4", active ? "border-emerald-300/35 bg-emerald-400/10" : "border-white/10 bg-white/5", index > save.storyStep && "opacity-45")}><div className="flex items-start gap-3"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/8 text-sm font-black">{complete ? "✓" : index + 1}</span><div><p className="font-black">{chapter.title}</p><p className="mt-1 text-sm text-white/55">{chapter.text}</p><p className="mt-2 text-xs font-bold text-emerald-200">{chapter.target} · Reward {chapter.reward} coins</p></div></div></div>; })}</div> : null}
          {panel === "leaderboard" ? <div><div className="mb-4 flex items-center justify-between"><p className="text-sm text-white/55">Real Flux accounts ranked by farm XP.</p><Button size="sm" variant="outline" onClick={() => void onRefreshLeaderboard()}>Refresh</Button></div><div className="space-y-2">{leaderboard.length ? leaderboard.map((entry, index) => <div key={entry.uid} className={cn("flex items-center gap-3 rounded-2xl border p-3", entry.uid === save.uid ? "border-emerald-300/35 bg-emerald-400/10" : "border-white/10 bg-white/5")}><span className="grid h-9 w-9 place-items-center rounded-xl bg-white/8 font-black">{index < 3 ? ["🥇", "🥈", "🥉"][index] : index + 1}</span><div className="h-10 w-10 overflow-hidden rounded-full bg-emerald-500/20">{entry.avatarUrl ? <img src={entry.avatarUrl} alt="" className="h-full w-full object-cover" /> : <span className="grid h-full place-items-center font-black">{entry.displayName[0]}</span>}</div><div className="min-w-0 flex-1"><p className="truncate font-black">{entry.displayName}</p><p className="text-xs text-white/50">Rank {entry.rank} · {entry.rankTitle}</p></div><div className="text-right"><p className="font-black text-amber-200">{entry.xp.toLocaleString()} XP</p><p className="text-[10px] text-white/45">{entry.harvested} harvests</p></div></div>) : <div className="rounded-2xl border border-dashed border-white/15 p-10 text-center text-white/50"><Trophy className="mx-auto h-9 w-9" /><p className="mt-3 font-bold">No ranked farmers yet.</p><p className="mt-1 text-xs">Save your farm to claim the first spot.</p></div>}</div></div> : null}
        </div>
      </section>
    </div>
  );
}

function HudChip({ icon: Icon, value, label, compact = false }: { icon: typeof Coins; value: string; label: string; compact?: boolean }) {
  return <div className={cn("flex items-center gap-2 rounded-2xl border border-white/10 bg-white/8 backdrop-blur-xl", compact ? "px-2.5 py-1.5" : "px-3 py-2")}><Icon className="h-4 w-4 text-amber-200" /><div><p className={cn("font-black leading-none", compact ? "text-xs" : "text-sm")}>{value}</p><p className="mt-0.5 max-w-24 truncate text-[9px] font-semibold text-white/45">{label}</p></div></div>;
}

function QuickButton({ icon: Icon, label, onClick }: { icon: typeof Settings; label: string; onClick: () => void }) {
  return <button type="button" onClick={onClick} className="flex h-11 items-center gap-2 rounded-2xl border border-white/12 bg-[#102016]/88 px-3 text-xs font-black shadow-xl backdrop-blur-xl transition hover:bg-[#1b3824]"><Icon className="h-4 w-4 text-emerald-200" /> {label}</button>;
}

function MobileMenuButton({ icon: Icon, label, onClick }: { icon: typeof Settings; label: string; onClick: () => void }) {
  return <button type="button" onClick={onClick} className="flex flex-col items-center justify-center gap-0.5 text-[9px] font-bold text-white/65 active:scale-95"><Icon className="h-5 w-5" />{label}</button>;
}

function ControlButton({ children, label, onPress }: { children: React.ReactNode; label: string; onPress: (pressed: boolean) => void }) {
  return <button type="button" aria-label={label} onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); onPress(true); }} onPointerUp={() => onPress(false)} onPointerCancel={() => onPress(false)} className="grid h-12 place-items-center rounded-2xl border border-white/12 bg-[#102016]/88 text-sm font-black shadow-xl backdrop-blur-xl active:scale-95">{children}</button>;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number, fill = false, stroke = false) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
  if (fill) ctx.fill();
  if (stroke) ctx.stroke();
}
