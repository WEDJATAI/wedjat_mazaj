import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { SUPPLIES } from "@/lib/catalog";
import { z } from "zod";

export async function GET() {
  try {
    const rows = await db.supplyItem.findMany({ orderBy: { name: "asc" } });
    // merge with catalog so every supply shows even if missing
    const byKey = new Map(rows.map((r) => [r.key, r]));
    const merged = SUPPLIES.map(
      (s) =>
        byKey.get(s.key) ?? {
          id: s.key,
          key: s.key,
          name: s.name,
          unit: s.unit,
          stock: 0,
          lowStockThreshold: s.lowThreshold,
          cost: s.cost,
          emoji: s.emoji,
          updatedAt: new Date().toISOString(),
        }
    );
    return NextResponse.json({ ok: true, items: merged });
  } catch (err) {
    console.error("supplies list error", err);
    return NextResponse.json(
      { ok: false, error: "Could not load supplies" },
      { status: 500 }
    );
  }
}

const RestockSchema = z.object({
  key: z.string(),
  addAmount: z.number().positive().max(100000),
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
    const { key, addAmount } = parsed.data;
    const existing = await db.supplyItem.findUnique({ where: { key } });
    if (!existing) {
      const def = SUPPLIES.find((s) => s.key === key);
      if (!def) {
        return NextResponse.json(
          { ok: false, error: "Supply not found" },
          { status: 404 }
        );
      }
      const created = await db.supplyItem.create({
        data: {
          key: def.key,
          name: def.name,
          unit: def.unit,
          emoji: def.emoji,
          stock: addAmount,
          lowStockThreshold: def.lowThreshold,
          cost: def.cost,
        },
      });
      return NextResponse.json({ ok: true, item: created });
    }
    const updated = await db.supplyItem.update({
      where: { key },
      data: { stock: existing.stock + addAmount },
    });
    return NextResponse.json({ ok: true, item: updated });
  } catch (err) {
    console.error("supply restock error", err);
    return NextResponse.json(
      { ok: false, error: "Could not restock" },
      { status: 500 }
    );
  }
}
