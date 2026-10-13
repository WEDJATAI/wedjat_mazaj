import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { fullMenuSyncToWedjat } from "@/lib/wedjat";
import { requireStaff } from "@/lib/auth";

// POST /api/wedjat/sync-prices
// Full menu sync to Wedjat RSM: the shisha type/price matrix (catalog
// upsert — creates missing products, re-prices changed ones) + the live
// availability mirror. Call this when prices change, or manually from the
// sync dashboard. The hourly Inngest job keeps it self-healing.
// r70: requires a signed-in staff member with the "sync" permission.
export async function POST(req: NextRequest) {
  try {
    {
      const guard = await requireStaff(req, "sync");
      if ("resp" in guard) return guard.resp;
    }
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
