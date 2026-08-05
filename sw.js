/* Flux X2 service worker — always prefer the deployed release. */
const CACHE = "flux-shell-v4";
const SCOPE_PATH = new URL(self.registration.scope).pathname.replace(/\/$/, "");
const scoped = (path) => `${SCOPE_PATH}${path}`;
const PRECACHE = [scoped("/"), scoped("/manifest.webmanifest"), scoped("/favicon.ico"), scoped("/flux-icon.png")];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(PRECACHE).catch(() => undefined)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))));
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith(scoped("/api/"))) return;

  const isReleaseProof = /\/(version\.txt|release\.json)$/.test(url.pathname);
  event.respondWith(
    fetch(request, { cache: request.mode === "navigate" || isReleaseProof ? "no-store" : "default" })
      .then((response) => {
        if (response.ok && request.mode !== "navigate" && !isReleaseProof) {
          const copy = response.clone();
          void caches.open(CACHE).then((cache) => cache.put(request, copy)).catch(() => undefined);
        }
        return response;
      })
      .catch(async () => {
        const cached = await caches.match(request);
        if (cached) return cached;
        const shell = await caches.match(scoped("/"));
        return shell || Response.error();
      })
  );
});
