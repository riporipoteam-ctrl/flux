import { readFileSync } from "node:fs";

function read(path) {
  return readFileSync(path, "utf8");
}

function requireText(source, marker, label) {
  if (!source.includes(marker)) throw new Error(`${label}: missing ${JSON.stringify(marker)}`);
}

function forbidText(source, marker, label) {
  if (source.includes(marker)) throw new Error(`${label}: forbidden ${JSON.stringify(marker)}`);
}

const route = read("src/app/(main)/ask-ai/page.tsx");
requireText(route, "AskAIWorkspaceV2", "AskAI V2 route");

const productShell = read("src/components/ask-ai/askai-workspace-v2.tsx");
for (const marker of [
  "Return to Flux",
  "AskAI Workspace",
  "subscribeLocalAskAIStatus",
  "Search Flux",
  "Local 1.5B ready",
]) requireText(productShell, marker, "AskAI product shell");

const warmup = read("src/components/providers/askai-model-warmup.tsx");
for (const marker of ["shouldWarmLocalAskAI", "requestIdleCallback", "warmLocalAskAI"]) {
  requireText(warmup, marker, "AskAI background warmup");
}

const localModel = read("src/lib/ai/local-web-llm.ts");
for (const marker of [
  "Qwen2.5-1.5B-Instruct-q4f16_1-MLC",
  "Qwen2.5-0.5B-Instruct-q4f16_1-MLC",
  "MODEL_CACHE_KEY",
  "navigator.storage",
  "subscribeLocalAskAIStatus",
  "Trying a lighter model",
]) requireText(localModel, marker, "Adaptive local model");
forbidText(localModel, 'const MODEL_ID = "Qwen2.5-0.5B', "Legacy 0.5B-only model");

const agents = read("src/lib/askai-workspace.ts");
for (const marker of [
  "Research Analyst",
  "Product Builder",
  "Social Lead",
  "Code Engineer",
  "routeAskAIAgent",
  "SPECIALIST ROSTER",
  "DELEGATION RULE",
  "local-balanced",
  "memoryEnabled",
]) requireText(agents, marker, "Routed agent roster");

const askStyles = read("src/styles/askai-workspace-v2.css");
for (const marker of [
  ".askai-v2-productbar",
  ".askai-v2-frame .askai-message.is-user",
  "grid-template-columns: minmax(0, 1fr)",
  "max-width: 82%",
  ".askai-v2-model",
]) requireText(askStyles, marker, "AskAI V2 styles");
forbidText(askStyles, "width: 54px", "Collapsed mobile message workaround");

const socialStyles = read("src/styles/flux-redesign-v2.css");
for (const marker of [
  ".flux-sidebar",
  ".flux-mobile-nav",
  ".flux-mobile-header",
  ".flux-right-rail",
  ".social-feed",
  ".social-row",
  "--flux2-nav",
]) requireText(socialStyles, marker, "Flux V2 social system");

const root = read("src/app/layout.tsx");
for (const marker of [
  "AskAIModelWarmup",
  "flux-redesign-v2.css",
  "askai-workspace-v2.css",
  "<AskAIModelWarmup />",
]) requireText(root, marker, "Root V2 integration");

const socialImport = root.indexOf('flux-redesign-v2.css');
const askImport = root.indexOf('askai-workspace-v2.css');
if (socialImport < 0 || askImport < socialImport) {
  throw new Error("Root V2 integration: AskAI V2 styles must load after the global Flux V2 styles.");
}

console.log("Flux V2 AskAI and full-site redesign audit passed.");
