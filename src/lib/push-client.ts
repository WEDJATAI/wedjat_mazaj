/**
 * Client-side web push — subscribe the installed app / browser to
 * order-status notifications from the lounge cloud.
 *
 * Subscriptions are registered per guest name (the same name used to
 * check in, order and track) so the cloud can route "your hookah is
 * being prepared 🔥" pushes to the right phone.
 */

import { detectPlatform } from "@/store/pwa";

const GUEST_KEY = "mazaj:push:guest";

export interface PushCapable {
  supported: boolean;
}

export function pushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const buffer = new ArrayBuffer(raw.length);
  const out = new Uint8Array(buffer);
  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i);
  return out;
}

async function getVapidKey(): Promise<string | null> {
  try {
    const res = await fetch("/api/push/key");
    const data = await res.json();
    return data.ok && typeof data.key === "string" ? data.key : null;
  } catch {
    return null;
  }
}

async function saveSubscription(
  subscription: PushSubscription,
  guestName: string
): Promise<boolean> {
  try {
    const platform = detectPlatform();
    const res = await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        subscription: subscription.toJSON(),
        guestName,
        platform: platform === "ios" || platform === "android" ? platform : "web",
      }),
    });
    const data = await res.json();
    return Boolean(data.ok);
  } catch {
    return false;
  }
}

/**
 * Subscribe this device to push for a guest. Returns:
 *  - "ok"        — subscribed & saved to the cloud
 *  - "denied"    — the user declined the notification permission
 *  - "unsupported" — browser can't do web push (e.g. iOS in a Safari tab;
 *                    iOS requires the installed home-screen app)
 *  - "error"     — something else went wrong
 */
export async function subscribeToPush(
  guestName: string
): Promise<"ok" | "denied" | "unsupported" | "error"> {
  if (!pushSupported()) return "unsupported";
  if (Notification.permission === "denied") return "denied";

  try {
    if (Notification.permission !== "granted") {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") return "denied";
    }

    const key = await getVapidKey();
    if (!key) return "error";

    const reg = await navigator.serviceWorker.ready;
    let sub: PushSubscription | null = null;
    try {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(key),
      });
    } catch (err) {
      // iOS Safari (not installed to home screen) & some contexts throw
      const name = (err as { name?: string }).name ?? "";
      if (
        name === "AbortError" ||
        name === "NotAllowedError" ||
        name === "TypeError"
      ) {
        return "unsupported";
      }
      return "error";
    }

    const saved = await saveSubscription(sub, guestName);
    if (!saved) return "error";

    try {
      window.localStorage.setItem(GUEST_KEY, guestName);
    } catch {
      // non-fatal
    }
    return "ok";
  } catch {
    return "error";
  }
}

/** Remove this device's subscription (cloud + browser). */
export async function unsubscribeFromPush(): Promise<void> {
  if (!pushSupported()) return;
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subscription: sub.toJSON(),
          unsubscribe: true,
        }),
      }).catch(() => {});
      await sub.unsubscribe().catch(() => {});
    }
    window.localStorage.removeItem(GUEST_KEY);
  } catch {
    // best effort
  }
}

/** Is this device currently subscribed (browser-side)? */
export async function isSubscribed(): Promise<boolean> {
  if (!pushSupported()) return false;
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    return Boolean(sub);
  } catch {
    return false;
  }
}

/**
 * Refresh the saved subscription after the push service rotated it
 * (pushsubscriptionchange) — re-POSTs with the remembered guest name.
 */
export async function refreshSubscriptionAfterChange(): Promise<void> {
  if (!pushSupported()) return;
  try {
    const guestName = window.localStorage.getItem(GUEST_KEY);
    if (!guestName) return;
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) await saveSubscription(sub, guestName);
  } catch {
    // best effort
  }
}

/**
 * Best-effort auto-save: if the user already granted notifications and is
 * subscribed on this device, re-register the subscription under the given
 * guest name (covers a guest ordering under a new name). Never prompts.
 */
export async function attachGuestIfSubscribed(guestName: string): Promise<void> {
  if (!pushSupported() || Notification.permission !== "granted") return;
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      await saveSubscription(sub, guestName);
      try {
        window.localStorage.setItem(GUEST_KEY, guestName);
      } catch {
        // ignore
      }
    }
  } catch {
    // best effort
  }
}

/** tiny helper for UI: notification permission without prompting */
export function permissionState(): NotificationPermission | "unsupported" {
  if (!pushSupported()) return "unsupported";
  return Notification.permission;
}
