import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");
const requireText = (source, marker, label) => {
  if (!source.includes(marker)) throw new Error(`${label}: missing ${JSON.stringify(marker)}`);
};

const nav = read("src/components/layout/mobile-nav.tsx");
for (const marker of ["createPortal", "document.body", "data-flux-mobile-dock=\"portal-v1\"", "Home", "Explore", "Create", "Games", "Profile"]) requireText(nav, marker, "Body portal mobile dock");

const dock = read("src/styles/flux-mobile-dock.css");
for (const marker of ["2147482000", "position: fixed", "display: block !important", "visibility: visible", "pointer-events: auto", "100vw"]) requireText(dock, marker, "Mobile dock visibility");

const root = read("src/app/layout.tsx");
for (const marker of ["data-flux-ui=\"x3\"", "flux-mobile-dock.css", "flux-x3"]) requireText(root, marker, "X3 root release");

const publisher = read(".github/workflows/publish-flux-live.yml");
for (const marker of ["name: Publish Flux Live X3", "build_type=workflow", "upload-pages-artifact@v3", "deploy-pages@v4", "gh-pages", "release.json", "data-flux-ui=\"x3\""]) requireText(publisher, marker, "Live Pages publisher");

const cover = read("src/components/game/game-cover-art.tsx");
for (const marker of ["ArcadeCover", "HorrorScene", "RacingScene", "TycoonScene", "QuestScene", "PlatformScene", "PuzzleScene", "SurvivalScene", "FarmingScene"]) requireText(cover, marker, "Unique game cover system");

const progress = read("src/lib/game-progress.ts");
for (const marker of ["recordGameOpened", "recordGameFinished", "dailyChallengeGame", "recentBrowserGames", "ARCADE_ACHIEVEMENTS", "resultShareText"]) requireText(progress, marker, "Arcade feature system");

console.log("Flux X3 live release audit passed.");
