import { readFileSync } from "node:fs";

function read(path) {
  return readFileSync(path, "utf8");
}

function requireText(source, text, label) {
  if (!source.includes(text)) throw new Error(`${label}: missing ${JSON.stringify(text)}`);
}

function forbidText(source, text, label) {
  if (source.includes(text)) throw new Error(`${label}: forbidden text ${JSON.stringify(text)}`);
}

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
for (const forbidden of ["Kimi K3", "runLocalAskAI", "Groq GPT-OSS 120B", "Groq GPT-OSS 20B"]) {
  forbidText(workspace, forbidden, "Hybrid AskAI workspace");
}

const client = read("src/lib/ai/askai-groq.ts");
for (const marker of [
  "askaiGroq",
  "getIdToken",
  "Authorization",
  "NEXT_PUBLIC_ASKAI_GROQ_ENDPOINT",
  "checkAskAIGroqHealth",
  "provider?: string",
  "ASKAI_PROVIDER_MISSING",
  "ASKAI_UPSTREAM_FAILED",
]) requireText(client, marker, "AskAI Firebase client");
for (const forbidden of ["process.env.GROQ_API_KEY", "NEXT_PUBLIC_GROQ_API_KEY", "gsk_"]) {
  forbidText(client, forbidden, "browser AI client");
}

const server = read("functions/src/index.ts");
for (const marker of [
  'defineSecret("RIPO_ASKAI_TOKEN")',
  'defineSecret("GROQ_API_KEY")',
  "verifyIdToken",
  "RIPO_ASKAI_BASE_URL",
  'qwen3:4b-instruct',
  'type: "browser_search"',
  'type: "code_interpreter"',
  "askaiRateLimits",
  "toolsRequested",
  "callRipoAskAI",
  "callGroq",
]) requireText(server, marker, "Firebase hybrid AskAI gateway");
for (const forbidden of ["gsk_", "NEXT_PUBLIC_RIPO_ASKAI_TOKEN"]) {
  forbidText(server, forbidden, "Firebase hybrid AskAI gateway");
}

const mainLayout = read("src/app/(main)/layout.tsx");
requireText(mainLayout, "if (isStudio)", "Immersive Studio shell");
requireText(mainLayout, "if (isImmersive)", "Immersive AskAI shell");

const rootLayout = read("src/app/layout.tsx");
requireText(rootLayout, "askai-workspace-v2.css", "AskAI styles");
requireText(rootLayout, "flux-v8.css", "Flux social styles");

const socialStyles = read("src/styles/flux-v8.css");
for (const marker of ["#1d9bf0", ".flux8-sidebar", ".flux8-mobile-nav", ".flux8-feed"]) {
  requireText(socialStyles, marker, "Flux social design");
}

const askStyles = read("src/styles/askai-workspace-v2.css");
for (const marker of [".askx-shell", ".askx-model-switch", ".askx-composer", ".askx-context"]) {
  requireText(askStyles, marker, "AskAI workspace styles");
}

console.log("Self-hosted Ripo AskAI and Flux social audit passed.");
