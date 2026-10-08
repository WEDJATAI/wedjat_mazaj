"use client";

import * as React from "react";

/**
 * R49 smart alerts — keeps the counter tablet/phone watching for:
 *  - new orders (pending / unassigned)
 *  - new guest service requests (pending)
 *
 * On first load it just records the current state (no alert storm), then
 * any NEW item after that triggers:
 *  - a two-tone chime (WebAudio — no asset needed)
 *  - a toast (returned via callback so the caller can render it)
 *  - a browser Notification (if permission was granted)
 *
 * Returns live counts for badges + a mute toggle.
 */

const POLL_MS = 20000;
const STORAGE_KEY = "mazaj-alerts-muted";

type AlertsState = {
  /** orders currently pending/unassigned */
  pendingOrders: number;
  /** requests currently pending */
  pendingRequests: number;
  /** unseen alerts since last acknowledge (for the tab badge) */
  unseen: number;
  muted: boolean;
  toggleMuted: () => void;
  acknowledge: () => void;
};

export function useSmartAlerts(opts?: { enabled?: boolean }): AlertsState {
  const enabled = opts?.enabled ?? true;
  const seenOrderIds = React.useRef<Set<string> | null>(null);
  const seenRequestIds = React.useRef<Set<string> | null>(null);
  const [pendingOrders, setPendingOrders] = React.useState(0);
  const [pendingRequests, setPendingRequests] = React.useState(0);
  const [unseen, setUnseen] = React.useState(0);
  const [muted, setMuted] = React.useState(false);

  // restore mute preference
  React.useEffect(() => {
    setMuted(localStorage.getItem(STORAGE_KEY) === "1");
  }, []);

  const toggleMuted = React.useCallback(() => {
    setMuted((m) => {
      const next = !m;
      localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      return next;
    });
  }, []);

  const acknowledge = React.useCallback(() => setUnseen(0), []);

  const chime = React.useCallback((kind: "order" | "request") => {
    try {
      const Ctx =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!Ctx) return;
      const ctx = new Ctx();
      // two-tone bell: order = rising (E5→A5), request = falling (A5→E5)
      const notes =
        kind === "order" ? [659.25, 880.0] : [880.0, 659.25];
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = freq;
        const t0 = ctx.currentTime + i * 0.18;
        gain.gain.setValueAtTime(0.0001, t0);
        gain.gain.exponentialRampToValueAtTime(0.18, t0 + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.5);
        osc.connect(gain).connect(ctx.destination);
        osc.start(t0);
        osc.stop(t0 + 0.55);
      });
      // auto-close the context after the chime
      setTimeout(() => ctx.close().catch(() => {}), 1400);
    } catch {
      // audio not available — silent fallback
    }
  }, []);

  const notify = React.useCallback((title: string, body: string) => {
    try {
      if (
        typeof Notification !== "undefined" &&
        Notification.permission === "granted"
      ) {
        new Notification(title, { body, icon: "/logo.svg" });
      }
    } catch {
      // notifications not available
    }
  }, []);

  const load = React.useCallback(async () => {
    if (typeof document !== "undefined" && document.hidden) return; // skip hidden tabs
    try {
      const [ordersRes, reqRes] = await Promise.all([
        fetch("/api/orders").then((r) => r.json()).catch(() => null),
        fetch("/api/requests").then((r) => r.json()).catch(() => null),
      ]);

      let newOrderAlerts = 0;
      let newRequestAlerts = 0;

      if (ordersRes?.ok) {
        const allOrders = ordersRes.orders as {
          id: string;
          status: string;
          customerName: string | null;
          itemCount: number;
          table: string | null;
        }[];
        const active = allOrders.filter((o) => o.status !== "done");
        const ids = new Set<string>(allOrders.map((o) => o.id));
        if (seenOrderIds.current === null) {
          // first load — record without alerting
          seenOrderIds.current = ids;
        } else {
          for (const o of allOrders) {
            if (!seenOrderIds.current.has(o.id)) {
              seenOrderIds.current.add(o.id);
              newOrderAlerts++;
            }
          }
        }
        setPendingOrders(active.length);
      }

      if (reqRes?.ok) {
        const allRequests = reqRes.requests as {
          id: string;
          status: string;
        }[];
        const pending = allRequests.filter((r) => r.status === "pending");
        const ids = new Set<string>(allRequests.map((r) => r.id));
        if (seenRequestIds.current === null) {
          seenRequestIds.current = ids;
        } else {
          for (const r of allRequests) {
            if (!seenRequestIds.current.has(r.id)) {
              seenRequestIds.current.add(r.id);
              newRequestAlerts++;
            }
          }
        }
        setPendingRequests(pending.length);
      }

      if (newOrderAlerts > 0) {
        if (!muted) chime("order");
        notify(
          "🔥 New order received",
          `${newOrderAlerts} new order${newOrderAlerts > 1 ? "s" : ""} in the queue`
        );
        setUnseen((u) => u + newOrderAlerts);
      }
      if (newRequestAlerts > 0) {
        if (!muted) chime("request");
        notify(
          "🔔 Guest needs you",
          `${newRequestAlerts} new service request${newRequestAlerts > 1 ? "s" : ""}`
        );
        setUnseen((u) => u + newRequestAlerts);
      }
    } catch {
      // silent — next poll retries
    }
  }, [chime, muted, notify]);

  React.useEffect(() => {
    if (!enabled) return;
    load();
    const id = setInterval(load, POLL_MS);
    return () => clearInterval(id);
  }, [enabled, load]);

  return {
    pendingOrders,
    pendingRequests,
    unseen,
    muted,
    toggleMuted,
    acknowledge,
  };
}

/** Ask for Notification permission on first user interaction (best effort). */
export function primeNotifications() {
  try {
    if (
      typeof Notification !== "undefined" &&
      Notification.permission === "default"
    ) {
      Notification.requestPermission().catch(() => {});
    }
  } catch {
    // ignore
  }
}
