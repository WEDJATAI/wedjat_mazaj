import webpush from "web-push";
import { db } from "@/lib/db";

/**
 * Web push — the cloud → phone side of the two-way sync.
 *
 * Guests subscribe from the installed app (or the tracking sheet); the
 * subscription is keyed by guest name. When staff moves an order forward
 * (preparing / served), every subscription for that guest receives a push
 * with a deep link that opens the live tracking view.
 */

let configured: boolean | null = null;

function ensureConfigured(): boolean {
  if (configured !== null) return configured;
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT ?? "mailto:ops@wedjat.app";
  if (!publicKey || !privateKey) {
    configured = false;
    return false;
  }
  webpush.setVapidDetails(subject, publicKey, privateKey);
  configured = true;
  return true;
}

export interface PushPayload {
  title: string;
  body: string;
  /** deep link opened when the notification is tapped */
  url: string;
  /** notification tag — replaces previous notifications for the same order */
  tag?: string;
}

/**
 * Push a payload to every subscription registered for a guest. Dead
 * endpoints (404/410) are pruned automatically. Never throws — push
 * failures must not break the status update they announce.
 */
export async function pushToGuest(
  guestName: string | null | undefined,
  payload: PushPayload
): Promise<{ sent: number; pruned: number }> {
  const name = guestName?.trim();
  if (!name || !ensureConfigured()) return { sent: 0, pruned: 0 };

  let subs: {
    id: string;
    endpoint: string;
    p256dh: string;
    auth: string;
  }[] = [];
  try {
    subs = await db.pushSubscription.findMany({
      where: { guestName: { equals: name, mode: "insensitive" } },
      select: { id: true, endpoint: true, p256dh: true, auth: true },
    });
  } catch {
    return { sent: 0, pruned: 0 };
  }
  if (subs.length === 0) return { sent: 0, pruned: 0 };

  const data = JSON.stringify(payload);
  let sent = 0;
  let pruned = 0;

  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: s.endpoint,
            keys: { p256dh: s.p256dh, auth: s.auth },
          },
          data,
          { TTL: 3600, urgency: "normal" }
        );
        sent += 1;
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 400 || status === 404 || status === 410) {
          // invalid / expired / unsubscribed endpoint — remove it
          // (FCM signals bad registrations with 400; the push RFC uses 404/410)
          try {
            await db.pushSubscription.delete({ where: { id: s.id } });
            pruned += 1;
          } catch {
            // already gone
          }
        }
        // 429 (rate limit) and transient 5xx: the next status change retries
      }
    })
  );

  return { sent, pruned };
}
