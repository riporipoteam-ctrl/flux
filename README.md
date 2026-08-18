# Flux — social network, creator tools and games

Next.js 15 · TypeScript · Tailwind CSS v4 · Firebase (Auth, Firestore, Storage) · Framer Motion

---

## Design system

The whole app runs on one X/Twitter-style design system so every screen — feed,
Explore, Stories, Studio, Games, Settings — shares the same chrome, spacing,
type ramp and motion.

| File | Role |
| --- | --- |
| `src/styles/flux-v8.css` | Tokens, motion library, app frame, navigation, timeline, and the shared `.x-*` page primitives |
| `src/styles/flux-v8-tokens.css` | Bridges the Tailwind/shadcn semantic names onto the X palette, themes Radix portals |
| `src/app/globals.css` | Tailwind entry plus the legacy utilities older components still reference |
| `src/components/x/x-ui.tsx` | React primitives: `XPage`, `XHeader`, `XTabs`, `XCard`, `XRow`, `XStat`, `XHero`, `XEmpty`, `Reveal` |

Key conventions:

- **A global bar, then three columns.** Facebook's shape on top — brand and
  search left, the primary destinations as icon tabs in the middle, actions and
  account right — over X's column discipline underneath. The bar earns its space
  from 1000px up; phones keep the compact header and the bottom bar, and every
  sticky offset hangs off `--v8-top-h` so it collapses to zero with it.
- **Columns float on a canvas.** `--v8-canvas` sits behind the shell and the
  reading column is a rounded panel on it, which is what makes Default, Dim and
  Lights out read as three different surfaces rather than three palettes.
- **One reading column.** Content lives in a 600px column between a 275px nav
  and a 350px rail. Screens that need the space (Games, Studio, Live, Messages)
  set `data-rail="off"` on the shell, and the column goes edge to edge.
- **Sticky header + tabs.** `XHeader` is 53px with a blurred backdrop; `XTabs`
  sticks beneath it and animates its underline with a shared `layoutId`.
- **Motion is a token, not a decoration.** `--v8-ease`, `--v8-spring` and the
  `x-*` keyframes cover rise, pop, burst, shimmer, sheet and stagger. Every
  animation collapses under `prefers-reduced-motion`.
- **Three backgrounds, six highlights.** Default, Dim and Lights out, each with
  a blue/yellow/pink/purple/orange/green accent, picked at
  `/settings/display`. Everything hangs off `--v8-accent`, so a highlight is
  three variables; the choice is stored per browser and painted by an inline
  script before first paint so no theme flashes white.
- **Breakpoints.** Wide (≥1400), desktop (1200–1399), laptop (1000–1199, icon
  rail), tablet (640–999, single column + bottom bar), phone (<640, cards on the
  canvas, dialogs become bottom sheets).
- **The phone gets the same idea, phrased for a thumb.** Wordmark and round
  action buttons in the header, the feed as full-bleed cards with air between
  them, and a bar that floats clear of the home indicator instead of sitting on
  the edge.

---

## Flux Farm

A full 2D farming life-sim at `/games/flux-farm`, built from scratch and
playable on phone, tablet and desktop.

| File | Role |
| --- | --- |
| `src/lib/flux-farm/content.ts` | Balance data: 12 crops, 4 seasons, 9 weather types, 15 ranks, 6 farmhands, 10 upgrades, 9 world events, 10 story chapters |
| `src/lib/flux-farm/world.ts` | Deterministic 48×36 valley generation, plots, save schema and v1→v2 migration |
| `src/lib/flux-farm/simulation.ts` | Time, growth, soil moisture, quality, weather, events, wages, economy, farmhand AI, movement, actions |
| `src/lib/flux-farm/iso-renderer.ts` | Isometric canvas renderer: sprite atlas, modular buildings, terrain, scenery, figures, lighting, weather, floaters |
| `public/game-assets/flux-farm/` | The CC0 sprite atlas and its manifest (`CREDITS.md` records provenance) |
| `scripts/vendor-flux-farm-art.py` | Re-cuts that atlas from the upstream CC0 packs |
| `src/lib/flux-farm/audio.ts` | Web Audio engine — adaptive music sequencer plus synthesised ambience and SFX |
| `src/components/game/flux-farm/flux-farm-game.tsx` | Canvas host, game loop, input, HUD and panels |

**Systems.** Till → plant → water → harvest, with soil moisture, fertility and
four harvest quality tiers. A 24-hour clock drives lighting and lantern glow;
14-day seasons cycle spring → winter and gate which crops grow. Weather adds or
removes moisture, bends crops with wind, and can destroy a harvest overnight.
World events, story chapters, ranks, farmhands with daily wages, buildings and
field expansions all read from `content.ts`.

**Saving and the leaderboard.** Progress autosaves to Firestore
(`fluxFarmSaves/{uid}`) every 20 seconds and on tab hide, mirrored to
localStorage so a dropped connection never costs progress. The in-game
leaderboard reads the same collection ordered by XP.

**Art.** Buildings are assembled tile by tile out of Kenney's modular isometric
farm kit — perimeter walls in all four rotations under a gabled roof — so a
barn is a real barn rather than one sprite. Terrain, woodland and crops come
from three CC0 packs; farmhands are drawn on the canvas because none of the
packs ship characters in this style.

**Controls.** Desktop — drag to pan, wheel to zoom, click a plot to work it,
1–5 to switch tools, Tab to change seed, Esc to pause. Touch — drag to pan,
pinch to zoom, tap a plot to work it.

**Audio.** Music, weather and effects are synthesised live in the browser: no
downloads, no licensing ambiguity, and the score reacts to season, clock and
weather. To use recordings instead, drop CC0 files into
`public/audio/flux-farm/` named after the keys in `SAMPLE_NAMES`
(`harvest.ogg`, `coin.ogg`, …) — anything found there is preloaded and played in
place of the synthesised voice.

---

## AskAI

Two engines behind one switch.

**AskAI 1.0 Instant** runs the model in the browser through WebGPU, so a chat
never leaves the device. Where WebGPU is missing — or the model download fails —
it falls back to Flux's built-in instant tools rather than erroring out.

**AskAI 1.0 Pro** is the connected, high-reasoning half. It speaks the
OpenAI-compatible `/chat/completions` shape, which is what Moonshot's Kimi API
and every gateway in front of it expose, and it streams: reasoning tokens drive
the progress line, answer tokens land in the bubble as they are written.

It resolves a connection in this order:

1. **What the person configured** in AskAI → *Connect Pro* — endpoint, key,
   model and reasoning effort, stored in that browser only and sent straight to
   the endpoint they chose.
2. **A build-time endpoint**, if `NEXT_PUBLIC_KIMI_K3_ENDPOINT` is set.
3. **`/api/askai-pro`**, Flux's own proxy, which keeps the key server-side. It
   exists only where the app runs a server — GitHub Pages strips `src/app/api`
   — and reads `KIMI_API_KEY`, `KIMI_BASE_URL` and `KIMI_MODEL`.

That ordering is what makes Pro work on the static Pages build at all: there is
no server there to hold a secret, so the browser has to bring its own.

The AskAI home uses a Rakazo-inspired workspace layout: specialist agents,
persistent threads, routines, activity, files, memory and miniapps live beside
the chat. Signed-in workspace state is mirrored to Firestore so it follows the
same user across browsers and the iOS shell.

---

## Platform features

- **Feed** — For You + Following, infinite scroll, posts with media and polls
- **Post detail** — full comment and reply threads
- **Explore** — trends, plus post/people/community search
- **Notifications** and **Activity** — filtered timelines
- **Messages** — 1:1 DMs with a live Firestore subscription, plus voice and
  video calls over WebRTC
- **Communities** and **Events** — create, join, discuss
- **Stories** — editor, viewer, per-viewer analytics
- **Live** — streaming studio and viewer
- **Studio** — visual game/website editor with versions and publishing
- **Games** — Flux Farm plus an open-source browser library and community builds
- **Shop, Gifts, Rewards, Premium** — the Flux Coin economy
- **AskAI** — feed-aware assistant, in two halves (see below)
- **Admin** — verification, reports and coin tools

Schema and rules: `firestore.rules`, `storage.rules`, `docs/SCHEMA.md`.

---

## Run locally

```bash
npm install
npm run dev
```

Open <http://localhost:3000>.

```bash
npm run build   # production build
npm run lint    # eslint
```

## Firebase checklist

1. **Authentication** → enable Email/Password and Google
2. **Firestore** → create the database, deploy `firestore.rules`
3. **Storage** → enable, deploy `storage.rules`
4. **Authentication → Settings → Authorized domains** → add your Pages domain
5. Deploy the indexes in `firestore.indexes.json`

```bash
npm i -g firebase-tools
firebase login
firebase use flux-544a6
firebase deploy --only firestore:rules,storage,firestore:indexes
```

## Deploying

- **GitHub Pages** — `.github/workflows/deploy-pages.yml` builds a static export
  on every push to `main`. It removes `src/app/api` first (Pages cannot run route
  handlers), sets `GITHUB_PAGES=true` so `next.config.ts` applies the repository
  `basePath`, and uploads `out/`. Enable Pages with the **GitHub Actions** source
  in repository settings.
- **Netlify** — `netlify.toml` builds the full app including API routes.
- **Mobile** — Capacitor: `npm run mobile:sync`, then `mobile:android` / `mobile:ios`.
  The iOS target includes a SwiftUI Liquid Glass navigation shell in `ios/`.
