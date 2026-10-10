import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { SUPPLIES } from "@/lib/catalog";
import { resolveBranchScope } from "@/lib/branch-scope";
import { z } from "zod";

/**
 * r57 — branch-scoped supplies (coal, foil, hose…).
 * Same scoping contract as /api/inventory: ?branchId=<id> | all | default.
 */
export async function GET(req: NextRequest) {
  try {
    const raw = req.nextUrl.searchParams.get("branchId");
    const { branchId } = await resolveBranchScope(raw);

    if (branchId) {
      const rows = await db.supplyItem.findMany({
        where: { branchId },
        orderBy: { name: "asc" },
      });
      const byKey = new Map(rows.map((r) => [r.key, r]));
      const merged = SUPPLIES.map(
        (s) =>
          byKey.get(s.key) ?? {
            id: `${s.key}:${branchId}`,
            key: s.key,
            name: s.name,
            unit: s.unit,
            stock: 0,
            lowStockThreshold: s.lowThreshold,
            cost: s.cost,
            sellPrice: s.sellPrice,
            emoji: s.emoji,
            updatedAt: new Date().toISOString(),
          }
      );
      return NextResponse.json({ ok: true, scope: "branch", branchId, items: merged });
    }

    // aggregate across branches
    const rows = await db.supplyItem.findMany({
      include: { branch: { select: { id: true, name: true, nameAr: true } } },
    });
    const byKey = new Map<
      string,
      {
        key: string;
        name: string;
        unit: string;
        emoji: string;
        stock: number;
        lowStockThreshold: number;
        cost: number;
        sellPrice: number;
        branches: { branchId: string; branchName: string; branchNameAr: string | null; stock: number }[];
      }
    >();
    for (const r of rows) {
      const def = SUPPLIES.find((s) => s.key === r.key);
      const entry = byKey.get(r.key) ?? {
        key: r.key,
        name: r.name,
        unit: r.unit,
        emoji: r.emoji,
        stock: 0,
        lowStockThreshold: r.lowStockThreshold,
        cost: r.cost,
        sellPrice: def?.sellPrice ?? r.sellPrice,
        branches: [],
      };
      entry.stock += r.stock;
      entry.branches.push({
        branchId: r.branchId ?? "",
        branchName: r.branch?.name ?? "—",
        branchNameAr: r.branch?.nameAr ?? null,
        stock: r.stock,
      });
      byKey.set(r.key, entry);
    }
    const merged = SUPPLIES.map(
      (s) =>
        byKey.get(s.key) ?? {
          key: s.key,
          name: s.name,
          unit: s.unit,
          emoji: s.emoji,
          stock: 0,
          lowStockThreshold: s.lowThreshold,
          cost: s.cost,
          sellPrice: s.sellPrice,
          branches: [],
        }
    );
    return NextResponse.json({ ok: true, scope: "all", branchId: null, items: merged });
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
  branchId: z.string().optional().nullable(),
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
    const { branchId } = await resolveBranchScope(parsed.data.branchId ?? null);
    const existing = await db.supplyItem.findFirst({
      where: { key, branchId },
    });
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
          sellPrice: def.sellPrice,
          branchId,
        },
      });
      return NextResponse.json({ ok: true, item: created });
    }
    const updated = await db.supplyItem.update({
      where: { id: existing.id },
      data: { stock: existing.stock + addAmount },
    });
    return NextResponse.json({ ok: true, item: updated });
  } catch (err) {
    console.error("supplies restock error", err);
    return NextResponse.json(
      { ok: false, error: "Could not restock" },
      { status: 500 }
    );
  }
}
