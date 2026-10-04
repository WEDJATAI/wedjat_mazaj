import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { BRANDS } from "@/lib/catalog";

export async function GET() {
  try {
    const rows = await db.flavorStock.findMany({
      orderBy: [{ brandName: "asc" }, { flavorName: "asc" }],
    });
    // Merge with catalog so every brand×flavor shows even if missing from DB.
    const byKey = new Map(
      rows.map((r) => [`${r.brandIdRaw}:${r.flavorName}`, r])
    );
    const merged = BRANDS.flatMap((b) =>
      b.flavors.map((f) => {
        const existing = byKey.get(`${b.id}:${f}`);
        return (
          existing ?? {
            id: `${b.id}:${f}`,
            brandIdRaw: b.id,
            brandName: b.name,
            flavorName: f,
            stockGrams: 0,
            lowStockThreshold: 60,
            updatedAt: new Date().toISOString(),
          }
        );
      })
    );
    return NextResponse.json({ ok: true, items: merged });
  } catch (err) {
    console.error("flavor-stock list error", err);
    return NextResponse.json(
      { ok: false, error: "Could not load flavor stock" },
      { status: 500 }
    );
  }
}
