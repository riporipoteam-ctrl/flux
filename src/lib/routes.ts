import { assetUrl } from "@/lib/asset-url";

/** Accept a same-origin path for post-auth redirects; reject external URLs. */
export function safeInternalPath(value?: string | null): string | null {
  const candidate = value?.trim();
  if (!candidate || !candidate.startsWith("/") || candidate.startsWith("//") || candidate.includes("\\")) {
    return null;
  }
  try {
    const parsed = new URL(candidate, "https://flux.invalid");
    if (parsed.origin !== "https://flux.invalid") return null;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return null;
  }
}

function queryPath(path: string, key: string, value: string): string {
  const params = new URLSearchParams({ [key]: value });
  return `${path}?${params.toString()}`;
}

/** Static-export-safe profile route. */
export function profilePath(username?: string | null): string {
  const clean = username?.trim();
  return clean ? queryPath("/profile", "username", clean) : "/settings/profile";
}

/** Static-export-safe profile game-capture gallery route. */
export function profileGamesPath(username?: string | null): string {
  const clean = username?.trim();
  return clean ? queryPath("/profile/games", "username", clean) : "/profile/games";
}

/** Static-export-safe post detail route. */
export function postPath(postId: string): string {
  return queryPath("/post", "postId", postId);
}

/** Static-export-safe group detail route. */
export function groupPath(groupId: string): string {
  return queryPath("/group", "groupId", groupId);
}

/** Static-export-safe event detail route. */
export function eventPath(eventId: string): string {
  return queryPath("/event", "eventId", eventId);
}

/** Absolute URL that also preserves Flux's GitHub Pages base path. */
export function absoluteAppUrl(path: string): string {
  const scopedPath = assetUrl(path);
  if (typeof window === "undefined") return scopedPath;
  return new URL(scopedPath, window.location.origin).toString();
}

/** Active-state helper that understands static-export detail aliases. */
export function isNavPathActive(pathname: string, href: string): boolean {
  if (href === "/groups" && pathname.startsWith("/group")) return true;
  if (href === "/events" && pathname.startsWith("/event")) return true;
  return pathname === href || pathname.startsWith(`${href}/`);
}
