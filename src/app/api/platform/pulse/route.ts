import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePlatformAdmin } from "@/lib/platform-auth";
import { getRsmConfig, computeWithConfig } from "@/lib/platform-settings";

/**
 * r61 — Platform Control Center · PULSE (the command dashboard feed).
 *
 * GET /api/platform/pulse?employeeId=…
 *
 * One round-trip powering the whole Pulse tab:
 *   • network     — venues (by status) + branches
 *   • today       — shisha orders, hookahs, revenue, WEDJAT gross
 *   • trend7d     — per-day revenue + WEDJAT gross (CSS bar chart)
 *   • activity    — the 8 most recent orders across every venue
 *   • ops         — low-stock alerts, pending guest requests
 *   • wedjat      — RSM sync counters
 *   • health      — DB latency measured on this very request
 */

const r2 = (n: number) => Math.round(n * 100) / 100;

export async function GET(req: NextRequest) {
  const started = Date.now();
  try {
    const admin = await requirePlatformAdmin(
      req.nextUrl.searchParams.get("employeeId")
    );
    if (!admin) {
      return NextResponse.json(
        { ok: false, error: "Platform admin only" },
        { status: 403 }
      );
    }

    const cfg = await getRsmConfig();

    // ── network ─────────────────────────────────────────────────────────
    const venues = await db.venue.findMany({
      include: { branches: { select: { id: true, isActive: true } } },
      orderBy: { createdAt: "asc" },
    });
    const branchIds = new Map<string, string>(); // branchId → venue name
    for (const v of venues) {
      for (const b of v.branches) branchIds.set(b.id, v.name);
    }
    const activeVenues = venues.filter((v) => v.status === "active").length;
    const pendingVenues = venues.filter((v) => v.status === "pending").length;

    // ── today + 7-day trend ────────────────────────────────────────────
    const now = new Date();
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);
    const start7d = new Date(startOfToday);
    start7d.setDate(start7d.getDate() - 6);

    const recent = await db.order.findMany({
      where: {
        createdAt: { gte: start7d },
        wedjatSyncStatus: { not: "revoked" },
      },
      select: {
        id: true,
        customerName: true,
        table: true,
        total: true,
        itemCount: true,
        status: true,
        source: true,
        branchId: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    let todayOrders = 0;
    let todayHookahs = 0;
    let todayRevenue = 0;
    const dayMap = new Map<string, { revenue: number }>();
    for (let i = 0; i < 7; i++) {
      const d = new Date(start7d);
      d.setDate(d.getDate() + i);
      dayMap.set(d.toISOString().slice(0, 10), { revenue: 0 });
    }
    for (const o of recent) {
      const key = o.createdAt.toISOString().slice(0, 10);
      if (dayMap.has(key)) {
        dayMap.get(key)!.revenue += o.total;
      }
      if (o.createdAt >= startOfToday) {
        todayOrders += 1;
        todayHookahs += o.itemCount;
        todayRevenue += o.total;
      }
    }
    const trend7d = [...dayMap.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, e]) => {
        const d = computeWithConfig(cfg, e.revenue);
        return { date, revenue: d.shishaRevenue, wedjatGross: d.wedjatGross };
      });

    const todayGp = computeWithConfig(cfg, todayRevenue);

    // ── activity feed (8 latest, any age) ───────────────────────────────
    const activity = await db.order.findMany({
      where: { wedjatSyncStatus: { not: "revoked" } },
      select: {
        id: true,
        customerName: true,
        table: true,
        total: true,
        itemCount: true,
        status: true,
        source: true,
        branchId: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: 8,
    });

    // ── ops: low stock + pending requests ───────────────────────────────
    const inventory = await db.inventoryItem.findMany({
      select: { brandName: true, stockGrams: true, lowStockThreshold: true, branchId: true },
    });
    const lowStock = inventory.filter((i) => i.stockGrams <= i.lowStockThreshold);
    const supplies = await db.supplyItem.findMany({
      select: { name: true, stock: true, lowStockThreshold: true, branchId: true },
    });
    const lowSupplies = supplies.filter((s) => s.stock <= s.lowStockThreshold);
    const pendingRequests = await db.serviceRequest.count({
      where: { status: "pending" },
    });

    // ── wedjat sync counters ────────────────────────────────────────────
    const syncRows = await db.order.groupBy({
      by: ["wedjatSyncStatus"],
      _count: { _all: true },
    });
    const sync: Record<string, number> = { synced: 0, pending: 0, failed: 0, revoked: 0 };
    for (const row of syncRows) {
      sync[row.wedjatSyncStatus] = row._count._all;
    }

    return NextResponse.json({
      ok: true,
      health: {
        dbUp: true,
        latencyMs: Date.now() - started,
        time: new Date().toISOString(),
      },
      network: {
        venues: venues.length,
        activeVenues,
        pendingVenues,
        branches: branchIds.size,
      },
      today: {
        orders: todayOrders,
        hookahs: todayHookahs,
        revenue: r2(todayRevenue),
        commission: todayGp.commission,
        wedjatGross: todayGp.wedjatGross,
      },
      trend7d,
      activity: activity.map((o) => ({
        id: o.id,
        customer: o.customerName ?? null,
        table: o.table ?? null,
        total: o.total,
        hookahs: o.itemCount,
        status: o.status,
        source: o.source,
        venue: o.branchId ? branchIds.get(o.branchId) ?? null : null,
        branchId: o.branchId,
        createdAt: o.createdAt.toISOString(),
      })),
      ops: {
        lowStockCount: lowStock.length,
        lowSuppliesCount: lowSupplies.length,
        pendingRequests,
      },
      wedjat: sync,
    });
  } catch (err) {
    console.error("platform pulse error", err);
    return NextResponse.json(
      { ok: false, error: "Could not load the platform pulse" },
      { status: 500 }
    );
  }
}
