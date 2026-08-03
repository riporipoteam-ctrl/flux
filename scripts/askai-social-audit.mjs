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
  "AskAI 1.0 Instant",
  "AskAI 1.0 Pro",
  "runAskAIGroq",
  "openai/gpt-oss-20b",
  "openai/gpt-oss-120b",
  "Browser research",
  "Code execution",
  "searchFlux",
]) requireText(workspace, marker, "Groq AskAI workspace");
for (const forbidden of ["streamLocalAskAI", "localAskAISupported", "Kimi K3", "runLocalAskAI"]) {
  forbidText(workspace, forbidden, "Groq AskAI workspace");
}

const client = read("src/lib/ai/askai-groq.ts");
for (const marker of [
  "askaiGroq",
  "getIdToken",
  "Authorization",
  "NEXT_PUBLIC_ASKAI_GROQ_ENDPOINT",
]) requireText(client, marker, "Groq Firebase client");
forbidText(client, "GROQ_API_KEY", "browser Groq client");
forbidText(client, "gsk_", "browser Groq client");

const server = read("functions/src/index.ts");
for (const marker of [
  'defineSecret("GROQ_API_KEY")',
  "verifyIdToken",
  'openai/gpt-oss-20b',
  'openai/gpt-oss-120b',
  'type: "browser_search"',
  'type: "code_interpreter"',
  'effort: mode === "pro" ? "high" : "low"',
  "askaiRateLimits",
]) requireText(server, marker, "Firebase Groq proxy");
forbidText(server, "gsk_", "Firebase Groq proxy");

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

console.log("Secure Groq AskAI and Flux social audit passed.");
