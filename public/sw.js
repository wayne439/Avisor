/* PilotAvisor shell — prefer fresh app code, keep assets offline-capable */
const CACHE = "avisor-shell-assets-v4";

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE).then(() => undefined));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k !== CACHE)
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;
  const path = url.pathname || "";
  const isHtmlLike =
    req.mode === "navigate" ||
    path.endsWith(".html") ||
    path.endsWith("/avisor") ||
    path.endsWith("/avisor.html");
  const isCodeLike =
    path.endsWith(".js") ||
    path.endsWith(".mjs") ||
    path.endsWith(".css") ||
    path.endsWith("/sw.js");

  // Network-first for app shell/code so users get latest updates.
  if (sameOrigin && (isHtmlLike || isCodeLike)) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res && res.status === 200 && res.type !== "opaque") {
            const copy = res.clone();
            caches.open(CACHE).then((cache) => cache.put(req, copy));
          }
          return res;
        })
        .catch(() => caches.match(req)),
    );
    return;
  }

  // Cache-first for static assets/tiles.
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req)
        .then((res) => {
          if (!res || res.status !== 200 || res.type === "opaque") return res;
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put(req, copy));
          return res;
        })
        .catch(() => cached);
    }),
  );
});
