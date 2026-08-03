import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");
const requireText = (source, marker, label) => {
  if (!source.includes(marker)) throw new Error(`${label}: missing ${JSON.stringify(marker)}`);
};
const forbidText = (source, marker, label) => {
  if (source.includes(marker)) throw new Error(`${label}: forbidden ${JSON.stringify(marker)}`);
};

const arcadeData = read("src/data/flux-arcade-games.ts");
const worldsBlock = arcadeData.split("const GENRES")[0];
const genresBlock = arcadeData.split("const GENRES")[1]?.split("function slugify")[0] || "";
const worldCount = (worldsBlock.match(/\{ name: /g) || []).length;
const genreCount = (genresBlock.match(/\{ genre: /g) || []).length;
if (worldCount * genreCount < 250) throw new Error(`Flux Arcade: expected 250+ games, found ${worldCount * genreCount}`);
for (const genre of ["Horror", "Simulator", "Quest", "Tycoon", "Story", "Racing", "Platformer", "Puzzle", "Survival", "Farming"]) requireText(arcadeData, `genre: \"${genre}\"`, "Flux Arcade genres");

const browserGames = read("src/data/browser-games.ts");
requireText(browserGames, "...ARCADE_GAMES", "Games catalog integration");
requireText(browserGames, "ARCADE_GAME_COUNT", "Games catalog count");

const gamesHub = read("src/components/game/games-hub.tsx");
for (const marker of ["useDeferredValue", "PAGE_SIZE", "visibleGames", "Show", "Global scores", "Daily challenge", "Continue playing", "Arcade achievements"]) requireText(gamesHub, marker, "Games performance and discovery");
forbidText(gamesHub, "filteredGames.map", "Games unbounded render");

const coverArt = read("src/components/game/game-cover-art.tsx");
for (const marker of ["HorrorScene", "RacingScene", "TycoonScene", "QuestScene", "PlatformScene", "PuzzleScene", "SurvivalScene", "FarmingScene", "hashText", "game.arcade"]) requireText(coverArt, marker, "Procedural game thumbnails");
forbidText(coverArt, "if (game.arcade) return null", "Arcade cover art");

const arcadePlayer = read("src/components/game/flux-arcade-player.tsx");
for (const marker of ["RunnerStage", "SurvivalStage", "TycoonStage", "QuestStage", "PuzzleStage", "submitGameScore", "Global leaderboard", "recordGameOpened", "recordGameFinished", "Share result"]) requireText(arcadePlayer, marker, "Playable Arcade runtime");

const progress = read("src/lib/game-progress.ts");
for (const marker of ["dailyChallengeGame", "recentBrowserGames", "ARCADE_ACHIEVEMENTS", "three-day-streak", "resultShareText"]) requireText(progress, marker, "Arcade progress features");

const leaderboard = read("src/services/game-leaderboards.ts");
for (const marker of ["gameSessions", "FieldPath", "runTransaction", "orderBy"]) requireText(leaderboard, marker, "Game leaderboard integration");

const nav = read("src/components/layout/mobile-nav.tsx");
for (const marker of ["/home", "/explore", "#compose", "/games", "profileHref", "flux8-mobile-tab-create", "createPortal", "data-flux-mobile-dock=\"portal-v1\""]) requireText(nav, marker, "Body-level mobile bottom navigation");

const dockStyle = read("src/styles/flux-mobile-dock.css");
for (const marker of ["z-index: 2147482000", "position: fixed", "visibility: visible", "pointer-events: auto", "flux-mobile-dock-label"]) requireText(dockStyle, marker, "Unhideable mobile dock styles");

const mobileBoot = read("src/components/providers/mobile-boot.tsx");
for (const marker of ["visualViewport", "--flux-visual-bottom", "updateViaCache", "flux-shell-v4", "NEXT_PUBLIC_RELEASE_SHA"]) requireText(mobileBoot, marker, "Safari viewport and cache recovery");

const style = read("src/styles/flux-x-ultimate.css");
for (const marker of ["var(--flux-visual-bottom)", "content-visibility: auto", "prefers-reduced-motion", ".flux9-topbar { display: none", "border-radius: 0 !important"]) requireText(style, marker, "Responsive X design system");

const root = read("src/app/layout.tsx");
for (const marker of ["data-flux-ui=\"x3\"", "data-flux-release", "NEXT_PUBLIC_RELEASE_SHA", "flux-mobile-dock.css"]) requireText(root, marker, "Traceable Flux X3 release");

const deploy = read(".github/workflows/publish-flux-live.yml");
for (const marker of ["Force Pages to use GitHub Actions", "build_type=workflow", "release.json", "version.txt", "upload-pages-artifact@v3", "gh-pages", "data-flux-ui=\"x3\"", "flux-mobile-dock-portal"]) requireText(deploy, marker, "Dual Pages deployment");

const media = read("src/services/media.ts");
for (const marker of ["processStoryImage", "maxDimension: 2048", "attempt < 3", "Post videos must be under 100 MB"]) requireText(media, marker, "Post upload reliability");

console.log(`Flux X3 audit passed with ${worldCount * genreCount} integrated Arcade games, portal navigation and procedural covers.`);
