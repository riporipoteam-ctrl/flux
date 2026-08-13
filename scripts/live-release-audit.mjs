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

const root = read("src/app/layout.tsx");
for (const marker of ["data-flux-ui=\"x4\"", "flux-performance-x4.css"]) requireText(root, marker, "X4 release");

const catalog = read("src/data/browser-games.ts");
for (const marker of ["OPEN_SOURCE_GAMES", "TuxRacer.js", "XQuest JS", "Progress Knight", "Adventures With Anxiety"]) requireText(catalog, marker, "Open-source Games");
for (const marker of ["fosiper.com", "FLUX_ORIGINALS", 'author: "Ripo Team"']) forbidText(catalog, marker, "Rejected game catalog");

const gameShell = read("src/components/game/browser-game-shell.tsx");
for (const marker of ["Open source · hosted by Flux", "requestFullscreen", "Restart game"]) requireText(gameShell, marker, "Game shell");
forbidText(gameShell, "original host", "Old embedding warning");

const liveViewer = read("src/components/live/live-viewer-v4.tsx");
for (const marker of ["signInAnonymously", "resetReliableLivePeer", "createReliableLivePeer", "latestComments", "ActionButton", "Guest viewing"]) requireText(liveViewer, marker, "Reliable public Live viewer");

const liveHost = read("src/components/live/live-studio-v4.tsx");
for (const marker of ["subscribeReliableLivePeers", "limitLiveSender", "addReliableLiveCandidate", "receiving video"]) requireText(liveHost, marker, "Reliable Live host");

const signaling = read("src/services/live-reliable.ts");
for (const marker of ["attempt", "subscribeReliableLiveCandidates", "Number(data.attempt || 0) !== attempt"]) requireText(signaling, marker, "Attempt-isolated signaling");

const ice = read("src/lib/live-ice.ts");
for (const marker of ["staticauth.openrelay.metered.ca", "openrelayprojectsecret", "turns:", "createReliableLivePeer"]) requireText(ice, marker, "TURN relay fallback");

const mainLayout = read("src/app/(main)/layout.tsx");
for (const marker of ["isPublicLiveViewer", "temporary anonymous Firebase identity"]) requireText(mainLayout, marker, "Public Live route");

const askai = read("src/lib/ai/askai-groq.ts");
for (const marker of ["checkAskAIGroqHealth", "ASKAI_PROVIDER_MISSING", "ASKAI_UPSTREAM_FAILED", "Ripo Team AI server"]) requireText(askai, marker, "AskAI diagnostics");

console.log("Flux X4 live release audit passed with public TURN-backed Live, hybrid AskAI, and bundled open-source games.");
