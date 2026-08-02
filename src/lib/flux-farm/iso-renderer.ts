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

import { CROPS, WORKERS, seasonForDay, type CropId, type Season } from "./content";
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
  /** Flat terrain diamonds; drawn centred rather than base-anchored. */
  ground?: boolean;
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

  const drawX = meta.ground ? worldX - meta.w / 2 : worldX - ANCHOR_X + meta.ox;
  const drawY = meta.ground ? worldY - meta.h / 2 : worldY - ANCHOR_Y + meta.oy;

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
  drawWorkers(ctx, runtime, state);
  drawSmoke(ctx, runtime, state);
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
        // Growing crops lean with the wind; taller growth leans further.
        const sway = Math.sin(state.time * 1.9 + tx * 0.6 + ty * 0.4) * runtime.save.windSpeed * progress * 0.035;
        ctx.save();
        ctx.translate(world.x, world.y);
        ctx.transform(1, 0, sway, 1, 0, 0);
        drawSprite(ctx, assets, cropSpriteName(plot.crop, progress), 0, 0, 1, info.palette[2]);
        ctx.restore();
        if (progress >= 1) {
          const bob = Math.sin(state.time * 3 + tx + ty) * 3;
          drawReadyPip(ctx, world.x, world.y - 96 + bob);
        }
      }
    }
  } else if (owned) {
    drawSprite(ctx, assets, "dirt", world.x, world.y);
  } else {
    drawGround(ctx, assets, world.x, world.y, season, tx, ty);
    drawScenery(ctx, assets, world.x, world.y, tx, ty);
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

/** Real textured ground, with the season shifting which variant is used. */
function drawGround(
  ctx: CanvasRenderingContext2D,
  assets: IsoAssets,
  x: number,
  y: number,
  season: Season,
  tx: number,
  ty: number
) {
  const noise = hash2(tx, ty, 17);
  const dry = season === "autumn" || season === "summer";
  const name = dry && noise > 0.62 ? `grassDry${Math.floor(noise * 2) % 2}` : `grass${Math.floor(noise * 4) % 4}`;

  if (assets.images.has(name)) {
    drawSprite(ctx, assets, name, x, y);
    if (season === "winter") {
      // Snow is a wash over the real texture, so the grain still shows.
      ctx.save();
      ctx.globalAlpha = 0.72;
      ctx.fillStyle = "#eef5fa";
      diamondPath(ctx, x, y);
      ctx.fill();
      ctx.restore();
    }
    return;
  }

  ctx.fillStyle = season === "winter" ? "#d7e3ea" : "#6f9d4a";
  diamondPath(ctx, x, y);
  ctx.fill();
}

/** Deterministic scenery outside the farm so the valley is not empty grass. */
function drawScenery(ctx: CanvasRenderingContext2D, assets: IsoAssets, x: number, y: number, tx: number, ty: number) {
  // Sparse on purpose: dense scatter turns the valley into an unreadable
  // thicket and buries the farm the player is meant to be looking at.
  const roll = hash2(tx, ty, 733);
  if (roll > 0.992) drawSprite(ctx, assets, "treeBig", x, y);
  else if (roll > 0.984) drawSprite(ctx, assets, "treePalm", x, y);
  else if (roll > 0.976) drawSprite(ctx, assets, "shrubTall", x, y);
  else if (roll > 0.964) drawSprite(ctx, assets, "bush", x, y);
  else if (roll > 0.950) drawSprite(ctx, assets, "shrub", x, y);
  else if (roll > 0.925) drawSprite(ctx, assets, "grassTuft", x, y);
  else if (roll > 0.905) drawSprite(ctx, assets, "weed", x, y);
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

/**
 * Hired farmhands, drawn as small shaded figures with a walk cycle. The pack
 * has no character art, so these are drawn directly — at this camera distance
 * a clean silhouette with a bob and swinging arms reads better than a
 * mismatched sprite from another art style would.
 */
function drawWorkers(ctx: CanvasRenderingContext2D, runtime: FarmRuntime, state: IsoState) {
  for (const worker of runtime.workers) {
    const info = WORKERS[worker.id];
    if (!info) continue;

    // The simulation tracks workers in top-down pixels; convert to tiles.
    const tx = worker.x / 32;
    const ty = worker.y / 32;
    const p = tileToWorld(tx, ty);

    const moving = Math.hypot(worker.targetX - worker.x, worker.targetY - worker.y) > 6;
    const phase = state.time * 7 + worker.phase;
    const bob = moving ? Math.abs(Math.sin(phase)) * 4 : Math.sin(state.time * 2 + worker.phase) * 1.2;
    const swing = moving ? Math.sin(phase) * 5 : 0;

    const bx = p.x;
    const by = p.y - bob;

    ctx.save();
    // contact shadow
    ctx.fillStyle = "rgba(0,0,0,0.28)";
    ctx.beginPath();
    ctx.ellipse(bx, p.y + 4, 13, 6, 0, 0, Math.PI * 2);
    ctx.fill();

    // legs
    ctx.strokeStyle = "#33405a";
    ctx.lineWidth = 5;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(bx - 3, by - 14);
    ctx.lineTo(bx - 3 + swing * 0.6, by);
    ctx.moveTo(bx + 3, by - 14);
    ctx.lineTo(bx + 3 - swing * 0.6, by);
    ctx.stroke();

    // torso
    ctx.fillStyle = info.shirt;
    roundRect(ctx, bx - 8, by - 34, 16, 21, 5);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.18)";
    roundRect(ctx, bx - 8, by - 34, 6, 21, 5);
    ctx.fill();

    // arms
    ctx.strokeStyle = info.shirt;
    ctx.lineWidth = 4.5;
    ctx.beginPath();
    ctx.moveTo(bx - 8, by - 30);
    ctx.lineTo(bx - 12, by - 18 + swing);
    ctx.moveTo(bx + 8, by - 30);
    ctx.lineTo(bx + 12, by - 18 - swing);
    ctx.stroke();

    // head + hat
    ctx.fillStyle = "#f0c39a";
    ctx.beginPath();
    ctx.arc(bx, by - 41, 7.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = info.hair;
    ctx.beginPath();
    ctx.ellipse(bx, by - 45, 9.5, 5, 0, Math.PI, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#d8b23c";
    ctx.beginPath();
    ctx.ellipse(bx, by - 44, 13, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    // a working flourish so idle hands still look busy
    if (!moving) {
      ctx.strokeStyle = "rgba(255,255,255,0.5)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(bx + 14, by - 24, 7, -0.8 + Math.sin(state.time * 6) * 0.5, 0.6 + Math.sin(state.time * 6) * 0.5);
      ctx.stroke();
    }
    ctx.restore();
  }
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Chimney smoke — cheap, but it makes the homestead feel lived in. */
function drawSmoke(ctx: CanvasRenderingContext2D, runtime: FarmRuntime, state: IsoState) {
  const house = runtime.terrain.buildings.find((b) => b.id === "house");
  if (!house) return;
  const p = tileToWorld(house.x, house.y);
  ctx.save();
  for (let i = 0; i < 5; i += 1) {
    const t = (state.time * 0.45 + i * 0.2) % 1;
    ctx.globalAlpha = (1 - t) * 0.4;
    ctx.fillStyle = "#e8eef2";
    ctx.beginPath();
    ctx.arc(p.x + 18 + Math.sin(t * 5 + i) * 9, p.y - 120 - t * 70, 5 + t * 11, 0, Math.PI * 2);
    ctx.fill();
  }
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
