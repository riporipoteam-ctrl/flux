import { readFileSync } from "node:fs";

function read(path) {
  return readFileSync(path, "utf8");
}

function requireText(source, marker, label) {
  if (!source.includes(marker)) throw new Error(`${label}: missing ${JSON.stringify(marker)}`);
}

function forbidText(source, marker, label) {
  if (source.includes(marker)) throw new Error(`${label}: forbidden legacy marker ${JSON.stringify(marker)}`);
}

const root = read("src/app/layout.tsx");
requireText(root, "flux-v8.css", "Root design system");
// Light-first, but the stored background has to be painted before first paint
// or Dim and Lights out flash white on every load.
requireText(root, 'className="light"', "Light-first design system");
requireText(root, "flux-theme-v2", "Theme boot script");
requireText(root, 'data-accent', "Accent boot script");
for (const legacy of ["social-rebuild.css", "flux-v5.css", "flux-social-2027.css", "flux-redesign-v2.css"]) {
  forbidText(root, legacy, "Root design system");
}

const layout = read("src/app/(main)/layout.tsx");
for (const marker of ["flux8-app-shell", "flux8-main-column", "Sidebar", "RightRail", "MobileNav"]) {
  requireText(layout, marker, "X-style Flux shell");
}
forbidText(layout, "DesktopTopbar", "X-style Flux shell");

const sidebar = read("src/components/layout/sidebar.tsx");
for (const marker of ["Home", "Explore", "Notifications", "Messages", "AskAI", "Bookmarks", "Communities", "Premium", "Profile", "More", "flux8-sidebar-create"]) {
  requireText(sidebar, marker, "X-style desktop navigation");
}

const mobileHeader = read("src/components/layout/mobile-app-header.tsx");
for (const marker of ["flux8-mobile-header", "MobileDrawer", "Settings"]) requireText(mobileHeader, marker, "X-style mobile header");
const mobileNav = read("src/components/layout/mobile-nav.tsx");
for (const marker of ["/home", "/explore", "/ask-ai", "/notifications", "/messages", "flux8-mobile-create"]) requireText(mobileNav, marker, "X-style mobile navigation");

const rail = read("src/components/layout/right-rail.tsx");
for (const marker of ["Search", "Subscribe to Premium", "What’s happening", "Who to follow", "flux8-right-rail"]) {
  requireText(rail, marker, "X-style discovery rail");
}

const home = read("src/app/(main)/home/page.tsx");
for (const marker of ["For you", "Following", "What is happening?!", "flux8-story-card", "flux8-post-wrap"]) {
  requireText(home, marker, "X-style Home timeline");
}

const styles = read("src/styles/flux-v8.css");
// The shell geometry is now expressed through design tokens, so assert the
// token values and the declaration that consumes them rather than one literal.
for (const marker of [
  "#1d9bf0",
  "--v8-nav-w: 275px",
  "--v8-feed: 600px",
  "--v8-rail: 350px",
  "grid-template-columns: var(--v8-nav-w) minmax(0, var(--v8-feed)) minmax(290px, var(--v8-rail))",
  ".flux8-sidebar",
  ".flux8-right-rail",
  ".flux8-mobile-header",
  ".flux8-mobile-nav",
  ".flux8-feed-tabs",
  ".flux8-composer-card",
  ".flux8-post-wrap",
]) requireText(styles, marker, "X-style Flux stylesheet");
forbidText(styles, "#7c3aed", "X-style Flux stylesheet");
// The composer's tool buttons carry `hover:bg-primary/10`, so a substring
// match on bg-primary paints them solid. It has to stay gone.
forbidText(styles, 'button[class*="bg-primary"]', "X-style Flux stylesheet");

// X ships three backgrounds and six highlight colours; so does Flux.
for (const marker of ["\n.dim {", '[data-accent="blue"]', '[data-accent="yellow"]', '[data-accent="pink"]', '[data-accent="purple"]', '[data-accent="orange"]', '[data-accent="green"]']) {
  requireText(styles, marker, "X-style display settings");
}

const display = read("src/app/(main)/settings/display/page.tsx");
for (const marker of ["Colour", "Background", "Lights out", "Match my device"]) {
  requireText(display, marker, "X-style display settings");
}

console.log("Flux X-style total redesign audit passed.");
