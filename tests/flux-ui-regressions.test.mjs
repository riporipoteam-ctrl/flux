import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const root = process.cwd();
const source = (file) => readFileSync(join(root, file), "utf8");

test("phone layout overrides the fixed desktop feed width", () => {
  const css = source("src/styles/flux-x.css");
  const desktopWidth = css.lastIndexOf(".xxmain-col { width: 600px; }");
  const mobileRule = css.lastIndexOf("@media (max-width: 1023.98px) {");
  assert.ok(desktopWidth >= 0, "desktop column baseline should remain");
  assert.ok(mobileRule > desktopWidth, "mobile sizing must be later in the cascade");
  assert.match(css.slice(mobileRule), /\.xxmain-col\s*\{[^}]*width:\s*100%;[^}]*max-width:\s*100%/);
});

test("mobile visitors can reach messages and notifications and still create posts", () => {
  const nav = source("src/components/layout/mobile-nav.tsx");
  for (const path of ["/home", "/explore", "/notifications", "/messages"]) {
    assert.ok(nav.includes('href: "' + path + '"'), path + " is required in bottom navigation");
  }
  assert.match(nav, /flux-mobile-compose-fab/);
  assert.match(nav, /setComposeOpen\(true\)/);
});

test("light is the default; saved dark and dim selections are preserved", () => {
  const layout = source("src/app/layout.tsx");
  const provider = source("src/contexts/theme-context.tsx");
  assert.match(layout, /className="light"/);
  assert.match(provider, /useState<ThemeMode>\("light"\)/);
  assert.match(provider, /\["light", "dim", "dark", "system"\]/);
});

test("route changes cannot remount the entire shell through a keyed wrapper", () => {
  const motion = source("src/components/providers/route-motion.tsx");
  assert.doesNotMatch(motion, /key=\{pathname\}/);
  assert.match(motion, /useReducedMotion/);
  assert.match(motion, /useAnimationControls/);
});

test("tab animations remain scoped and reduced-motion tabs keep an indicator", () => {
  const ui = source("src/components/x/x-ui.tsx");
  assert.match(ui, /const underlineId = React\.useId\(\)/);
  assert.match(ui, /layoutId=\{underlineId\}/);
  assert.doesNotMatch(ui, /layoutId="x-tab-underline"/);
  assert.match(ui, /reduce \? \(/);
});


test("switching timeline tabs cannot apply late results from the previous tab", () => {
  const feed = source("src/app/(main)/home/page.tsx");
  assert.match(feed, /requestIdRef\s*=\s*useRef\(0\)/);
  assert.match(feed, /requestIdRef\.current\s*\+=\s*1/);
  assert.match(feed, /if\s*\(!isCurrent\(\)\)\s*return/);
  assert.match(feed, /const requestId = requestIdRef\.current/);
});
