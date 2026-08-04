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
  "FLUX_ORIGINALS",
  "Flux Velocity",
  "Flux Orbit",
  "Flux Rooftop",
  "Flux Hoops",
  "Flux Defender",
  "Flux Stack",
  'author: "Ripo Team"',
  'origin: "bundled"',
  'dimension: "3D"',
  'dimension: "2D"',
]) requireText(catalog, marker, "Flux Originals catalog");
for (const forbidden of [
  "fosiper.com",
  "original-host",
  "FLUX_ARCADE_GAMES.map",
  "Open original",
]) forbidText(catalog, forbidden, "Remote or generated game catalog");

const gameFiles = [
  ["public/games-library/flux-velocity/index.html", ["three.module.min.js", "pointerdown", "boost"]],
  ["public/games-library/flux-orbit/index.html", ["three.module.min.js", "stick", "pulse"]],
  ["public/games-library/flux-rooftop/index.html", ["jump", "pointerdown", "double jumps"]],
  ["public/games-library/flux-hoops/index.html", ["HOLD TO CHARGE", "pointerdown", "release"]],
  ["public/games-library/flux-defender/index.html", ["FIRE", "pointerdown", "touch-action:none"]],
  ["public/games-library/flux-stack/index.html", ["DROP BLOCK", "pointerdown", "touch-action:none"]],
];
for (const [path, markers] of gameFiles) {
  const source = read(path);
  for (const marker of markers) requireText(source, marker, path);
  forbidText(source, "https://fosiper.com", `${path} remote host`);
}

const hub = read("src/components/game/games-hub.tsx");
for (const marker of [
  "Flux Games",
  "Instant play · no redirects",
  "Flux Originals",
  "Touch ready",
  "working games",
  "GameVisual",
]) requireText(hub, marker, "Flux Games UI");
for (const forbidden of ["Source linked", "View source", "Open Games", "Daily challenge", "Arcade achievements"]) {
  forbidText(hub, forbidden, "Rejected old Games UI");
}

const shell = read("src/components/game/browser-game-shell.tsx");
for (const marker of [
  "Flux Original",
  "Mobile controls included",
  "requestFullscreen",
  "gameUrl",
  "Restart game",
]) requireText(shell, marker, "Local fullscreen game shell");
for (const forbidden of ["original host", "Open original", "showEmbedHelp", "sourceUrl"]) {
  forbidText(shell, forbidden, "Remote iframe warning shell");
}

const licenses = read("public/games-library/FLUX-ORIGINALS-LICENSES.txt");
for (const marker of ["original Ripo Team game implementations", "Three.js", "MIT License"]) {
  requireText(licenses, marker, "Flux Originals license notice");
}

console.log(`Flux Originals audit passed with ${gameFiles.length} self-hosted touch-ready games.`);
