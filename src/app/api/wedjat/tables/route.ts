import { NextResponse } from "next/server";
import { fetchWedjatTables } from "@/lib/wedjat";

// GET /api/wedjat/tables — live restaurant tables (active floors) so the
// employee order screen can pick a REAL table. The numeric id is the
// unambiguous reference echoed back to the RSM webhook as tableId.
export async function GET() {
  try {
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
