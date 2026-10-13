import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sessionEmployee } from "@/lib/auth";
import {
  clientIp,
  GUEST_LIMITS,
  guestRateLimitResponse,
  hitGuestRateLimit,
} from "@/lib/rate-limit";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // r72 — cookie-free guest write → per-IP limit (staff bypass)
    const caller = await sessionEmployee(req);
    if (!caller) {
      const limit = await hitGuestRateLimit(
        `favdel:${clientIp(req.headers)}`,
        GUEST_LIMITS.favoriteDelete.max,
        GUEST_LIMITS.favoriteDelete.windowMs
      );
      if (!limit.ok) return guestRateLimitResponse(limit);
    }
    const { id } = await params;
    const existing = await db.favoriteMix.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { ok: false, error: "Favorite not found" },
        { status: 404 }
      );
    }
    await db.favoriteMix.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("delete favorite error", err);
    return NextResponse.json(
      { ok: false, error: "Could not delete favorite" },
      { status: 500 }
    );
  }
}
