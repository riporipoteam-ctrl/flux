import sharp from "sharp";
import { mkdir, writeFile, copyFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = path.join(root, "docs/brand/flux-symbol-source.png");
const destination = (name) => path.join(root, name);
await mkdir(destination("public/icons"), { recursive: true });
await mkdir(destination("public/brand"), { recursive: true });
// Export the generated artwork without changing its shape or color.
await sharp(source)
  .resize(512, 512)
  .png({ compressionLevel: 9 })
  .toFile(destination("public/brand/flux-symbol.png"));
await copyFile(
  destination("public/brand/flux-symbol.png"),
  destination("public/flux-logo.png"),
);
await copyFile(
  destination("public/brand/flux-symbol.png"),
  destination("public/brand/logo.png"),
);
const tile = async (size, maskable = false) => {
  const symbol = await sharp(source)
    .resize(
      Math.round(size * (maskable ? 0.7 : 0.92)),
      Math.round(size * (maskable ? 0.7 : 0.92)),
    )
    .png()
    .toBuffer();
  return sharp({
    create: { width: size, height: size, channels: 4, background: "#101c18" },
  })
    .composite([{ input: symbol, gravity: "centre" }])
    .png({ compressionLevel: 9 })
    .toBuffer();
};
for (const size of [16, 32, 48, 64, 180, 192, 512])
  await writeFile(
    destination(`public/icons/flux-${size}.png`),
    await tile(size),
  );
await writeFile(
  destination("public/icons/flux-maskable-512.png"),
  await tile(512, true),
);
await copyFile(
  destination("public/icons/flux-512.png"),
  destination("public/flux-icon.png"),
);
await copyFile(
  destination("public/icons/flux-512.png"),
  destination("src/app/icon.png"),
);
await copyFile(
  destination("public/icons/flux-180.png"),
  destination("public/apple-touch-icon.png"),
);
const sizes = [16, 32, 48, 64];
const images = await Promise.all(sizes.map((size) => tile(size)));
const header = Buffer.alloc(6);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(images.length, 4);
let offset = 6 + 16 * images.length;
const entries = images.map((data, index) => {
  const entry = Buffer.alloc(16);
  entry[0] = sizes[index];
  entry[1] = sizes[index];
  entry.writeUInt16LE(1, 4);
  entry.writeUInt16LE(32, 6);
  entry.writeUInt32LE(data.length, 8);
  entry.writeUInt32LE(offset, 12);
  offset += data.length;
  return entry;
});
await writeFile(
  destination("public/favicon.ico"),
  Buffer.concat([header, ...entries, ...images]),
);
console.log(
  "Generated Flux logo exports, multi-resolution favicon, Apple touch icon, PWA icons and maskable icon.",
);
