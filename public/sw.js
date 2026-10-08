/* Mazaj service worker v2 — production PWA engine.
 *
 * Fetch strategies:
 *  - Navigations (HTML): network-first → cached shell → offline page.
 *    Keeps the app openable offline once visited.
 *  - GET /api/*: network-first with cache fallback → the installed app
 *    shows the last known orders/menu/inventory when offline and always
 *    pulls fresh data when online (two-way sync read side).
 *  - Static assets (/_next/static, icons, images, fonts): cache-first.
 *  - Non-GET (orders, ratings, status changes) are NEVER intercepted —
 *    they go straight to the network; offline writes are queued in
 *    IndexedDB by the offline-queue module and replayed below.
 *
 * Production app services:
 *  - BACKGROUND SYNC ("mazaj-sync-orders"): queued offline orders are
 *    replayed by the worker when connectivity returns — even when the
 *    app is closed. Open clients get a "synced" message for the green chip.
 *  - PERIODIC SYNC ("mazaj-refresh", installed apps): re-caches the core
 *    API data (menu, orders, supplies) a few times a day so the offline
 *    app opens with reasonably fresh data.
 *  - WEB PUSH: order-status pushes from the lounge cloud show a
 *    notification; tapping it opens the live tracking view (?track=<id>).
 *  - PRE-CACHE: on install/activate the core APIs are fetched once so
 *    the app works offline from the very first offline session.
 *
 * Registration is done with ?mode=dev in development: in dev mode the
 * worker registers (so installability & UI can be tested) but passes
 * every fetch through untouched, keeping Turbopack HMR 100% safe.
 * Sync/push handlers still run in dev (they only touch IndexedDB and
 * the network, never HMR sockets).
 */

const VERSION = "mazaj-v2";
const STATIC_CACHE = `${VERSION}-static`;
const API_CACHE = `${VERSION}-api`;
const SHELL_URL = "/";
const SYNC_TAG = "mazaj-sync-orders";
const REFRESH_TAG = "mazaj-refresh";
const IDB_NAME = "mazaj-sync";
const IDB_STORE = "orders";
const MAX_ATTEMPTS = 5;

/** Core APIs pre-cached for offline-from-first-run (same list the app
 * loads on the menu/queue screens — keep in sync with the panels).
 * NOTE: URLs must EXACTLY match what the app fetches (query strings
 * included in cache keys). */
const CORE_APIS = [
  "/api/inventory",
  "/api/orders",
  "/api/flavor-stock",
  "/api/supplies",
];

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
      try {
        await precacheApis();
      } catch (e) {
        // non-fatal — first online visit fills the API cache
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
      // periodic refresh for installed apps (silently unsupported elsewhere)
      try {
        if ("periodicSync" in self.registration) {
          const status =
            await self.registration.periodicSync.getPermissionState?.();
          const tags = await self.registration.periodicSync.getTags?.();
          if ((status === "granted" || status === undefined) && !(tags || []).includes(REFRESH_TAG)) {
            await self.registration.periodicSync.register(REFRESH_TAG, {
              minInterval: 6 * 60 * 60 * 1000, // ~4×/day
            });
          }
        }
      } catch (e) {
        // not supported / not allowed — runtime caching still covers it
      }
    })()
  );
});

self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
  if (event.data === "FLUSH_NOW") event.waitUntil(replayQueue(true));
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

/* ------------------------------------------------------------------ */
/* Background sync — replay queued offline orders (phone → cloud)      */
/* ------------------------------------------------------------------ */

self.addEventListener("sync", (event) => {
  if (event.tag !== SYNC_TAG) return;
  event.waitUntil(replayQueue(false));
});

self.addEventListener("periodicsync", (event) => {
  if (event.tag !== REFRESH_TAG) return;
  event.waitUntil(precacheApis());
});

/** IndexedDB queue access (mirrors src/lib/offline-queue.ts). */
function openQueueDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function queueOp(mode, fn) {
  const db = await openQueueDb();
  return new Promise((resolve, reject) => {
    const t = db.transaction(IDB_STORE, mode);
    const req = fn(t.objectStore(IDB_STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    t.oncomplete = () => db.close();
  });
}

async function replayQueue(fromClient) {
  let synced = 0;
  let dropped = 0;
  try {
    while (true) {
      const items = await queueOp("readonly", (s) => s.getAll());
      if (!items || items.length === 0) break;
      const item = items[0];

      let res;
      try {
        res = await fetch("/api/orders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(item.payload),
        });
      } catch (err) {
        // still offline — the browser re-fires the sync tag later
        break;
      }

      if (res.ok) {
        await queueOp("readwrite", (s) => s.delete(item.id));
        synced += 1;
      } else {
        const attempts = item.attempts + 1;
        if (attempts >= MAX_ATTEMPTS) {
          await queueOp("readwrite", (s) => s.delete(item.id));
          dropped += 1;
        } else {
          await queueOp("readwrite", (s) =>
            s.put({ ...item, attempts })
          );
          break; // retry later — don't hammer a rejecting server
        }
      }
    }
  } catch (e) {
    // never crash the sync event
  }

  if (synced > 0 || dropped > 0 || fromClient) {
    const remainingItems = await queueOp("readonly", (s) => s.getAll()).catch(
      () => []
    );
    const remaining = remainingItems ? remainingItems.length : 0;
    const clients = await self.clients.matchAll({ type: "window" });
    for (const client of clients) {
      client.postMessage({
        type: "ORDERS_SYNCED",
        synced,
        dropped,
        remaining,
      });
    }
  }
  return { synced, dropped };
}

/** Fetch the core APIs into the cache (offline-first data). */
async function precacheApis() {
  const cache = await caches.open(API_CACHE);
  await Promise.all(
    CORE_APIS.map(async (url) => {
      try {
        const res = await fetch(url);
        if (res && res.ok) cache.put(url, res.clone());
      } catch (e) {
        // offline right now — keep whatever is cached
      }
    })
  );
}

/* ------------------------------------------------------------------ */
/* Web push — order status notifications (cloud → phone)               */
/* ------------------------------------------------------------------ */

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { title: "Mazaj", body: event.data ? event.data.text() : "" };
  }
  const title = data.title || "Mazaj";
  const options = {
    body: data.body || "",
    tag: data.tag || "mazaj",
    icon: "/icons/icon-192.png",
    badge: "/icons/favicon-64.png",
    data: { url: data.url || "/?source=pwa" },
    vibrate: [80, 40, 80],
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    (async () => {
      const clients = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      // focus an open app window and navigate it to the tracking view
      for (const client of clients) {
        if ("focus" in client) {
          client.focus();
          if ("navigate" in client) {
            try {
              await client.navigate(url);
            } catch (e) {
              // navigate may be restricted — focus is still useful
            }
          }
          return;
        }
      }
      // no open window — open the app
      await self.clients.openWindow(url);
    })()
  );
});

/** The push service rotated the subscription — re-subscribe and tell the
 *  server (the page re-POSTs /api/push/subscribe with the guest name it
 *  remembered in localStorage). */
self.addEventListener("pushsubscriptionchange", (event) => {
  event.waitUntil(
    (async () => {
      try {
        const reg = await self.registration.pushManager.getSubscription();
        const clients = await self.clients.matchAll({ type: "window" });
        for (const client of clients) {
          client.postMessage({
            type: "PUSH_SUBSCRIPTION_CHANGE",
            endpoint: reg ? reg.endpoint : null,
          });
        }
      } catch (e) {
        // nothing we can do without a page
      }
    })()
  );
});

/* ------------------------------------------------------------------ */
/* Fetch helpers                                                       */
/* ------------------------------------------------------------------ */

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
