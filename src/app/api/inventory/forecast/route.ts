import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { BRANDS, SUPPLIES, getBrand, getSupply } from "@/lib/catalog";

/**
 * GET /api/inventory/forecast — inventory intelligence:
 *  - consumption rate per brand/flavor/supply (per day, from order history)
 *  - days until empty at the current burn rate
 *  - a suggested shopping list (packs to buy for a 30-day cover) with cost
 *
 * Consumption is derived from the last 14 days of orders (itemsJson grams
 * per component + supply deductions per hookah). Default burn assumption
 * for brands with no history: a nominal 20g/day so new installs still get
 * a sensible forecast.
 */
export async function GET() {
  try {
    const now = new Date();
    const daysAgo14 = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
    const windowDays = 14;

    const orders = await db.order.findMany({
      where: { createdAt: { gte: daysAgo14 } },
      select: { itemsJson: true, itemCount: true },
    });

    // ---- molasses consumption per brand (grams) + per flavor ----
    const brandBurn = new Map<string, number>(); // brandId → grams in window
    const flavorBurn = new Map<string, number>(); // brandId|flavor → grams
    let totalHookahs = 0;
    for (const o of orders) {
      totalHookahs += o.itemCount;
      let items: { components?: { brandId: string; flavorName: string; grams: number }[]; qty?: number }[] = [];
      try {
        items = JSON.parse(o.itemsJson);
      } catch {
        continue;
      }
      if (!Array.isArray(items)) continue;
      for (const it of items) {
        const qty = it.qty ?? 0;
        for (const c of it.components ?? []) {
          brandBurn.set(c.brandId, (brandBurn.get(c.brandId) ?? 0) + (c.grams ?? 0) * qty);
          const key = `${c.brandId}|${c.flavorName}`;
          flavorBurn.set(key, (flavorBurn.get(key) ?? 0) + (c.grams ?? 0) * qty);
        }
      }
    }
    const hookahsPerDay = totalHookahs / windowDays;

    const inventory = await db.inventoryItem.findMany();
    const flavorStock = await db.flavorStock.findMany();
    const supplyRows = await db.supplyItem.findMany();

    // ---- brand forecast ----
    const NOMINAL_BURN = 20; // g/day assumption when there is no history
    const brands = BRANDS.map((b) => {
      const row = inventory.find((i) => i.brandId === b.id);
      const stock = row?.stockGrams ?? 0;
      const burn = brandBurn.get(b.id) ?? 0;
      const gramsPerDay = burn > 0 ? burn / windowDays : NOMINAL_BURN;
      const daysLeft = gramsPerDay > 0 ? Math.round((stock / gramsPerDay) * 10) / 10 : Infinity;
      const hookahsLeft = Math.floor(stock / 20);

      // suggested packs: cover 30 days at the current burn rate
      const neededGrams = Math.max(0, gramsPerDay * 30 - stock);
      const cheapestPack = b.packs.reduce(
        (best, p) => (p.costEgp / p.grams < best.costEgp / p.grams ? p : best),
        b.packs[0] ?? { grams: 250, label: "250g pack", costEgp: 80 }
      );
      const packsToBuy =
        neededGrams > 0 ? Math.ceil(neededGrams / cheapestPack.grams) : 0;

      return {
        brandId: b.id,
        brandName: b.name,
        emoji: b.emoji,
        stockGrams: Math.round(stock),
        gramsPerDay: Math.round(gramsPerDay * 10) / 10,
        daysLeft: daysLeft === Infinity ? null : daysLeft,
        hookahsLeft,
        lowStock: stock < (row?.lowStockThreshold ?? 100),
        suggestedPacks: packsToBuy,
        packLabel: cheapestPack.label,
        packCost: cheapestPack.costEgp,
        suggestedCost: packsToBuy * cheapestPack.costEgp,
      };
    }).sort((a, b) => (a.daysLeft ?? 99999) - (b.daysLeft ?? 99999));

    // ---- flavor-level warnings (below 3 days at current burn) ----
    const flavors = flavorStock
      .map((f) => {
        const burn = flavorBurn.get(`${f.brandIdRaw}|${f.flavorName}`) ?? 0;
        const perDay = burn > 0 ? burn / windowDays : 0;
        const daysLeft = perDay > 0 ? Math.round((f.stockGrams / perDay) * 10) / 10 : null;
        return {
          brandId: f.brandIdRaw,
          brandName: f.brandName,
          flavorName: f.flavorName,
          stockGrams: Math.round(f.stockGrams),
          daysLeft,
          critical: (daysLeft ?? 99) <= 3 || f.stockGrams < f.lowStockThreshold,
        };
      })
      .filter((f) => f.critical)
      .sort((a, b) => (a.daysLeft ?? 99) - (b.daysLeft ?? 99))
      .slice(0, 12);

    // ---- supplies forecast ----
    const supplies = SUPPLIES.map((s) => {
      const row = supplyRows.find((r) => r.key === s.key);
      const stock = row?.stock ?? 0;
      const perDay = s.perHookah > 0 ? s.perHookah * hookahsPerDay : 0;
      const daysLeft = perDay > 0 ? Math.round((stock / perDay) * 10) / 10 : null;
      const needed = Math.max(0, Math.ceil(perDay * 30 - stock));
      return {
        key: s.key,
        name: s.name,
        emoji: s.emoji,
        unit: s.unit,
        stock: Math.round(stock),
        perDay: Math.round(perDay * 10) / 10,
        daysLeft,
        lowStock: stock < (row?.lowStockThreshold ?? s.lowThreshold),
        // supplies are bought in nominal 100-unit boxes at catalog cost
        suggestedBoxes: needed > 0 ? Math.ceil(needed / 100) : 0,
        boxCost: Math.round(s.cost * 100),
      };
    }).sort((a, b) => (a.daysLeft ?? 99999) - (b.daysLeft ?? 99999));

    // ---- aggregated shopping list ----
    const shoppingList = [
      ...brands
        .filter((b) => b.suggestedPacks > 0)
        .map((b) => ({
          kind: "molasses" as const,
          refId: b.brandId,
          name: `${b.brandName} · ${b.packLabel} × ${b.suggestedPacks}`,
          cost: b.suggestedCost,
        })),
      ...supplies
        .filter((s) => s.suggestedBoxes > 0)
        .map((s) => ({
          kind: "supply" as const,
          refId: s.key,
          name: `${s.name} · box × ${s.suggestedBoxes}`,
          cost: s.suggestedBoxes * s.boxCost,
        })),
    ];
    const shoppingTotal = shoppingList.reduce((s, i) => s + i.cost, 0);

    return NextResponse.json({
      ok: true,
      windowDays,
      hookahsPerDay: Math.round(hookahsPerDay * 10) / 10,
      brands,
      flavors,
      supplies,
      shoppingList,
      shoppingTotal: Math.round(shoppingTotal * 100) / 100,
    });
  } catch (err) {
    console.error("inventory forecast error", err);
    return NextResponse.json(
      { ok: false, error: "Could not load forecast" },
      { status: 500 }
    );
  }
}
