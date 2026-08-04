import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");
const requireText = (source, marker, label) => {
  if (!source.includes(marker)) throw new Error(`${label}: missing ${JSON.stringify(marker)}`);
};
const forbidText = (source, marker, label) => {
  if (source.includes(marker)) throw new Error(`${label}: forbidden ${JSON.stringify(marker)}`);
};

const nav = read("src/components/layout/mobile-nav.tsx");
for (const marker of ["createPortal", "document.body", "data-flux-mobile-dock=\"portal-v1\"", "Home", "Explore", "Create", "Games", "Profile"]) requireText(nav, marker, "Body portal mobile dock");

const dock = read("src/styles/flux-mobile-dock.css");
for (const marker of ["2147482000", "position: fixed", "display: block !important", "visibility: visible", "pointer-events: auto", "100vw"]) requireText(dock, marker, "Mobile dock visibility");

const root = read("src/app/layout.tsx");
for (const marker of ["data-flux-ui=\"x3\"", "flux-mobile-dock.css", "flux-x3"]) requireText(root, marker, "X3 root release");

const publisher = read(".github/workflows/publish-flux-live.yml");
for (const marker of ["name: Publish Flux Live X3", "build_type=workflow", "upload-pages-artifact@v3", "deploy-pages@v4", "gh-pages", "release.json", "data-flux-ui=\"x3\""]) requireText(publisher, marker, "Live Pages publisher");

const games = read("src/data/browser-games.ts");
for (const marker of ["OPEN_SOURCE_GAMES", "OPEN_SOURCE_GAME_COUNT", "sourceUrl", "license", "fosiper"]) requireText(games, marker, "Open-source Games release");
forbidText(games, "FLUX_ARCADE_GAMES.map", "Generated public game catalog");

const live = read("src/components/live/live-viewer.tsx");
for (const marker of ["latestComments", "FloatingHeart", "chatOpen", "ActionButton", "CommentList", "Gift", "Follow"]) requireText(live, marker, "TikTok-style live release");

const askai = read("src/components/ask-ai/askai-connection-status.tsx");
for (const marker of ["checkAskAIGroqHealth", "Groq secret is missing", "AskAI function is not deployed"]) requireText(askai, marker, "AskAI backend diagnostics");

console.log("Flux X3 live release audit passed with source-linked Games, TikTok-style Live and AskAI diagnostics.");
