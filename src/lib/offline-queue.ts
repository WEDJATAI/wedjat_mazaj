/**
 * Offline order queue — the phone → cloud side of the two-way sync.
 *
 * When a guest or employee places an order while offline (or the network
 * drops mid-request), the payload is saved in IndexedDB (chosen over
 * localStorage so the SERVICE WORKER can read it) and replayed:
 *
 *   1. Background Sync API (Android/desktop Chrome): the browser fires the
 *      SW "sync" event when connectivity returns — EVEN IF THE APP IS
 *      CLOSED. The worker replays the queue and messages open clients.
 *   2. Browsers without Background Sync (iOS Safari, Firefox): the page
 *      flushes on the "online" event, on visibility change, and on load.
 *
 * Server rejections retry a few times then give up (with a toast) so a
 * malformed payload can't block the queue forever. Network errors keep
 * the item — it will succeed when connectivity returns.
 *
 * The IndexedDB store (mazaj-sync / orders) is shared with sw.js —
 * the schema there must stay in sync with QueuedOrder here.
 */

export interface QueuedOrder {
  id: string;
  queuedAt: number;
  label: string;
  attempts: number;
  payload: Record<string, unknown>;
}

const DB_NAME = "mazaj-sync";
const STORE = "orders";
const LEGACY_KEY = "mazaj:offline-orders"; // pre-R53 localStorage queue
const MAX_ATTEMPTS = 5;

export const QUEUE_EVENT = "mazaj:queue-changed";
export const SYNCED_EVENT = "mazaj:orders-synced";
export const SYNC_TAG = "mazaj-sync-orders";

/* ------------------------------------------------------------------ */
/* IndexedDB helpers (promise-wrapped, dependency-free)                */
/* ------------------------------------------------------------------ */

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
  const db = await openDb();
  return new Promise<T>((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const req = fn(t.objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    t.oncomplete = () => db.close();
  });
}

function getAll(): Promise<QueuedOrder[]> {
  return tx<QueuedOrder[]>("readonly", (s) => s.getAll() as IDBRequest<QueuedOrder[]>);
}

function putItem(item: QueuedOrder): Promise<IDBValidKey> {
  return tx("readwrite", (s) => s.put(item));
}

function deleteItem(id: string): Promise<undefined> {
  return tx("readwrite", (s) => s.delete(id) as unknown as IDBRequest<undefined>);
}

/* ------------------------------------------------------------------ */
/* One-time migration from the R50 localStorage queue                  */
/* ------------------------------------------------------------------ */

let migrated = false;
async function migrateLegacy(): Promise<void> {
  if (migrated || typeof window === "undefined") return;
  migrated = true;
  try {
    const raw = window.localStorage.getItem(LEGACY_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as QueuedOrder[];
    if (!Array.isArray(parsed) || parsed.length === 0) {
      window.localStorage.removeItem(LEGACY_KEY);
      return;
    }
    const existing = await getAll();
    const known = new Set(existing.map((i) => i.id));
    for (const item of parsed) {
      if (!known.has(item.id)) await putItem(item);
    }
    window.localStorage.removeItem(LEGACY_KEY);
    notify(parsed.length);
  } catch {
    // non-fatal — legacy queue stays in localStorage, page flush can't
    // reach it anymore, but that only affects orders queued before this
    // version deployed (next app load after a sync would have replayed
    // them anyway)
  }
}

function notify(count?: number): void {
  if (typeof window === "undefined") return;
  if (count === undefined) {
    getAll()
      .then((items) =>
        window.dispatchEvent(
          new CustomEvent(QUEUE_EVENT, { detail: items.length })
        )
      )
      .catch(() => {});
  } else {
    window.dispatchEvent(new CustomEvent(QUEUE_EVENT, { detail: count }));
  }
}

/* ------------------------------------------------------------------ */
/* Public API                                                          */
/* ------------------------------------------------------------------ */

export async function getQueuedOrders(): Promise<QueuedOrder[]> {
  await migrateLegacy();
  return getAll().catch(() => [] as QueuedOrder[]);
}

export async function queuedCount(): Promise<number> {
  return (await getQueuedOrders()).length;
}

/**
 * Ask the browser to run the background sync tag. On browsers with the
 * Background Sync API (Chrome/Edge/Android) the service worker flushes
 * the queue — now or the moment connectivity returns, even if the app is
 * closed. Safe to call anywhere; no-ops without support.
 */
export async function registerBackgroundSync(): Promise<boolean> {
  try {
    if (!("serviceWorker" in navigator) || !("SyncManager" in window)) {
      return false;
    }
    const reg = (await navigator.serviceWorker.ready) as ServiceWorkerRegistration & {
      sync?: { register: (tag: string) => Promise<void> };
    };
    if (!reg?.sync) return false;
    await reg.sync.register(SYNC_TAG);
    return true;
  } catch {
    return false;
  }
}

/** Save an order payload for later replay. Returns the queued item. */
export async function queueOrder(
  payload: Record<string, unknown>,
  label: string
): Promise<QueuedOrder> {
  await migrateLegacy();
  const item: QueuedOrder = {
    id: `q_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    queuedAt: Date.now(),
    attempts: 0,
    label,
    payload,
  };
  await putItem(item);
  notify();
  // Let the OS-level background sync own the replay when supported; the
  // page-side flush (below) covers everyone else.
  void registerBackgroundSync();
  return item;
}

let flushing = false;

export interface FlushResult {
  synced: number;
  dropped: number;
  remaining: number;
  /** true when the replay was handed to the service worker instead */
  deferred?: boolean;
}

/**
 * Page-side replay — used on browsers WITHOUT Background Sync (iOS
 * Safari, Firefox). On browsers WITH it, the replay is deferred to the
 * service worker (registerBackgroundSync) so a queued order is POSTed
 * exactly once, never by both the page and the worker.
 *
 * Dev builds always use the page path so the flow stays testable in
 * the dev environment.
 */
export async function flushQueue(force = false): Promise<FlushResult> {
  const empty: FlushResult = { synced: 0, dropped: 0, remaining: 0 };
  if (typeof window === "undefined") return empty;

  const count = await queuedCount();
  if (count === 0) return empty;

  // Production: defer to the service worker when Background Sync exists.
  if (
    !force &&
    process.env.NODE_ENV === "production" &&
    "serviceWorker" in navigator &&
    "SyncManager" in window
  ) {
    const ok = await registerBackgroundSync();
    if (ok) return { ...empty, remaining: count, deferred: true };
  }

  if (!window.navigator.onLine) {
    return { ...empty, remaining: count };
  }
  if (flushing) return { ...empty, remaining: count };
  flushing = true;

  let synced = 0;
  let dropped = 0;

  try {
    while (true) {
      const items = await getAll();
      if (items.length === 0) break;
      const item = items[0];

      let res: Response;
      try {
        res = await fetch("/api/orders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(item.payload),
        });
      } catch {
        // network dropped mid-flush — keep everything for next time
        break;
      }

      if (res.ok) {
        await deleteItem(item.id).catch(() => {});
        synced += 1;
        notify();
      } else {
        // server rejected (validation / server error) — count the attempt
        const attempts = item.attempts + 1;
        if (attempts >= MAX_ATTEMPTS) {
          await deleteItem(item.id).catch(() => {});
          dropped += 1;
          notify();
        } else {
          await putItem({ ...item, attempts });
          notify();
          break; // stop the flush; retry later with backoff
        }
      }
    }
  } finally {
    flushing = false;
  }

  const remaining = await queuedCount();
  if (synced > 0) {
    window.dispatchEvent(new CustomEvent(SYNCED_EVENT, { detail: synced }));
  }
  return { synced, dropped, remaining };
}

/** Subscribe to queue-length changes. Returns an unsubscribe fn. */
export function subscribeQueue(cb: (count: number) => void): () => void {
  const handler = () => {
    queuedCount()
      .then(cb)
      .catch(() => cb(0));
  };
  window.addEventListener(QUEUE_EVENT, handler);
  window.addEventListener("storage", handler);
  handler(); // initial value
  return () => {
    window.removeEventListener(QUEUE_EVENT, handler);
    window.removeEventListener("storage", handler);
  };
}
