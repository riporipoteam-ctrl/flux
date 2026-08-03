"""Re-cut the Flux Farm sprite atlas from the CC0 source packs.

Not part of the build — the cut sprites are committed. Run it when the atlas
needs to change, with the two source packs unpacked next to each other:

    kenney_isometricminiaturefarm.zip -> <work>/farm/Isometric/*.png
    isometric-plant-pack.zip          -> <work>/plants/isometric tiles/*.png

    SCRATCH=<work> python3 scripts/vendor-flux-farm-art.py

Both packs are CC0; see public/game-assets/flux-farm/CREDITS.md.

Every sprite is trimmed to its own bounding box and records where the tile
anchor sits inside it (ax, ay), so the renderer only ever needs one anchor and
sprites are free to overhang the tile in any direction.
"""
from PIL import Image, ImageEnhance
import json
import os

SCRATCH = os.environ.get("SCRATCH", "vendor-src")
KENNEY = f"{SCRATCH}/farm/Isometric"
PLANTS = f"{SCRATCH}/plants/isometric tiles"
OUT = "public/game-assets/flux-farm"

# Working canvas: generous enough that nothing is ever clipped.
CW, CH, CAX, CAY = 640, 640, 320, 470
# Kenney frames are 256x512 with the tile anchor at (128, 432); halved they are
# 128x256 anchored at (64, 216).
KW, KH, KAX, KAY = 128, 256, 64, 216

sprites = {}

def emit(name, canvas, ground=False):
    box = canvas.getbbox()
    if box is None:
        raise SystemExit(f"empty sprite {name}")
    canvas.crop(box).save(f"{OUT}/{name}.png", optimize=True)
    meta = {"w": box[2] - box[0], "h": box[3] - box[1], "ax": CAX - box[0], "ay": CAY - box[1]}
    if ground:
        meta["ground"] = True
    sprites[name] = meta

def blank():
    return Image.new("RGBA", (CW, CH), (0, 0, 0, 0))

def lift(im, gamma, saturation, brightness=1.0):
    """The source renders bake in heavy ambient shading, which reads as murk at
    game scale. A gamma curve opens the shadows without blowing the highlights;
    saturation puts the colour back that lifting the shadows washes out."""
    lut = [round(255 * (i / 255) ** gamma) for i in range(256)] * 3 + list(range(256))
    im = im.point(lut)
    if brightness != 1.0:
        alpha = im.getchannel("A")
        im = ImageEnhance.Brightness(im).enhance(brightness)
        im.putalpha(alpha)
    alpha = im.getchannel("A")
    im = ImageEnhance.Color(im).enhance(saturation)
    im.putalpha(alpha)
    return im

# ------------------------------------------------------------- Kenney kit ---
# _S sits on the tile's upper-right edge, _E upper-left, _N lower-left and
# _W lower-right. Anything placed on more than one edge needs all four.
ROTATED = [
    "woodWall", "woodWallDoorClosed", "woodWallDoorOpen", "woodWallWindow",
    "woodWallWindowGlass", "woodWallGateClosed", "woodWallSupport",
    "woodWallEmpty", "woodWallCorner", "woodWallRoofLeft", "woodWallRoofRight",
    "roofSingle", "roof", "roofCorner", "fenceLow", "fenceHigh", "fenceLowBroken",
]
FIXED = [
    "dirt", "dirtFarmland", "corn", "cornDouble", "cornYoung", "cornYoungDouble",
    "hay", "hayBales", "hayBalesStacked", "sack", "sacksCrate",
    "chimneyBase", "chimneyTop", "ladderStand", "ladderStraight",
    "planks", "planksHigh", "planksOld", "planksSide",
]

def kenney(base, angle):
    im = Image.open(f"{KENNEY}/{base}_{angle}.png").convert("RGBA").resize((KW, KH), Image.LANCZOS)
    im = lift(im, 0.9, 1.08)
    canvas = blank()
    canvas.alpha_composite(im, (CAX - KAX, CAY - KAY))
    return canvas

for base in ROTATED:
    for angle in "SENW":
        emit(f"{base}_{angle}", kenney(base, angle))
for base in FIXED:
    emit(base, kenney(base, "S"))

# ---------------------------------------------------------------- plants ---
# The pack renders each plant on a 2x2 tile plate with a baked ground shadow.
# The shadow is semi-transparent and the plant is not, so the opaque bounding
# box locates the trunk base to anchor on.
def plant(name, source, target_h):
    im = Image.open(f"{PLANTS}/{source}.png").convert("RGBA")
    alpha = im.getchannel("A")
    solid = alpha.point(lambda v: 255 if v > 200 else 0)
    box = solid.getbbox() or im.getbbox()

    # Half the pack's baked shadows run off the edge of their own frame, which
    # leaves a hard rectangular cut. Lighten the shadow and fade the outer band
    # so whatever the source clipped dissolves instead of ending in a straight
    # line.
    faded = alpha.point(lambda v: v if v > 200 else round(v * 0.5))
    px = faded.load()
    band = 26
    for x in range(im.width):
        fx = min(1.0, min(x, im.width - 1 - x) / band)
        if fx >= 1.0:
            continue
        for y in range(im.height):
            if px[x, y]:
                px[x, y] = round(px[x, y] * fx)
    im.putalpha(faded)

    scale = target_h / (box[3] - box[1])
    im = lift(im.resize((max(1, round(im.width * scale)), max(1, round(im.height * scale))), Image.LANCZOS), 0.6, 1.34, 1.06)
    canvas = blank()
    canvas.alpha_composite(im, (round(CAX - (box[0] + box[2]) / 2 * scale), round(CAY - box[3] * scale)))
    emit(name, canvas)

for key, src, h in [
    ("treeBig", "bigtree01", 156), ("treeBig2", "bigtree02", 138), ("treeBig3", "bigtree03", 150),
    ("pine", "pine-none01", 140), ("pine2", "pine-none04", 124), ("pine3", "pine-none06", 132),
    ("pineSnow", "pine-full01", 140), ("pineSnow2", "pine-full04", 124),
    ("treePalm", "palm03", 118), ("cactus", "cactus01", 74),
    ("bush", "bush01", 46), ("bush2", "bush03", 38),
    ("shrub", "shrub1-01", 54), ("shrubTall", "shrub2-01", 62),
    ("grassTuft", "grasses01", 26), ("grassTuft2", "grasses03", 22),
    ("weed", "weed01", 24), ("tropical", "tropical01", 46),
    ("hemp", "hemp01", 58), ("swirl", "swirl01", 20),
]:
    plant(key, src, h)

# ------------------------------------------------- ground tiles (Kutejnikov)
# These single diamonds were cut out of the Kutejnikov sheets by hand and are
# carried through as they are; only their manifest entries are regenerated.
for name in ["grass0", "grass1", "grass2", "grass3", "grassDry0", "grassDry1",
             "soil0", "soil1", "soilDark0", "soilDark1", "path0", "sand0"]:
    im = Image.open(f"{OUT}/{name}.png").convert("RGBA")
    sprites[name] = {"w": im.width, "h": im.height, "ax": im.width // 2, "ay": im.height // 2, "ground": True}

json.dump({"tile": {"w": 128, "h": 64}, "sprites": dict(sorted(sprites.items()))},
          open(f"{OUT}/manifest.json", "w"), indent=1)
print(len(sprites), "sprites")
