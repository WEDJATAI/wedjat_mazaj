import { NextRequest, NextResponse } from "next/server";
import { fetchWedjatProducts } from "@/lib/wedjat";
import { requireStaff } from "@/lib/auth";

// GET /api/wedjat/products — the restaurant's shisha menu mirror (what
// the R46 catalog sync has materialized on the POS side), for the sync
// dashboard display.
// r71: staff session required (dashboard surface).
export async function GET(req: NextRequest) {
  try {
    {
      const guard = await requireStaff(req);
      if ("resp" in guard) return guard.resp;
    }
    const products = await fetchWedjatProducts();
    return NextResponse.json({ ok: true, products });
  } catch (err) {
    console.error("wedjat products error", err);
    return NextResponse.json(
      { ok: false, error: "Could not fetch Wedjat products" },
      { status: 500 }
    );
  }
}
