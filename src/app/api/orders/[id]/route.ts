import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * GET /api/orders/[id] — single-order tracking feed for the guest live
 * tracking view. Returns only what a guest should see (no internal
 * COGS/profit/sync fields). The cuid id is unguessable, which is the
 * access control for the tracking link.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const order = await db.order.findUnique({ where: { id } });
    if (!order) {
      return NextResponse.json(
        { ok: false, error: "Order not found" },
        { status: 404 }
      );
    }

    let items: {
      primaryBrandName: string;
      flavorLabel: string;
      qty: number;
      emoji?: string;
    }[] = [];
    try {
      const parsed = JSON.parse(order.itemsJson);
      if (Array.isArray(parsed)) items = parsed;
    } catch {
      // keep empty
    }

    // Queue position: how many not-done orders were created before this one.
    const ahead = await db.order.count({
      where: {
        status: { not: "done" },
        createdAt: { lt: order.createdAt },
      },
    });

    return NextResponse.json({
      ok: true,
      order: {
        id: order.id,
        status: order.status,
        customerName: order.customerName,
        table: order.table,
        itemCount: order.itemCount,
        items,
        total: order.total,
        createdAt: order.createdAt.toISOString(),
        rating: order.rating,
        ratingComment: order.ratingComment,
        // loyalty summary shown in the tracking view after completion
        pointsEarned: order.pointsEarned,
      },
      queueAhead: ahead,
    });
  } catch (err) {
    console.error("order tracking error", err);
    return NextResponse.json(
      { ok: false, error: "Could not load order" },
      { status: 500 }
    );
  }
}
