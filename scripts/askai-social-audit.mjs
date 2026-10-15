import { readFileSync } from "node:fs";

// Audit the shipped native AskAI implementation, not the retired Rakazo iframe.
const read = (path) => readFileSync(path, "utf8");
const expect = (source, marker, label) => {
  if (!source.includes(marker)) throw new Error(`${label}: missing ${JSON.stringify(marker)}`);
};
const forbid = (source, marker, label) => {
  if (source.includes(marker)) throw new Error(`${label}: forbidden ${JSON.stringify(marker)}`);
};
const route = read("src/app/(main)/ask-ai/page.tsx");
expect(route, "@/components/ask-ai/askai-grok", "AskAI route");
expect(route, "<AskAIGrok />", "AskAI route");

const native = read("src/components/ask-ai/askai-grok.tsx");
for (const marker of [
  "export default function AskAIGrok", "streamChat", "useAuth",
  "localStorage", "Send", "MessageSquarePlus",
]) expect(native, marker, "Native AskAI");
for (const marker of ["GROQ_API_KEY", "document.cookie", "gsk_"])
  forbid(native, marker, "Native AskAI");

const transport = read("src/lib/ai/pollinations.ts");
for (const marker of ["streamChat", "POLLINATIONS_CHAT_URL"])
  expect(transport, marker, "Native AskAI transport");
forbid(transport, "GROQ_API_KEY", "Native AskAI transport");

const gateway = read("functions/src/index.ts");
for (const marker of [
  "verifyIdToken", "RIPO_ASKAI_BASE_URL", "browser_search",
  "code_interpreter", "askaiRateLimits", "callRipoAskAI",
]) expect(gateway, marker, "Firebase AI gateway");
forbid(gateway, "gsk_", "Firebase AI gateway");

const mainLayout = read("src/app/(main)/layout.tsx");
for (const marker of [
  "const isPublicAskAI = isAskAI", "if (isPublicAskAI)",
  "if (isStudio)", "if (isImmersive)",
]) expect(mainLayout, marker, "Main app shell");

const root = read("src/app/layout.tsx");
for (const marker of [
  "flux-v11.css", "askai-grok.css", "flux-x.css", 'className="light"',
]) expect(root, marker, "Root styles and light mode");
const social = read("src/styles/flux-v11.css");
for (const marker of [
  "--flux-sidebar: 274px", ".flux8-mobile-nav",
  ".flux9-topbar", "@keyframes flux11-rise",
]) expect(social, marker, "Social design system");
const x = read("src/styles/flux-x.css");
for (const marker of [".xxshell", ".xxnav", ".xxpost", ".xxrail"])
  expect(x, marker, "X-style shell");

console.log("Native AskAI, Firebase gateway, and current social UI audit passed.");
