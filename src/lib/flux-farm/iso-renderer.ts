/**
 * Flux Farm — isometric renderer.
 *
 * Draws the farm with real CC0 art (Kenney's Isometric Miniature Farm, see
 * public/game-assets/flux-farm/CREDITS.md) instead of procedural pixel art.
 *
 * Design note: Hay Day has no walking avatar — you act on plots directly. This
 * renderer follows that: a fixed-angle isometric camera you can pan and zoom,
 * with the tile under the cursor highlighted for tap-to-act.
 */

import { CROPS, seasonForDay, type CropId, type Season } from "./content";
import { dayFactor, upgradeLevel, type FarmRuntime } from "./simulation";
import { WORLD_H, WORLD_W, hash2, unlockedPlotBounds } from "./world";

/** Ground diamond in sprite pixels, and where its centre sits on the canvas. */
export const ISO_W = 128;
export const ISO_H = 64;
const ANCHOR_X = 64;
const ANCHOR_Y = 216;

const ASSET_BASE = `${process.env.NEXT_PUBLIC_BASE_PATH || ""}/game-assets/flux-farm`;

interface SpriteMeta {
  w: number;
  h: number;
  ox: number;
  oy: number;
  fw: number;
  fh: number;
}

export interface IsoAssets {
  images: Map<string, HTMLImageElement>;
  meta: Map<string, SpriteMeta>;
  ready: boolean;
}

/* -------------------------------------------------------------------------- */
/* Loading                                                                     */
/* -------------------------------------------------------------------------- */

export async function loadIsoAssets(): Promise<IsoAssets> {
  const assets: IsoAssets = { images: new Map(), meta: new Map(), ready: false };

  const response = await fetch(`${ASSET_BASE}/manifest.json`, { cache: "force-cache" });
  const manifest = (await response.json()) as { sprites: Record<string, SpriteMeta> };

  await Promise.all(
    Object.entries(manifest.sprites).map(
      ([name, meta]) =>
        new Promise<void>((resolve) => {
          const image = new Image();
          image.onload = () => {
            assets.images.set(name, image);
            assets.meta.set(name, meta);
            resolve();
          };
          // A missing sprite must not wedge the whole load.
          image.onerror = () => resolve();
          image.src = `${ASSET_BASE}/${name}.png`;
        })
    )
  );

  assets.ready = assets.images.size > 0;
  return assets;
}

/* -------------------------------------------------------------------------- */
/* Projection                                                                  */
/* -------------------------------------------------------------------------- */

export function tileToWorld(tx: number, ty: number) {
  return { x: (tx - ty) * (ISO_W / 2), y: (tx + ty) * (ISO_H / 2) };
}

/** Inverse projection — turns a world point back into fractional tile coords. */
export function worldToTile(wx: number, wy: number) {
  const tx = (wx / (ISO_W / 2) + wy / (ISO_H / 2)) / 2;
  const ty = (wy / (ISO_H / 2) - wx / (ISO_W / 2)) / 2;
  return { tx, ty };
}

/* -------------------------------------------------------------------------- */
/* State                                                                       */
/* -------------------------------------------------------------------------- */

export interface IsoCamera {
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
  max: number;
  size: number;
  color: string;
  gravity: boolean;
}

export interface IsoState {
  assets: IsoAssets | null;
  camera: IsoCamera;
  hover: { tx: number; ty: number } | null;
  particles: Particle[];
  floaters: Array<{ x: number; y: number; text: string; life: number; color: string }>;
  time: number;
  shake: number;
}

export function createIsoState(): IsoState {
  return {
    assets: null,
    camera: { x: 0, y: 0, zoom: 0.62 },
    hover: null,
    particles: [],
    floaters: [],
    time: 0,
    shake: 0,
  };
}

export function isoFloater(state: IsoState, tx: number, ty: number, text: string, color = "#ffe066") {
  const world = tileToWorld(tx, ty);
  state.floaters.push({ x: world.x, y: world.y - 40, text, life: 1.5, color });
  if (state.floaters.length > 30) state.floaters.shift();
}

export function isoBurst(state: IsoState, tx: number, ty: number, count: number, color: string) {
  const world = tileToWorld(tx, ty);
  for (let i = 0; i < count; i += 1) {
    const angle = (i / count) * Math.PI * 2 + Math.random();
    const speed = 20 + Math.random() * 60;
    state.particles.push({
      x: world.x,
      y: world.y - 10,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed * 0.5 - 40,
      life: 0.6 + Math.random() * 0.5,
      max: 1.1,
      size: 2 + Math.random() * 3,
      color,
      gravity: true,
    });
  }
}

/* -------------------------------------------------------------------------- */
/* Sprite helpers                                                              */
/* -------------------------------------------------------------------------- */

function drawSprite(
  ctx: CanvasRenderingContext2D,
  assets: IsoAssets,
  name: string,
  worldX: number,
  worldY: number,
  alpha = 1,
  tint?: string
) {
  const image = assets.images.get(name);
  const meta = assets.meta.get(name);
  if (!image || !meta) return;

  const drawX = worldX - ANCHOR_X + meta.ox;
  const drawY = worldY - ANCHOR_Y + meta.oy;

  if (alpha !== 1) ctx.globalAlpha = alpha;
  ctx.drawImage(image, drawX, drawY);
  if (alpha !== 1) ctx.globalAlpha = 1;

  if (tint) {
    // Crops all reuse the corn art, so a masked tint is what makes a tomato
    // read differently from wheat. `source-atop` keeps the sprite's alpha.
    ctx.save();
    ctx.globalCompositeOperation = "source-atop";
    ctx.globalAlpha = 0.45;
    ctx.fillStyle = tint;
    ctx.fillRect(drawX, drawY, meta.w, meta.h);
    ctx.restore();
  }
}

/** Crops share the corn sprites; stage and tint give each one its identity. */
function cropSpriteName(crop: CropId, progress: number) {
  const info = CROPS[crop];
  const dense = info.shape === "grain" || info.shape === "bush" || info.shape === "vine";
  if (progress < 0.28) return dense ? "cornYoungDouble" : "cornYoung";
  if (progress < 0.62) return dense ? "cornYoungDouble" : "cornYoungDouble";
  return dense ? "cornDouble" : "corn";
}

/* -------------------------------------------------------------------------- */
/* Main render                                                                 */
/* -------------------------------------------------------------------------- */

export function renderIso(
  ctx: CanvasRenderingContext2D,
  runtime: FarmRuntime,
  state: IsoState,
  dt: number,
  width: number,
  height: number,
  dpr: number
) {
  const assets = state.assets;
  state.time += dt;

  const season = seasonForDay(runtime.save.day);
  const viewW = width / dpr / state.camera.zoom;
  const viewH = height / dpr / state.camera.zoom;

  stepParticles(state, dt);
  if (state.shake > 0) state.shake = Math.max(0, state.shake - dt * 1.6);

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  paintSky(ctx, width / dpr, height / dpr, runtime, season);

  if (!assets?.ready) {
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.font = "600 15px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Loading farm art…", width / dpr / 2, height / dpr / 2);
    return;
  }

  const shakeX = state.shake > 0 ? (Math.random() - 0.5) * state.shake * 12 : 0;
  const shakeY = state.shake > 0 ? (Math.random() - 0.5) * state.shake * 12 : 0;

  ctx.save();
  ctx.scale(state.camera.zoom, state.camera.zoom);
  ctx.translate(-state.camera.x + viewW / 2 + shakeX, -state.camera.y + viewH / 2 + shakeY);

  drawWorld(ctx, runtime, state, assets, season, viewW, viewH);
  drawParticles(ctx, state);

  ctx.restore();

  applyDayNight(ctx, runtime, width / dpr, height / dpr);
  drawFloaters(ctx, state, dt, viewW, viewH);
}

function paintSky(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  runtime: FarmRuntime,
  season: Season
) {
  const light = dayFactor(runtime.save.minute);
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  if (light > 0.7) {
    gradient.addColorStop(0, season === "winter" ? "#bcd6e8" : "#8ec7e8");
    gradient.addColorStop(1, season === "winter" ? "#e3edf3" : "#cfe9c4");
  } else if (light > 0.3) {
    gradient.addColorStop(0, "#e8a765");
    gradient.addColorStop(1, "#9d8a6a");
  } else {
    gradient.addColorStop(0, "#16233f");
    gradient.addColorStop(1, "#2b3a4d");
  }
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
}

function drawWorld(
  ctx: CanvasRenderingContext2D,
  runtime: FarmRuntime,
  state: IsoState,
  assets: IsoAssets,
  season: Season,
  viewW: number,
  viewH: number
) {
  const bounds = unlockedPlotBounds(upgradeLevel(runtime.save, "field"));

  // Painter's order for an isometric grid is simply increasing (tx + ty).
  for (let sum = 0; sum <= WORLD_W + WORLD_H; sum += 1) {
    for (let tx = 0; tx < WORLD_W; tx += 1) {
      const ty = sum - tx;
      if (ty < 0 || ty >= WORLD_H) continue;

      const world = tileToWorld(tx, ty);
      if (
        world.x < state.camera.x - viewW / 2 - ISO_W * 2 ||
        world.x > state.camera.x + viewW / 2 + ISO_W * 2 ||
        world.y < state.camera.y - viewH / 2 - 400 ||
        world.y > state.camera.y + viewH / 2 + 300
      ) {
        continue;
      }

      drawTile(ctx, runtime, state, assets, season, tx, ty, world, bounds);
    }
  }
}

function drawTile(
  ctx: CanvasRenderingContext2D,
  runtime: FarmRuntime,
  state: IsoState,
  assets: IsoAssets,
  season: Season,
  tx: number,
  ty: number,
  world: { x: number; y: number },
  bounds: { x: number; y: number; w: number; h: number }
) {
  const owned =
    tx >= bounds.x && tx < bounds.x + bounds.w && ty >= bounds.y && ty < bounds.y + bounds.h;
  const plot = runtime.plotIndex.get(ty * WORLD_W + tx) ?? null;

  if (plot) {
    drawSprite(ctx, assets, plot.tilled ? "dirtFarmland" : "dirt", world.x, world.y);

    if (plot.tilled && plot.moisture > 0.55) {
      // Wet soil: a dark diamond wash reads better than a whole extra sprite.
      ctx.save();
      ctx.globalAlpha = Math.min(0.32, plot.moisture * 0.34);
      ctx.fillStyle = "#20344a";
      diamondPath(ctx, world.x, world.y);
      ctx.fill();
      ctx.restore();
    }

    if (plot.crop) {
      const info = CROPS[plot.crop];
      const progress = Math.min(1, plot.growth / info.growHours);
      if (plot.dead) {
        drawSprite(ctx, assets, "cornYoung", world.x, world.y, 0.75, "#6b5a3a");
      } else {
        drawSprite(ctx, assets, cropSpriteName(plot.crop, progress), world.x, world.y, 1, info.palette[2]);
        if (progress >= 1) {
          const bob = Math.sin(state.time * 3 + tx + ty) * 3;
          drawReadyPip(ctx, world.x, world.y - 96 + bob);
        }
      }
    }
  } else if (owned) {
    drawSprite(ctx, assets, "dirt", world.x, world.y);
  } else {
    drawGround(ctx, world.x, world.y, season, tx, ty);
  }

  // Fence ring around the owned block.
  const onEdge =
    owned &&
    (tx === bounds.x || tx === bounds.x + bounds.w - 1 || ty === bounds.y || ty === bounds.y + bounds.h - 1);
  if (onEdge && (tx + ty) % 1 === 0) {
    drawSprite(ctx, assets, "fenceLow", world.x, world.y, 0.95);
  }

  for (const building of runtime.terrain.buildings) {
    if (building.x !== tx || building.y !== ty) continue;
    if (building.requiresUpgrade && upgradeLevel(runtime.save, building.requiresUpgrade) < 1) continue;
    drawBuilding(ctx, assets, building.id, world.x, world.y);
  }

  if (state.hover && state.hover.tx === tx && state.hover.ty === ty) {
    ctx.save();
    ctx.strokeStyle = "rgba(255,240,170,0.95)";
    ctx.lineWidth = 3;
    ctx.fillStyle = "rgba(255,240,170,0.18)";
    diamondPath(ctx, world.x, world.y);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
}

function drawBuilding(
  ctx: CanvasRenderingContext2D,
  assets: IsoAssets,
  id: string,
  x: number,
  y: number
) {
  // The pack is a modular kit, so each building is a small stack of pieces.
  switch (id) {
    case "house":
      drawSprite(ctx, assets, "woodWallDoorClosed", x, y);
      drawSprite(ctx, assets, "roof", x, y - 84);
      break;
    case "barn":
      drawSprite(ctx, assets, "woodWallGateClosed", x, y);
      drawSprite(ctx, assets, "roofSingle", x, y - 84);
      break;
    case "shed":
      drawSprite(ctx, assets, "woodWallWindow", x, y);
      drawSprite(ctx, assets, "roofSingleWall", x, y - 84);
      break;
    case "market":
      drawSprite(ctx, assets, "planksHigh", x, y);
      drawSprite(ctx, assets, "sacksCrate", x, y - 30);
      break;
    case "silo":
      drawSprite(ctx, assets, "hayBalesStacked", x, y);
      break;
    case "greenhouse":
      drawSprite(ctx, assets, "woodWallWindowGlass", x, y);
      drawSprite(ctx, assets, "roofSingle", x, y - 84, 0.8);
      break;
    case "well":
      drawSprite(ctx, assets, "planksHigh", x, y);
      drawSprite(ctx, assets, "sack", x, y - 26);
      break;
    case "windmill":
      drawSprite(ctx, assets, "woodWallSupport", x, y);
      drawSprite(ctx, assets, "ladderStand", x, y - 60);
      break;
    default:
      break;
  }
}

function drawGround(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  season: Season,
  tx: number,
  ty: number
) {
  const noise = hash2(tx, ty, 17);
  const base =
    season === "winter"
      ? ["#d7e3ea", "#cddae2"]
      : season === "autumn"
        ? ["#8f9a4e", "#849046"]
        : ["#6f9d4a", "#679544"];
  ctx.fillStyle = noise > 0.5 ? base[0] : base[1];
  diamondPath(ctx, x, y);
  ctx.fill();
}

function diamondPath(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.beginPath();
  ctx.moveTo(x, y - ISO_H / 2);
  ctx.lineTo(x + ISO_W / 2, y);
  ctx.lineTo(x, y + ISO_H / 2);
  ctx.lineTo(x - ISO_W / 2, y);
  ctx.closePath();
}

function drawReadyPip(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.save();
  ctx.fillStyle = "#ffd45e";
  ctx.strokeStyle = "rgba(60,40,0,0.5)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, y, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#5a3d00";
  ctx.font = "700 12px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("!", x, y + 1);
  ctx.restore();
}

/* -------------------------------------------------------------------------- */
/* Effects                                                                     */
/* -------------------------------------------------------------------------- */

function stepParticles(state: IsoState, dt: number) {
  for (let i = state.particles.length - 1; i >= 0; i -= 1) {
    const p = state.particles[i];
    p.life -= dt;
    if (p.life <= 0) {
      state.particles.splice(i, 1);
      continue;
    }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    if (p.gravity) p.vy += 220 * dt;
  }
}

function drawParticles(ctx: CanvasRenderingContext2D, state: IsoState) {
  for (const p of state.particles) {
    ctx.globalAlpha = Math.min(1, p.life / p.max);
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x, p.y, p.size, p.size);
  }
  ctx.globalAlpha = 1;
}

function applyDayNight(
  ctx: CanvasRenderingContext2D,
  runtime: FarmRuntime,
  width: number,
  height: number
) {
  const light = dayFactor(runtime.save.minute);
  if (light > 0.72) return;

  ctx.save();
  ctx.globalCompositeOperation = "multiply";
  const alpha = Math.min(0.6, (0.72 - light) * 0.95);
  ctx.fillStyle = light > 0.32 ? "#ffb072" : "#2a3c66";
  ctx.globalAlpha = alpha;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();
}

function drawFloaters(
  ctx: CanvasRenderingContext2D,
  state: IsoState,
  dt: number,
  viewW: number,
  viewH: number
) {
  ctx.save();
  ctx.font = "800 15px system-ui, -apple-system, sans-serif";
  ctx.textAlign = "center";

  for (let i = state.floaters.length - 1; i >= 0; i -= 1) {
    const f = state.floaters[i];
    f.life -= dt;
    if (f.life <= 0) {
      state.floaters.splice(i, 1);
      continue;
    }
    f.y -= dt * 34;
    const sx = (f.x - state.camera.x + viewW / 2) * state.camera.zoom;
    const sy = (f.y - state.camera.y + viewH / 2) * state.camera.zoom;
    ctx.globalAlpha = Math.min(1, f.life / 0.6);
    ctx.lineWidth = 4;
    ctx.strokeStyle = "rgba(0,0,0,0.7)";
    ctx.strokeText(f.text, sx, sy);
    ctx.fillStyle = f.color;
    ctx.fillText(f.text, sx, sy);
  }
  ctx.restore();
}

/** Screen pixel → tile, for tap-to-act. */
export function pickTile(
  state: IsoState,
  screenX: number,
  screenY: number,
  width: number,
  height: number
) {
  const viewW = width / state.camera.zoom;
  const viewH = height / state.camera.zoom;
  const worldX = state.camera.x - viewW / 2 + screenX / state.camera.zoom;
  const worldY = state.camera.y - viewH / 2 + screenY / state.camera.zoom;
  const { tx, ty } = worldToTile(worldX, worldY);
  return { tx: Math.round(tx), ty: Math.round(ty) };
}
