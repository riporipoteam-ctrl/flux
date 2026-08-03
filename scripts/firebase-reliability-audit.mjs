import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");
const requireText = (source, marker, label) => {
  if (!source.includes(marker)) throw new Error(`${label}: missing ${JSON.stringify(marker)}`);
};
const requireAnyText = (source, alternatives, label) => {
  if (!alternatives.some((marker) => source.includes(marker))) {
    throw new Error(`${label}: missing one of ${alternatives.map(JSON.stringify).join(", ")}`);
  }
};
const forbidText = (source, marker, label) => {
  if (source.includes(marker)) throw new Error(`${label}: forbidden ${JSON.stringify(marker)}`);
};

const mediaProcessing = read("src/lib/media-processing.ts");
for (const marker of ["processProfileAvatar", "processProfileBanner", "1500", "512", "image/webp"]) {
  requireText(mediaProcessing, marker, "Profile image processing");
}

const media = read("src/services/media.ts");
for (const marker of ["uploadBytesResumable", "processProfileAvatar", "processProfileBanner", "getIdToken(true)", "UploadProgress"]) {
  requireText(media, marker, "Firebase media reliability");
}

const auth = read("src/contexts/auth-context.tsx");
for (const marker of ["flux-profile-cache-v1", "updateProfileOptimistic", "Profile loading timed out", "writeCachedProfile"]) {
  requireText(auth, marker, "Profile loading and avatar refresh");
}

const callPage = read("src/app/(main)/messages/call/page.tsx");
for (const marker of [
  "createIceCandidateQueue",
  "getFluxIceServers",
  "replaceTrack",
  "devicechange",
  "restartIce",
  "iceRestart: true",
  "The call was not answered",
  "describeMediaError",
]) requireText(callPage, marker, "Voice and video calls");

const live = read("src/components/live/live-studio-v2.tsx");
requireAnyText(live, ["element.srcObject = captured.stream", "element.srcObject = capture.stream"], "Live persistent preview");
requireText(live, "getFluxIceServers", "Live TURN support");

const firebase = read("firebase.json");
requireText(firebase, '"functions"', "Firebase Functions configuration");
requireText(firebase, '"storage"', "Firebase Storage configuration");

for (const path of [
  "src/lib/ai/askai-groq.ts",
  "src/components/ask-ai/askai-groq-workspace.tsx",
  "functions/src/index.ts",
  "docs/groq-firebase-setup.md",
]) {
  const source = read(path);
  forbidText(source, "gsk_", `${path} secret scan`);
}

console.log("Firebase profile, calls, Live and Groq reliability audit passed.");
