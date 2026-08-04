import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");
const requireText = (source, marker, label) => {
  if (!source.includes(marker)) throw new Error(`${label}: missing ${JSON.stringify(marker)}`);
};
const forbidText = (source, marker, label) => {
  if (source.includes(marker)) throw new Error(`${label}: forbidden ${JSON.stringify(marker)}`);
};

const browserGames = read("src/data/browser-games.ts");
for (const marker of [
  "OPEN_SOURCE_GAMES",
  "OPEN_SOURCE_GAME_COUNT",
  "githubCover",
  "fosiper",
  "https://github.com/attogram/2048-lite",
  "https://github.com/attogram/hextris-lite",
  "https://github.com/dmcinnes/dead-valley",
  "https://github.com/arturkot/the-house-game",
  "https://github.com/phoboslab/underrun",
  "https://github.com/particle-clicker/particle-clicker",
  "license:",
  "sourceUrl:",
]) requireText(browserGames, marker, "Open-source games catalog");
forbidText(browserGames, "FLUX_ARCADE_GAMES.map", "Generated games in public catalog");
forbidText(browserGames, "thumbnail: \"/game-covers/flux-arcade.svg\"", "Repeated fake Arcade thumbnails");
const sourceEntries = (browserGames.match(/sourceUrl:/g) || []).length;
if (sourceEntries < 20) throw new Error(`Open-source catalog: expected at least 20 source-linked entries, found ${sourceEntries}`);

const gamesHub = read("src/components/game/games-hub.tsx");
for (const marker of ["Open Games", "OPEN_SOURCE_GAME_COUNT", "Source linked", "View source", "Continue playing", "Source & license", "OPEN SOURCE"]) requireText(gamesHub, marker, "Open-source Games UI");
forbidText(gamesHub, "Arcade achievements", "Rejected custom Arcade features");
forbidText(gamesHub, "Daily challenge", "Rejected custom Arcade daily challenge");
forbidText(gamesHub, "ARCADE_GAME_COUNT", "Generated Arcade count");

const gameShell = read("src/components/game/browser-game-shell.tsx");
for (const marker of ["Original open-source web build", "Open original", "Source & license", "iframe", "requestFullscreen", "showEmbedHelp"]) requireText(gameShell, marker, "Open-source game player");
forbidText(gameShell, "Stored and served by Flux · no redirect", "False hosting claim");

const liveViewer = read("src/components/live/live-viewer.tsx");
for (const marker of ["latestComments", "chatOpen", "FloatingHeart", "AnimatePresence", "Add comment", "Gift", "Follow", "CommentList", "ActionButton", "@${username}"]) requireText(liveViewer, marker, "TikTok-style Live viewer");

const askaiClient = read("src/lib/ai/askai-groq.ts");
for (const marker of ["checkAskAIGroqHealth", "GROQ_SECRET_MISSING", "GROQ_KEY_REJECTED", "missing-secret", "not-deployed", "openai/gpt-oss-120b"]) requireText(askaiClient, marker, "AskAI diagnostics");

const askaiFunction = read("functions/src/index.ts");
for (const marker of ["defineSecret(\"GROQ_API_KEY\")", "FUNCTION_VERSION", "request.method === \"GET\"", "GROQ_SECRET_MISSING", "browser_search", "code_interpreter"]) requireText(askaiFunction, marker, "Secure AskAI Firebase proxy");
forbidText(askaiFunction, "gsk_", "Hardcoded Groq key");

const askaiStatus = read("src/components/ask-ai/askai-connection-status.tsx");
for (const marker of ["Groq secret is missing", "AskAI function is not deployed", "Test again", "functions:secrets:set GROQ_API_KEY"]) requireText(askaiStatus, marker, "AskAI connection UI");

const firebaseWorkflow = read(".github/workflows/deploy-askai-firebase.yml");
for (const marker of ["FIREBASE_SERVICE_ACCOUNT_FLUX_544A6", "secrets.GROQ_API_KEY", "functions:secrets:set GROQ_API_KEY", "functions:askaiGroq", "Verify deployed health endpoint"]) requireText(firebaseWorkflow, marker, "AskAI Firebase deploy workflow");
forbidText(firebaseWorkflow, "gsk_", "Hardcoded Groq key in workflow");

const nav = read("src/components/layout/mobile-nav.tsx");
for (const marker of ["createPortal", "document.body", "data-flux-mobile-dock=\"portal-v1\""]) requireText(nav, marker, "Body-level mobile navigation");

const media = read("src/services/media.ts");
for (const marker of ["processStoryImage", "maxDimension: 2048", "attempt < 3"]) requireText(media, marker, "Upload reliability");

console.log(`Flux audit passed with ${sourceEntries} source-linked games, TikTok-style Live comments and secure AskAI diagnostics.`);
