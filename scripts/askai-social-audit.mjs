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
requireText(route, "AskAIWorkspace", "AskAI route");
forbidText(route, "AskAIProduct", "AskAI route");

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
requireText(rootLayout, "askai-workspace.css", "AskAI styles");
requireText(rootLayout, "flux-social-2027.css", "Flux social styles");

const socialStyles = read("src/styles/flux-social-2027.css");
for (const marker of [
  ".flux-sidebar",
  ".flux-nav-link",
  ".flux-mobile-nav",
  ".flux-mobile-header",
  ".flux-right-rail",
  ".social-feed",
]) requireText(socialStyles, marker, "Flux social redesign");

const askStyles = read("src/styles/askai-workspace.css");
for (const marker of [
  ".askai-shell",
  ".askai-sidebar",
  ".askai-context-panel",
  ".askai-composer",
  ".askai-miniapp-grid",
]) requireText(askStyles, marker, "AskAI workspace styles");

console.log("AskAI workspace and Flux social redesign audit passed.");
