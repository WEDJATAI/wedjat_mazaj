import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { z } from "zod";

export async function GET() {
  try {
    const items = await db.inventoryItem.findMany({
      orderBy: { brandName: "asc" },
    });
    return NextResponse.json({ ok: true, items });
  } catch (err) {
    console.error("inventory list error", err);
    return NextResponse.json(
      { ok: false, error: "Could not load inventory" },
      { status: 500 }
    );
  }
}

const RestockSchema = z.object({
  brandId: z.string(),
  addGrams: z.number().positive().max(100000),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = RestockSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 }
      );
    }
    const { brandId, addGrams } = parsed.data;
    const existing = await db.inventoryItem.findUnique({ where: { brandId } });
    if (!existing) {
      return NextResponse.json(
        { ok: false, error: "Brand not in inventory" },
        { status: 404 }
      );
    }
    const updated = await db.inventoryItem.update({
      where: { brandId },
      data: { stockGrams: existing.stockGrams + addGrams },
    });
    return NextResponse.json({ ok: true, item: updated });
  } catch (err) {
    console.error("inventory restock error", err);
    return NextResponse.json(
      { ok: false, error: "Could not restock" },
      { status: 500 }
    );
  }
}
