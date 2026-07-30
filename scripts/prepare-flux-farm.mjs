import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, normalize, resolve } from "node:path";
import { gunzipSync } from "node:zlib";

const root = resolve(import.meta.dirname, "..");
const sourceDirectory = join(root, ".github", "flux-farm-source");
const expectedBase64Hash = "860a0fd8cb5cb0618314f34b94b3b4ac51a441ec0152d758ff86eda476fd295f";
const expectedArchiveHash = "8d4fcddd5e3c7662272904f34bd6325c1f3b647be2ca64e9af484242932a3541";
const allowedFiles = new Set([
  "src/services/flux-farm.ts",
  "src/components/layout/sidebar.tsx",
  "src/components/layout/right-rail.tsx",
  "src/components/layout/mobile-app-header.tsx",
  "src/components/game/flux-farm/flux-farm-game.tsx",
  "src/app/(main)/games/page.tsx",
  "src/app/(main)/home/page.tsx",
  "src/app/games/flux-farm/page.tsx",
]);

const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const chunks = readdirSync(sourceDirectory)
  .filter((name) => name.startsWith("part-"))
  .sort()
  .map((name) => readFileSync(join(sourceDirectory, name), "utf8"));

if (chunks.length !== 7) throw new Error(`Expected 7 Flux Farm source parts, found ${chunks.length}.`);
const base64 = chunks.join("");
if (sha256(base64) !== expectedBase64Hash) throw new Error("Flux Farm source checksum failed.");

const archive = Buffer.from(base64, "base64");
if (sha256(archive) !== expectedArchiveHash) throw new Error("Flux Farm archive checksum failed.");
const tar = gunzipSync(archive);

let offset = 0;
const extracted = new Set();
while (offset + 512 <= tar.length) {
  const header = tar.subarray(offset, offset + 512);
  if (header.every((byte) => byte === 0)) break;
  const rawName = header.subarray(0, 100).toString("utf8").replace(/\0.*$/, "");
  const path = normalize(rawName.replace(/^\.\//, "")).replaceAll("\\", "/");
  const sizeText = header.subarray(124, 136).toString("ascii").replace(/\0.*$/, "").trim();
  const size = Number.parseInt(sizeText || "0", 8);
  const type = String.fromCharCode(header[156] || 48);
  offset += 512;

  if ((type === "0" || type === "\0") && allowedFiles.has(path)) {
    const destination = resolve(root, path);
    if (!destination.startsWith(`${root}/`) && destination !== root) throw new Error(`Unsafe archive path: ${path}`);
    mkdirSync(dirname(destination), { recursive: true });
    writeFileSync(destination, tar.subarray(offset, offset + size));
    extracted.add(path);
  }
  offset += Math.ceil(size / 512) * 512;
}

for (const path of allowedFiles) {
  if (!extracted.has(path)) throw new Error(`Flux Farm archive is missing ${path}.`);
}

for (const retired of [
  "src/app/play/page.tsx",
  "src/components/game/flux-plays-world.tsx",
  "src/services/flux-plays.ts",
  "public/game-thumbs/flux-plays-hero.png",
]) {
  rmSync(resolve(root, retired), { force: true });
}

console.log(`Prepared Flux Farm (${extracted.size} source files).`);
