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
for (const marker of ["AskAIGroqWorkspace", "RakazoAskAIWorkspace", "AskAIWorkspaceSync"]) {
  forbidText(route, marker, "AskAI route");
}

const officialApp = read("src/components/ask-ai/rakazo-official-app.tsx");
for (const marker of [
  "https://app.rakazo.com/app",
  "https://github.com/elie222/rakazo",
  "<iframe",
  "Flux Pages is a static frontend deployment",
]) requireText(officialApp, marker, "Official Rakazo app bridge");

for (const obsoletePath of [
  "src/components/ask-ai/rakazo-askai-workspace.tsx",
  "src/components/ask-ai/askai-workspace-sync.tsx",
  "src/styles/rakazo-askai.css",
]) {
  if (existsSync(obsoletePath)) throw new Error(`Official Rakazo app bridge: obsolete mock remains at ${obsoletePath}`);
}

const mainLayout = read("src/app/(main)/layout.tsx");
requireText(mainLayout, "if (isStudio)", "Immersive Studio shell");
requireText(mainLayout, "if (isImmersive)", "Immersive AskAI shell");

const rootLayout = read("src/app/layout.tsx");
requireText(rootLayout, "askai-workspace-v2.css", "AskAI styles");
requireText(rootLayout, "flux-v8.css", "Flux social styles");

const socialStyles = read("src/styles/flux-v8.css");
for (const marker of ["#1d9bf0", ".flux8-sidebar", ".flux8-mobile-nav", ".flux8-feed"]) requireText(socialStyles, marker, "Flux social design");

const askStyles = read("src/styles/askai-workspace-v2.css");
for (const marker of [".askx-shell", ".askx-model-switch", ".askx-composer", ".askx-context"]) requireText(askStyles, marker, "AskAI workspace styles");

console.log("Official Rakazo app bridge and Flux social audit passed.");
