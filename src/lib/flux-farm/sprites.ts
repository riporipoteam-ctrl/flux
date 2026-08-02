/**
 * Flux Farm — procedural sprite atlas.
 *
 * Every tile, crop stage, character frame, building and prop is painted once
 * into an offscreen canvas at load time and then blitted by the renderer. This
 * keeps the game a single self-contained bundle (no image downloads, works
 * offline and on GitHub Pages) while still giving hand-drawn-looking pixel art
 * with per-season palettes, shading and outlines.
 */

import { CROPS, SEASON_INFO, TILE, type CropId, type Season } from "./content";
import { hash2, type PropKind, type TerrainKind } from "./world";

type Ctx = CanvasRenderingContext2D;

export interface Sprite {
  canvas: HTMLCanvasElement;
  w: number;
  h: number;
  /** Pixels the sprite extends above its tile origin. */
  offsetY: number;
}

function makeCanvas(w: number, h: number) {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D canvas unavailable");
  ctx.imageSmoothingEnabled = false;
  return { canvas, ctx };
}

function shade(hex: string, amount: number) {
  const value = hex.replace("#", "");
  const num = parseInt(value.length === 3 ? value.split("").map((c) => c + c).join("") : value, 16);
  const r = Math.max(0, Math.min(255, ((num >> 16) & 255) + amount));
  const g = Math.max(0, Math.min(255, ((num >> 8) & 255) + amount));
  const b = Math.max(0, Math.min(255, (num & 255) + amount));
  return `rgb(${r},${g},${b})`;
}

function px(ctx: Ctx, x: number, y: number, w: number, h: number, color: string) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}

/** Speckles a rect with deterministic 1px noise — the pixel-art "texture" pass. */
function speckle(ctx: Ctx, x: number, y: number, w: number, h: number, colors: string[], seed: number, density: number) {
  for (let iy = 0; iy < h; iy += 1) {
    for (let ix = 0; ix < w; ix += 1) {
      const n = hash2(x + ix, y + iy, seed);
      if (n < density) {
        ctx.fillStyle = colors[Math.floor(n * colors.length * (1 / density)) % colors.length];
        ctx.fillRect(x + ix, y + iy, 1, 1);
      }
    }
  }
}

function ellipse(ctx: Ctx, cx: number, cy: number, rx: number, ry: number, color: string) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
}

/* -------------------------------------------------------------------------- */
/* Terrain tiles                                                               */
/* -------------------------------------------------------------------------- */

function drawGrass(ctx: Ctx, season: Season, variant: number, alt: boolean) {
  const info = SEASON_INFO[season];
  const base = alt ? info.grassAlt : info.grass;
  px(ctx, 0, 0, TILE, TILE, base);
  speckle(ctx, 0, 0, TILE, TILE, [shade(base, -14), shade(base, 10)], variant * 31 + 7, 0.3);

  // Blades: a few 2px vertical strokes give the tile a readable direction.
  for (let i = 0; i < 5; i += 1) {
    const bx = Math.floor(hash2(i, variant, 4) * (TILE - 2)) + 1;
    const by = Math.floor(hash2(i, variant, 9) * (TILE - 4)) + 2;
    px(ctx, bx, by, 1, 2, shade(base, 18));
    px(ctx, bx, by + 2, 1, 1, shade(base, -20));
  }

  if (season === "spring" && variant === 2) {
    px(ctx, 8, 20, 2, 2, info.accent);
    px(ctx, 21, 9, 2, 2, info.accent);
  }
  if (season === "autumn" && variant === 1) {
    px(ctx, 12, 14, 3, 2, "#c2703a");
    px(ctx, 22, 22, 2, 2, "#a85a2c");
  }
  if (season === "winter") {
    speckle(ctx, 0, 0, TILE, TILE, ["#ffffff", "#eef6fb"], variant * 13 + 3, 0.16);
  }
}

function drawSoil(ctx: Ctx, tilled: boolean, wet: number, season: Season) {
  const dry = season === "winter" ? "#6b5c4d" : "#7a5f43";
  const damp = "#4a3627";
  const base = `rgb(${Math.round(lerp(hexPart(dry, 0), hexPart(damp, 0), wet))},${Math.round(
    lerp(hexPart(dry, 1), hexPart(damp, 1), wet)
  )},${Math.round(lerp(hexPart(dry, 2), hexPart(damp, 2), wet))})`;

  px(ctx, 0, 0, TILE, TILE, base);
  speckle(ctx, 0, 0, TILE, TILE, [shade(dry, -22), shade(dry, 14)], 91, 0.34);

  if (tilled) {
    // Furrow rows with a lit top edge and shadowed bottom edge.
    for (let row = 3; row < TILE; row += 7) {
      px(ctx, 1, row, TILE - 2, 1, shade(dry, wet > 0.5 ? -40 : -28));
      px(ctx, 1, row + 1, TILE - 2, 1, shade(dry, 12));
    }
  }
}

function hexPart(hex: string, index: number) {
  const num = parseInt(hex.replace("#", ""), 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255][index];
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * Math.max(0, Math.min(1, t));
}

/** Unploughed farmland: pasture grass broken up by patches of bare earth. */
function drawField(ctx: Ctx, season: Season, variant: number) {
  drawGrass(ctx, season, variant, variant % 2 === 1);
  // Only a quarter of the variants carry detail — with four tiles in the
  // atlas, decorating every one turns the field into a visible polka-dot grid.
  const dry = season === "winter" ? "#c2ccd2" : season === "autumn" ? "#9a9648" : "#84a352";
  if (variant === 2) {
    ellipse(ctx, 12, 15, 6, 4, dry);
    ellipse(ctx, 12, 14, 4.5, 2.8, shade(dry, 16));
  }
  if (variant === 3) {
    ellipse(ctx, 22, 23, 3, 2, "#9aa0a5");
    ellipse(ctx, 22, 22, 2, 1.2, "#b6bbc0");
  }
}

function drawPath(ctx: Ctx, variant: number) {
  px(ctx, 0, 0, TILE, TILE, "#a08a68");
  speckle(ctx, 0, 0, TILE, TILE, ["#8d7757", "#b39c78", "#7d6a4c"], variant * 17 + 5, 0.42);
  for (let i = 0; i < 4; i += 1) {
    const sx = Math.floor(hash2(i, variant, 71) * (TILE - 4));
    const sy = Math.floor(hash2(i, variant, 73) * (TILE - 4));
    px(ctx, sx, sy, 3, 2, "#8a7454");
    px(ctx, sx, sy - 1, 3, 1, "#bfa87f");
  }
}

function drawWater(ctx: Ctx, variant: number, frame: number) {
  px(ctx, 0, 0, TILE, TILE, "#2f6aa8");
  speckle(ctx, 0, 0, TILE, TILE, ["#2a5f97", "#3877b8"], variant * 5, 0.4);
  for (let i = 0; i < 3; i += 1) {
    const wy = (i * 11 + frame * 4) % TILE;
    px(ctx, 3 + ((i * 7 + frame * 3) % 12), wy, 8, 1, "#7fb6e0");
    px(ctx, 18 - ((i * 5 + frame * 2) % 10), (wy + 6) % TILE, 6, 1, "#5c9ad0");
  }
}

function drawStone(ctx: Ctx, variant: number) {
  px(ctx, 0, 0, TILE, TILE, "#8c8f92");
  speckle(ctx, 0, 0, TILE, TILE, ["#7a7d80", "#9ba0a4", "#6d7073"], variant * 23, 0.45);
}

function drawSand(ctx: Ctx, variant: number) {
  px(ctx, 0, 0, TILE, TILE, "#d8c58c");
  speckle(ctx, 0, 0, TILE, TILE, ["#c8b37a", "#e5d5a3"], variant * 29, 0.35);
}

/* -------------------------------------------------------------------------- */
/* Crops                                                                       */
/* -------------------------------------------------------------------------- */

export const CROP_STAGES = 5;

function drawCrop(ctx: Ctx, crop: CropId, stage: number) {
  const info = CROPS[crop];
  const [stem, leaf, fruit] = info.palette;
  const height = 6 + stage * 5;
  const baseY = 30;
  const cx = 16;

  if (stage === 0) {
    // Sprout: two seed leaves.
    px(ctx, cx - 1, baseY - 4, 2, 4, stem);
    px(ctx, cx - 4, baseY - 5, 3, 2, leaf);
    px(ctx, cx + 1, baseY - 5, 3, 2, leaf);
    return;
  }

  switch (info.shape) {
    case "grain": {
      for (let i = -2; i <= 2; i += 1) {
        const sway = Math.round(i * 0.6);
        px(ctx, cx + i * 3 + sway, baseY - height, 1, height, stem);
        if (stage >= 3) {
          px(ctx, cx + i * 3 + sway - 1, baseY - height - 4, 3, 5, fruit);
          px(ctx, cx + i * 3 + sway, baseY - height - 5, 1, 2, shade(fruit, 22));
        }
      }
      break;
    }
    case "root": {
      px(ctx, cx - 1, baseY - height, 2, height, stem);
      for (let i = 0; i < stage + 1; i += 1) {
        const side = i % 2 === 0 ? -1 : 1;
        const ly = baseY - height + 2 + i * 3;
        px(ctx, cx + side * 2, ly, 5 * side > 0 ? 5 : -5, 3, leaf);
        px(ctx, cx + side * 2, ly, side > 0 ? 5 : -5, 1, shade(leaf, 20));
      }
      if (stage >= CROP_STAGES - 1) {
        px(ctx, cx - 3, baseY - 3, 6, 4, fruit);
        px(ctx, cx - 2, baseY - 4, 4, 1, shade(fruit, 28));
      }
      break;
    }
    case "bush": {
      ellipse(ctx, cx, baseY - height / 2, 3 + stage * 1.6, height / 2, leaf);
      ellipse(ctx, cx - 2, baseY - height / 2 - 2, 2 + stage, height / 3, shade(leaf, 18));
      if (stage >= 3) {
        for (let i = 0; i < stage; i += 1) {
          const fx = cx - 5 + ((i * 5) % 11);
          const fy = baseY - 6 - ((i * 4) % 10);
          px(ctx, fx, fy, 3, 3, fruit);
          px(ctx, fx, fy, 1, 1, shade(fruit, 40));
        }
      }
      break;
    }
    case "tall": {
      px(ctx, cx - 1, baseY - height, 3, height, stem);
      for (let i = 0; i < stage + 2; i += 1) {
        const side = i % 2 === 0 ? -1 : 1;
        const ly = baseY - 4 - i * 4;
        ctx.fillStyle = leaf;
        ctx.beginPath();
        ctx.moveTo(cx, ly);
        ctx.lineTo(cx + side * (5 + stage), ly - 4);
        ctx.lineTo(cx + side * 2, ly + 2);
        ctx.closePath();
        ctx.fill();
      }
      if (stage >= CROP_STAGES - 1) {
        if (crop === "sunflower") {
          ellipse(ctx, cx, baseY - height - 3, 7, 7, fruit);
          ellipse(ctx, cx, baseY - height - 3, 3, 3, "#6b3f14");
        } else {
          px(ctx, cx + 2, baseY - height + 3, 4, 9, fruit);
          px(ctx, cx + 2, baseY - height + 3, 1, 9, shade(fruit, 30));
        }
      }
      break;
    }
    case "vine": {
      px(ctx, cx - 1, baseY - height, 2, height, stem);
      for (let i = 0; i < 3; i += 1) {
        px(ctx, cx - 6 + i * 6, baseY - height + 2, 5, 1, stem);
      }
      if (stage >= 3) {
        for (let i = 0; i < 6; i += 1) {
          const fx = cx - 6 + ((i * 4) % 13);
          const fy = baseY - height + 4 + ((i * 3) % 9);
          px(ctx, fx, fy, 3, 3, fruit);
        }
        if (crop === "starfruit") {
          px(ctx, cx - 1, baseY - height - 4, 3, 3, "#fff3b0");
          px(ctx, cx - 3, baseY - height - 3, 7, 1, "#ffe066");
        }
      }
      break;
    }
    case "gourd": {
      px(ctx, cx - 1, baseY - 10, 2, 8, stem);
      for (let i = 0; i < 3; i += 1) {
        ellipse(ctx, cx - 7 + i * 7, baseY - 12, 4, 3, leaf);
      }
      if (stage >= 3) {
        ellipse(ctx, cx, baseY - 4, 6 + stage, 5 + stage * 0.6, fruit);
        px(ctx, cx - 1, baseY - 12, 2, 3, "#5f7a34");
        ellipse(ctx, cx - 3, baseY - 6, 2, 3, shade(fruit, 34));
      }
      break;
    }
    default:
      break;
  }
}

function drawDeadCrop(ctx: Ctx) {
  const brown = "#6f5a3c";
  for (let i = -1; i <= 1; i += 1) {
    px(ctx, 16 + i * 3, 18, 1, 12, brown);
    px(ctx, 16 + i * 3 - 1, 17, 3, 1, shade(brown, -20));
  }
}

/* -------------------------------------------------------------------------- */
/* Characters                                                                  */
/* -------------------------------------------------------------------------- */

export interface CharacterPalette {
  skin: string;
  hair: string;
  shirt: string;
  pants: string;
  hat?: string;
}

const CHAR_W = 24;
const CHAR_H = 34;

/**
 * 4 directions × 4 frames. Frame 0/2 are the neutral pose, 1 and 3 are the
 * opposing strides, which reads as a proper walk cycle at ~9fps.
 */
function drawCharacter(ctx: Ctx, palette: CharacterPalette, dir: number, frame: number) {
  const cx = CHAR_W / 2;
  const bob = frame === 1 ? -1 : frame === 3 ? 0 : 0;
  const legSwing = frame === 1 ? 2 : frame === 3 ? -2 : 0;
  const back = dir === 3;
  const side = dir === 1 || dir === 2;
  const flip = dir === 1 ? -1 : 1;

  // Shadow
  ellipse(ctx, cx, CHAR_H - 2, 7, 2.5, "rgba(0,0,0,0.22)");

  // Legs
  px(ctx, cx - 4, 24 + bob, 3, 8 + legSwing, "#33405a");
  px(ctx, cx + 1, 24 + bob, 3, 8 - legSwing, "#2b3750");
  px(ctx, cx - 5, 31 + bob, 4, 2, "#3a2a1c");
  px(ctx, cx + 1, 31 + bob, 4, 2, "#3a2a1c");

  // Torso
  px(ctx, cx - 5, 14 + bob, 10, 11, palette.shirt);
  px(ctx, cx - 5, 14 + bob, 10, 2, shade(palette.shirt, 26));
  px(ctx, cx - 5, 23 + bob, 10, 2, shade(palette.shirt, -26));

  // Arms
  const armY = 15 + bob;
  px(ctx, cx - 7, armY, 2, 8 + (frame === 1 ? 1 : 0), palette.shirt);
  px(ctx, cx + 5, armY, 2, 8 + (frame === 3 ? 1 : 0), shade(palette.shirt, -18));
  px(ctx, cx - 7, armY + 8, 2, 2, palette.skin);
  px(ctx, cx + 5, armY + 8, 2, 2, palette.skin);

  // Head
  px(ctx, cx - 4, 5 + bob, 8, 9, palette.skin);
  px(ctx, cx - 4, 5 + bob, 8, 2, shade(palette.skin, 18));

  // Hair / hat
  if (palette.hat) {
    px(ctx, cx - 6, 3 + bob, 12, 3, palette.hat);
    px(ctx, cx - 4, 1 + bob, 8, 3, palette.hat);
    px(ctx, cx - 6, 5 + bob, 12, 1, shade(palette.hat, -30));
  } else {
    px(ctx, cx - 4, 3 + bob, 8, 4, palette.hair);
    px(ctx, cx - 5, 5 + bob, 1, 4, palette.hair);
    px(ctx, cx + 4, 5 + bob, 1, 4, palette.hair);
  }

  // Face — hidden when walking away.
  if (!back) {
    if (side) {
      px(ctx, cx + flip * 2 - (flip < 0 ? 1 : 0), 9 + bob, 1, 2, "#1a1410");
    } else {
      px(ctx, cx - 2, 9 + bob, 1, 2, "#1a1410");
      px(ctx, cx + 1, 9 + bob, 1, 2, "#1a1410");
      px(ctx, cx - 1, 12 + bob, 2, 1, shade(palette.skin, -40));
    }
  }
}

/* -------------------------------------------------------------------------- */
/* Buildings and props                                                         */
/* -------------------------------------------------------------------------- */

function drawHouse(ctx: Ctx, w: number, h: number, level: number) {
  const wallH = h - 24;
  const wall = level >= 3 ? "#e6dbc6" : "#d9c9a8";
  const roof = level >= 4 ? "#7d3b3b" : "#8c4a3a";

  // Roof
  ctx.fillStyle = roof;
  ctx.beginPath();
  ctx.moveTo(-6, 26);
  ctx.lineTo(w / 2, 0);
  ctx.lineTo(w + 6, 26);
  ctx.closePath();
  ctx.fill();
  px(ctx, -6, 26, w + 12, 3, shade(roof, -28));
  for (let x = -4; x < w + 6; x += 6) {
    px(ctx, x, 14 + Math.abs(x - w / 2) * 0.24, 4, 1, shade(roof, -18));
  }

  // Walls
  px(ctx, 4, 29, w - 8, wallH, wall);
  px(ctx, 4, 29, w - 8, 2, shade(wall, 22));
  px(ctx, 4, 29 + wallH - 3, w - 8, 3, shade(wall, -26));
  speckle(ctx, 4, 29, w - 8, wallH, [shade(wall, -10), shade(wall, 8)], 17, 0.14);

  // Door and windows
  const doorX = Math.round(w / 2) - 6;
  px(ctx, doorX, 29 + wallH - 20, 12, 20, "#6b4526");
  px(ctx, doorX + 1, 29 + wallH - 19, 10, 18, "#7d5330");
  px(ctx, doorX + 8, 29 + wallH - 10, 2, 2, "#e8c04a");
  px(ctx, 10, 34, 9, 9, "#2f4a5c");
  px(ctx, 10, 34, 9, 2, shade("#2f4a5c", 30));
  px(ctx, w - 19, 34, 9, 9, "#2f4a5c");
  if (level >= 2) {
    px(ctx, w - 14, 6, 6, 16, "#6d6a66");
    px(ctx, w - 15, 4, 8, 3, "#57544f");
  }
}

function drawBarn(ctx: Ctx, w: number, h: number) {
  const wall = "#a83c33";
  const roof = "#6b2f28";
  ctx.fillStyle = roof;
  ctx.beginPath();
  ctx.moveTo(-4, 24);
  ctx.lineTo(w / 2, 2);
  ctx.lineTo(w + 4, 24);
  ctx.closePath();
  ctx.fill();
  px(ctx, 3, 26, w - 6, h - 26, wall);
  px(ctx, 3, 26, w - 6, 2, shade(wall, 26));
  for (let x = 3; x < w - 3; x += 8) px(ctx, x, 28, 1, h - 30, shade(wall, -26));
  const doorX = Math.round(w / 2) - 9;
  px(ctx, doorX, h - 26, 18, 26, "#e8dcc0");
  px(ctx, doorX, h - 26, 18, 2, "#c9bda1");
  ctx.strokeStyle = "#8c4a3a";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(doorX, h - 26);
  ctx.lineTo(doorX + 18, h);
  ctx.moveTo(doorX + 18, h - 26);
  ctx.lineTo(doorX, h);
  ctx.stroke();
}

function drawGreenhouse(ctx: Ctx, w: number, h: number) {
  ctx.fillStyle = "rgba(168, 226, 220, 0.62)";
  ctx.beginPath();
  ctx.moveTo(0, 26);
  ctx.lineTo(w / 2, 2);
  ctx.lineTo(w, 26);
  ctx.closePath();
  ctx.fill();
  px(ctx, 2, 26, w - 4, h - 26, "rgba(186, 235, 228, 0.55)");
  ctx.strokeStyle = "#5f8f86";
  ctx.lineWidth = 2;
  ctx.strokeRect(2, 26, w - 4, h - 26);
  for (let x = 8; x < w - 4; x += 12) px(ctx, x, 26, 2, h - 26, "#5f8f86");
  for (let y = 34; y < h; y += 12) px(ctx, 2, y, w - 4, 2, "#5f8f86");
  px(ctx, 6, h - 14, w - 12, 10, "#3f7a4e");
  speckle(ctx, 6, h - 14, w - 12, 10, ["#5aa060", "#2f6b3d"], 41, 0.4);
}

function drawSilo(ctx: Ctx, w: number, h: number) {
  px(ctx, 4, 14, w - 8, h - 14, "#b9bfc4");
  for (let y = 18; y < h; y += 8) px(ctx, 4, y, w - 8, 1, "#93999e");
  px(ctx, 4, 14, 3, h - 14, "#d3d8dc");
  ellipse(ctx, w / 2, 14, (w - 8) / 2, 9, "#9aa0a5");
  ellipse(ctx, w / 2, 12, (w - 12) / 2, 6, "#c3c9ce");
}

function drawWindmill(ctx: Ctx, w: number, h: number, spin: number) {
  px(ctx, w / 2 - 7, h - 34, 14, 34, "#c6b393");
  px(ctx, w / 2 - 7, h - 34, 4, 34, "#dccbaa");
  ctx.fillStyle = "#7d4a33";
  ctx.beginPath();
  ctx.moveTo(w / 2 - 11, h - 34);
  ctx.lineTo(w / 2, h - 48);
  ctx.lineTo(w / 2 + 11, h - 34);
  ctx.closePath();
  ctx.fill();

  ctx.save();
  ctx.translate(w / 2, h - 42);
  ctx.rotate(spin);
  for (let i = 0; i < 4; i += 1) {
    ctx.rotate(Math.PI / 2);
    px(ctx, -2, -26, 4, 26, "#e6dcc4");
    px(ctx, -2, -26, 1, 26, "#b8ae95");
  }
  ctx.restore();
  ellipse(ctx, w / 2, h - 42, 3, 3, "#6b5a42");
}

function drawMarket(ctx: Ctx, w: number, h: number) {
  px(ctx, 2, 20, w - 4, h - 20, "#c9a878");
  for (let x = 0; x < w; x += 10) {
    px(ctx, x, 8, 5, 12, "#e05a5a");
    px(ctx, x + 5, 8, 5, 12, "#f2efe6");
  }
  px(ctx, 0, 6, w, 3, "#8c5b3a");
  px(ctx, 4, h - 12, w - 8, 10, "#8c6b45");
  px(ctx, 8, h - 18, 6, 6, "#e57722");
  px(ctx, 18, h - 18, 6, 6, "#d2352a");
  px(ctx, 28, h - 18, 6, 6, "#f4c623");
}

function drawWell(ctx: Ctx) {
  px(ctx, 4, 16, 24, 14, "#8f8b85");
  speckle(ctx, 4, 16, 24, 14, ["#7a7671", "#a29d96"], 61, 0.4);
  ellipse(ctx, 16, 16, 12, 5, "#2c4a63");
  ellipse(ctx, 16, 16, 9, 3.5, "#1d3349");
  px(ctx, 6, 0, 3, 18, "#7a5a3a");
  px(ctx, 23, 0, 3, 18, "#7a5a3a");
  ctx.fillStyle = "#8c4a3a";
  ctx.beginPath();
  ctx.moveTo(1, 6);
  ctx.lineTo(16, -4);
  ctx.lineTo(31, 6);
  ctx.closePath();
  ctx.fill();
}

function drawShed(ctx: Ctx, w: number, h: number) {
  px(ctx, 2, 12, w - 4, h - 12, "#9b7a52");
  px(ctx, 0, 8, w, 6, "#6b4f33");
  px(ctx, w / 2 - 5, h - 16, 10, 16, "#5d4229");
}

function drawTree(ctx: Ctx, season: Season, variant: number, pine: boolean) {
  const info = SEASON_INFO[season];
  const trunk = "#5b4127";
  px(ctx, 20, 34, 8, 18, trunk);
  px(ctx, 20, 34, 3, 18, shade(trunk, 20));

  if (pine) {
    for (let i = 0; i < 4; i += 1) {
      const width = 30 - i * 5;
      const y = 34 - i * 9;
      ctx.fillStyle = season === "winter" ? "#4f6f60" : info.tree;
      ctx.beginPath();
      ctx.moveTo(24, y - 14);
      ctx.lineTo(24 - width / 2, y);
      ctx.lineTo(24 + width / 2, y);
      ctx.closePath();
      ctx.fill();
      if (season === "winter") {
        px(ctx, 24 - width / 2 + 2, y - 2, width - 4, 2, "#eef6fb");
      }
    }
  } else {
    const leaf = season === "winter" ? "#6b5f52" : info.tree;
    ellipse(ctx, 24, 22, 18, 15, leaf);
    ellipse(ctx, 15, 26, 11, 9, shade(leaf, -16));
    ellipse(ctx, 31, 24, 12, 10, shade(leaf, 14));
    if (season === "autumn") {
      speckle(ctx, 8, 10, 32, 24, ["#d3822f", "#b8552c", "#e0a13a"], variant * 11, 0.22);
    }
    if (season === "spring") {
      speckle(ctx, 8, 10, 32, 24, [info.accent, "#ffffff"], variant * 7, 0.1);
    }
    if (season === "winter") {
      speckle(ctx, 8, 8, 32, 18, ["#ffffff"], variant * 5, 0.18);
    }
  }
}

function drawProp(ctx: Ctx, kind: PropKind, season: Season, variant: number) {
  switch (kind) {
    case "tree":
    case "pine":
      drawTree(ctx, season, variant, kind === "pine");
      break;
    case "rock":
      ellipse(ctx, 16, 22, 11, 8, "#8b8e92");
      ellipse(ctx, 13, 20, 6, 4, "#a6aaae");
      ellipse(ctx, 20, 24, 5, 3, "#75797d");
      break;
    case "bush": {
      const leaf = season === "winter" ? "#6f7d78" : SEASON_INFO[season].tree;
      ellipse(ctx, 16, 22, 10, 8, leaf);
      ellipse(ctx, 12, 20, 5, 4, shade(leaf, 18));
      if (season === "summer") speckle(ctx, 8, 16, 16, 12, ["#d2352a"], variant, 0.08);
      break;
    }
    case "flower": {
      const colors = ["#ff7ba8", "#ffd45e", "#9fd8ff", "#c98bff"];
      const color = colors[variant % colors.length];
      px(ctx, 16, 20, 1, 6, "#4f7a34");
      px(ctx, 14, 18, 2, 2, color);
      px(ctx, 17, 18, 2, 2, color);
      px(ctx, 15, 16, 3, 2, color);
      px(ctx, 16, 19, 1, 1, "#fff3b0");
      break;
    }
    case "fence-h":
      px(ctx, 0, 18, TILE, 3, "#8b6b45");
      px(ctx, 0, 24, TILE, 3, "#7a5c3a");
      px(ctx, 13, 14, 4, 16, "#6b5033");
      break;
    case "fence-v":
      px(ctx, 14, 0, 3, TILE, "#8b6b45");
      px(ctx, 19, 0, 3, TILE, "#7a5c3a");
      px(ctx, 12, 13, 11, 4, "#6b5033");
      break;
    case "lantern":
      px(ctx, 14, 12, 4, 20, "#4a4a4a");
      px(ctx, 11, 4, 10, 10, "#3a3a3a");
      px(ctx, 13, 6, 6, 6, "#ffd98a");
      px(ctx, 10, 2, 12, 2, "#2e2e2e");
      break;
    case "sign":
      px(ctx, 15, 16, 3, 14, "#6b5033");
      px(ctx, 6, 6, 20, 12, "#a37d5b");
      px(ctx, 8, 9, 16, 2, "#6b5033");
      px(ctx, 8, 13, 11, 2, "#6b5033");
      break;
    case "crate":
      px(ctx, 6, 12, 20, 18, "#a8814f");
      px(ctx, 6, 12, 20, 2, "#c49a63");
      px(ctx, 6, 20, 20, 2, "#8a6a3f");
      break;
    case "stump":
      ellipse(ctx, 16, 24, 9, 6, "#6b5033");
      ellipse(ctx, 16, 22, 7, 4.5, "#8a6a45");
      break;
    case "post":
      px(ctx, 14, 8, 4, 22, "#6b5033");
      break;
    default:
      break;
  }
}

/* -------------------------------------------------------------------------- */
/* Atlas                                                                       */
/* -------------------------------------------------------------------------- */

export interface SpriteAtlas {
  season: Season;
  tiles: Map<string, HTMLCanvasElement>;
  soil: HTMLCanvasElement[];
  water: HTMLCanvasElement[];
  crops: Map<string, HTMLCanvasElement>;
  deadCrop: HTMLCanvasElement;
  props: Map<string, HTMLCanvasElement>;
  characters: Map<string, HTMLCanvasElement[]>;
  buildings: Map<string, HTMLCanvasElement>;
}

const SOIL_STEPS = 5;

export function buildAtlas(season: Season): SpriteAtlas {
  const tiles = new Map<string, HTMLCanvasElement>();

  const terrainKinds: TerrainKind[] = ["grass", "grass-alt", "path", "stone", "sand", "farm"];
  for (const kind of terrainKinds) {
    for (let variant = 0; variant < 4; variant += 1) {
      const { canvas, ctx } = makeCanvas(TILE, TILE);
      if (kind === "grass" || kind === "grass-alt") drawGrass(ctx, season, variant, kind === "grass-alt");
      else if (kind === "farm") drawField(ctx, season, variant);
      else if (kind === "path") drawPath(ctx, variant);
      else if (kind === "stone") drawStone(ctx, variant);
      else drawSand(ctx, variant);
      tiles.set(`${kind}:${variant}`, canvas);
    }
  }

  // Soil is keyed by (tilled, moisture step) so watering visibly darkens it.
  const soil: HTMLCanvasElement[] = [];
  for (let tilled = 0; tilled < 2; tilled += 1) {
    for (let step = 0; step < SOIL_STEPS; step += 1) {
      const { canvas, ctx } = makeCanvas(TILE, TILE);
      drawSoil(ctx, tilled === 1, step / (SOIL_STEPS - 1), season);
      soil.push(canvas);
    }
  }

  const water: HTMLCanvasElement[] = [];
  for (let frame = 0; frame < 4; frame += 1) {
    const { canvas, ctx } = makeCanvas(TILE, TILE);
    drawWater(ctx, frame, frame);
    water.push(canvas);
  }

  const crops = new Map<string, HTMLCanvasElement>();
  for (const crop of Object.keys(CROPS) as CropId[]) {
    for (let stage = 0; stage < CROP_STAGES; stage += 1) {
      const { canvas, ctx } = makeCanvas(TILE, TILE + 16);
      ctx.translate(0, 16);
      drawCrop(ctx, crop, stage);
      crops.set(`${crop}:${stage}`, canvas);
    }
  }

  const dead = makeCanvas(TILE, TILE + 16);
  dead.ctx.translate(0, 16);
  drawDeadCrop(dead.ctx);

  const props = new Map<string, HTMLCanvasElement>();
  const propKinds: PropKind[] = ["tree", "pine", "rock", "bush", "flower", "fence-h", "fence-v", "lantern", "sign", "crate", "stump", "post"];
  for (const kind of propKinds) {
    for (let variant = 0; variant < 4; variant += 1) {
      const big = kind === "tree" || kind === "pine";
      const { canvas, ctx } = makeCanvas(big ? 48 : TILE, big ? 56 : TILE);
      drawProp(ctx, kind, season, variant);
      props.set(`${kind}:${variant}`, canvas);
    }
  }

  const buildings = new Map<string, HTMLCanvasElement>();
  const specs: Array<[string, number, number]> = [
    ["house", 5, 4],
    ["barn", 5, 4],
    ["greenhouse", 4, 4],
    ["silo", 2, 3],
    ["market", 4, 3],
    ["shed", 2, 2],
    ["well", 1, 1],
  ];
  for (const [id, tw, th] of specs) {
    for (let level = 1; level <= 5; level += 1) {
      const w = tw * TILE;
      const h = th * TILE + 24;
      const { canvas, ctx } = makeCanvas(w + 16, h + 16);
      ctx.translate(8, 8);
      if (id === "house") drawHouse(ctx, w, h, level);
      else if (id === "barn") drawBarn(ctx, w, h);
      else if (id === "greenhouse") drawGreenhouse(ctx, w, h);
      else if (id === "silo") drawSilo(ctx, w, h);
      else if (id === "market") drawMarket(ctx, w, h);
      else if (id === "shed") drawShed(ctx, w, h);
      else if (id === "well") drawWell(ctx);
      buildings.set(`${id}:${level}`, canvas);
      if (id === "well" || id === "shed" || id === "market" || id === "greenhouse" || id === "silo" || id === "barn") break;
    }
  }

  // The windmill spins, so it is stored as 8 rotation frames.
  for (let frame = 0; frame < 8; frame += 1) {
    const w = 3 * TILE;
    const h = 5 * TILE;
    const { canvas, ctx } = makeCanvas(w + 32, h + 32);
    ctx.translate(16, 16);
    drawWindmill(ctx, w, h, (frame / 8) * Math.PI * 2);
    buildings.set(`windmill:${frame}`, canvas);
  }

  return { season, tiles, soil, water, crops, deadCrop: dead.canvas, props, characters: new Map(), buildings };
}

export function buildCharacter(atlas: SpriteAtlas, key: string, palette: CharacterPalette) {
  if (atlas.characters.has(key)) return atlas.characters.get(key)!;
  const frames: HTMLCanvasElement[] = [];
  for (let dir = 0; dir < 4; dir += 1) {
    for (let frame = 0; frame < 4; frame += 1) {
      const { canvas, ctx } = makeCanvas(CHAR_W, CHAR_H);
      drawCharacter(ctx, palette, dir, frame);
      frames.push(canvas);
    }
  }
  atlas.characters.set(key, frames);
  return frames;
}

export function characterFrame(frames: HTMLCanvasElement[], dir: number, frame: number) {
  return frames[dir * 4 + (frame % 4)];
}

export function soilSprite(atlas: SpriteAtlas, tilled: boolean, moisture: number) {
  const step = Math.min(SOIL_STEPS - 1, Math.max(0, Math.round(moisture * (SOIL_STEPS - 1))));
  return atlas.soil[(tilled ? SOIL_STEPS : 0) + step];
}

export function cropSprite(atlas: SpriteAtlas, crop: CropId, progress: number) {
  const stage = Math.min(CROP_STAGES - 1, Math.floor(progress * CROP_STAGES));
  return atlas.crops.get(`${crop}:${stage}`) ?? atlas.deadCrop;
}

export const CHARACTER_SIZE = { w: CHAR_W, h: CHAR_H };
