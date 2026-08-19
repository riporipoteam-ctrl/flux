import { existsSync, readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");
const requireText = (source, marker, label) => {
  if (!source.includes(marker)) throw new Error(`${label}: missing ${JSON.stringify(marker)}`);
};
const forbidText = (source, marker, label) => {
  if (source.includes(marker)) throw new Error(`${label}: forbidden ${JSON.stringify(marker)}`);
};

const route = read("src/app/(main)/ask-ai/page.tsx");
requireText(route, "RakazoOfficialApp", "AskAI route");
for (const marker of ["AskAIGroqWorkspace", "RakazoAskAIWorkspace", "AskAIWorkspaceSync"]) forbidText(route, marker, "AskAI route");

const officialApp = read("src/components/ask-ai/rakazo-official-app.tsx");
for (const marker of ["https://github.com/elie222/rakazo", "RAKAZO_GUEST_PATH", "/flux/rakazo/", "<iframe", "guest adapter"]) requireText(officialApp, marker, "Rakazo guest app bridge");
for (const marker of ["https://app.rakazo.com/app", "Open official Rakazo", "RakazoAskAIWorkspace", "AskAIWorkspaceSync"]) forbidText(officialApp, marker, "Rakazo guest app bridge");

const rakazoPatch = read("patches/rakazo-guest-mode.patch");
for (const marker of ["apps/web/src/App.tsx", "apps/web/src/lib/guest-rpc.ts", "VITE_GUEST_MODE", "guestRpc", "BrowserRouter", "VITE_BASE_PATH"]) requireText(rakazoPatch, marker, "Rakazo guest source patch");
for (const legacy of ["src/components/ask-ai/rakazo-askai-workspace.tsx", "src/components/ask-ai/askai-workspace-sync.tsx", "src/styles/rakazo-askai.css"]) {
  if (existsSync(legacy)) throw new Error(`Legacy Rakazo mock still exists: ${legacy}`);
}

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
requireText(mainLayout, "const isPublicAskAI = isAskAI", "Public AskAI route");
requireText(mainLayout, "if (isPublicAskAI)", "Public AskAI shell");
requireText(mainLayout, "if (isStudio)", "Immersive Studio shell");
requireText(mainLayout, "if (isImmersive)", "Immersive AskAI shell");

const rootLayout = read("src/app/layout.tsx");
requireText(rootLayout, "flux-v8.css", "Flux social styles");
forbidText(rootLayout, "rakazo-askai.css", "Flux root styles");

const socialStyles = read("src/styles/flux-v8.css");
for (const marker of ["#1d9bf0", ".flux8-sidebar", ".flux8-mobile-nav", ".flux8-feed"]) requireText(socialStyles, marker, "Flux social design");

console.log("Official Rakazo source, guest mode, and Flux social audit passed.");
