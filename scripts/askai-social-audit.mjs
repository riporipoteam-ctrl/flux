import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");
const requireText = (source, marker, label) => {
  if (!source.includes(marker)) throw new Error(`${label}: missing ${JSON.stringify(marker)}`);
};
const forbidText = (source, marker, label) => {
  if (source.includes(marker)) throw new Error(`${label}: forbidden ${JSON.stringify(marker)}`);
};

const route = read("src/app/(main)/ask-ai/page.tsx");
requireText(route, "AskAIGroqWorkspace", "AskAI route");

const workspace = read("src/components/ask-ai/askai-groq-workspace.tsx");
for (const marker of [
  "Ripo Local · Qwen3 4B",
  "AskAI Pro",
  "AskAI Instant",
  "runAskAIGroq",
  "Web research",
  "Cloud compute",
  "searchFlux",
  "lastProvider",
  "lastModel",
]) requireText(workspace, marker, "Hybrid AskAI workspace");
for (const marker of ["Kimi K3", "runLocalAskAI", "Groq GPT-OSS 120B", "Groq GPT-OSS 20B"]) forbidText(workspace, marker, "Hybrid AskAI workspace");

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
requireText(mainLayout, "if (isStudio)", "Immersive Studio shell");
requireText(mainLayout, "if (isImmersive)", "Immersive AskAI shell");

const rootLayout = read("src/app/layout.tsx");
requireText(rootLayout, "askai-workspace-v2.css", "AskAI styles");
requireText(rootLayout, "flux-v8.css", "Flux social styles");

const socialStyles = read("src/styles/flux-v8.css");
for (const marker of ["#1d9bf0", ".flux8-sidebar", ".flux8-mobile-nav", ".flux8-feed"]) requireText(socialStyles, marker, "Flux social design");

const askStyles = read("src/styles/askai-workspace-v2.css");
for (const marker of [".askx-shell", ".askx-model-switch", ".askx-composer", ".askx-context"]) requireText(askStyles, marker, "AskAI workspace styles");

console.log("Self-hosted Ripo AskAI and Flux social audit passed.");
