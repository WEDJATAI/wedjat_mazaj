/* Mazaj service worker — full PWA with two-way sync support.
 *
 * Strategies:
 *  - Navigations (HTML): network-first → cached shell → offline page.
 *    Keeps the app openable offline once visited.
 *  - GET /api/*: network-first with cache fallback → the installed app
 *    shows the last known orders/menu/inventory when offline and always
 *    pulls fresh data when online (two-way sync read side).
 *  - Static assets (/_next/static, icons, images, fonts): cache-first.
 *  - Non-GET (orders, ratings, status changes) are NEVER intercepted —
 *    they go straight to the network; offline writes are queued
 *    client-side by the offline-queue module and replayed on reconnect.
 *
 * Registration is done with ?mode=dev in development: in dev mode the
 * worker registers (so installability & UI can be tested) but passes
 * every fetch through untouched, keeping Turbopack HMR 100% safe.
 */

const VERSION = "mazaj-v1";
const STATIC_CACHE = `${VERSION}-static`;
const API_CACHE = `${VERSION}-api`;
const SHELL_URL = "/";

const DEV = new URLSearchParams(self.location.search).get("mode") === "dev";

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      try {
        const cache = await caches.open(STATIC_CACHE);
        await cache.addAll([
          SHELL_URL,
          "/offline.html",
          "/manifest.webmanifest",
          "/icons/icon-192.png",
          "/icons/icon-512.png",
          "/icons/maskable-192.png",
          "/icons/maskable-512.png",
          "/icons/apple-touch-icon.png",
        ]);
      } catch (e) {
        // non-fatal — runtime caching will fill in as the user browses
      }
      await self.skipWaiting();
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => !k.startsWith(VERSION))
          .map((k) => caches.delete(k))
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  if (DEV) return; // pass-through in development

  const req = event.request;
  if (req.method !== "GET") return; // never intercept writes

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  // internal dev/introspection paths (sourcemaps, HMR, next internals)
  if (
    url.pathname.startsWith("/_next/webpack") ||
    url.pathname.includes("hmr") ||
    url.pathname.endsWith(".map")
  ) {
    return;
  }

  if (url.pathname.startsWith("/api/")) {
    if (url.pathname.startsWith("/api/inngest")) return;
    event.respondWith(networkFirstApi(req));
    return;
  }

  if (req.mode === "navigate") {
    event.respondWith(navigationHandler(req));
    return;
  }

  if (
    url.pathname.startsWith("/_next/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname.startsWith("/images/") ||
    url.pathname === "/logo.svg" ||
    url.pathname === "/manifest.webmanifest" ||
    url.pathname.endsWith(".woff2") ||
    url.pathname.endsWith(".png") ||
    url.pathname.endsWith(".jpg") ||
    url.pathname.endsWith(".svg")
  ) {
    event.respondWith(cacheFirst(req));
  }
});

/** APIs: fresh when online, last-known when offline. */
async function networkFirstApi(req) {
  const cache = await caches.open(API_CACHE);
  try {
    const res = await fetch(req);
    if (res && res.ok) {
      cache.put(req, res.clone());
    }
    return res;
  } catch (err) {
    const cached = await cache.match(req, { ignoreSearch: false });
    if (cached) return cached;
    return new Response(
      JSON.stringify({ ok: false, offline: true, error: "You are offline" }),
      { status: 503, headers: { "Content-Type": "application/json" } }
    );
  }
}

/** HTML navigations: network-first, cached shell when offline. */
async function navigationHandler(req) {
  const cache = await caches.open(STATIC_CACHE);
  try {
    const res = await fetch(req);
    if (res && res.ok) {
      cache.put(SHELL_URL, res.clone());
    }
    return res;
  } catch (err) {
    const cached = await cache.match(SHELL_URL);
    if (cached) return cached;
    const offline = await caches.match("/offline.html");
    return (
      offline ||
      new Response("Mazaj is offline — reconnect to sync.", {
        status: 503,
        headers: { "Content-Type": "text/plain" },
      })
    );
  }
}

/** Immutable static assets. */
async function cacheFirst(req) {
  const cache = await caches.open(STATIC_CACHE);
  const cached = await cache.match(req);
  if (cached) return cached;
  try {
    const res = await fetch(req);
    if (res && res.ok && res.type === "basic") {
      cache.put(req, res.clone());
    }
    return res;
  } catch (err) {
    return new Response("", { status: 504 });
  }
}
