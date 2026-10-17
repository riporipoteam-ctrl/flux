import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
const pngSize = (file) => {
  const data = readFileSync(file);
  assert.equal(
    data.subarray(0, 8).toString("hex"),
    "89504e470d0a1a0a",
    file + " must be PNG",
  );
  return [data.readUInt32BE(16), data.readUInt32BE(20)];
};
test("installed Flux opens the home feed and provides real correctly sized app icons", () => {
  const manifest = JSON.parse(
    readFileSync("public/manifest.webmanifest", "utf8"),
  );
  assert.equal(
    new URL(manifest.start_url, "https://flux.sitey.my/").pathname,
    "/home/",
  );
  for (const icon of manifest.icons) {
    const file = "public/" + icon.src.split("?")[0];
    assert.equal(pngSize(file).join("x"), icon.sizes);
  }
  assert.ok(
    manifest.icons.some(
      (icon) => icon.sizes === "192x192" && icon.purpose === "any",
    ),
  );
  assert.ok(
    manifest.icons.some(
      (icon) => icon.sizes === "512x512" && icon.purpose === "any",
    ),
  );
  assert.ok(
    manifest.icons.some(
      (icon) => icon.sizes === "512x512" && icon.purpose === "maskable",
    ),
  );
  assert.deepEqual(pngSize("public/apple-touch-icon.png"), [180, 180]);
  assert.deepEqual(pngSize("src/app/icon.png"), [512, 512]);
});
test("favicon contains browser-sized images with valid data offsets", () => {
  const ico = readFileSync("public/favicon.ico");
  assert.equal(ico.readUInt16LE(0), 0);
  assert.equal(ico.readUInt16LE(2), 1);
  const count = ico.readUInt16LE(4);
  assert.ok(count >= 2);
  const sizes = [];
  for (let i = 0; i < count; i++) {
    const entry = 6 + i * 16;
    const size = ico[entry] || 256;
    const bytes = ico.readUInt32LE(entry + 8);
    const offset = ico.readUInt32LE(entry + 12);
    assert.ok(offset >= 6 + count * 16);
    assert.ok(offset + bytes <= ico.length);
    assert.equal(
      ico.subarray(offset, offset + 8).toString("hex"),
      "89504e470d0a1a0a",
    );
    sizes.push(size);
  }
  assert.ok(sizes.includes(16));
  assert.ok(sizes.includes(32));
});
