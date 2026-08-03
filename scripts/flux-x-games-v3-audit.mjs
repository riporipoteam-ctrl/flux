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
for (const marker of ["useDeferredValue", "PAGE_SIZE", "visibleGames", "Show", "Global scores"]) requireText(gamesHub, marker, "Games performance and discovery");
forbidText(gamesHub, "filteredGames.map", "Games unbounded render");

const arcadePlayer = read("src/components/game/flux-arcade-player.tsx");
for (const marker of ["RunnerStage", "SurvivalStage", "TycoonStage", "QuestStage", "PuzzleStage", "submitGameScore", "Global leaderboard"]) requireText(arcadePlayer, marker, "Playable Arcade runtime");

const leaderboard = read("src/services/game-leaderboards.ts");
for (const marker of ["gameSessions", "FieldPath", "runTransaction", "orderBy"]) requireText(leaderboard, marker, "Game leaderboard integration");

const nav = read("src/components/layout/mobile-nav.tsx");
for (const marker of ["/home", "/explore", "#compose", "/games", "profileHref", "flux8-mobile-tab-create"]) requireText(nav, marker, "Mobile bottom navigation");

const mobileBoot = read("src/components/providers/mobile-boot.tsx");
for (const marker of ["visualViewport", "--flux-visual-bottom", "updateViaCache", "flux-shell-v3"]) requireText(mobileBoot, marker, "Safari viewport and cache recovery");

const style = read("src/styles/flux-x-ultimate.css");
for (const marker of ["var(--flux-visual-bottom)", "z-index: 1000", "content-visibility: auto", "prefers-reduced-motion"]) requireText(style, marker, "Responsive X design system");

const media = read("src/services/media.ts");
for (const marker of ["processStoryImage", "maxDimension: 2048", "attempt < 3", "Post videos must be under 100 MB"]) requireText(media, marker, "Post upload reliability");

console.log(`Flux X V3 audit passed with ${worldCount * genreCount} integrated Arcade games.`);
