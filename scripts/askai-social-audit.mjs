import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");
const requireText = (source, marker, label) => {
  if (!source.includes(marker)) throw new Error(`${label}: missing ${JSON.stringify(marker)}`);
};
const forbidText = (source, marker, label) => {
  if (source.includes(marker)) throw new Error(`${label}: forbidden ${JSON.stringify(marker)}`);
};

const route = read("src/app/(main)/ask-ai/page.tsx");
requireText(route, "RakazoOfficialApp", "AskAI route");
forbidText(route, "AskAIGroqWorkspace", "AskAI route");

const officialApp = read("src/components/ask-ai/rakazo-official-app.tsx");
for (const marker of [
  "https://app.rakazo.com/app",
  "https://github.com/elie222/rakazo",
  "RakazoAskAIWorkspace",
  "AskAIWorkspaceSync",
  "Guests can use",
  "Open official Rakazo",
  "runtime without",
]) requireText(officialApp, marker, "Rakazo guest app bridge");

const workspace = read("src/components/ask-ai/rakazo-askai-workspace.tsx");
for (const marker of [
  "GUEST_OWNER_ID",
  "Guest workspace · local only",
  "Flux local runtime",
  "localStorage",
  "streamLocalAskAI",
]) requireText(workspace, marker, "Rakazo guest workspace");
forbidText(workspace, "Sign in to use the AskAI workspace", "Rakazo guest workspace");

const sync = read("src/components/ask-ai/askai-workspace-sync.tsx");
for (const marker of ["askAIWorkspaces", "onSnapshot", "setDoc", "if (!user) return"]) requireText(sync, marker, "AskAI workspace sync");

const client = read("src/lib/ai/askai-groq.ts");
for (const marker of [
  "askaiGroq",
  "getIdToken",
  "Authorization",
  "checkAskAIGroqHealth",
  "provider?: string",
  "ASKAI_UPSTREAM_FAILED",
]) requireText(client, marker, "AskAI browser client");
forbidText(client, "gsk_", "AskAI browser client");

const gateway = read("functions/src/index.ts");
for (const marker of [
  "verifyIdToken",
  "RIPO_ASKAI_BASE_URL",
  "qwen3:4b-instruct",
  "browser_search",
  "code_interpreter",
  "askaiRateLimits",
  "toolsRequested",
  "callRipoAskAI",
  "firebaseIdToken",
  "probeRipoAskAI",
]) requireText(gateway, marker, "AskAI Firebase gateway");
forbidText(gateway, "gsk_", "AskAI Firebase gateway");

const mainLayout = read("src/app/(main)/layout.tsx");
requireText(mainLayout, "const isPublicAskAI = pathname === \"/ask-ai\"", "Public AskAI route");
requireText(mainLayout, "if (isPublicAskAI)", "Public AskAI shell");
requireText(mainLayout, "if (isStudio)", "Immersive Studio shell");
requireText(mainLayout, "if (isImmersive)", "Immersive AskAI shell");

const rootLayout = read("src/app/layout.tsx");
requireText(rootLayout, "rakazo-askai.css", "Rakazo AskAI styles");
requireText(rootLayout, "flux-v8.css", "Flux social styles");

const socialStyles = read("src/styles/flux-v8.css");
for (const marker of ["#1d9bf0", ".flux8-sidebar", ".flux8-mobile-nav", ".flux8-feed"]) requireText(socialStyles, marker, "Flux social design");

const askStyles = read("src/styles/rakazo-askai.css");
for (const marker of [".rakazo-shell", ".rakazo-composer", ".rakazo-inspector", ".rakazo-mobile-menu"]) requireText(askStyles, marker, "Rakazo AskAI styles");

console.log("Rakazo guest AskAI and Flux social audit passed.");
