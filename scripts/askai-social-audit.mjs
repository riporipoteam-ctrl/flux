import { readFileSync } from "node:fs";

function read(path) {
  return readFileSync(path, "utf8");
}

function requireText(source, text, label) {
  if (!source.includes(text)) throw new Error(`${label}: missing ${JSON.stringify(text)}`);
}

function forbidText(source, text, label) {
  if (source.includes(text)) throw new Error(`${label}: forbidden legacy text ${JSON.stringify(text)}`);
}

const route = read("src/app/(main)/ask-ai/page.tsx");
requireText(route, "AskAIWorkspaceV2", "AskAI route");
forbidText(route, "AskAIProduct", "AskAI route");

const productShell = read("src/components/ask-ai/askai-workspace-v2.tsx");
for (const marker of [
  "AskAI Workspace",
  "subscribeLocalAskAIStatus",
  "Search Flux",
  "Return to Flux",
]) requireText(productShell, marker, "AskAI product shell");

const workspace = read("src/components/ask-ai/askai-workspace.tsx");
for (const marker of [
  "streamLocalAskAI",
  "localAskAISupported",
  "AgentsView",
  "JobsView",
  "MiniappsView",
  "FilesView",
  "MemoryView",
  "ApprovalCard",
  "performSearch",
  "performProject",
  "performGroup",
  "SpeechRecognition",
  "speechSynthesis",
]) requireText(workspace, marker, "AskAI workspace");

const data = read("src/lib/askai-workspace.ts");
for (const marker of [
  "DEFAULT_AGENTS",
  "saveAskAIJob",
  "createAskAIMiniapp",
  "saveAskAIMemory",
  "saveAskAIFile",
  "buildAskAIWorkspaceContext",
]) requireText(data, marker, "AskAI workspace data");

const local = read("src/lib/local-ask-ai.ts");
requireText(local, "conversationalResponse", "Instant local AskAI");
requireText(local, "I’m doing well", "Instant local conversation");
forbidText(local, "The main focus appears to be", "Instant local AskAI");

const mainLayout = read("src/app/(main)/layout.tsx");
requireText(mainLayout, "if (isStudio)", "Immersive Studio shell");
requireText(mainLayout, "if (isImmersive)", "Immersive AskAI shell");

const rootLayout = read("src/app/layout.tsx");
requireText(rootLayout, "askai-workspace-v2.css", "AskAI styles");
requireText(rootLayout, "flux-v8.css", "Flux social styles");

const socialStyles = read("src/styles/flux-v8.css");
for (const marker of [
  ".flux8-sidebar",
  ".flux8-mobile-nav",
  ".flux8-mobile-header",
  ".flux8-right-rail",
  ".flux8-feed",
]) requireText(socialStyles, marker, "Flux V8 social redesign");

const askStyles = read("src/styles/askai-workspace-v2.css");
for (const marker of [
  ".askai-v2-productbar",
  ".askai-v2-frame",
  ".askai-v2-model",
]) requireText(askStyles, marker, "AskAI V2 styles");

console.log("AskAI workspace and Flux V8 redesign audit passed.");
