import { chromium } from "playwright";
const base = process.argv[2];
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto(`${base}/farm-test`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(9000);
const canvas = await page.locator("canvas").first();
const box = await canvas.boundingBox();
// Auto tool: tap the same beds repeatedly to till -> plant -> water.
const spots = [[0.62, 0.53], [0.66, 0.56], [0.70, 0.59], [0.58, 0.56], [0.62, 0.59], [0.66, 0.62]];
for (let pass = 0; pass < 3; pass += 1) {
  for (const [fx, fy] of spots) {
    await page.mouse.click(box.x + box.width * fx, box.y + box.height * fy);
    await page.waitForTimeout(120);
  }
}
await page.waitForTimeout(1500);
await page.screenshot({ path: process.argv[3] });
// Panels
const rail = page.locator("button").filter({ hasText: "" });
console.log("buttons:", await page.locator("button").count());
console.log("errors:", errors.length ? errors : "none");
await browser.close();
