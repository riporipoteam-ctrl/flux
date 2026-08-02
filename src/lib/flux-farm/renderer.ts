/**
 * Flux Farm — canvas renderer.
 *
 * Draws the world in painter order (terrain → soil → props/buildings/actors
 * sorted by Y → weather → lighting → HUD overlays), with a camera that follows
 * the player, a day/night lighting pass with point lights, and particle
 * systems for rain, snow, wind-blown leaves, dust and harvest sparkles.
 */

import {
  CROPS,
  SEASON_INFO,
  TILE,
  WEATHER_INFO,
  seasonForDay,
  type Season,
} from "./content";
import {
  CHARACTER_SIZE,
  buildAtlas,
  buildCharacter,
  characterFrame,
  cropSprite,
  soilSprite,
  type SpriteAtlas,
} from "./sprites";
import { WORKERS } from "./content";
import { dayFactor, plotAt, upgradeLevel, type FarmRuntime } from "./simulation";
import { unlockedPlotBounds } from "./world";
import { WORLD_H, WORLD_W, hash2 } from "./world";

export interface Camera {
  x: number;
  y: number;
  zoom: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  kind: "rain" | "snow" | "leaf" | "dust" | "spark" | "splash";
}

export interface RenderState {
  atlas: SpriteAtlas;
  camera: Camera;
  particles: Particle[];
  time: number;
  /** Floating "+12 XP" style callouts. */
  floaters: Array<{ x: number; y: number; text: string; life: number; color: string }>;
  shake: number;
}

export function createRenderState(season: Season): RenderState {
  return {
    atlas: buildAtlas(season),
    camera: { x: 0, y: 0, zoom: 2 },
    particles: [],
    time: 0,
    floaters: [],
    shake: 0,
  };
}

export function ensureSeason(state: RenderState, season: Season) {
  if (state.atlas.season !== season) {
    const characters = state.atlas.characters;
    state.atlas = buildAtlas(season);
    state.atlas.characters = characters;
  }
}

export function addFloater(state: RenderState, x: number, y: number, text: string, color = "#ffe066") {
  state.floaters.push({ x, y, text, life: 1.4, color });
  if (state.floaters.length > 40) state.floaters.shift();
}

export function burst(state: RenderState, x: number, y: number, count: number, color: string, kind: Particle["kind"] = "spark") {
  for (let i = 0; i < count; i += 1) {
    const angle = (i / count) * Math.PI * 2 + Math.random();
    const speed = 20 + Math.random() * 55;
    state.particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 30,
      life: 0.5 + Math.random() * 0.5,
      maxLife: 1,
      size: 1 + Math.random() * 2,
      color,
      kind,
    });
  }
}

/* -------------------------------------------------------------------------- */
/* Weather particles                                                           */
/* -------------------------------------------------------------------------- */

function spawnWeather(state: RenderState, runtime: FarmRuntime, dt: number, viewW: number, viewH: number) {
  const weather = runtime.save.weather;
  const info = WEATHER_INFO[weather];
  const wind = runtime.save.windSpeed;
  const angle = runtime.save.windAngle;
  const windX = Math.cos(angle) * wind * 26;

  const spawn = (count: number, make: () => Particle) => {
    for (let i = 0; i < count; i += 1) state.particles.push(make());
  };

  const left = state.camera.x - viewW / 2 - 60;
  const top = state.camera.y - viewH / 2 - 60;

  if (weather === "rain" || weather === "storm") {
    const rate = weather === "storm" ? 260 : 130;
    spawn(Math.round(rate * dt), () => ({
      x: left + Math.random() * (viewW + 160),
      y: top - Math.random() * 60,
      vx: windX * 1.6 - 30,
      vy: 480 + Math.random() * 160,
      life: 1.1,
      maxLife: 1.1,
      size: weather === "storm" ? 2 : 1,
      color: "rgba(160,200,240,0.75)",
      kind: "rain",
    }));
  } else if (weather === "snow") {
    spawn(Math.round(70 * dt), () => ({
      x: left + Math.random() * (viewW + 160),
      y: top - Math.random() * 60,
      vx: windX + (Math.random() - 0.5) * 22,
      vy: 34 + Math.random() * 34,
      life: 5,
      maxLife: 5,
      size: 1 + Math.random() * 2,
      color: "rgba(255,255,255,0.92)",
      kind: "snow",
    }));
  } else if (wind > 1.4) {
    const season = seasonForDay(runtime.save.day);
    const color = season === "autumn" ? "#c9772f" : season === "winter" ? "#dfe9ef" : SEASON_INFO[season].tree;
    spawn(Math.round(18 * dt * wind), () => ({
      x: left + Math.random() * (viewW + 160),
      y: top + Math.random() * (viewH + 120),
      vx: windX * 2.2,
      vy: -12 + Math.random() * 40,
      life: 2.4,
      maxLife: 2.4,
      size: 2,
      color,
      kind: "leaf",
    }));
  }

  if (info.hazard > 0 && weather === "storm" && Math.random() < dt * 0.12) {
    state.shake = 0.4;
  }
}

function stepParticles(state: RenderState, dt: number) {
  for (let i = state.particles.length - 1; i >= 0; i -= 1) {
    const particle = state.particles[i];
    particle.life -= dt;
    if (particle.life <= 0) {
      state.particles.splice(i, 1);
      continue;
    }
    particle.x += particle.vx * dt;
    particle.y += particle.vy * dt;
    if (particle.kind === "spark" || particle.kind === "splash") particle.vy += 180 * dt;
    if (particle.kind === "leaf") {
      particle.vy += Math.sin(state.time * 4 + particle.x * 0.05) * 12 * dt;
    }
    if (particle.kind === "snow") {
      particle.x += Math.sin(state.time * 1.6 + particle.y * 0.04) * 12 * dt;
    }
  }
  if (state.particles.length > 1400) state.particles.splice(0, state.particles.length - 1400);
}

/* -------------------------------------------------------------------------- */
/* Lighting                                                                    */
/* -------------------------------------------------------------------------- */

function skyTint(minute: number, weather: string): { color: string; alpha: number } {
  const light = dayFactor(minute);
  const weatherLight = WEATHER_INFO[weather as keyof typeof WEATHER_INFO]?.light ?? 1;
  const combined = Math.min(1, light * weatherLight);

  // Dawn/dusk warm band, deep blue at night.
  if (combined > 0.78) return { color: "#fff6d8", alpha: 0.04 };
  if (minute > 4 * 60 && minute < 8 * 60) return { color: "#ff9f5a", alpha: (1 - combined) * 0.5 };
  if (minute > 16 * 60 && minute < 20 * 60) return { color: "#ff7a4d", alpha: (1 - combined) * 0.55 };
  return { color: "#0e1a3a", alpha: Math.min(0.72, (1 - combined) * 0.86) };
}

/* -------------------------------------------------------------------------- */
/* Main draw                                                                   */
/* -------------------------------------------------------------------------- */

export function render(
  ctx: CanvasRenderingContext2D,
  runtime: FarmRuntime,
  state: RenderState,
  dt: number,
  width: number,
  height: number,
  dpr: number
) {
  const season = seasonForDay(runtime.save.day);
  ensureSeason(state, season);
  state.time += dt;

  // Camera follows the player with a soft spring and clamps to world bounds.
  const zoom = state.camera.zoom;
  const viewW = width / dpr / zoom;
  const viewH = height / dpr / zoom;
  const targetX = runtime.player.x + TILE / 2;
  const targetY = runtime.player.y + TILE / 2;
  state.camera.x += (targetX - state.camera.x) * Math.min(1, dt * 6);
  state.camera.y += (targetY - state.camera.y) * Math.min(1, dt * 6);
  state.camera.x = Math.max(viewW / 2, Math.min(WORLD_W * TILE - viewW / 2, state.camera.x));
  state.camera.y = Math.max(viewH / 2, Math.min(WORLD_H * TILE - viewH / 2, state.camera.y));

  if (state.shake > 0) state.shake = Math.max(0, state.shake - dt * 1.6);
  const shakeX = state.shake > 0 ? (Math.random() - 0.5) * state.shake * 10 : 0;
  const shakeY = state.shake > 0 ? (Math.random() - 0.5) * state.shake * 10 : 0;

  spawnWeather(state, runtime, dt, viewW, viewH);
  stepParticles(state, dt);

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = season === "winter" ? "#b8cbd6" : "#2b4a2f";
  ctx.fillRect(0, 0, width / dpr, height / dpr);

  ctx.save();
  ctx.scale(zoom, zoom);
  ctx.translate(
    Math.round(-state.camera.x + viewW / 2 + shakeX),
    Math.round(-state.camera.y + viewH / 2 + shakeY)
  );

  const minTileX = Math.max(0, Math.floor((state.camera.x - viewW / 2) / TILE) - 1);
  const maxTileX = Math.min(WORLD_W - 1, Math.ceil((state.camera.x + viewW / 2) / TILE) + 1);
  const minTileY = Math.max(0, Math.floor((state.camera.y - viewH / 2) / TILE) - 1);
  const maxTileY = Math.min(WORLD_H - 1, Math.ceil((state.camera.y + viewH / 2) / TILE) + 2);

  drawTerrain(ctx, runtime, state, minTileX, maxTileX, minTileY, maxTileY);
  drawOwnedBoundary(ctx, runtime, state);
  drawPlots(ctx, runtime, state, minTileX, maxTileX, minTileY, maxTileY);
  drawEntities(ctx, runtime, state, minTileY, maxTileY);
  drawParticles(ctx, state);

  ctx.restore();

  drawLighting(ctx, runtime, state, width / dpr, height / dpr, zoom, viewW, viewH);
  drawFloaters(ctx, state, dt, zoom, viewW, viewH);
  drawFogAndWeatherOverlay(ctx, runtime, width / dpr, height / dpr);
}

function drawTerrain(
  ctx: CanvasRenderingContext2D,
  runtime: FarmRuntime,
  state: RenderState,
  minX: number,
  maxX: number,
  minY: number,
  maxY: number
) {
  const { terrain } = runtime;
  const waterFrame = Math.floor(state.time * 3) % 4;

  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      const index = y * WORLD_W + x;
      const kind = terrain.kind[index];
      const variant = terrain.variant[index] ?? 0;
      let sprite: HTMLCanvasElement | undefined;

      if (kind === "water") sprite = state.atlas.water[waterFrame];
      else sprite = state.atlas.tiles.get(`${kind}:${variant}`);

      if (sprite) ctx.drawImage(sprite, x * TILE, y * TILE);
    }
  }
}

/**
 * Marks the ground the player actually owns. Without it the fenced valley
 * looks uniformly farmable and every tool press outside the bought area just
 * produces a refusal message.
 */
function drawOwnedBoundary(ctx: CanvasRenderingContext2D, runtime: FarmRuntime, state: RenderState) {
  const bounds = unlockedPlotBounds(upgradeLevel(runtime.save, "field"));
  const x = bounds.x * TILE;
  const y = bounds.y * TILE;
  const w = bounds.w * TILE;
  const h = bounds.h * TILE;

  ctx.save();
  ctx.fillStyle = "rgba(255, 244, 214, 0.07)";
  ctx.fillRect(x, y, w, h);

  const pulse = 0.45 + Math.sin(state.time * 1.6) * 0.12;
  ctx.strokeStyle = `rgba(199, 242, 132, ${pulse})`;
  ctx.lineWidth = 2;
  ctx.setLineDash([8, 6]);
  ctx.lineDashOffset = -state.time * 12;
  ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
  ctx.restore();
}

function drawPlots(
  ctx: CanvasRenderingContext2D,
  runtime: FarmRuntime,
  state: RenderState,
  minX: number,
  maxX: number,
  minY: number,
  maxY: number
) {
  const sway = Math.sin(state.time * 2.2) * runtime.save.windSpeed;

  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      const plot = plotAt(runtime, x, y);
      if (!plot) continue;

      if (plot.tilled) {
        ctx.drawImage(soilSprite(state.atlas, true, plot.moisture), x * TILE, y * TILE);
        if (plot.moisture > 0.7) {
          ctx.fillStyle = "rgba(60,110,160,0.14)";
          ctx.fillRect(x * TILE + 2, y * TILE + 2, TILE - 4, TILE - 4);
        }
      }

      if (!plot.crop) continue;

      const info = CROPS[plot.crop];
      const progress = Math.min(1, plot.growth / info.growHours);
      const sprite = plot.dead ? state.atlas.deadCrop : cropSprite(state.atlas, plot.crop, progress);

      // Crops lean with the wind; taller crops lean more.
      const lean = plot.dead ? 0 : sway * progress * 1.6;
      ctx.save();
      ctx.translate(x * TILE + TILE / 2, y * TILE + TILE);
      ctx.transform(1, 0, lean / 40, 1, 0, 0);
      ctx.drawImage(sprite, -TILE / 2, -TILE - 16);
      ctx.restore();

      if (!plot.dead && progress >= 1) {
        // Ready marker — a small bobbing glyph so ripe crops read at a glance.
        const bob = Math.sin(state.time * 3 + x + y) * 1.6;
        ctx.fillStyle = "rgba(255,224,102,0.95)";
        ctx.beginPath();
        ctx.arc(x * TILE + TILE - 6, y * TILE - 4 + bob, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
}

function drawEntities(
  ctx: CanvasRenderingContext2D,
  runtime: FarmRuntime,
  state: RenderState,
  minY: number,
  maxY: number
) {
  type Drawable = { y: number; draw: () => void };
  const list: Drawable[] = [];

  for (const building of runtime.terrain.buildings) {
    if (building.requiresUpgrade && upgradeLevel(runtime.save, building.requiresUpgrade) < 1) continue;
    if (building.y + building.h < minY - 6 || building.y > maxY + 6) continue;

    const level =
      building.id === "house"
        ? Math.max(1, upgradeLevel(runtime.save, "house"))
        : 1;

    if (building.id === "windmill") {
      const frame = Math.floor(state.time * (1 + runtime.save.windSpeed * 1.4)) % 8;
      const sprite = state.atlas.buildings.get(`windmill:${frame}`);
      if (sprite) {
        list.push({
          y: (building.y + building.h) * TILE,
          draw: () => ctx.drawImage(sprite, building.x * TILE - 16, building.y * TILE - 16),
        });
      }
      continue;
    }

    const sprite = state.atlas.buildings.get(`${building.id}:${level}`) ?? state.atlas.buildings.get(`${building.id}:1`);
    if (!sprite) continue;
    list.push({
      y: (building.y + building.h) * TILE,
      draw: () => ctx.drawImage(sprite, building.x * TILE - 8, building.y * TILE - 32),
    });
  }

  for (const prop of runtime.terrain.props) {
    if (prop.y < minY - 3 || prop.y > maxY + 3) continue;
    const sprite = state.atlas.props.get(`${prop.kind}:${prop.variant % 4}`);
    if (!sprite) continue;
    const big = prop.kind === "tree" || prop.kind === "pine";
    const sway = big ? Math.sin(state.time * 1.4 + prop.x * 0.4) * runtime.save.windSpeed * 0.7 : 0;

    list.push({
      y: prop.y * TILE + (big ? TILE : TILE / 2),
      draw: () => {
        if (!big) {
          ctx.drawImage(sprite, prop.x * TILE, prop.y * TILE);
          return;
        }
        ctx.save();
        ctx.translate(prop.x * TILE + TILE / 2, prop.y * TILE + TILE);
        ctx.transform(1, 0, sway / 30, 1, 0, 0);
        ctx.drawImage(sprite, -24, -52);
        ctx.restore();
      },
    });
  }

  for (const worker of runtime.workers) {
    const info = WORKERS[worker.id];
    const frames = buildCharacter(state.atlas, `worker-${worker.id}`, {
      skin: "#e0b088",
      hair: info.hair,
      shirt: info.shirt,
      pants: "#33405a",
      hat: info.job === "harvest" ? "#d8b23c" : undefined,
    });
    const moving = Math.hypot(worker.targetX - worker.x, worker.targetY - worker.y) > 6;
    const frame = moving ? Math.floor(worker.phase) % 4 : 0;
    const sprite = characterFrame(frames, worker.facing, frame);
    list.push({
      y: worker.y + TILE,
      draw: () => ctx.drawImage(sprite, worker.x + (TILE - CHARACTER_SIZE.w) / 2, worker.y + TILE - CHARACTER_SIZE.h),
    });
  }

  const playerFrames = buildCharacter(state.atlas, "player", {
    skin: "#f0c39a",
    hair: "#3a2a1c",
    shirt: "#2f7d42",
    pants: "#2b3750",
    hat: "#c9a961",
  });
  const playerFrame = runtime.player.moving ? Math.floor(runtime.player.phase) % 4 : 0;
  const playerSprite = characterFrame(playerFrames, runtime.player.facing, playerFrame);

  list.push({
    y: runtime.player.y + TILE,
    draw: () => {
      // Tool swing: a short arc drawn in front of the player.
      if (runtime.player.action && runtime.player.action.timer > 0) {
        const t = 1 - runtime.player.action.timer / 0.28;
        ctx.save();
        ctx.globalAlpha = 0.7 * (1 - t);
        ctx.strokeStyle = runtime.player.action.kind === "water" ? "#8fd0ff" : "#ffe9b0";
        ctx.lineWidth = 2;
        ctx.beginPath();
        const cx = runtime.player.x + TILE / 2;
        const cy = runtime.player.y + TILE / 2;
        ctx.arc(cx, cy, 16 + t * 8, -0.6 + t * 1.6, 0.9 + t * 1.6);
        ctx.stroke();
        ctx.restore();
      }
      ctx.drawImage(
        playerSprite,
        runtime.player.x + (TILE - CHARACTER_SIZE.w) / 2,
        runtime.player.y + TILE - CHARACTER_SIZE.h
      );
    },
  });

  list.sort((a, b) => a.y - b.y);
  for (const item of list) item.draw();
}

function drawParticles(ctx: CanvasRenderingContext2D, state: RenderState) {
  for (const particle of state.particles) {
    const alpha = Math.min(1, particle.life / Math.max(0.001, particle.maxLife));
    ctx.globalAlpha = particle.kind === "rain" ? 0.65 : alpha;
    ctx.fillStyle = particle.color;
    if (particle.kind === "rain") {
      ctx.fillRect(particle.x, particle.y, particle.size, 7);
    } else {
      ctx.fillRect(particle.x, particle.y, particle.size, particle.size);
    }
  }
  ctx.globalAlpha = 1;
}

function drawLighting(
  ctx: CanvasRenderingContext2D,
  runtime: FarmRuntime,
  state: RenderState,
  width: number,
  height: number,
  zoom: number,
  viewW: number,
  viewH: number
) {
  const tint = skyTint(runtime.save.minute, runtime.save.weather);
  if (tint.alpha <= 0.01) return;

  ctx.save();
  ctx.globalCompositeOperation = "multiply";
  ctx.fillStyle = tint.color;
  ctx.globalAlpha = tint.alpha;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();

  // Point lights punch back through the night layer.
  if (tint.alpha > 0.28) {
    ctx.save();
    ctx.globalCompositeOperation = "screen";

    const toScreen = (worldX: number, worldY: number) => ({
      x: (worldX - state.camera.x + viewW / 2) * zoom,
      y: (worldY - state.camera.y + viewH / 2) * zoom,
    });

    const lights: Array<{ x: number; y: number; r: number; color: string }> = [];
    for (const prop of runtime.terrain.props) {
      if (prop.kind !== "lantern") continue;
      lights.push({ x: prop.x * TILE + TILE / 2, y: prop.y * TILE + 10, r: 86, color: "255,205,120" });
    }
    for (const building of runtime.terrain.buildings) {
      if (building.id !== "house" && building.id !== "market") continue;
      lights.push({
        x: (building.x + building.w / 2) * TILE,
        y: (building.y + building.h / 2) * TILE,
        r: 110,
        color: "255,190,110",
      });
    }
    lights.push({ x: runtime.player.x + TILE / 2, y: runtime.player.y + TILE / 2, r: 96, color: "255,225,170" });

    const flicker = 0.9 + Math.sin(state.time * 7) * 0.06 + Math.sin(state.time * 13.7) * 0.04;

    for (const light of lights) {
      const point = toScreen(light.x, light.y);
      if (point.x < -200 || point.y < -200 || point.x > width + 200 || point.y > height + 200) continue;
      const radius = light.r * zoom * flicker;
      const gradient = ctx.createRadialGradient(point.x, point.y, 0, point.x, point.y, radius);
      gradient.addColorStop(0, `rgba(${light.color},${0.5 * tint.alpha + 0.18})`);
      gradient.addColorStop(0.45, `rgba(${light.color},${0.2 * tint.alpha})`);
      gradient.addColorStop(1, `rgba(${light.color},0)`);
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

function drawFogAndWeatherOverlay(
  ctx: CanvasRenderingContext2D,
  runtime: FarmRuntime,
  width: number,
  height: number
) {
  const weather = runtime.save.weather;
  if (weather === "fog") {
    ctx.save();
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = "#dfe8ee";
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
  }
  if (weather === "heatwave") {
    ctx.save();
    ctx.globalAlpha = 0.1;
    ctx.fillStyle = "#ff9a3d";
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
  }
  if (weather === "storm") {
    // Occasional full-screen lightning flash, driven off the clock so it is
    // consistent for every player on the same in-game minute.
    const flash = hash2(Math.floor(runtime.save.minute), Math.floor(performance.now() / 900), runtime.save.seed);
    if (flash > 0.982) {
      ctx.save();
      ctx.globalAlpha = 0.42;
      ctx.fillStyle = "#e8f2ff";
      ctx.fillRect(0, 0, width, height);
      ctx.restore();
    }
  }

  // Vignette keeps the eye on the playfield on large screens.
  const gradient = ctx.createRadialGradient(width / 2, height / 2, Math.min(width, height) * 0.35, width / 2, height / 2, Math.max(width, height) * 0.75);
  gradient.addColorStop(0, "rgba(0,0,0,0)");
  gradient.addColorStop(1, "rgba(0,0,0,0.3)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
}

function drawFloaters(
  ctx: CanvasRenderingContext2D,
  state: RenderState,
  dt: number,
  zoom: number,
  viewW: number,
  viewH: number
) {
  ctx.save();
  ctx.font = "700 13px system-ui, -apple-system, sans-serif";
  ctx.textAlign = "center";

  for (let i = state.floaters.length - 1; i >= 0; i -= 1) {
    const floater = state.floaters[i];
    floater.life -= dt;
    if (floater.life <= 0) {
      state.floaters.splice(i, 1);
      continue;
    }
    floater.y -= dt * 26;
    const screenX = (floater.x - state.camera.x + viewW / 2) * zoom;
    const screenY = (floater.y - state.camera.y + viewH / 2) * zoom;
    ctx.globalAlpha = Math.min(1, floater.life / 0.6);
    ctx.lineWidth = 3;
    ctx.strokeStyle = "rgba(0,0,0,0.65)";
    ctx.strokeText(floater.text, screenX, screenY);
    ctx.fillStyle = floater.color;
    ctx.fillText(floater.text, screenX, screenY);
  }
  ctx.restore();
}

/** Screen → world, used by tap-to-act on touch devices. */
export function screenToWorld(state: RenderState, sx: number, sy: number, viewW: number, viewH: number) {
  return {
    x: state.camera.x - viewW / 2 + sx / state.camera.zoom,
    y: state.camera.y - viewH / 2 + sy / state.camera.zoom,
  };
}
