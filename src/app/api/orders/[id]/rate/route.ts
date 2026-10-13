import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { z } from "zod";
import {
  clientIp,
  GUEST_LIMITS,
  guestRateLimitResponse,
  hitGuestRateLimit,
} from "@/lib/rate-limit";

const RateSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().max(400).optional().or(z.literal("")),
});

/**
 * POST /api/orders/[id]/rate — guest feedback (1–5 stars + optional
 * comment). Only accepted once per order and only after the order is
 * done, so ratings reflect completed sessions.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    // r71 — guest-only write: per-IP rate limit (one rating per order is
    // already enforced; this stops a script from walking order ids)
    {
      const limit = await hitGuestRateLimit(
        `rate:${clientIp(req.headers)}`,
        GUEST_LIMITS.rate.max,
        GUEST_LIMITS.rate.windowMs
      );
      if (!limit.ok) return guestRateLimitResponse(limit);
    }
    const body = await req.json();
    const parsed = RateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: "Rating must be 1–5 stars" },
        { status: 400 }
      );
    }

    const order = await db.order.findUnique({ where: { id } });
    if (!order) {
      return NextResponse.json(
        { ok: false, error: "Order not found" },
        { status: 404 }
      );
    }
    if (order.status !== "done") {
      return NextResponse.json(
        { ok: false, error: "You can rate after your session is served" },
        { status: 409 }
      );
    }
    if (order.rating != null) {
      return NextResponse.json(
        { ok: false, error: "This order is already rated" },
        { status: 409 }
      );
    }

    const updated = await db.order.update({
      where: { id },
      data: {
        rating: parsed.data.rating,
        ratingComment: parsed.data.comment || null,
        ratedAt: new Date(),
      },
    });

    return NextResponse.json({ ok: true, order: updated });
  } catch (err) {
    console.error("rate order error", err);
    return NextResponse.json(
      { ok: false, error: "Could not save rating" },
      { status: 500 }
    );
  }
}
