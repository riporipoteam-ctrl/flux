/**
 * Flux Farm — isometric renderer.
 *
 * Draws the farm with real CC0 art (see public/game-assets/flux-farm/CREDITS.md).
 *
 * Two conventions run through this file:
 *
 * 1. **One anchor.** Every sprite records where the tile anchor sits inside its
 *    own trimmed bitmap (`ax`, `ay`), so a sprite can overhang the tile in any
 *    direction and still line up.
 * 2. **Four edges.** Kenney's kit ships each wall, fence and roof in four
 *    rotations. `_S` sits on a tile's upper-right edge, `_E` upper-left,
 *    `_N` lower-left and `_W` lower-right — which is what lets a footprint be
 *    walled in on all four sides instead of being one lonely panel.
 *
 * Design note: Hay Day has no walking avatar — you act on plots directly. This
 * renderer follows that: a fixed-angle camera you pan and zoom, the tile under
 * the cursor highlighted for tap-to-act, and a farmhand who walks over to
 * whatever you just tapped.
 */

import { CROPS, WORKERS, seasonForDay, type CropId, type Season } from "./content";
import { dayFactor, upgradeLevel, type FarmRuntime } from "./simulation";
import { WORLD_H, WORLD_W, hash2, unlockedPlotBounds, type BuildingEntity, type PropEntity } from "./world";

/** Ground diamond in sprite pixels. */
export const ISO_W = 128;
export const ISO_H = 64;

/** How far above the tile plane a roof sits — one wall's height. */
const ROOF_H = 42;

const ASSET_BASE = `${process.env.NEXT_PUBLIC_BASE_PATH || ""}/game-assets/flux-farm`;

interface SpriteMeta {
  w: number;
  h: number;
  /** Where the tile anchor sits inside the trimmed bitmap. */
  ax: number;
  ay: number;
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

/** A farmhand the player can see working the yard. */
interface Figure {
  x: number;
  y: number;
  tx: number;
  ty: number;
  phase: number;
  idle: number;
}

export interface IsoState {
  assets: IsoAssets | null;
  camera: IsoCamera;
  hover: { tx: number; ty: number } | null;
  particles: Particle[];
  floaters: Array<{ x: number; y: number; text: string; life: number; color: string }>;
  time: number;
  shake: number;
  /** The player's farmer, who walks to whatever tile was last acted on. */
  farmer: Figure;
  props: Map<number, PropEntity[]> | null;
  propsFor: unknown;
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
    farmer: { x: 0, y: 0, tx: 0, ty: 0, phase: 0, idle: 0 },
    props: null,
    propsFor: null,
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

/** Send the farmer to a tile — called whenever the player acts on one. */
export function isoSendFarmer(state: IsoState, tx: number, ty: number) {
  state.farmer.tx = tx;
  state.farmer.ty = ty;
  state.farmer.idle = 0;
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
  tint?: string,
  tintAlpha = 0.45
) {
  const image = assets.images.get(name);
  const meta = assets.meta.get(name);
  if (!image || !meta) return;

  const drawX = worldX - meta.ax;
  const drawY = worldY - meta.ay;

  if (alpha !== 1) ctx.globalAlpha = alpha;
  ctx.drawImage(tint ? tinted(name, image, meta, tint, tintAlpha) : image, drawX, drawY);
  if (alpha !== 1) ctx.globalAlpha = 1;
}

/**
 * A recoloured copy of a sprite. The tint has to be composited against the
 * sprite on its own canvas — `source-atop` straight onto the scene would keep
 * the fill wherever the *scene* is opaque, which is everywhere, and paint a
 * rectangle. Results are cached; there are only a handful of combinations.
 */
const tintCache = new Map<string, HTMLCanvasElement>();

function tinted(
  name: string,
  image: HTMLImageElement,
  meta: SpriteMeta,
  tint: string,
  tintAlpha: number
) {
  const key = `${name}|${tint}|${tintAlpha}`;
  const cached = tintCache.get(key);
  if (cached) return cached;

  const canvas = document.createElement("canvas");
  canvas.width = meta.w;
  canvas.height = meta.h;
  const scratch = canvas.getContext("2d");
  if (scratch) {
    scratch.drawImage(image, 0, 0);
    scratch.globalCompositeOperation = "source-atop";
    scratch.globalAlpha = tintAlpha;
    scratch.fillStyle = tint;
    scratch.fillRect(0, 0, meta.w, meta.h);
  }
  tintCache.set(key, canvas);
  return canvas;
}

/** Crops share the corn sprites; stage and tint give each one its identity. */
function cropSpriteName(crop: CropId, progress: number) {
  const info = CROPS[crop];
  const dense = info.shape === "grain" || info.shape === "bush" || info.shape === "vine";
  if (progress < 0.32) return "cornYoung";
  if (progress < 0.7) return "cornYoungDouble";
  return dense ? "cornDouble" : "corn";
}

/* -------------------------------------------------------------------------- */
/* Buildings                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Layers inside a single tile. Back walls have to land before whatever stands
 * inside the building, front walls after it, and the roof over all of it.
 */
const Layer = { Floor: 0, Back: 1, Front: 2, Roof: 3 } as const;
type Layer = (typeof Layer)[keyof typeof Layer];

interface Piece {
  sprite: string;
  dz?: number;
  alpha?: number;
  /** Paints the piece a colour — a red barn beside a timber house. */
  tint?: string;
  tintAlpha?: number;
  layer: Layer;
}

interface BoxOptions {
  wall?: string;
  door?: string;
  doorAt?: number;
  window?: string;
  windowAt?: number;
  roof?: string | null;
  roofAlpha?: number;
  floor?: string;
  wallTint?: string;
  roofTint?: string;
}

/**
 * Walls the perimeter of a `w`x`h` footprint and caps it with a gabled roof.
 * `roofSingle` tiles seamlessly along the +y axis, so its ridge always runs
 * the depth of the building.
 */
function box(i: number, j: number, w: number, h: number, options: BoxOptions = {}): Piece[] {
  const {
    wall = "woodWall",
    door,
    doorAt = 0,
    window: win,
    windowAt = 1,
    roof = "roofSingle",
    roofAlpha,
    floor,
    wallTint,
    roofTint,
  } = options;
  const pieces: Piece[] = [];
  const t = wallTint ? { tint: wallTint, tintAlpha: 0.34 } : {};

  if (floor) pieces.push({ sprite: floor, layer: Layer.Floor });
  if (j === 0) pieces.push({ sprite: `${wall}_S`, layer: Layer.Back, ...t });
  if (i === 0) pieces.push({ sprite: `${wall}_E`, layer: Layer.Back, ...t });
  if (j === h - 1) {
    pieces.push({ sprite: `${door && i === doorAt ? door : wall}_N`, layer: Layer.Front, ...t });
  }
  if (i === w - 1) {
    pieces.push({ sprite: `${win && j === windowAt ? win : wall}_W`, layer: Layer.Front, ...t });
  }
  if (roof) {
    pieces.push({
      sprite: `${roof}_S`,
      dz: -ROOF_H,
      alpha: roofAlpha,
      tint: roofTint,
      tintAlpha: 0.3,
      layer: Layer.Roof,
    });
  }

  return pieces;
}

/** Which sprites a building puts on the cell `(i, j)` of its own footprint. */
function buildingPieces(building: BuildingEntity, i: number, j: number): Piece[] {
  const { w, h } = building;

  switch (building.id) {
    case "house": {
      const pieces = box(i, j, w, h, {
        door: "woodWallDoorClosed",
        doorAt: 0,
        window: "woodWallWindow",
        windowAt: 1,
        roofTint: "#c8613a",
      });
      if (i === w - 1 && j === 0) {
        pieces.push({ sprite: "chimneyBase", dz: -ROOF_H - 30, layer: Layer.Roof });
      }
      return pieces;
    }
    case "barn": {
      // The red barn is the one silhouette everyone recognises on a farm.
      const pieces = box(i, j, w, h, {
        door: "woodWallGateClosed",
        doorAt: Math.floor(w / 2),
        window: "woodWallWindow",
        windowAt: 1,
        wallTint: "#b8362c",
        roofTint: "#6d7f8c",
      });
      if (i === 0 && j === h - 1) pieces.push({ sprite: "hayBales", layer: Layer.Front });
      return pieces;
    }
    case "shed":
      return box(i, j, w, h, { door: "woodWallDoorOpen", window: "woodWallWindow", windowAt: 0 });
    case "silo": {
      const pieces = box(i, j, w, h, { wall: "woodWallSupport", door: "woodWallDoorClosed" });
      if (j === h - 1) pieces.push({ sprite: "ladderStand", layer: Layer.Front });
      return pieces;
    }
    case "greenhouse":
      return box(i, j, w, h, {
        wall: "woodWallWindowGlass",
        door: "woodWallDoorClosed",
        roofAlpha: 0.82,
        roofTint: "#7fc4d8",
      });
    case "windmill":
      return box(i, j, w, h, { wall: "woodWallSupport", door: "woodWallDoorClosed" });
    case "well": {
      // A one-tile well house: a decked base, four corner posts, little gable.
      return [
        { sprite: "planksHigh", layer: Layer.Floor },
        { sprite: "woodWallCorner_S", layer: Layer.Back },
        { sprite: "woodWallCorner_E", layer: Layer.Back },
        { sprite: "woodWallCorner_N", layer: Layer.Front },
        { sprite: "woodWallCorner_W", layer: Layer.Front },
        { sprite: "sack", layer: Layer.Front },
        { sprite: "roofSingle_S", dz: -ROOF_H, layer: Layer.Roof },
      ];
    }
    case "market": {
      // An open stall: decked floor, posts at the back, produce out front.
      const pieces: Piece[] = [{ sprite: "planksHigh", layer: Layer.Floor }];
      if (j === 0) pieces.push({ sprite: "woodWallSupport_S", layer: Layer.Back });
      if (i === 0) pieces.push({ sprite: "woodWallSupport_E", layer: Layer.Back });
      if (j === h - 1) pieces.push({ sprite: i === 0 ? "sacksCrate" : "hay", layer: Layer.Front });
      pieces.push({ sprite: "roofSingle_S", dz: -ROOF_H, layer: Layer.Roof });
      return pieces;
    }
    default:
      return [];
  }
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
  stepFarmer(runtime, state, dt);
  clampCamera(state, viewW, viewH);
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

  indexProps(runtime, state);

  const shakeX = state.shake > 0 ? (Math.random() - 0.5) * state.shake * 12 : 0;
  const shakeY = state.shake > 0 ? (Math.random() - 0.5) * state.shake * 12 : 0;

  ctx.save();
  ctx.scale(state.camera.zoom, state.camera.zoom);
  ctx.translate(-state.camera.x + viewW / 2 + shakeX, -state.camera.y + viewH / 2 + shakeY);

  drawWorld(ctx, runtime, state, assets, season, viewW, viewH);
  drawWindmillSails(ctx, runtime, state);
  drawSmoke(ctx, runtime, state);
  drawParticles(ctx, state);

  ctx.restore();

  applyDayNight(ctx, runtime, state, width / dpr, height / dpr);
  drawFloaters(ctx, state, dt, viewW, viewH);
}

/** Keeps the valley filling the frame — panning off it would show bare sky. */
function clampCamera(state: IsoState, viewW: number, viewH: number) {
  const minX = -(WORLD_H - 1) * (ISO_W / 2);
  const maxX = (WORLD_W - 1) * (ISO_W / 2);
  // Headroom above the world for tall trees, and below for their shadows.
  const minY = -ISO_H * 2;
  const maxY = (WORLD_W + WORLD_H - 2) * (ISO_H / 2) + ISO_H;

  state.camera.x =
    viewW >= maxX - minX
      ? (minX + maxX) / 2
      : Math.min(maxX - viewW / 2, Math.max(minX + viewW / 2, state.camera.x));
  state.camera.y =
    viewH >= maxY - minY
      ? (minY + maxY) / 2
      : Math.min(maxY - viewH / 2, Math.max(minY + viewH / 2, state.camera.y));
}

/**
 * The camera looks straight down at a valley, so there is no horizon to draw.
 * Anything past the tile grid is painted as more of the same countryside,
 * which is what keeps the corners of a phone screen from showing bare sky.
 */
const BACKDROP: Record<Season, string> = {
  spring: "#78a84f",
  summer: "#84ab4b",
  autumn: "#93994e",
  winter: "#dbe7ee",
};

function paintSky(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  runtime: FarmRuntime,
  season: Season
) {
  ctx.fillStyle = BACKDROP[season];
  ctx.fillRect(0, 0, width, height);

  // A soft vignette pushes the eye to the middle of the farm.
  const vignette = ctx.createRadialGradient(
    width / 2,
    height / 2,
    Math.min(width, height) * 0.3,
    width / 2,
    height / 2,
    Math.max(width, height) * 0.78
  );
  vignette.addColorStop(0, "rgba(0,0,0,0)");
  vignette.addColorStop(1, "rgba(12,28,10,0.28)");
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, width, height);
}

/** Terrain props are generated once; bucket them by tile so lookup is O(1). */
function indexProps(runtime: FarmRuntime, state: IsoState) {
  if (state.propsFor === runtime.terrain && state.props) return;
  const map = new Map<number, PropEntity[]>();
  for (const prop of runtime.terrain.props) {
    const key = prop.y * WORLD_W + prop.x;
    const list = map.get(key);
    if (list) list.push(prop);
    else map.set(key, [prop]);
  }
  state.props = map;
  state.propsFor = runtime.terrain;
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
  const farmerRow = Math.round(state.farmer.x + state.farmer.y);
  const workerRows = new Map<number, typeof runtime.workers>();
  for (const worker of runtime.workers) {
    const row = Math.round(worker.x / 32 + worker.y / 32);
    const list = workerRows.get(row);
    if (list) list.push(worker);
    else workerRows.set(row, [worker]);
  }

  // Painter's order for an isometric grid is simply increasing (tx + ty).
  for (let sum = 0; sum <= WORLD_W + WORLD_H; sum += 1) {
    for (let tx = 0; tx < WORLD_W; tx += 1) {
      const ty = sum - tx;
      if (ty < 0 || ty >= WORLD_H) continue;

      const world = tileToWorld(tx, ty);
      if (
        world.x < state.camera.x - viewW / 2 - ISO_W * 3 ||
        world.x > state.camera.x + viewW / 2 + ISO_W * 3 ||
        world.y < state.camera.y - viewH / 2 - 500 ||
        world.y > state.camera.y + viewH / 2 + 400
      ) {
        continue;
      }

      drawTile(ctx, runtime, state, assets, season, tx, ty, world, bounds);
    }

    // Figures are sorted into the same painter order as the tiles they stand on.
    const workers = workerRows.get(sum);
    if (workers) {
      for (const worker of workers) {
        const info = WORKERS[worker.id];
        const moving = Math.hypot(worker.targetX - worker.x, worker.targetY - worker.y) > 6;
        drawFarmer(
          ctx,
          state,
          worker.x / 32,
          worker.y / 32,
          moving,
          worker.phase,
          info?.shirt ?? "#4f7fd6",
          info?.hair ?? "#3a2a1d"
        );
      }
    }
    if (farmerRow === sum) {
      const moving = Math.hypot(state.farmer.tx - state.farmer.x, state.farmer.ty - state.farmer.y) > 0.12;
      drawFarmer(ctx, state, state.farmer.x, state.farmer.y, moving, state.farmer.phase, "#e0533f", "#4a2f1c");
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

  /* ---------------------------------------------------------------- ground */

  drawGround(ctx, runtime, state, assets, world.x, world.y, season, tx, ty);
  if (plot || owned) drawField(ctx, assets, world.x, world.y, tx, ty, plot);

  /* -------------------------------------------------------------- building */

  const pieces: Array<{ piece: Piece; building: BuildingEntity }> = [];
  for (const building of runtime.terrain.buildings) {
    if (
      tx < building.x ||
      tx >= building.x + building.w ||
      ty < building.y ||
      ty >= building.y + building.h
    ) {
      continue;
    }
    if (building.requiresUpgrade && upgradeLevel(runtime.save, building.requiresUpgrade) < 1) continue;
    for (const piece of buildingPieces(building, tx - building.x, ty - building.y)) {
      pieces.push({ piece, building });
    }
  }
  const paint = (layer: Layer) => {
    for (const { piece } of pieces) {
      if (piece.layer !== layer) continue;
      drawSprite(
        ctx,
        assets,
        piece.sprite,
        world.x,
        world.y + (piece.dz ?? 0),
        piece.alpha ?? 1,
        piece.tint,
        piece.tintAlpha
      );
    }
  };

  paint(Layer.Floor);
  paint(Layer.Back);

  /* ----------------------------------------------------------------- fence */

  if (owned) {
    if (ty === bounds.y) drawSprite(ctx, assets, "fenceLow_S", world.x, world.y);
    if (tx === bounds.x) drawSprite(ctx, assets, "fenceLow_E", world.x, world.y);
  }

  /* ------------------------------------------------------ crops and scenery */

  if (plot?.crop) {
    const info = CROPS[plot.crop];
    const progress = Math.min(1, plot.growth / info.growHours);
    if (plot.dead) {
      drawSprite(ctx, assets, "cornYoung", world.x, world.y, 0.75, "#6b5a3a");
    } else {
      // Growing crops lean with the wind; taller growth leans further.
      const sway =
        Math.sin(state.time * 1.9 + tx * 0.6 + ty * 0.4) * runtime.save.windSpeed * progress * 0.035;
      ctx.save();
      ctx.translate(world.x, world.y);
      ctx.transform(1, 0, sway, 1, 0, 0);
      drawSprite(ctx, assets, cropSpriteName(plot.crop, progress), 0, 0, 1, info.palette[2]);
      ctx.restore();
      if (progress >= 1) {
        const bob = Math.sin(state.time * 3 + tx + ty) * 3;
        drawReadyPip(ctx, world.x, world.y - 92 + bob);
      }
    }
  } else if (!owned) {
    drawProps(ctx, assets, state, season, tx, ty, world.x, world.y);
  }

  /* ------------------------------------------------------- front and roofs */

  if (owned) {
    if (ty === bounds.y + bounds.h - 1) drawSprite(ctx, assets, "fenceLow_N", world.x, world.y);
    if (tx === bounds.x + bounds.w - 1) drawSprite(ctx, assets, "fenceLow_W", world.x, world.y);
  }

  paint(Layer.Front);
  paint(Layer.Roof);

  if (state.hover && state.hover.tx === tx && state.hover.ty === ty) {
    ctx.save();
    ctx.strokeStyle = "rgba(255,250,205,0.95)";
    ctx.lineWidth = 3;
    ctx.fillStyle = "rgba(255,244,170,0.25)";
    diamondPath(ctx, world.x, world.y);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
}

/**
 * A plot is a raised bed sitting on the grass rather than a slab of the ground
 * layer, so the field reads as a grid of beds with turf between them.
 */
const BED = 0.88;

function drawField(
  ctx: CanvasRenderingContext2D,
  assets: IsoAssets,
  x: number,
  y: number,
  tx: number,
  ty: number,
  plot: { tilled: boolean; moisture: number } | null
) {
  const variant = hash2(tx, ty, 41) > 0.5 ? 1 : 0;

  ctx.save();
  ctx.translate(x, y);

  // Bed shadow, so each one sits into the turf instead of floating on it.
  ctx.globalAlpha = 0.2;
  ctx.fillStyle = "#20340f";
  ctx.scale(BED + 0.05, BED + 0.05);
  diamondPath(ctx, 0, 3);
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.translate(x, y);
  ctx.scale(BED, BED);
  drawSprite(ctx, assets, plot?.tilled ? "dirtFarmland" : `soil${variant}`, 0, 0);

  if (plot && plot.moisture > 0.45) {
    ctx.globalAlpha = Math.min(0.3, plot.moisture * 0.32);
    ctx.fillStyle = "#2c4257";
    diamondPath(ctx, 0, 0);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  ctx.globalAlpha = 0.45;
  ctx.strokeStyle = "#4a3016";
  ctx.lineWidth = 3;
  diamondPath(ctx, 0, 0);
  ctx.stroke();
  ctx.restore();
}

/** Real textured ground, with the season shifting which variant is used. */
function drawGround(
  ctx: CanvasRenderingContext2D,
  runtime: FarmRuntime,
  state: IsoState,
  assets: IsoAssets,
  x: number,
  y: number,
  season: Season,
  tx: number,
  ty: number
) {
  const kind = runtime.terrain.kind[ty * WORLD_W + tx];

  if (kind === "water") {
    drawWater(ctx, state, x, y, tx, ty);
    return;
  }

  const noise = hash2(tx, ty, 17);
  const dry = season === "autumn" || season === "summer";
  let name: string;
  if (kind === "path") name = "dirt";
  else if (kind === "sand") name = "sand0";
  else if (kind === "stone") name = `grass${Math.floor(noise * 4) % 4}`;
  else if (dry && noise > 0.66) name = `grassDry${Math.floor(noise * 2) % 2}`;
  else name = `grass${Math.floor(noise * 4) % 4}`;

  if (assets.images.has(name)) {
    drawSprite(ctx, assets, name, x, y);
    if (season === "winter") {
      // Snow is a wash over the real texture, so the grain still shows.
      ctx.save();
      ctx.globalAlpha = 0.7;
      ctx.fillStyle = "#f2f8fc";
      diamondPath(ctx, x, y);
      ctx.fill();
      ctx.restore();
    }
    return;
  }

  ctx.fillStyle = season === "winter" ? "#e2ecf2" : "#7cae53";
  diamondPath(ctx, x, y);
  ctx.fill();
}

/** The river along the west of the valley — no pack ships a water tile. */
function drawWater(
  ctx: CanvasRenderingContext2D,
  state: IsoState,
  x: number,
  y: number,
  tx: number,
  ty: number
) {
  const shimmer = Math.sin(state.time * 1.1 + tx * 0.7 + ty * 0.5) * 0.5 + 0.5;
  const depth = hash2(tx, ty, 61);

  ctx.save();
  // A flat body colour: a gradient per diamond makes every tile seam show.
  ctx.fillStyle = depth > 0.5 ? "#3d84b8" : "#3a7cae";
  diamondPath(ctx, x, y);
  ctx.fill();

  if (depth > 0.62) {
    ctx.globalAlpha = 0.1 + shimmer * 0.14;
    ctx.strokeStyle = "#dcf1ff";
    ctx.lineWidth = 4;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(x - 26, y - 2 + shimmer * 5);
    ctx.quadraticCurveTo(x, y - 10 + shimmer * 5, x + 26, y - 2 + shimmer * 5);
    ctx.stroke();
  }
  ctx.restore();
}

const TREES = ["treeBig", "treeBig2", "treeBig3"];
const PINES = ["pine", "pine2", "pine3"];
const SNOWY_PINES = ["pineSnow", "pineSnow2", "pineSnow"];
const BUSHES = ["bush", "bush2", "shrub", "shrubTall"];
const FLOWERS = ["grassTuft", "grassTuft2", "tropical", "hemp", "swirl"];

/**
 * Scenery comes from the world generator's prop list, so the valley has real
 * woodland with clearings rather than an even dusting of twigs. A light
 * deterministic scatter fills the gaps between them.
 */
function drawProps(
  ctx: CanvasRenderingContext2D,
  assets: IsoAssets,
  state: IsoState,
  season: Season,
  tx: number,
  ty: number,
  x: number,
  y: number
) {
  const props = state.props?.get(ty * WORLD_W + tx);
  if (props) {
    for (const prop of props) {
      switch (prop.kind) {
        case "tree":
          drawSprite(ctx, assets, TREES[prop.variant % TREES.length], x, y);
          break;
        case "pine":
          drawSprite(
            ctx,
            assets,
            (season === "winter" ? SNOWY_PINES : PINES)[prop.variant % PINES.length],
            x,
            y
          );
          break;
        case "bush":
          drawSprite(ctx, assets, BUSHES[prop.variant % BUSHES.length], x, y);
          break;
        case "flower":
          drawSprite(ctx, assets, FLOWERS[prop.variant % FLOWERS.length], x, y);
          break;
        case "rock":
          drawRock(ctx, x, y, prop.variant);
          break;
        case "crate":
        case "stump":
          drawSprite(ctx, assets, "sacksCrate", x, y);
          break;
        default:
          break;
      }
    }
    return;
  }

  const roll = hash2(tx, ty, 733);
  if (roll > 0.9) drawSprite(ctx, assets, BUSHES[Math.floor(roll * 97) % BUSHES.length], x, y);
  else if (roll > 0.66) drawSprite(ctx, assets, FLOWERS[Math.floor(roll * 131) % FLOWERS.length], x, y);
}

/** The packs ship no boulder, so rocks are drawn — they read fine at this size. */
function drawRock(ctx: CanvasRenderingContext2D, x: number, y: number, variant: number) {
  const r = 15 + (variant % 3) * 5;
  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,0.22)";
  ctx.beginPath();
  ctx.ellipse(x, y + 4, r * 1.1, r * 0.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#8d8b85";
  ctx.beginPath();
  ctx.ellipse(x, y - r * 0.35, r, r * 0.72, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#adaba3";
  ctx.beginPath();
  ctx.ellipse(x - r * 0.25, y - r * 0.55, r * 0.55, r * 0.36, -0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
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
/* Figures                                                                     */
/* -------------------------------------------------------------------------- */

/** The player's farmer strolls the yard, and walks to whatever you just tapped. */
function stepFarmer(runtime: FarmRuntime, state: IsoState, dt: number) {
  const farmer = state.farmer;
  const bounds = unlockedPlotBounds(upgradeLevel(runtime.save, "field"));

  if (farmer.x === 0 && farmer.y === 0) {
    farmer.x = bounds.x + 1;
    farmer.y = bounds.y + bounds.h - 1;
    farmer.tx = farmer.x;
    farmer.ty = farmer.y;
  }

  const dx = farmer.tx - farmer.x;
  const dy = farmer.ty - farmer.y;
  const distance = Math.hypot(dx, dy);

  if (distance > 0.12) {
    const step = Math.min(distance, dt * 2.6);
    farmer.x += (dx / distance) * step;
    farmer.y += (dy / distance) * step;
    farmer.phase += dt * 9;
    farmer.idle = 0;
  } else {
    farmer.idle += dt;
    farmer.phase += dt * 2;
    if (farmer.idle > 4 + hash2(Math.round(farmer.x), Math.round(farmer.y), 5) * 5) {
      farmer.idle = 0;
      farmer.tx = bounds.x + Math.floor(Math.random() * bounds.w);
      farmer.ty = bounds.y + Math.floor(Math.random() * bounds.h);
    }
  }
}

/**
 * Farmhands, drawn as chunky shaded figures with a walk cycle. None of the CC0
 * packs ship characters in this style, so these are drawn directly — a clean
 * silhouette with a bob and swinging arms reads better at this camera distance
 * than a sprite borrowed from a different art style would.
 */
function drawFarmer(
  ctx: CanvasRenderingContext2D,
  state: IsoState,
  tileX: number,
  tileY: number,
  moving: boolean,
  seed: number,
  shirt: string,
  hair: string
) {
  const p = tileToWorld(tileX, tileY);
  const phase = moving ? state.time * 8 + seed : seed;
  const bob = moving ? Math.abs(Math.sin(phase)) * 5 : Math.sin(state.time * 1.8 + seed) * 1.4;
  const swing = moving ? Math.sin(phase) * 7 : 0;

  const bx = p.x;
  const by = p.y - bob;

  ctx.save();

  ctx.fillStyle = "rgba(0,0,0,0.26)";
  ctx.beginPath();
  ctx.ellipse(bx, p.y + 3, 17, 8, 0, 0, Math.PI * 2);
  ctx.fill();

  // boots and legs
  ctx.strokeStyle = "#3d4a63";
  ctx.lineWidth = 8;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(bx - 4, by - 20);
  ctx.lineTo(bx - 4 + swing * 0.7, by - 1);
  ctx.moveTo(bx + 4, by - 20);
  ctx.lineTo(bx + 4 - swing * 0.7, by - 1);
  ctx.stroke();

  // dungarees
  ctx.fillStyle = shirt;
  roundRect(ctx, bx - 12, by - 48, 24, 30, 8);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.2)";
  roundRect(ctx, bx - 12, by - 48, 9, 30, 8);
  ctx.fill();
  ctx.fillStyle = "rgba(0,0,0,0.16)";
  roundRect(ctx, bx + 5, by - 48, 7, 30, 8);
  ctx.fill();

  // arms
  ctx.strokeStyle = shirt;
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.moveTo(bx - 11, by - 43);
  ctx.lineTo(bx - 17, by - 26 + swing);
  ctx.moveTo(bx + 11, by - 43);
  ctx.lineTo(bx + 17, by - 26 - swing);
  ctx.stroke();

  // head, hair and straw hat
  ctx.fillStyle = "#f4c9a0";
  ctx.beginPath();
  ctx.arc(bx, by - 57, 10.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = hair;
  ctx.beginPath();
  ctx.ellipse(bx, by - 62, 11, 7, 0, Math.PI, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#e3bd52";
  ctx.beginPath();
  ctx.ellipse(bx, by - 62, 19, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#f0d074";
  ctx.beginPath();
  ctx.ellipse(bx, by - 67, 9.5, 6.5, 0, 0, Math.PI * 2);
  ctx.fill();

  // eyes, so the figure has a front
  ctx.fillStyle = "#40301f";
  ctx.beginPath();
  ctx.arc(bx - 3.6, by - 55, 1.7, 0, Math.PI * 2);
  ctx.arc(bx + 3.6, by - 55, 1.7, 0, Math.PI * 2);
  ctx.fill();

  if (!moving) {
    // a working flourish so idle hands still look busy
    ctx.strokeStyle = "rgba(255,255,255,0.55)";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(bx + 20, by - 32, 8, -0.8 + Math.sin(state.time * 6) * 0.5, 0.6 + Math.sin(state.time * 6) * 0.5);
    ctx.stroke();
  }
  ctx.restore();
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

/** The windmill's sails turn with the wind — the kit has no moving parts. */
function drawWindmillSails(ctx: CanvasRenderingContext2D, runtime: FarmRuntime, state: IsoState) {
  const mill = runtime.terrain.buildings.find((b) => b.id === "windmill");
  if (!mill || upgradeLevel(runtime.save, "windmill") < 1) return;

  const p = tileToWorld(mill.x + mill.w - 1, mill.y + mill.h - 1);
  const cx = p.x;
  const cy = p.y - ROOF_H - 58;
  const spin = state.time * (0.5 + runtime.save.windSpeed * 0.9);

  ctx.save();
  ctx.translate(cx, cy);
  ctx.strokeStyle = "#6b4a2c";
  ctx.lineWidth = 6;
  ctx.lineCap = "round";
  for (let i = 0; i < 4; i += 1) {
    const angle = spin + (i * Math.PI) / 2;
    ctx.save();
    ctx.rotate(angle);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, -46);
    ctx.stroke();
    ctx.fillStyle = "rgba(244,232,205,0.92)";
    roundRect(ctx, -9, -46, 18, 30, 3);
    ctx.fill();
    ctx.restore();
  }
  ctx.fillStyle = "#4a331f";
  ctx.beginPath();
  ctx.arc(0, 0, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** Chimney smoke — cheap, but it makes the homestead feel lived in. */
function drawSmoke(ctx: CanvasRenderingContext2D, runtime: FarmRuntime, state: IsoState) {
  const house = runtime.terrain.buildings.find((b) => b.id === "house");
  if (!house) return;
  const p = tileToWorld(house.x + house.w - 1, house.y);
  ctx.save();
  for (let i = 0; i < 6; i += 1) {
    const t = (state.time * 0.4 + i * 0.17) % 1;
    ctx.globalAlpha = (1 - t) * 0.42;
    ctx.fillStyle = "#eef3f6";
    ctx.beginPath();
    ctx.arc(p.x + Math.sin(t * 5 + i) * 10, p.y - ROOF_H - 96 - t * 80, 6 + t * 13, 0, Math.PI * 2);
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

/**
 * Dusk and night tint the scene, but only gently — a farm you cannot read is a
 * farm you cannot play. Lantern light around the homestead lifts it further.
 */
function applyDayNight(
  ctx: CanvasRenderingContext2D,
  runtime: FarmRuntime,
  state: IsoState,
  width: number,
  height: number
) {
  const light = dayFactor(runtime.save.minute);
  if (light > 0.86) return;

  const depth = (0.86 - light) / 0.86;

  ctx.save();
  ctx.globalCompositeOperation = "multiply";
  ctx.globalAlpha = Math.min(0.34, depth * 0.42);
  ctx.fillStyle = light > 0.35 ? "#ffc48a" : "#93a9d6";
  ctx.fillRect(0, 0, width, height);
  ctx.restore();

  if (light > 0.5) return;

  const house = runtime.terrain.buildings.find((b) => b.id === "house");
  if (!house) return;
  const p = tileToWorld(house.x, house.y + house.h - 1);
  const sx = (p.x - state.camera.x + width / state.camera.zoom / 2) * state.camera.zoom;
  const sy = (p.y - state.camera.y + height / state.camera.zoom / 2) * state.camera.zoom;
  const radius = 260 * state.camera.zoom;

  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const glow = ctx.createRadialGradient(sx, sy, 0, sx, sy, radius);
  glow.addColorStop(0, `rgba(255,203,120,${0.3 * (1 - light * 2)})`);
  glow.addColorStop(1, "rgba(255,203,120,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(sx - radius, sy - radius, radius * 2, radius * 2);
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
