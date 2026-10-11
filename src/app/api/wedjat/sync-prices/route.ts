import { NextResponse } from "next/server";
import { fullMenuSyncToWedjat } from "@/lib/wedjat";

// POST /api/wedjat/sync-prices
// Full menu sync to Wedjat RSM: the shisha type/price matrix (catalog
// upsert — creates missing products, re-prices changed ones) + the live
// availability mirror. Call this when prices change, or manually from the
// sync dashboard. The hourly Inngest job keeps it self-healing.
export async function POST() {
  try {
    const { catalog, availability } = await fullMenuSyncToWedjat();
    const ok = catalog.ok && availability.ok;
    return NextResponse.json(
      { ok, catalog, availability },
      { status: ok ? 200 : 502 }
    );
  } catch (err) {
    console.error("wedjat sync-prices error", err);
    return NextResponse.json(
      { ok: false, error: "Could not sync menu to Wedjat" },
      { status: 500 }
    );
  }
}
