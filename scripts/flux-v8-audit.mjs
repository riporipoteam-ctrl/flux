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
requireText(root, 'className="light"', "Light-first design system");
requireText(root, "flux-theme-v2", "Theme boot script");
requireText(root, 'data-accent', "Accent boot script");
for (const legacy of ["social-rebuild.css", "flux-v5.css", "flux-social-2027.css", "flux-redesign-v2.css"]) forbidText(root, legacy, "Root design system");

const layout = read("src/app/(main)/layout.tsx");
for (const marker of ["flux8-app-shell", "flux8-main-column", "Sidebar", "RightRail", "MobileNav", "TopBar", "RouteProgress"]) requireText(layout, marker, "X-style Flux shell");
forbidText(layout, "DesktopTopbar", "X-style Flux shell");

const topBar = read("src/components/layout/top-bar.tsx");
for (const marker of ["flux9-topbar-search", "flux9-topbar-tabs", "flux9-topbar-actions", "flux9-topbar-avatar"]) requireText(topBar, marker, "Flux top bar");

const call = read("src/app/(main)/messages/call/page.tsx");
for (const marker of ["remoteAudio", "attachStreams", "remoteStreamRef", "getVideoTracks().length === 0"]) requireText(call, marker, "Flux call surface");

const sidebar = read("src/components/layout/sidebar.tsx");
for (const marker of ["Home", "Explore", "Notifications", "Messages", "AskAI", "Bookmarks", "Communities", "Premium", "Profile", "More", "flux8-sidebar-create"]) requireText(sidebar, marker, "X-style desktop navigation");

const mobileHeader = read("src/components/layout/mobile-app-header.tsx");
for (const marker of ["flux8-mobile-header", "MobileDrawer", "Search", "flux8-mobile-header-actions"]) requireText(mobileHeader, marker, "X-style mobile header");

const mobileDrawer = read("src/components/layout/mobile-drawer.tsx");
requireText(mobileDrawer, "/ask-ai", "Mobile AskAI access");
requireText(mobileDrawer, "/notifications", "Mobile notifications access");
requireText(mobileDrawer, "/messages", "Mobile messages access");

const mobileNav = read("src/components/layout/mobile-nav.tsx");
for (const marker of ["/home", "/explore", "#compose", "/games", "profileHref", "flux8-mobile-tab-create"]) requireText(mobileNav, marker, "X-style mobile navigation");
forbidText(mobileNav, "flux8-mobile-create", "Single mobile create action");

const rail = read("src/components/layout/right-rail.tsx");
for (const marker of ["Search", "Subscribe to Premium", "What’s happening", "Who to follow", "flux8-right-rail"]) requireText(rail, marker, "X-style discovery rail");

const home = read("src/app/(main)/home/page.tsx");
for (const marker of ["For you", "Following", "What is happening?", "flux8-story-card", "flux8-post-wrap"]) requireText(home, marker, "X-style Home timeline");

const styles = read("src/styles/flux-v8.css");
for (const marker of [
  "#1d9bf0",
  "--v8-nav-w: 275px",
  "--v8-feed: 600px",
  "--v8-rail: 350px",
  "grid-template-columns: var(--v8-nav-w) minmax(0, var(--v8-feed)) minmax(290px, var(--v8-rail))",
  "--v8-top-h: 56px",
  "--v8-canvas:",
  ".flux9-topbar",
  ".flux8-mobile-header-actions",
  "border-radius: 22px",
  ".flux8-sidebar",
  ".flux8-right-rail",
  ".flux8-mobile-header",
  ".flux8-mobile-nav",
  ".flux8-feed-tabs",
  ".flux8-composer-card",
  ".flux8-post-wrap",
]) requireText(styles, marker, "X-style Flux stylesheet");
forbidText(styles, "#7c3aed", "X-style Flux stylesheet");
forbidText(styles, 'button[class*="bg-primary"]', "X-style Flux stylesheet");

for (const marker of ["\n.dim {", '[data-accent="blue"]', '[data-accent="yellow"]', '[data-accent="pink"]', '[data-accent="purple"]', '[data-accent="orange"]', '[data-accent="green"]']) requireText(styles, marker, "X-style display settings");

const display = read("src/app/(main)/settings/display/page.tsx");
for (const marker of ["Colour", "Background", "Lights out", "Match my device"]) requireText(display, marker, "X-style display settings");

console.log("Flux X-style total redesign audit passed.");
