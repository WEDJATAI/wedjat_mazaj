import { NextResponse } from "next/server";

/**
 * GET /api/push/key — the VAPID public key the browser needs to create a
 * push subscription. Returns ok:false when push isn't configured, letting
 * the client hide the "notify me" affordance gracefully.
 */
export async function GET() {
  const key = process.env.VAPID_PUBLIC_KEY ?? "";
  return NextResponse.json({ ok: key.length > 0, key });
}
