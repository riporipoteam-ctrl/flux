import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Serve room thumbnails for Flux Rec game page.
 * Looks in public/game-thumbs then RecNet data/images.
 */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ name: string }> }
) {
  const { name: raw } = await ctx.params;
  const safe = decodeURIComponent(raw || "")
    .replace(/[^a-zA-Z0-9._-]/g, "")
    .replace(/\.(png|jpg|jpeg)$/i, "");
  if (!safe) {
    return new NextResponse("missing", { status: 400 });
  }

  const roots = [
    path.join(process.cwd(), "public", "game-thumbs"),
    path.join(process.cwd(), "game", "flux-recnet", "data", "images"),
  ];
  const tries = [
    `${safe}.png`,
    `${safe}.jpg`,
    `${safe}.jpeg`,
    safe,
    `${safe}.png.png`,
  ];

  for (const root of roots) {
    for (const f of tries) {
      const p = path.join(root, f);
      try {
        if (fs.existsSync(p) && fs.statSync(p).size > 32) {
          const buf = fs.readFileSync(p);
          const type =
            buf[0] === 0xff && buf[1] === 0xd8
              ? "image/jpeg"
              : "image/png";
          return new NextResponse(buf, {
            status: 200,
            headers: {
              "Content-Type": type,
              "Cache-Control": "public, max-age=86400",
            },
          });
        }
      } catch {
        /* next */
      }
    }
  }

  // 1x1 transparent PNG
  const empty = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    "base64"
  );
  return new NextResponse(empty, {
    status: 404,
    headers: { "Content-Type": "image/png" },
  });
}
