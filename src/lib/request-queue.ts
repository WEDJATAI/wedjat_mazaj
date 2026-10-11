/**
 * r57 — Resilient service-request queue (Call shisha man / Coal request).
 *
 * Root cause that made "call & coal not work" in the field: the production
 * database went unreachable, so POST /api/requests returned 500 and the
 * guest just saw an error. A table calling for coal must NEVER depend on a
 * perfect cloud — so guest-originated service requests now follow the same
 * philosophy as the offline order queue:
 *
 *   1. Try to POST immediately.
 *   2. Network error / 5xx / offline → save to localStorage, tell the guest
 *      it's queued, and keep retrying (online event, app focus, 45s tick).
 *   3. 4xx validation errors are real errors — surfaced, never queued.
 *
 * The queue is intentionally localStorage (not IndexedDB): requests are
 * tiny, page-level replay is enough (a call/coal is time-critical but
 * re-delivered within seconds of reconnect), and it keeps this module
 * dependency-free.
 */

export interface QueuedServiceRequest {
  id: string;
  queuedAt: number;
  attempts: number;
  payload: {
    type: string; // call_shisha_man | coal_request | ...
    guestName?: string;
    table?: string;
    note?: string;
    branchId?: string | null;
  };
}

const KEY = "mazaj:queued-requests";
const MAX_AGE_MS = 30 * 60 * 1000; // drop stale requests after 30 minutes
export const REQUEST_QUEUE_EVENT = "mazaj:request-queue-changed";

function read(): QueuedServiceRequest[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const list = JSON.parse(raw) as QueuedServiceRequest[];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function write(list: QueuedServiceRequest[]) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    // private mode / quota — nothing else we can do
  }
  try {
    window.dispatchEvent(new CustomEvent(REQUEST_QUEUE_EVENT));
  } catch {
    // ignore
  }
}

export function queuedRequestCount(): number {
  return read().length;
}

export function subscribeRequestQueue(cb: (n: number) => void): () => void {
  const handler = () => cb(queuedRequestCount());
  window.addEventListener(REQUEST_QUEUE_EVENT, handler);
  window.addEventListener("storage", handler);
  return () => {
    window.removeEventListener(REQUEST_QUEUE_EVENT, handler);
    window.removeEventListener("storage", handler);
  };
}

export type SendResult = "sent" | "queued";

/**
 * POST a service request with automatic queueing. Never throws for
 * infrastructure problems — returns "queued" instead. Only throws for
 * client errors (4xx) the guest can actually fix.
 */
export async function sendServiceRequest(
  payload: QueuedServiceRequest["payload"]
): Promise<SendResult> {
  let res: Response;
  try {
    res = await fetch("/api/requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch {
    // network failure / offline → queue
    enqueue(payload);
    return "queued";
  }

  if (res.ok) {
    let ok = false;
    try {
      const data = await res.json();
      ok = !!data.ok;
    } catch {
      ok = false;
    }
    if (ok) return "sent";
    // server said not-ok with 200 — treat as server trouble, queue it
    enqueue(payload);
    return "queued";
  }

  if (res.status >= 500) {
    // the cloud is having a bad day (the exact production-DB scenario)
    enqueue(payload);
    return "queued";
  }

  // 4xx — a real validation error; surface it
  let message = "Could not send request";
  try {
    const data = await res.json();
    if (data?.error) message = data.error;
  } catch {
    // ignore
  }
  throw new Error(message);
}

function enqueue(payload: QueuedServiceRequest["payload"]) {
  const list = read();
  list.push({
    id: `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    queuedAt: Date.now(),
    attempts: 0,
    payload,
  });
  write(list);
}

/**
 * Replay everything queued. Requests older than MAX_AGE_MS are dropped
 * (nobody wants a coal delivery from 40 minutes ago). Returns the number
 * successfully delivered.
 */
export async function flushRequestQueue(): Promise<number> {
  if (typeof window === "undefined") return 0;
  if (!navigator.onLine) return 0;
  const list = read();
  if (list.length === 0) return 0;

  const now = Date.now();
  const remaining: QueuedServiceRequest[] = [];
  let delivered = 0;

  for (const item of list) {
    if (now - item.queuedAt > MAX_AGE_MS) continue; // expired — drop
    try {
      const res = await fetch("/api/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(item.payload),
      });
      if (res.ok) {
        delivered++;
      } else if (res.status >= 500 || res.status === 0) {
        item.attempts += 1;
        remaining.push(item);
      }
      // 4xx → drop (invalid payload, retrying forever helps nobody)
    } catch {
      item.attempts += 1;
      remaining.push(item);
    }
  }

  write(remaining);
  return delivered;
}
