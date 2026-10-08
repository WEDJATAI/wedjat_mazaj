import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getBrand } from "@/lib/catalog";

/**
 * GET /api/analytics — manager analytics dashboard aggregates.
 * Everything is computed from the last 30 days of orders (small dataset —
 * a lounge POS — so JS aggregation is exact and fast).
 */
export async function GET() {
  try {
    const now = new Date();
    const daysAgo30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const daysAgo14 = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);

    const orders = await db.order.findMany({
      where: { createdAt: { gte: daysAgo30 } },
      orderBy: { createdAt: "asc" },
    });

    // ---------- today KPIs ----------
    const todayOrders = orders.filter(
      (o) => o.createdAt.getTime() >= startOfToday.getTime()
    );
    const todayRevenue = todayOrders.reduce((s, o) => s + o.total, 0);
    const todayHookahs = todayOrders.reduce((s, o) => s + o.itemCount, 0);
    const todayProfit = todayOrders.reduce((s, o) => s + o.netProfit, 0);

    // ---------- ratings ----------
    const rated = orders.filter((o) => o.rating != null);
    const avgRating =
      rated.length > 0
        ? Math.round((rated.reduce((s, o) => s + (o.rating ?? 0), 0) / rated.length) * 10) / 10
        : null;

    // ---------- 14-day revenue trend ----------
    const trendMap = new Map<string, { revenue: number; orders: number; day: string }>();
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const key = d.toISOString().slice(0, 10);
      trendMap.set(key, { revenue: 0, orders: 0, day: key });
    }
    for (const o of orders) {
      if (o.createdAt < daysAgo14) continue;
      const key = o.createdAt.toISOString().slice(0, 10);
      const entry = trendMap.get(key);
      if (entry) {
        entry.revenue += o.total;
        entry.orders += 1;
      }
    }
    const trend14 = [...trendMap.values()].map((t) => ({
      ...t,
      revenue: Math.round(t.revenue * 100) / 100,
    }));

    // ---------- top brands (parse itemsJson; recompute unit price from the
    // catalog so legacy items with a missing/zero client unitPrice still
    // count correctly — server-side source of truth) ----------
    const brandAgg = new Map<string, { revenue: number; hookahs: number }>();
    for (const o of orders) {
      let items: {
        primaryBrandId?: string;
        primaryBrandName?: string;
        qty?: number;
        unitPrice?: number;
        components?: { brandId: string }[];
      }[] = [];
      try {
        items = JSON.parse(o.itemsJson);
      } catch {
        continue;
      }
      if (!Array.isArray(items)) continue;
      for (const it of items) {
        const key = it.primaryBrandId ?? it.primaryBrandName ?? "unknown";
        const qty = it.qty ?? 0;
        // authoritative recompute: same rules as the order API
        let unit = it.unitPrice ?? 0;
        if (unit <= 0 && it.components?.length) {
          const comp = it.components[0];
          const brand = getBrand(comp.brandId);
          unit = brand?.pricing.flat ?? brand?.pricing.fruits ?? 0;
        }
        const cur = brandAgg.get(key) ?? { revenue: 0, hookahs: 0 };
        cur.revenue += unit * qty;
        cur.hookahs += qty;
        brandAgg.set(key, cur);
      }
    }
    const topBrands = [...brandAgg.entries()]
      .map(([brandId, v]) => ({
        brandId,
        brandName: getBrand(brandId)?.name ?? brandId,
        emoji: getBrand(brandId)?.emoji ?? "🌿",
        revenue: Math.round(v.revenue * 100) / 100,
        hookahs: v.hookahs,
      }))
      .sort((a, b) => b.revenue - a.revenue);

    // ---------- peak hours (hour-of-day histogram) ----------
    const hourBuckets = Array.from({ length: 24 }, (_, h) => ({ hour: h, orders: 0 }));
    const weekdayBuckets = Array.from({ length: 7 }, (_, d) => ({ weekday: d, orders: 0 }));
    for (const o of orders) {
      hourBuckets[o.createdAt.getHours()].orders += 1;
      weekdayBuckets[o.createdAt.getDay()].orders += 1;
    }

    // ---------- employee leaderboard ----------
    const empAgg = new Map<string, { orders: number; revenue: number; hookahs: number }>();
    for (const o of orders) {
      // attribute to the assigned employee, else the employee who created it
      const name = o.assignedToName ?? o.orderedByName;
      if (!name) continue;
      const cur = empAgg.get(name) ?? { orders: 0, revenue: 0, hookahs: 0 };
      cur.orders += 1;
      cur.revenue += o.total;
      cur.hookahs += o.itemCount;
      empAgg.set(name, cur);
    }
    const employees = [...empAgg.entries()]
      .map(([name, v]) => ({
        name,
        orders: v.orders,
        revenue: Math.round(v.revenue * 100) / 100,
        hookahs: v.hookahs,
      }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    // ---------- loyalty snapshot ----------
    const members = await db.loyaltyMember.findMany({
      select: { points: true, lifetimePoints: true, createdAt: true },
    });
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const loyalty = {
      members: members.length,
      pointsOutstanding: members.reduce((s, m) => s + m.points, 0),
      newMembers30d: members.filter((m) => m.createdAt >= monthAgo).length,
    };

    // ---------- recent feedback ----------
    const feedback = orders
      .filter((o) => o.rating != null)
      .sort((a, b) => (b.ratedAt?.getTime() ?? 0) - (a.ratedAt?.getTime() ?? 0))
      .slice(0, 8)
      .map((o) => ({
        id: o.id,
        customerName: o.customerName,
        table: o.table,
        rating: o.rating,
        comment: o.ratingComment,
        ratedAt: (o.ratedAt ?? o.createdAt).toISOString(),
      }));

    return NextResponse.json({
      ok: true,
      today: {
        revenue: Math.round(todayRevenue * 100) / 100,
        orders: todayOrders.length,
        hookahs: todayHookahs,
        profit: Math.round(todayProfit * 100) / 100,
      },
      last30: {
        orders: orders.length,
        revenue: Math.round(orders.reduce((s, o) => s + o.total, 0) * 100) / 100,
        avgRating,
        ratedCount: rated.length,
      },
      trend14,
      topBrands,
      peakHours: hourBuckets,
      weekdays: weekdayBuckets,
      employees,
      loyalty,
      feedback,
    });
  } catch (err) {
    console.error("analytics error", err);
    return NextResponse.json(
      { ok: false, error: "Could not load analytics" },
      { status: 500 }
    );
  }
}
