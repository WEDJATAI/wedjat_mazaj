import { NextRequest, NextResponse } from "next/server";
import { fetchWedjatTables } from "@/lib/wedjat";
import { requireStaff } from "@/lib/auth";

// GET /api/wedjat/tables — live restaurant tables (active floors) so the
// employee order screen can pick a REAL table. The numeric id is the
// unambiguous reference echoed back to the RSM webhook as tableId.
// r71: staff session required — this feeds the staff bowl builder, and the
// live floor plan of the restaurant is not public data.
export async function GET(req: NextRequest) {
  try {
    {
      const guard = await requireStaff(req);
      if ("resp" in guard) return guard.resp;
    }
    const tables = await fetchWedjatTables();
    return NextResponse.json({ ok: true, tables });
  } catch (err) {
    console.error("wedjat tables error", err);
    return NextResponse.json(
      { ok: false, error: "Could not fetch Wedjat tables" },
      { status: 500 }
    );
  }
}
