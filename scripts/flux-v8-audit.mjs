import { readFileSync } from "node:fs";

/**
 * Flux v11-to-X compatibility audit.
 * Validate the current shell and primary destinations rather than deleted
 * v8 navigation and the retired Rakazo bridge.
 */
const read = (path) => readFileSync(path, "utf8");
function requireText(source, marker, label) {
  if (!source.includes(marker)) throw new Error(`${label}: missing ${JSON.stringify(marker)}`);
}
function forbidText(source, marker, label) {
  if (source.includes(marker)) throw new Error(`${label}: forbidden legacy marker ${JSON.stringify(marker)}`);
}

const root = read("src/app/layout.tsx");
for (const marker of [
  "flux-v11.css", "flux-v11-deep.css", "flux-v11-posts.css",
  "flux-x.css", 'className="light"', "flux-theme-v2", "data-accent",
]) requireText(root, marker, "Root design system");
for (const legacy of [
  "flux-v8.css", "flux-v8-tokens.css", "flux-polish.css",
  "flux-x-ultimate.css", "flux-performance-x4.css", "flux-v10.css",
  "flux-aurora.css", "askai-v10.css",
]) forbidText(root, legacy, "Root design system");

const layout = read("src/app/(main)/layout.tsx");
for (const marker of [
  "xxshell", "xxmain-col", "Sidebar", "RightRail",
  "MobileNav", "MobileAppHeader", "RouteProgress",
]) requireText(layout, marker, "Current Flux social shell");

const sidebar = read("src/components/layout/sidebar.tsx");
for (const marker of [
  "Home", "Explore", "Notifications", "Messages",
  "Bookmarks", "Communities", "Profile", "More",
  "fluxDestinations", "flux-sidebar-post",
]) requireText(sidebar, marker, "Desktop social navigation");
const destinations = read("src/lib/flux-navigation.ts");
for (const marker of ["/ask-ai", "AskAI", "/premium", "Premium"])
  requireText(destinations, marker, "More menu destinations");

const mobileHeader = read("src/components/layout/mobile-app-header.tsx");
for (const marker of [
  "flux-mobile-header", "MobileDrawer", "flux-header-menu",
  "profilePath",
]) requireText(mobileHeader, marker, "Responsive app header");
const mobileDrawer = read("src/components/layout/mobile-drawer.tsx");
for (const marker of ["fluxDestinations", "visiblePaths", "flux-navigation-drawer", "flux-drawer-link"])
  requireText(mobileDrawer, marker, "Mobile drawer access");

const mobileNav = read("src/components/layout/mobile-nav.tsx");
for (const marker of [
  "/home", "/explore", "/notifications", "/messages", "profileHref",
  "flux-phone-link", "flux-mobile-compose-fab", "setComposeOpen",
]) requireText(mobileNav, marker, "Mobile X-style navigation");
forbidText(mobileNav, "Gamepad2", "Five-destination mobile navigation");

const styles = read("src/styles/flux-v11.css");
for (const marker of [
  "--flux-sidebar: 274px", "--flux-feed: 640px", "--flux-rail: 330px",
  ".flux8-mobile-header", ".flux8-mobile-nav",
  "@keyframes flux11-rise",
]) requireText(styles, marker, "Legacy compatibility tokens");

const x = read("src/styles/flux-x.css");
for (const marker of [
  ".xxshell", ".xxnav", ".xxmain-col", ".xxrail", ".xxpost",
  ".x-page", ".x-header", ".x-row", ".x-card", ".x-tab",
  "@media (max-width: 1023.98px)", "--xx-blue",
]) requireText(x, marker, "Current shared X styles");
const ui = read("src/components/x/x-ui.tsx");
for (const marker of [
  "export function XPage", "export function XHeader", "export function XTabs",
  "export function XCard", "export function XRow", "export function XEmpty",
  "useReducedMotion",
]) requireText(ui, marker, "Shared page components");

const posts = read("src/components/posts/post-card.tsx");
for (const marker of ["toggleLike", "toggleBookmark", "PostWithAuthor"])
  requireText(posts, marker, "Post UI");
const compose = read("src/components/posts/safe-compose-box.tsx");
for (const marker of ["createPost", "onSuccess", "assertContentAllowed"])
  requireText(compose, marker, "Post composer");

const route = read("src/app/(main)/ask-ai/page.tsx");
requireText(route, "AskAIGrok", "Current AI route");
const display = read("src/app/(main)/settings/display/page.tsx");
for (const marker of ["Colour", "Background", "Lights out", "Match my device"])
  requireText(display, marker, "Appearance settings");
console.log("Current X-style Flux shell, social controls, and theme compatibility audit passed.");
