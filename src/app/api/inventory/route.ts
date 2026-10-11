import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { z } from "zod";
import { resolveBranchScope } from "@/lib/branch-scope";

/**
 * r57 — branch-scoped molasses inventory.
 *
 * GET ?branchId=<id>   → that branch's stock rows
 * GET ?branchId=all    → venue-wide aggregate per brand: total grams across
 *                        every branch + a per-branch breakdown (the admin
 *                        "total inventory" matrix)
 * GET (no param)       → default (flagship) branch
 *
 * POST restock { brandId, addGrams, branchId } → adds grams to THAT
 * branch's jar (creating the row when a new branch gets its first stock).
 */
export async function GET(req: NextRequest) {
  try {
    const raw = req.nextUrl.searchParams.get("branchId");
    const { branchId } = await resolveBranchScope(raw);

    if (branchId) {
      const items = await db.inventoryItem.findMany({
        where: { branchId },
        orderBy: { brandName: "asc" },
      });
      return NextResponse.json({ ok: true, scope: "branch", branchId, items });
    }

    // aggregate across all branches (the venue-admin matrix)
    const rows = await db.inventoryItem.findMany({
      include: { branch: { select: { id: true, name: true, nameAr: true } } },
      orderBy: { brandName: "asc" },
    });
    const byBrand = new Map<
      string,
      {
        brandId: string;
        brandName: string;
        stockGrams: number;
        lowStockThreshold: number;
        branches: { branchId: string; branchName: string; branchNameAr: string | null; stockGrams: number }[];
      }
    >();
    for (const r of rows) {
      const entry = byBrand.get(r.brandId) ?? {
        brandId: r.brandId,
        brandName: r.brandName,
        stockGrams: 0,
        lowStockThreshold: r.lowStockThreshold,
        branches: [],
      };
      entry.stockGrams += r.stockGrams;
      entry.lowStockThreshold = Math.max(entry.lowStockThreshold, r.lowStockThreshold);
      entry.branches.push({
        branchId: r.branchId ?? "",
        branchName: r.branch?.name ?? "—",
        branchNameAr: r.branch?.nameAr ?? null,
        stockGrams: r.stockGrams,
      });
      byBrand.set(r.brandId, entry);
    }
    return NextResponse.json({
      ok: true,
      scope: "all",
      branchId: null,
      items: [...byBrand.values()].map((e) => ({
        ...e,
        branches: e.branches.sort((a, b) => b.stockGrams - a.stockGrams),
      })),
    });
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
    const { brandId, addGrams } = parsed.data;
    const { branchId } = await resolveBranchScope(parsed.data.branchId ?? null);
    const existing = await db.inventoryItem.findFirst({
      where: { brandId, branchId },
    });
    if (!existing) {
      return NextResponse.json(
        { ok: false, error: "Brand not in inventory" },
        { status: 404 }
      );
    }
    const updated = await db.inventoryItem.update({
      where: { id: existing.id },
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
