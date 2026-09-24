# Flux Farm — third-party art

All art in this directory is **CC0 1.0 (public domain)**. No attribution is
legally required; it is recorded here anyway so provenance stays auditable and
so anyone auditing the repo can confirm the licence without guessing.

## Isometric Miniature Farm — Kenney

- **Source:** https://opengameart.org/content/isometric-miniature-farm
- **Author:** Kenney (https://kenney.nl)
- **Licence:** CC0 1.0 Universal — "Free to use in personal, educational and
  commercial projects. Written permission not required."
- **Retrieved:** 2026-08-02

### What was taken and what was changed

Only the pieces Flux Farm actually draws. Walls, fences and roofs are vendored
in all four camera angles, because a building needs a wall on each of its four
sides; everything symmetrical keeps the `_S` angle alone. Each sprite was
halved from 256x512 to 128x256 (still oversampled for a 2x DPR display), had a
gamma curve applied to open up the baked ambient shading, and was trimmed to
its own bounding box. That takes the pack from 9.7 MB / 466 files to ~1.2 MB /
89 files.

`scripts/vendor-flux-farm-art.py` performs the cut and writes `manifest.json`.

The upstream `License.txt` shipped with the pack is preserved alongside this
file as `KENNEY-LICENSE.txt`.

## Isometric Ground Tiles — Kutejnikov

- **Source:** https://opengameart.org/content/isometric-ground-tiles
- **Licence:** CC0 1.0 Universal
- **Retrieved:** 2026-08-02
- **Modified:** single 128x64 diamonds cut out of the 8x7 sheets (grass, dry
  grass, dirt, dark dirt, stone path, sand); the source sheets, .blend and
  .xcf files were not vendored.

## Free Isometric Plants Pack — yd

- **Source:** https://opengameart.org/content/free-isometric-plants-pack
- **Licence:** CC0 1.0 Universal
- **Retrieved:** 2026-08-02
- **Modified:** trees, shrubs and tufts taken from the pack's `isometric tiles`
  folder, scaled to 20-156px so they sit correctly on a 128px tile, gamma
  lifted, and anchored on the base of the plant rather than the middle of the
  source plate. Several of the pack's baked ground shadows run off the edge of
  their own frame; the outer band of each sprite is faded so the clip dissolves
  instead of ending in a straight line.
