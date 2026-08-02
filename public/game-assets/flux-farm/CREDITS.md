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
