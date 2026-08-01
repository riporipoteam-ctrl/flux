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
for (const legacy of ["social-rebuild.css", "flux-v5.css", "flux-social-2027.css", "flux-redesign-v2.css"]) {
  forbidText(root, legacy, "Root design system");
}

const layout = read("src/app/(main)/layout.tsx");
for (const marker of ["DesktopTopbar", "flux8-app-shell", "flux8-content-grid", "flux8-main-column"]) {
  requireText(layout, marker, "Flux V8 shell");
}

const topbar = read("src/components/layout/desktop-topbar.tsx");
for (const marker of ["flux8-global-search", "flux8-create-button", "ComposeBox", "getUnreadCount"]) {
  requireText(topbar, marker, "Desktop command bar");
}

const sidebar = read("src/components/layout/sidebar.tsx");
for (const marker of ["flux8-sidebar", "flux8-sidebar-link", "flux8-sidebar-create", "Flux Coins"]) {
  requireText(sidebar, marker, "Desktop navigation");
}

const mobileHeader = read("src/components/layout/mobile-app-header.tsx");
requireText(mobileHeader, "flux8-mobile-header", "Mobile header");
const mobileNav = read("src/components/layout/mobile-nav.tsx");
requireText(mobileNav, "flux8-mobile-nav", "Mobile navigation");
const drawer = read("src/components/layout/mobile-drawer.tsx");
requireText(drawer, "var(--v8-nav)", "Mobile drawer");

const rail = read("src/components/layout/right-rail.tsx");
for (const marker of ["flux8-balance-card", "flux8-premium-card", "flux8-askai-promo", "flux8-game-links"]) {
  requireText(rail, marker, "Discovery rail");
}

const home = read("src/app/(main)/home/page.tsx");
for (const marker of ["flux8-feed-hero", "flux8-quick-actions", "flux8-story-card", "flux8-post-wrap"]) {
  requireText(home, marker, "Home feed");
}

const styles = read("src/styles/flux-v8.css");
for (const marker of [
  ".flux8-app-shell",
  ".flux8-topbar",
  ".flux8-sidebar",
  ".flux8-right-rail",
  ".flux8-mobile-header",
  ".flux8-mobile-nav",
  ".flux8-feed",
  ".flux8-composer-card",
  ".flux8-post-wrap",
  ".social-page-header",
  ".surface-card",
]) requireText(styles, marker, "Flux V8 stylesheet");

console.log("Flux V8 total redesign audit passed.");
