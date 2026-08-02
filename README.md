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

- **One reading column.** Content lives in a 600px column between a 275px nav
  and a 350px rail. Screens that need the space (Games, Studio, Live, Messages)
  set `data-rail="off"` on the shell and the column expands.
- **Sticky header + tabs.** `XHeader` is 53px with a blurred backdrop; `XTabs`
  sticks beneath it and animates its underline with a shared `layoutId`.
- **Motion is a token, not a decoration.** `--v8-ease`, `--v8-spring` and the
  `x-*` keyframes cover rise, pop, burst, shimmer, sheet and stagger. Every
  animation collapses under `prefers-reduced-motion`.
- **Breakpoints.** Wide (≥1400), desktop (1200–1399), laptop (1000–1199, icon
  rail), tablet (640–999, single column + bottom nav), phone (<640, edge to
  edge, dialogs become bottom sheets).

---

## Flux Farm

A full 2D farming life-sim at `/games/flux-farm`, built from scratch and
playable on phone, tablet and desktop.

| File | Role |
| --- | --- |
| `src/lib/flux-farm/content.ts` | Balance data: 12 crops, 4 seasons, 9 weather types, 15 ranks, 6 farmhands, 10 upgrades, 9 world events, 10 story chapters |
| `src/lib/flux-farm/world.ts` | Deterministic 48×36 valley generation, plots, save schema and v1→v2 migration |
| `src/lib/flux-farm/simulation.ts` | Time, growth, soil moisture, quality, weather, events, wages, economy, farmhand AI, movement, actions |
| `src/lib/flux-farm/sprites.ts` | Procedural pixel-art atlas — tiles, crop stages, character walk cycles, buildings, props |
| `src/lib/flux-farm/renderer.ts` | Layered canvas renderer: camera, Y-sorted entities, day/night lighting with point lights, weather particles, floaters |
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

**Controls.** Desktop — WASD/arrows, Space or E to use the tool, 1–5 to switch
tools, Tab to change seed, Esc to pause. Touch — left stick to walk, hold the
action button to work, or tap any nearby tile.

**Audio.** Music, weather and effects are synthesised live in the browser: no
downloads, no licensing ambiguity, and the score reacts to season, clock and
weather. To use recordings instead, drop CC0 files into
`public/audio/flux-farm/` named after the keys in `SAMPLE_NAMES`
(`harvest.ogg`, `coin.ogg`, …) — anything found there is preloaded and played in
place of the synthesised voice.

---

## Platform features

- **Feed** — For You + Following, infinite scroll, posts with media and polls
- **Post detail** — full comment and reply threads
- **Explore** — trends, plus post/people/community search
- **Notifications** and **Activity** — filtered timelines
- **Messages** — 1:1 DMs with a live Firestore subscription, plus calls
- **Communities** and **Events** — create, join, discuss
- **Stories** — editor, viewer, per-viewer analytics
- **Live** — streaming studio and viewer
- **Studio** — visual game/website editor with versions and publishing
- **Games** — Flux Farm plus an open-source browser library and community builds
- **Shop, Gifts, Rewards, Premium** — the Flux Coin economy
- **AskAI** — feed-aware assistant (`/api/ask-ai`)
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
