import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { fetchWedjatRevocations } from "@/lib/wedjat";

// GET /api/wedjat/sync-revocations
// Polls Wedjat RSM for checks that were pushed from Mazaj and have been
// cancelled. Updates the Mazaj order status + records who revoked it.
// Also run every 2 minutes by the Inngest poll job; this endpoint serves
// the employee dashboard's manual refresh.
export async function GET() {
  try {
    const revocations = await fetchWedjatRevocations();

    let updated = 0;
    const applied: {
      mazajOrderId: string;
      wedjatOrderId: number;
      revokedBy: string;
      revokedAt: string;
    }[] = [];
    for (const rev of revocations) {
      const tracked = await db.order.findFirst({
        where: { wedjatOrderId: rev.wedjatOrderId, wedjatSyncStatus: { not: "revoked" } },
        select: { id: true },
      });
      if (!tracked) continue;

      await db.order.update({
        where: { id: tracked.id },
        data: {
          wedjatSyncStatus: "revoked",
          wedjatRevokedBy: rev.revokedBy,
          wedjatRevokedAt: new Date(rev.revokedAt),
          status: "done", // mark as done so it leaves the active queue
        },
      });
      updated++;
      applied.push({
        mazajOrderId: tracked.id,
        wedjatOrderId: rev.wedjatOrderId,
        revokedBy: rev.revokedBy,
        revokedAt: rev.revokedAt,
      });
    }

    return NextResponse.json({
      ok: true,
      checked: revocations.length,
      updated,
      revocations: applied,
    });
  } catch (err) {
    console.error("sync revocations error", err);
    return NextResponse.json(
      { ok: false, error: "Could not sync revocations" },
      { status: 500 }
    );
  }
}
