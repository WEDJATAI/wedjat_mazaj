import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { fetchWedjatRevocations } from "@/lib/wedjat";

// GET /api/wedjat/sync-revocations
// Polls Wedjat for orders that were pushed from Mazaj and have been cancelled.
// Updates the Mazaj order status + records who revoked it.
// This should be called periodically (e.g. every 30s) by the employee dashboard.
export async function GET() {
  try {
    // Check revocations since 24h ago (covers any recent cancellations)
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const revocations = await fetchWedjatRevocations(since);

    let updated = 0;
    for (const rev of revocations) {
      if (!rev.mazajOrderId) continue;
      // Only update if not already marked as revoked
      const existing = await db.order.findUnique({
        where: { id: rev.mazajOrderId },
        select: { wedjatSyncStatus: true },
      });
      if (!existing || existing.wedjatSyncStatus === "revoked") continue;

      await db.order.update({
        where: { id: rev.mazajOrderId },
        data: {
          wedjatSyncStatus: "revoked",
          wedjatRevokedBy: rev.revokedBy,
          wedjatRevokedAt: new Date(rev.revokedAt),
          status: "done", // mark as done so it leaves the active queue
        },
      });
      updated++;
    }

    return NextResponse.json({
      ok: true,
      checked: revocations.length,
      updated,
      revocations: revocations.map((r) => ({
        mazajOrderId: r.mazajOrderId,
        wedjatOrderId: r.wedjatOrderId,
        revokedBy: r.revokedBy,
        revokedAt: r.revokedAt,
      })),
    });
  } catch (err) {
    console.error("sync revocations error", err);
    return NextResponse.json(
      { ok: false, error: "Could not sync revocations" },
      { status: 500 }
    );
  }
}
