import { NextRequest, NextResponse } from "next/server";
import { fetchWedjatProducts, fetchWedjatProductsByCategory } from "@/lib/wedjat";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const category = searchParams.get("category");
    const products = category
      ? await fetchWedjatProductsByCategory(category)
      : await fetchWedjatProducts();
    return NextResponse.json({ ok: true, products });
  } catch (err) {
    console.error("wedjat products error", err);
    return NextResponse.json(
      { ok: false, error: "Could not fetch Wedjat products" },
      { status: 500 }
    );
  }
}
