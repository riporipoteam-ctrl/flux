import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");
const requireText = (source, marker, label) => {
  if (!source.includes(marker)) throw new Error(`${label}: missing ${JSON.stringify(marker)}`);
};
const forbidText = (source, marker, label) => {
  if (source.includes(marker)) throw new Error(`${label}: forbidden ${JSON.stringify(marker)}`);
};

const catalog = read("src/data/browser-games.ts");
for (const marker of [
  "OPEN_SOURCE_GAMES",
  "TuxRacer.js",
  "Anti-Gravity Pool",
  "XQuest JS",
  "Progress Knight",
  "Adventures With Anxiety",
  "OpenPanzer",
  'origin: "bundled"',
  'dimension: "3D"',
  'dimension: "2D"',
  "mobileReady: true",
]) requireText(catalog, marker, "Self-hosted open-source catalog");
for (const forbidden of [
  "fosiper.com",
  'origin: "original-host"',
  "FLUX_ORIGINALS",
  'author: "Ripo Team"',
  "Open original",
]) forbidText(catalog, forbidden, "Rejected remote or fake-owned catalog");

const gameFiles = [
  ["public/games-library/tux-racer/index.html", ["game-touch-stick-canvas", "game-canvas"]],
  ["public/games-library/anti-gravity-pool/index.html", ["MobileJoystickControls.js", "startButton"]],
  ["public/games-library/xquest/index.html", ["Touch", "inlineGame"]],
  ["public/games-library/progress-knight/index.html", ["viewport", "Progress Knight"]],
  ["public/games-library/anxiety/index.html", ["viewport", "Adventures With Anxiety"]],
  ["public/games-library/openpanzer/index.html", ["apple-mobile-web-app-capable", "OpenPanzer"]],
];
for (const [path, markers] of gameFiles) {
  const source = read(path);
  for (const marker of markers) requireText(source, marker, path);
}

const hub = read("src/components/game/games-hub.tsx");
for (const marker of [
  "Flux Games",
  "Self-hosted open-source games",
  "Flux Open Games",
  "Open source",
  "Hosted by Flux",
  "/games/licenses",
]) requireText(hub, marker, "Open-source Games UI");
for (const forbidden of ["FLUX ORIGINAL", "Flux Originals", "Instant play · no redirects", "working games"]) {
  forbidText(hub, forbidden, "Rejected fake-owned Games UI");
}

const shell = read("src/components/game/browser-game-shell.tsx");
for (const marker of [
  "Open source · hosted by Flux",
  "requestFullscreen",
  "gameUrl",
  "Restart game",
  "/games/licenses",
]) requireText(shell, marker, "Local fullscreen game shell");
for (const forbidden of ["original host", "Open original", "Flux Original", "sourceUrl"]) {
  forbidText(shell, forbidden, "Remote or false-ownership game shell");
}

const licensePage = read("src/app/(main)/games/licenses/page.tsx");
for (const marker of ["Game credits and licenses", "sourceUrl", "license", "does not claim authorship"]) {
  requireText(licensePage, marker, "Open-source license page");
}

console.log(`Open-source Games audit passed with ${gameFiles.length} bundled mobile-ready projects.`);
