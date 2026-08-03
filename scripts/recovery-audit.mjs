import { readFileSync } from "node:fs";

function read(path) {
  return readFileSync(path, "utf8");
}

function requireText(source, text, label) {
  if (!source.includes(text)) throw new Error(`${label}: missing ${JSON.stringify(text)}`);
}

function requireAnyText(source, alternatives, label) {
  if (!alternatives.some((text) => source.includes(text))) {
    throw new Error(`${label}: missing one of ${alternatives.map(JSON.stringify).join(", ")}`);
  }
}

function forbidText(source, text, label) {
  if (source.includes(text)) throw new Error(`${label}: forbidden legacy text ${JSON.stringify(text)}`);
}

const live = read("src/components/live/live-studio-v2.tsx");
requireText(live, "const attachPreview", "Live persistent canvas");
requireAnyText(live, ["element.srcObject = captured.stream", "element.srcObject = capture.stream"], "Live stream attachment");
requireText(live, "source === \"screen\" && !screenSupported", "Live platform capability guard");
const liveVideos = live.match(/<video\b/g)?.length || 0;
if (liveVideos !== 1) throw new Error(`Live persistent canvas: expected exactly one video element, found ${liveVideos}`);

const storyStudio = read("src/components/stories/story-studio-v2.tsx");
requireText(storyStudio, "beginGesture", "Story gesture editing");
requireText(storyStudio, "\"scale\"", "Story resize gesture");
requireText(storyStudio, "\"rotate\"", "Story rotate gesture");
requireText(storyStudio, "TransformSlider", "Story exact transforms");
const stories = read("src/services/stories.ts");
requireText(stories, "imageToFirestoreFallback", "Story Storage fallback");
requireText(stories, "firestore-fallback", "Story fallback metadata");

const studio = read("src/components/studio/studio-workspace-v2.tsx");
requireText(studio, "Blank project", "Studio manual creation");
requireText(studio, "index.html", "Studio HTML file");
requireText(studio, "styles.css", "Studio CSS file");
requireText(studio, "script.js", "Studio JavaScript file");
requireText(studio, "createProjectRevision", "Studio restore points");
requireText(studio, "AskAI edit applied", "Studio iterative edits");

const askAI = read("src/components/ask-ai/ask-ai-unified.tsx");
requireText(askAI, "detectIntent", "Unified AskAI routing");
forbidText(askAI, "type AskMode", "Unified AskAI");
forbidText(askAI, "Create mode", "Unified AskAI");

const giftsPage = read("src/app/(main)/gifts/page.tsx");
requireText(giftsPage, "GiftVisual", "Custom gift renderer");
forbidText(giftsPage, "gift.emoji", "Gift page");
const giftsService = read("src/services/gift-experience.ts");
requireText(giftsService, "GiftVisual", "Gift definitions");
forbidText(giftsService, "emoji:", "Gift definitions");


// A cached "no such user" must never be allowed to create — and therefore
// overwrite — a real profile, which is what used to reset onboarding and wipe
// a person's account on the first load after a deploy.
const users = read("src/services/users.ts");
for (const marker of ["getDocFromServer", "{ merge: true }"]) {
  requireText(users, marker, "Profile creation guard");
}
forbidText(users, "await setDoc(ref, payload);", "Profile creation guard");

// Nobody with a username gets sent back through setup.
for (const file of ["src/app/(main)/layout.tsx", "src/app/(auth)/layout.tsx", "src/app/page.tsx"]) {
  requireText(read(file), 'String(profile.username || "").trim()', "Onboarding redirect guard");
}

console.log("Flux recovery audit passed.");