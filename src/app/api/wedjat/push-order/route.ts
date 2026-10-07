import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { pushOrderToWedjat } from "@/lib/wedjat";
import { z } from "zod";

// POST /api/wedjat/push-order — re-push an EXISTING mazaj order to the
// Wedjat RSM check (manual retry from the sync dashboard). Idempotent:
// the RSM webhook dedupes per mazaj order id, so re-pushing is safe.
const Schema = z.object({
  orderId: z.string().min(1, "orderId is required"),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const parsed = Schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid" },
        { status: 400 }
      );
    }
    const order = await db.order.findUnique({ where: { id: parsed.data.orderId } });
    if (!order) {
      return NextResponse.json(
        { ok: false, error: "Order not found" },
        { status: 404 }
      );
    }
    let addons: string[] = [];
    try {
      addons = order.addonsJson ? (JSON.parse(order.addonsJson) as string[]) : [];
    } catch {
      addons = [];
    }
    const result = await pushOrderToWedjat({
      id: order.id,
      customerName: order.customerName,
      phone: order.phone,
      table: order.table,
      wedjatTableId: order.wedjatTableId,
      notes: order.notes,
      itemsJson: order.itemsJson,
      bogo: order.bogo,
      addonsJson: addons,
    });
    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error }, { status: 409 });
    }
    await db.order
      .update({
        where: { id: order.id },
        data: {
          wedjatOrderId: result.wedjatOrderId ?? null,
          wedjatSyncStatus: "synced",
        },
      })
      .catch(() => {});
    return NextResponse.json({
      ok: true,
      wedjatOrderId: result.wedjatOrderId,
      duplicate: result.duplicate ?? false,
      addedToCheck: result.addedToCheck ?? false,
    });
  } catch (err) {
    console.error("wedjat push-order error", err);
    return NextResponse.json(
      { ok: false, error: "Could not push order to Wedjat" },
      { status: 500 }
    );
  }
}
