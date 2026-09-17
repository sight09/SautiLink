/* SautiLink service worker — offline shell + low-bandwidth caching. */
const VERSION = "sautilink-v1";
const SHELL = ["/", "/report", "/cases", "/assistant", "/track", "/settings", "/offline", "/manifest.webmanifest", "/icons/icon.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(VERSION).then((cache) => cache.addAll(SHELL).catch(() => undefined)).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== VERSION).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // API: network-first, never served stale from cache (avoids showing
  // cached data as if it were server-confirmed).
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(
      fetch(request).catch(
        () =>
          new Response(JSON.stringify({ error: "offline", offline: true }), {
            status: 503,
            headers: { "content-type": "application/json" },
          }),
      ),
    );
    return;
  }

  // Navigations: network-first with offline shell fallback.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(VERSION).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(async () => (await caches.match(request)) || (await caches.match("/offline")) || Response.error()),
    );
    return;
  }

  // Static assets: cache-first.
  event.respondWith(
    caches.match(request).then(
      (cached) =>
        cached ||
        fetch(request).then((response) => {
          const copy = response.clone();
          caches.open(VERSION).then((cache) => cache.put(request, copy));
          return response;
        }),
    ),
  );
});

self.addEventListener("sync", (event) => {
  if (event.tag === "sautilink-sync") {
    event.waitUntil(
      self.clients.matchAll().then((clients) => clients.forEach((client) => client.postMessage({ type: "sync-queue" }))),
    );
  }
});
