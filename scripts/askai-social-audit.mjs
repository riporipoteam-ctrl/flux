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

const workspace = read("src/components/ask-ai/askai-workspace-v2.tsx");
for (const marker of [
  "AskAI 1.0 Instant",
  "AskAI 1.0 Pro",
  "runAskAIPro",
  "searchConnectedWeb",
  "streamLocalAskAI",
  "searchFlux",
  "reasoning",
  // Pro's model, endpoint and effort are chosen at runtime now, so assert the
  // connection machinery rather than a hardcoded model name in the markup.
  "resolveProConnection",
  "ConnectProSheet",
  "saveProConnection",
]) requireText(workspace, marker, "AskAI two-model workspace");
for (const legacy of ["Auto route", "Smart local WebGPU", "Connected endpoint", "AskAI Workspace"]) {
  forbidText(workspace, legacy, "AskAI model selection");
}

const pro = read("src/lib/ai/askai-pro.ts");
for (const marker of [
  // The model and the effort are chosen at runtime now, so assert the default
  // and the wire format rather than the literals that used to be hardcoded.
  "kimi-k3-max",
  "reasoning_effort",
  "reasoning_content",
  "stream: true",
  "api.moonshot.ai",
  "proxyEndpoint",
  "NEXT_PUBLIC_KIMI_K3_ENDPOINT",
  "NEXT_PUBLIC_ASKAI_SEARCH_ENDPOINT",
  "searchConnectedWeb",
  "CONNECTED RESEARCH SOURCES",
]) requireText(pro, marker, "AskAI Pro connector");

// The proxy is what lets a server-side key work without the browser holding one.
const proxy = read("src/app/api/askai-pro/route.ts");
for (const marker of ["KIMI_API_KEY", "KIMI_BASE_URL", "KIMI_MODEL", "text/event-stream"]) {
  requireText(proxy, marker, "AskAI Pro proxy");
}

const localModel = read("src/lib/ai/local-web-llm.ts");
requireText(localModel, "Qwen2.5-0.5B-Instruct", "AskAI Instant model");
requireText(localModel, "AskAI 1.0 Instant", "AskAI Instant branding");
forbidText(localModel, "Qwen2.5-1.5B-Instruct", "AskAI Instant model");

const localTools = read("src/lib/local-ask-ai.ts");
requireText(localTools, "runLocalAskAI", "Instant local fallback");
forbidText(localTools, "The main focus appears to be", "Instant local fallback");

const mainLayout = read("src/app/(main)/layout.tsx");
requireText(mainLayout, "if (isStudio)", "Immersive Studio shell");
requireText(mainLayout, "if (isImmersive)", "Immersive AskAI shell");

const rootLayout = read("src/app/layout.tsx");
requireText(rootLayout, 'className="light"', "Light-first Flux");
requireText(rootLayout, "askai-workspace-v2.css", "AskAI styles");
requireText(rootLayout, "flux-v8.css", "Flux social styles");

const socialStyles = read("src/styles/flux-v8.css");
for (const marker of [
  "#1d9bf0",
  ".flux8-sidebar",
  ".flux8-mobile-nav",
  ".flux8-mobile-header",
  ".flux8-right-rail",
  ".flux8-feed",
]) requireText(socialStyles, marker, "X-style Flux redesign");
forbidText(socialStyles, "#7c3aed", "X-style Flux redesign");

const askStyles = read("src/styles/askai-workspace-v2.css");
for (const marker of [
  ".askx-shell",
  ".askx-model-switch",
  ".askx-composer",
  ".askx-context",
]) requireText(askStyles, marker, "AskAI X-style workspace");

console.log("AskAI Kimi and X-style Flux audit passed.");
