import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePlatformAdminSession } from "@/lib/auth";
import { MOLASSES_GRAMS } from "@/lib/catalog";

/**
 * r61 — Platform Control Center · INVENTORY matrix.
 *
 * GET /api/platform/inventory?employeeId=…
 *
 * The platform owner's cross-venue stock view of the SHISHA operation:
 *   • perBranch — every branch's molasses jars (grams + hookahs left)
 *                 and consumable supplies, with low-stock flags
 *   • perBrand  — platform-wide totals per brand (the aggregate the
 *                 owner thinks in: "how much Mazaya do we have left")
 *   • alerts    — everything at/below its threshold, ready to action
 */

const r1 = (n: number) => Math.round(n * 10) / 10;

export async function GET(req: NextRequest) {
  try {
    const guard = await requirePlatformAdminSession(req);
    if ("resp" in guard) return guard.resp;

    const [branches, inventory, supplies] = await Promise.all([
      db.branch.findMany({
        select: {
          id: true,
          name: true,
          nameAr: true,
          isActive: true,
          venue: { select: { id: true, name: true, nameAr: true, status: true } },
        },
        orderBy: [{ isActive: "desc" }, { createdAt: "asc" }],
      }),
      db.inventoryItem.findMany({
        include: { flavors: { select: { flavorName: true, stockGrams: true } } },
      }),
      db.supplyItem.findMany(),
    ]);

    const branchById = new Map(branches.map((b) => [b.id, b]));

    type BrandRow = {
      brandId: string;
      brandName: string;
      stockGrams: number;
      lowStock: boolean;
      flavors: { name: string; grams: number }[];
    };
    type SupplyRow = {
      key: string;
      name: string;
      emoji: string;
      unit: string;
      stock: number;
      lowStock: boolean;
    };

    const perBranch = branches.map((b) => {
      const jars = inventory
        .filter((i) => i.branchId === b.id)
        .map<BrandRow>((i) => ({
          brandId: i.brandId,
          brandName: i.brandName,
          stockGrams: r1(i.stockGrams),
          lowStock: i.stockGrams <= i.lowStockThreshold,
          flavors: i.flavors
            .map((f) => ({ name: f.flavorName, grams: r1(f.stockGrams) }))
            .sort((x, y) => y.grams - x.grams),
        }))
        .sort((x, y) => y.stockGrams - x.stockGrams);
      const supplyRows = supplies
        .filter((s) => s.branchId === b.id)
        .map<SupplyRow>((s) => ({
          key: s.key,
          name: s.name,
          emoji: s.emoji,
          unit: s.unit,
          stock: r1(s.stock),
          lowStock: s.stock <= s.lowStockThreshold,
        }));
      return {
        id: b.id,
        name: b.name,
        nameAr: b.nameAr,
        isActive: b.isActive,
        venue: { id: b.venue.id, name: b.venue.name, nameAr: b.venue.nameAr, status: b.venue.status },
        jars,
        supplies: supplyRows,
        lowStockCount: jars.filter((j) => j.lowStock).length + supplyRows.filter((s) => s.lowStock).length,
      };
    });

    // platform-wide totals per brand
    const brandTotals = new Map<string, { grams: number; branches: number }>();
    for (const i of inventory) {
      const e = brandTotals.get(i.brandId) ?? { grams: 0, branches: 0 };
      e.grams += i.stockGrams;
      e.branches += 1;
      brandTotals.set(i.brandId, e);
    }
    const perBrand = [...brandTotals.entries()]
      .map(([brandId, e]) => ({
        brandId,
        grams: r1(e.grams),
        hookahs: Math.floor(e.grams / MOLASSES_GRAMS),
        branches: e.branches,
      }))
      .sort((a, b) => b.grams - a.grams);

    // alert list (branch + brand/supply + how low)
    const alerts: {
      branchId: string;
      branchName: string;
      venueName: string;
      kind: "molasses" | "supply";
      name: string;
      level: number; // percent of threshold remaining
    }[] = [];
    for (const i of inventory) {
      if (i.stockGrams > i.lowStockThreshold || !i.branchId) continue;
      const b = branchById.get(i.branchId);
      if (!b) continue;
      alerts.push({
        branchId: b.id,
        branchName: b.name,
        venueName: b.venue.name,
        kind: "molasses",
        name: i.brandName,
        level: i.lowStockThreshold > 0 ? Math.round((i.stockGrams / i.lowStockThreshold) * 100) : 0,
      });
    }
    for (const s of supplies) {
      if (s.stock > s.lowStockThreshold || !s.branchId) continue;
      const b = branchById.get(s.branchId);
      if (!b) continue;
      alerts.push({
        branchId: b.id,
        branchName: b.name,
        venueName: b.venue.name,
        kind: "supply",
        name: s.name,
        level: s.lowStockThreshold > 0 ? Math.round((s.stock / s.lowStockThreshold) * 100) : 0,
      });
    }
    alerts.sort((a, b) => a.level - b.level);

    return NextResponse.json({
      ok: true,
      perBranch,
      perBrand,
      alerts,
      totals: {
        branches: branches.filter((b) => b.isActive).length,
        brandKinds: perBrand.length,
        totalGrams: r1([...brandTotals.values()].reduce((s, e) => s + e.grams, 0)),
        alertCount: alerts.length,
      },
    });
  } catch (err) {
    console.error("platform inventory error", err);
    return NextResponse.json(
      { ok: false, error: "Could not load the inventory matrix" },
      { status: 500 }
    );
  }
}
