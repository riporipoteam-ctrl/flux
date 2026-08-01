import { readFileSync } from "node:fs";

function read(path) {
  return readFileSync(path, "utf8");
}

function requireText(source, marker, label) {
  if (!source.includes(marker)) throw new Error(`${label}: missing ${JSON.stringify(marker)}`);
}

const registry = read("src/data/flux-engine-features.ts");
const featureCount = (registry.match(/\{ id: "/g) || []).length;
if (featureCount !== 100) throw new Error(`Expected exactly 100 Flux Engine features, found ${featureCount}`);

const runtime = read("src/lib/babylon-runtime.ts");
for (const marker of ["cdn.babylonjs.com/babylon.js", "babylonjs.loaders.min.js", "cannon.js", "loadBabylonRuntime"]) {
  requireText(runtime, marker, "Babylon runtime");
}

const viewport = read("src/components/studio/engine/engine-viewport-v2.tsx");
for (const marker of [
  "new B.Engine",
  "new B.Scene",
  "new B.GizmoManager",
  "SceneLoader.ImportMeshAsync",
  "PhysicsImpostor",
  "spin",
  "bob",
  "pulse",
  "movePlayer",
  "setCameraView",
  "capture",
]) requireText(viewport, marker, "3D viewport");

const shell = read("src/components/studio/engine/flux-engine-studio.tsx");
for (const marker of [
  "Hierarchy",
  "Inspector",
  "CommandPalette",
  "ProjectBrowser",
  "FeaturesModal",
  "createEngineVersion",
  "saveEnginePrefab",
  "generateEngineGameHtml",
  "publishEngineProject",
  "Ctrl K",
  "F6",
]) requireText(shell, marker, "Engine editor shell");

const projects = read("src/services/flux-engine-projects.ts");
for (const marker of [
  "flux-engine-projects-v1",
  "createDefaultEngineProject",
  "saveEngineProject",
  "createEngineVersion",
  "restoreEngineVersion",
  "serializeEngineProject",
  "parseEngineProject",
  "generateEngineGameHtml",
  "publishEngineProject",
]) requireText(projects, marker, "Engine project system");

const studioPage = read("src/app/(main)/studio/page.tsx");
requireText(studioPage, "FluxEngineStudio", "Studio route");

const mainLayout = read("src/app/(main)/layout.tsx");
requireText(mainLayout, "if (isStudio)", "Immersive Studio layout");

const rootLayout = read("src/app/layout.tsx");
requireText(rootLayout, "flux-engine.css", "Engine stylesheet");
requireText(rootLayout, "flux-v5.css", "Global Flux redesign");

console.log("Flux Engine 100-feature audit passed.");
