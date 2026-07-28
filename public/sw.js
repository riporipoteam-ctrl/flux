/* Flux PWA service worker — cache shell for faster launch on phone */
const CACHE = "flux-shell-v2";
const SCOPE_PATH = new URL(self.registration.scope).pathname.replace(/\/$/, "");
const scoped = (path) => `${SCOPE_PATH}${path}`;
const PRECACHE = [
  scoped("/"),
  scoped("/manifest.webmanifest"),
  scoped("/favicon.ico"),
  scoped("/flux-icon.png"),
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(PRECACHE).catch(() => undefined))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  // Network-first for API / Firebase; cache-first for same-origin static
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith(scoped("/api/"))) return;

  event.respondWith(
    fetch(req)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => undefined);
        return res;
      })
      .catch(() => caches.match(req).then((r) => r || caches.match(scoped("/"))))
  );
});
