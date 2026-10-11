import { NextResponse } from "next/server";
import { fetchWedjatProducts } from "@/lib/wedjat";

// GET /api/wedjat/products — the restaurant's shisha menu mirror (what
// the R46 catalog sync has materialized on the POS side), for the sync
// dashboard display.
export async function GET() {
  try {
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
