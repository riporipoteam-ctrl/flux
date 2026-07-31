import { readFileSync } from "node:fs";

function read(path) {
  return readFileSync(path, "utf8");
}

function requireText(source, text, label) {
  if (!source.includes(text)) throw new Error(`${label}: missing ${JSON.stringify(text)}`);
}

const featureRegistry = read("src/data/flux-product-features.ts");
const featureCount = (featureRegistry.match(/\{ id: "/g) || []).length;
if (featureCount !== 25) throw new Error(`Expected exactly 25 documented features, found ${featureCount}`);

const localAI = read("src/lib/local-ask-ai.ts");
for (const marker of ["rewriteText", "summarizeText", "createCaptions", "createHashtags", "brainstorm", "runLocalAskAI"]) {
  requireText(localAI, marker, "Local AskAI");
}

const askAI = read("src/components/ask-ai/ask-ai-product.tsx");
requireText(askAI, "runLocalAskAI", "AskAI local fallback");
requireText(askAI, "Remote AskAI was unavailable", "AskAI failure fallback");
requireText(askAI, "One input. Local first.", "AskAI product UI");

const story = read("src/components/stories/story-studio-v3.tsx");
for (const marker of ["addText", "beginGesture", "undo", "redo", "snapGuides", "showSafeArea", "Bring forward", "Hide layer", "localStorage.setItem(DRAFT_KEY"]) {
  requireText(story, marker, "Story Studio v3");
}
const storyService = read("src/services/stories.ts");
for (const kind of ['"text"', '"shape"', '"label"', '"emoji"']) requireText(storyService, kind, "Story layer model");
const storyViewer = read("src/components/stories/story-viewer.tsx");
requireText(storyViewer, "StoryLayerRenderer", "Story viewer layer rendering");
requireText(storyViewer, "QUICK_REACTIONS", "Story reactions");

const studio = read("src/components/studio/studio-product-v3.tsx");
for (const marker of ["SceneWorkspace", "ObjectInspector", "runStudioCommand", "generateSceneCode", "beginDrag", "resize", "Restore visual scene and code together."]) {
  requireText(studio, marker, "Studio v3");
}

console.log("Flux 25-feature product redesign audit passed.");
