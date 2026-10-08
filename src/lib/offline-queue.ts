/**
 * Offline order queue — the write side of the two-way sync.
 *
 * When a guest or employee places an order while offline (or the network
 * drops mid-request), the payload is saved locally instead of lost.
 * The queue replays automatically:
 *   - on the browser "online" event,
 *   - when the app becomes visible again while online,
 *   - and once on every app load.
 *
 * Server rejections retry a few times then give up (with a toast) so a
 * malformed payload can't block the queue forever. Network errors keep
 * the item — it will succeed when connectivity returns.
 */

export interface QueuedOrder {
  id: string;
  queuedAt: number;
  label: string;
  attempts: number;
  payload: Record<string, unknown>;
}

const KEY = "mazaj:offline-orders";
const MAX_ATTEMPTS = 5;

export const QUEUE_EVENT = "mazaj:queue-changed";
export const SYNCED_EVENT = "mazaj:orders-synced";

function read(): QueuedOrder[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as QueuedOrder[]) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function write(items: QueuedOrder[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(items));
  } catch {
    // storage full — nothing we can do
  }
  window.dispatchEvent(new CustomEvent(QUEUE_EVENT, { detail: items.length }));
}

export function getQueuedOrders(): QueuedOrder[] {
  return read();
}

export function queuedCount(): number {
  return read().length;
}

/** Save an order payload for later replay. Returns the queued item. */
export function queueOrder(
  payload: Record<string, unknown>,
  label: string
): QueuedOrder {
  const item: QueuedOrder = {
    id: `q_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    queuedAt: Date.now(),
    attempts: 0,
    label,
    payload,
  };
  write([...read(), item]);
  return item;
}

let flushing = false;

export interface FlushResult {
  synced: number;
  dropped: number;
  remaining: number;
}

/**
 * Replay every queued order to the live platform. Safe to call often —
 * concurrent calls coalesce. Returns how many synced / were dropped.
 */
export async function flushQueue(): Promise<FlushResult> {
  const empty: FlushResult = { synced: 0, dropped: 0, remaining: 0 };
  if (typeof window === "undefined") return empty;
  if (!window.navigator.onLine) {
    return { ...empty, remaining: queuedCount() };
  }
  if (flushing) return { ...empty, remaining: queuedCount() };
  flushing = true;

  let synced = 0;
  let dropped = 0;

  try {
    // Work on a copy; re-read before each removal to stay consistent.
    while (true) {
      const items = read();
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
        const idx = read().findIndex((i) => i.id === item.id);
        if (idx >= 0) {
          const next = read();
          next.splice(idx, 1);
          write(next);
        }
        synced += 1;
      } else {
        // server rejected (validation / server error) — count the attempt
        const next = read();
        const idx = next.findIndex((i) => i.id === item.id);
        if (idx >= 0) {
          next[idx] = { ...next[idx], attempts: next[idx].attempts + 1 };
          if (next[idx].attempts >= MAX_ATTEMPTS) {
            next.splice(idx, 1);
            dropped += 1;
          } else {
            write(next);
            break; // stop the flush; retry later with backoff
          }
        }
      }
    }
  } finally {
    flushing = false;
  }

  const remaining = queuedCount();
  if (synced > 0) {
    window.dispatchEvent(new CustomEvent(SYNCED_EVENT, { detail: synced }));
  }
  return { synced, dropped, remaining };
}

/** Subscribe to queue-length changes. Returns an unsubscribe fn. */
export function subscribeQueue(cb: (count: number) => void): () => void {
  const handler = () => cb(queuedCount());
  window.addEventListener(QUEUE_EVENT, handler);
  window.addEventListener("storage", handler);
  return () => {
    window.removeEventListener(QUEUE_EVENT, handler);
    window.removeEventListener("storage", handler);
  };
}
