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

const layout = read("src/app/layout.tsx");
requireText(layout, "RouteMotion", "Global route motion");
requireText(layout, "flux-v12-rebuild.css", "Global v12 stylesheet");

const v12 = read("src/styles/flux-v12-rebuild.css");
for (const marker of [
  "prefers-reduced-motion",
  "flux-v12-shell",
  "flux-v12-mobile-dock",
  "flux-v12-post",
  "flux-v12-composer",
]) requireText(v12, marker, "Flux UI v12");

const studioRoute = read("src/app/(main)/studio/page.tsx");
requireText(studioRoute, "FluxStudioShell", "Studio route");

const studioShell = read("src/components/studio/flux-studio-shell.tsx");
for (const marker of [
  "Build with AskAI",
  "generateStudioProjectWithAskAI",
  "replaceWorld",
  "saveEngineProject",
]) requireText(studioShell, marker, "Studio AskAI shell");

const studioAI = read("src/lib/ai/studio-askai.ts");
for (const marker of [
  "runAskAIGroq",
  "Return ONLY valid JSON",
  "normalizeEngineProject",
  "ground",
  "spawn",
  "directional-light",
]) requireText(studioAI, marker, "Studio structured generation");

const reposts = read("src/services/reposts.ts");
for (const marker of [
  "setRepostState",
  "runTransaction",
  "repost_${uid}_${postId}",
  "currentlyReposted === desired",
]) requireText(reposts, marker, "Idempotent reposts");

const postCard = read("src/components/posts/post-card.tsx");
for (const marker of [
  "setRepostState",
  "repostBusy",
  "disabled={busy}",
  "aria-busy={busy}",
]) requireText(postCard, marker, "Post interaction locking");
forbidText(postCard, "toggleRepost(", "Post duplicate repost prevention");

const liveService = read("src/services/live.ts");
for (const marker of [
  "setLivePeerStatus",
  'status: "waiting"',
  "attempt",
  'status: "offered"',
  'status: "answered"',
]) requireText(liveService, marker, "Live signaling state");

const liveHost = read("src/components/live/live-studio-v2.tsx");
for (const marker of [
  "reconcilePeers",
  "cleanupPeer",
  "iceCandidatePoolSize: 4",
  "livePeer.attempt > 1",
  "setLivePeerStatus",
]) requireText(liveHost, marker, "Live host recovery");
forbidText(liveHost, "handledViewerIds", "Live host stale peer handling");

const liveViewer = read("src/components/live/live-viewer.tsx");
for (const marker of [
  "setAttempt",
  "The host did not connect in time",
  "Reconnect",
  "removeLivePeer",
  "setLivePeerStatus",
]) requireText(liveViewer, marker, "Live viewer recovery");

console.log("Flux UI v12, Studio AskAI, Live recovery and repost reliability audit passed.");
