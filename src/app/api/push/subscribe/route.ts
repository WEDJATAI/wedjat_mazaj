import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * POST /api/push/subscribe — register/refresh a push subscription for a
 *   guest. Body: { subscription, guestName, platform? }
 *   Idempotent per endpoint (upsert), so re-subscribing is always safe.
 * POST /api/push/subscribe { unsubscribe: true, subscription } — remove the
 *   endpoint (user turned notifications off / pushsubscriptionchange).
 */
interface PushSubscriptionBody {
  subscription?: {
    endpoint?: string;
    keys?: { p256dh?: string; auth?: string };
  };
  guestName?: string;
  platform?: string;
  unsubscribe?: boolean;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as PushSubscriptionBody;
    const sub = body.subscription;
    const endpoint = sub?.endpoint;

    if (!endpoint) {
      return NextResponse.json(
        { ok: false, error: "subscription.endpoint required" },
        { status: 400 }
      );
    }

    if (body.unsubscribe) {
      await db.pushSubscription.deleteMany({ where: { endpoint } });
      return NextResponse.json({ ok: true, removed: true });
    }

    const guestName = body.guestName?.trim();
    const p256dh = sub?.keys?.p256dh;
    const auth = sub?.keys?.auth;
    if (!guestName || !p256dh || !auth) {
      return NextResponse.json(
        {
          ok: false,
          error: "guestName and subscription.keys (p256dh, auth) required",
        },
        { status: 400 }
      );
    }

    const platform =
      body.platform === "android" || body.platform === "ios"
        ? body.platform
        : "web";

    const saved = await db.pushSubscription.upsert({
      where: { endpoint },
      create: { endpoint, p256dh, auth, guestName, platform },
      update: { p256dh, auth, guestName, platform },
    });

    return NextResponse.json({ ok: true, id: saved.id });
  } catch (err) {
    console.error("push subscribe error", err);
    return NextResponse.json(
      { ok: false, error: "Could not save subscription" },
      { status: 500 }
    );
  }
}
