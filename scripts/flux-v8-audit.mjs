import { readFileSync } from "node:fs";

function read(path) { return readFileSync(path, "utf8"); }
function requireText(source, marker, label) {
  if (!source.includes(marker)) throw new Error(`${label}: missing ${JSON.stringify(marker)}`);
}
function forbidText(source, marker, label) {
  if (source.includes(marker)) throw new Error(`${label}: forbidden legacy marker ${JSON.stringify(marker)}`);
}

const root = read("src/app/layout.tsx");
for (const marker of ["flux-v11.css", "askai-v11.css", "flux-v11-deep.css", "flux-v11-posts.css", "askai-v11-deep.css"]) requireText(root, marker, "Root v11 design system");
requireText(root, 'className="light"', "Light-first design system");
requireText(root, "flux-theme-v2", "Theme boot script");
requireText(root, 'data-accent', "Accent boot script");
for (const legacy of ["flux-v8.css", "flux-v8-tokens.css", "flux-polish.css", "flux-x-ultimate.css", "flux-performance-x4.css", "flux-v10.css", "flux-aurora.css", "askai-v10.css", "maus-agents-v10.css"]) forbidText(root, legacy, "Root design system");

const layout = read("src/app/(main)/layout.tsx");
for (const marker of ["flux8-app-shell", "flux8-main-column", "Sidebar", "RightRail", "MobileNav", "TopBar", "RouteProgress"]) requireText(layout, marker, "Flux shell");

const topBar = read("src/components/layout/top-bar.tsx");
for (const marker of ["flux9-topbar-search", "flux9-topbar-tabs", "flux9-topbar-actions", "flux9-topbar-avatar"]) requireText(topBar, marker, "Flux top bar");

const sidebar = read("src/components/layout/sidebar.tsx");
for (const marker of ["Home", "Explore", "Notifications", "Messages", "AskAI", "Bookmarks", "Communities", "Premium", "Profile", "More", "flux8-sidebar-create"]) requireText(sidebar, marker, "Desktop navigation");

const mobileHeader = read("src/components/layout/mobile-app-header.tsx");
for (const marker of ["flux8-mobile-header", "MobileDrawer", "Search", "flux8-mobile-header-actions"]) requireText(mobileHeader, marker, "Mobile header");

const mobileDrawer = read("src/components/layout/mobile-drawer.tsx");
for (const marker of ["/ask-ai", "/notifications", "/messages"]) requireText(mobileDrawer, marker, "Mobile drawer access");

const mobileNav = read("src/components/layout/mobile-nav.tsx");
for (const marker of ["/home", "/explore", "#compose", "/ask-ai", "profileHref", "flux8-mobile-tab-create"]) requireText(mobileNav, marker, "Thumb-first mobile navigation");
forbidText(mobileNav, "Gamepad2", "Five-action mobile dock");

const styles = read("src/styles/flux-v11.css");
for (const marker of ["--flux-sidebar: 274px", "--flux-feed: 640px", "--flux-rail: 330px", "--flux-topbar: 68px", ".flux8-sidebar", ".flux9-topbar", ".flux8-mobile-header", ".flux8-mobile-nav", "@keyframes flux11-rise", "@media (max-width: 639px)"]) requireText(styles, marker, "Flux v11 stylesheet");
forbidText(styles, "#7c3aed", "Flux v11 stylesheet");

const deep = read("src/styles/flux-v11-deep.css");
for (const marker of [".flux8-feed-tabs", ".flux8-composer-card", ".flux8-story-card", ".flux8-right-rail", ".flux8-mobile-nav", ".flux8-premium-card", ".flux8-post-skeleton", "@media (max-width: 639px)"]) requireText(deep, marker, "Flux deep component polish");
const posts = read("src/styles/flux-v11-posts.css");
for (const marker of [".post-row", ".flux-action-pending", ".like-burst", "@media (max-width:639px)"]) requireText(posts, marker, "Post surface polish");

const askai = read("src/components/ask-ai/rakazo-official-app.tsx");
for (const marker of ["GrokPanel", "askai-v11-shell", "ASK_AI_ENDPOINT", "/flux/rakazo/", "<iframe"]) requireText(askai, marker, "AskAI v11 shell");

const grok = read("src/components/ask-ai/grok-panel.tsx");
for (const marker of ["/v1/grok/chat/completions", "Community bridge", "sessionStorage", "HISTORY_KEY", "grok-4.20-auto", "2noScript/unofficial-api", "copyMessage", "newChat"]) requireText(grok, marker, "Community Grok integration");
forbidText(grok, "document.cookie", "Community Grok integration");

const askaiDeep = read("src/styles/askai-v11-deep.css");
for (const marker of [".askai-v11-message", ".askai-v11-message-copy", ".askai-v11-icon-button", "@media (max-width:639px)"]) requireText(askaiDeep, marker, "AskAI deep polish");

const display = read("src/app/(main)/settings/display/page.tsx");
for (const marker of ["Colour", "Background", "Lights out", "Match my device"]) requireText(display, marker, "Display settings");

console.log("Flux v11 deep design audit passed.");
