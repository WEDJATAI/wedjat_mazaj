import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { BRANDS, molassesCostPerHookah, egp } from "@/lib/catalog";

// GET /api/profit — aggregates revenue, COGS, net profit from all orders.
export async function GET() {
  try {
    const orders = await db.order.findMany({
      orderBy: { createdAt: "desc" },
    });

    let totalRevenue = 0;
    let totalCogs = 0;
    let totalMolassesCost = 0;
    let totalSuppliesCost = 0;
    let orderCount = 0;
    let hookahCount = 0;

    // Per-brand profit breakdown
    const brandStats = new Map<
      string,
      {
        brandId: string;
        brandName: string;
        emoji: string;
        revenue: number;
        cogs: number;
        hookahs: number;
      }
    >();

    for (const o of orders) {
      totalRevenue += o.total;
      totalCogs += o.cogs;
      totalMolassesCost += o.molassesCost;
      totalSuppliesCost += o.suppliesCost;
      orderCount += 1;
      hookahCount += o.itemCount;

      // Parse items to break down per-brand revenue/cost.
      try {
        const items = JSON.parse(o.itemsJson) as {
          primaryBrandId: string;
          primaryBrandName: string;
          components: { brandId: string }[];
          unitPrice: number;
          qty: number;
        }[];
        for (const it of items) {
          const brandId = it.primaryBrandId;
          const entry =
            brandStats.get(brandId) ??
            {
              brandId,
              brandName: it.primaryBrandName,
              emoji: BRANDS.find((b) => b.id === brandId)?.emoji ?? "📦",
              revenue: 0,
              cogs: 0,
              hookahs: 0,
            };
          entry.revenue += it.unitPrice * it.qty;
          // cost = molasses cost per hookah for the primary brand × qty
          const perHookah = molassesCostPerHookah(brandId);
          entry.cogs += perHookah * it.qty;
          entry.hookahs += it.qty;
          brandStats.set(brandId, entry);
        }
      } catch {
        // ignore parse errors
      }
    }

    const netProfit = Math.round((totalRevenue - totalCogs) * 100) / 100;
    const marginPct =
      totalRevenue > 0
        ? Math.round((netProfit / totalRevenue) * 1000) / 10
        : 0;

    const brandBreakdown = [...brandStats.values()]
      .map((b) => ({
        ...b,
        revenue: Math.round(b.revenue * 100) / 100,
        cogs: Math.round(b.cogs * 100) / 100,
        netProfit: Math.round((b.revenue - b.cogs) * 100) / 100,
        marginPct:
          b.revenue > 0
            ? Math.round(((b.revenue - b.cogs) / b.revenue) * 1000) / 10
            : 0,
      }))
      .sort((a, b) => b.netProfit - a.netProfit);

    // Total procurement spend
    const purchases = await db.purchase.findMany();
    const totalSpent = purchases.reduce((s, p) => s + p.totalCost, 0);

    return NextResponse.json({
      ok: true,
      summary: {
        orderCount,
        hookahCount,
        totalRevenue: Math.round(totalRevenue * 100) / 100,
        totalCogs: Math.round(totalCogs * 100) / 100,
        totalMolassesCost: Math.round(totalMolassesCost * 100) / 100,
        totalSuppliesCost: Math.round(totalSuppliesCost * 100) / 100,
        netProfit,
        marginPct,
        totalSpent: Math.round(totalSpent * 100) / 100,
        formatted: {
          totalRevenue: egp(totalRevenue),
          totalCogs: egp(totalCogs),
          netProfit: egp(netProfit),
          marginPct: `${marginPct}%`,
          totalSpent: egp(totalSpent),
        },
      },
      brandBreakdown,
      recentOrders: orders.slice(0, 20).map((o) => ({
        id: o.id,
        customerName: o.customerName,
        table: o.table,
        total: o.total,
        cogs: o.cogs,
        netProfit: o.netProfit,
        marginPct: o.marginPct,
        itemCount: o.itemCount,
        createdAt: o.createdAt,
      })),
    });
  } catch (err) {
    console.error("profit summary error", err);
    return NextResponse.json(
      { ok: false, error: "Could not load profit summary" },
      { status: 500 }
    );
  }
}
