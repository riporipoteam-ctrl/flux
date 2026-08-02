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

Only the 37 sprites Flux Farm actually draws, and only the `_S` camera angle —
the game uses a fixed camera, so the N/E/W rotations would be dead bundle
weight. Each sprite was halved from 256x512 to 128x256 (still oversampled for a
2x DPR display) and its transparent margin trimmed. That takes the pack from
9.7 MB / 466 files to ~430 KB / 37 files.

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
- **Modified:** trees, shrubs and tufts trimmed and scaled down from 1024px to
  90-150px so they sit correctly on a 128px tile.
