import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");
const requireText = (source, marker, label) => {
  if (!source.includes(marker)) throw new Error(`${label}: missing ${JSON.stringify(marker)}`);
};
const forbidText = (source, marker, label) => {
  if (source.includes(marker)) throw new Error(`${label}: forbidden ${JSON.stringify(marker)}`);
};

const nav = read("src/components/layout/mobile-nav.tsx");
for (const marker of ["createPortal", "document.body", "data-flux-mobile-dock=\"portal-v1\""]) requireText(nav, marker, "Mobile dock");

const catalog = read("src/data/browser-games.ts");
for (const marker of ["FLUX_ORIGINALS", "Flux Velocity", "Flux Orbit", "Flux Rooftop", "Flux Hoops", "Flux Defender", "Flux Stack"]) requireText(catalog, marker, "Flux Originals");
forbidText(catalog, "fosiper.com", "Remote game hosting");

const gameShell = read("src/components/game/browser-game-shell.tsx");
for (const marker of ["Mobile controls included", "Flux Original", "requestFullscreen", "Restart game"]) requireText(gameShell, marker, "Game shell");
forbidText(gameShell, "original host", "Old embedding warning");

const liveViewer = read("src/components/live/live-viewer.tsx");
for (const marker of ["latestComments", "chatOpen", "FloatingHeart", "ActionButton"]) requireText(liveViewer, marker, "TikTok-style Live");

const askai = read("src/lib/ai/askai-groq.ts");
for (const marker of ["checkAskAIGroqHealth", "GROQ_SECRET_MISSING", "GROQ_KEY_REJECTED"]) requireText(askai, marker, "AskAI diagnostics");

console.log("Flux live release audit passed with self-hosted Originals, mobile Live and AskAI diagnostics.");
