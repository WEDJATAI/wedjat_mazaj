import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  SHISHA_COMMISSION_PCT,
  WEDJAT_SHARE_PCT,
  PARTNER_SHARE_PCT,
  WEDJAT_EFFECTIVE_PCT,
  computeRsmGrossProfit,
} from "@/lib/rsm-finance";

/**
 * r59 — WEDJAT RSM finance (Revenue Share Management).
 *
 * GET /api/rsm/finance?employeeId=…&range=today|7d|30d|all&branchId=…
 *
 * Computes the WEDJAT gross profit on shisha:
 *   shisha revenue × 12% commission × 40% WEDJAT share
 * — always APART from the café/restaurant's own (food & beverage) orders,
 * which are not part of this platform's shisha corner and carry no
 * commission. Tax & VAT are borne by the venue (the rented shisha corner),
 * so nothing tax-related is deducted here.
 *
 * Authz: admin-level staff (super_admin / venue_admin / admin) see their
 * branch scope; platform_admin sees the whole platform with a per-venue
 * breakdown. Orders revoked in the restaurant POS (cancelled checks) are
 * excluded — the guest never paid them.
 */

const RANGES = ["today", "7d", "30d", "all"] as const;
type Range = (typeof RANGES)[number];

function rangeStart(range: Range): Date | null {
  const now = new Date();
  if (range === "today") {
    const d = new Date(now);
    d.setHours(0, 0, 0, 0);
    return d;
  }
  if (range === "7d" || range === "30d") {
    const days = range === "7d" ? 7 : 30;
    const d = new Date(now);
    d.setDate(d.getDate() - (days - 1));
    d.setHours(0, 0, 0, 0);
    return d;
  }
  return null; // all time
}

export async function GET(req: NextRequest) {
  try {
    const employeeId = req.nextUrl.searchParams.get("employeeId");
    const rangeParam = req.nextUrl.searchParams.get("range") ?? "7d";
    const range: Range = (RANGES as readonly string[]).includes(rangeParam)
      ? (rangeParam as Range)
      : "7d";
    const branchParam = req.nextUrl.searchParams.get("branchId"); // "all" | concrete id | null

    if (!employeeId) {
      return NextResponse.json(
        { ok: false, error: "Sign in required" },
        { status: 401 }
      );
    }
    const emp = await db.employee.findUnique({ where: { id: employeeId } });
    if (!emp || !emp.active) {
      return NextResponse.json(
        { ok: false, error: "Unknown employee" },
        { status: 403 }
      );
    }
    const isPlatformAdmin = emp.role === "platform_admin";
    const isFinanceRole =
      isPlatformAdmin ||
      emp.role === "super_admin" ||
      emp.role === "venue_admin" ||
      emp.role === "admin";
    if (!isFinanceRole) {
      return NextResponse.json(
        { ok: false, error: "Admin access required" },
        { status: 403 }
      );
    }

    // Branch scoping:
    //  - platform_admin → every branch of every venue
    //  - venue_admin    → the branches of THEIR venue (floaters see all of them)
    //  - admin/super    → their pinned branch, or everything when floating
    let allowedBranchIds: Set<string> | null = null;
    if (isPlatformAdmin) {
      if (branchParam && branchParam !== "all") {
        allowedBranchIds = new Set([branchParam]);
      }
    } else if (emp.role === "venue_admin" && emp.venueId) {
      const venueBranches = await db.branch.findMany({
        where: { venueId: emp.venueId },
        select: { id: true },
      });
      const own = new Set(venueBranches.map((b) => b.id));
      allowedBranchIds =
        branchParam && branchParam !== "all"
          ? own.has(branchParam)
            ? new Set([branchParam])
            : new Set() // requested a foreign branch → nothing
          : own;
    } else if (emp.branchId) {
      allowedBranchIds =
        branchParam && branchParam !== "all"
          ? emp.branchId === branchParam
            ? new Set([branchParam])
            : new Set()
          : new Set([emp.branchId]);
    } else if (branchParam && branchParam !== "all") {
      allowedBranchIds = new Set([branchParam]);
    }

    const start = rangeStart(range);
    const orders = await db.order.findMany({
      where: {
        ...(start ? { createdAt: { gte: start } } : {}),
        // a check cancelled in the restaurant POS was never paid
        wedjatSyncStatus: { not: "revoked" },
      },
      select: {
        subtotal: true,
        total: true,
        itemCount: true,
        branchId: true,
        wedjatSyncStatus: true,
        createdAt: true,
      },
      orderBy: { createdAt: "asc" },
    });

    const scoped = orders.filter(
      (o) =>
        !o.branchId ||
        !allowedBranchIds ||
        allowedBranchIds.size === 0 ||
        allowedBranchIds.has(o.branchId)
    );

    // ── summary ──────────────────────────────────────────────────────────
    let grossSales = 0; // menu price before discounts
    let shishaRevenue = 0; // actually charged (commission base)
    let hookahCount = 0;
    for (const o of scoped) {
      grossSales += o.subtotal;
      shishaRevenue += o.total;
      hookahCount += o.itemCount;
    }
    const discounts = Math.max(0, grossSales - shishaRevenue);
    const gp = computeRsmGrossProfit(shishaRevenue);

    // ── per-day buckets (for the trend chart) ────────────────────────────
    const dayMap = new Map<
      string,
      { revenue: number }
    >();
    for (const o of scoped) {
      const key = o.createdAt.toISOString().slice(0, 10);
      const entry = dayMap.get(key) ?? { revenue: 0 };
      entry.revenue += o.total;
      dayMap.set(key, entry);
    }
    const days = [...dayMap.entries()]
      .map(([date, e]) => {
        const d = computeRsmGrossProfit(e.revenue);
        return {
          date,
          revenue: d.shishaRevenue,
          commission: d.commission,
          wedjatGross: d.wedjatGross,
        };
      })
      .sort((a, b) => a.date.localeCompare(b.date));

    // ── per-branch breakdown ─────────────────────────────────────────────
    const branches = await db.branch.findMany({
      select: {
        id: true,
        name: true,
        nameAr: true,
        venue: { select: { id: true, name: true, nameAr: true, kind: true } },
      },
    });
    const branchById = new Map(branches.map((b) => [b.id, b]));
    const branchAgg = new Map<string, { orders: number; revenue: number }>();
    for (const o of scoped) {
      if (!o.branchId) continue;
      const e = branchAgg.get(o.branchId) ?? { orders: 0, revenue: 0 };
      e.orders += 1;
      e.revenue += o.total;
      branchAgg.set(o.branchId, e);
    }
    const branchRows = [...branchAgg.entries()]
      .map(([id, e]) => {
        const b = branchById.get(id);
        const d = computeRsmGrossProfit(e.revenue);
        return {
          branchId: id,
          name: b?.name ?? "—",
          nameAr: b?.nameAr ?? null,
          venueName: b?.venue.name ?? null,
          venueNameAr: b?.venue.nameAr ?? null,
          orders: e.orders,
          ...d,
        };
      })
      .sort((a, b) => b.shishaRevenue - a.shishaRevenue);

    // ── per-venue breakdown (platform admin view) ────────────────────────
    let venueRows: {
      venueId: string;
      name: string;
      nameAr: string | null;
      kind: string;
      orders: number;
      shishaRevenue: number;
      commission: number;
      wedjatGross: number;
      partnerShare: number;
      effectivePct: number;
    }[] = [];
    if (isPlatformAdmin) {
      const venueAgg = new Map<string, { orders: number; revenue: number }>();
      for (const o of scoped) {
        const b = o.branchId ? branchById.get(o.branchId) : undefined;
        const vid = b?.venue.id ?? "unassigned";
        const e = venueAgg.get(vid) ?? { orders: 0, revenue: 0 };
        e.orders += 1;
        e.revenue += o.total;
        venueAgg.set(vid, e);
      }
      venueRows = [...venueAgg.entries()]
        .map(([vid, e]) => {
          const venue =
            branches.find((b) => b.venue.id === vid)?.venue ?? undefined;
          const d = computeRsmGrossProfit(e.revenue);
          return {
            venueId: vid,
            name: venue?.name ?? "Unassigned orders",
            nameAr: venue?.nameAr ?? null,
            kind: venue?.kind ?? "hookah",
            orders: e.orders,
            ...d,
          };
        })
        .sort((a, b) => b.shishaRevenue - a.shishaRevenue);
    }

    // ── Wedjat RSM sync status for the range ─────────────────────────────
    let synced = 0;
    let pending = 0;
    let failed = 0;
    let revoked = 0;
    let syncedRevenue = 0;
    for (const o of orders) {
      // sync counters cover the employee's whole scope (incl. revoked)
      if (
        o.branchId &&
        allowedBranchIds &&
        allowedBranchIds.size > 0 &&
        !allowedBranchIds.has(o.branchId)
      )
        continue;
      if (o.wedjatSyncStatus === "synced") {
        synced += 1;
        syncedRevenue += o.total;
      } else if (o.wedjatSyncStatus === "failed") failed += 1;
      else if (o.wedjatSyncStatus === "revoked") revoked += 1;
      else pending += 1;
    }

    return NextResponse.json({
      ok: true,
      range,
      scope: isPlatformAdmin ? "platform" : "venue",
      constants: {
        commissionPct: SHISHA_COMMISSION_PCT,
        wedjatSharePct: WEDJAT_SHARE_PCT,
        partnerSharePct: PARTNER_SHARE_PCT,
        effectivePct: WEDJAT_EFFECTIVE_PCT,
      },
      summary: {
        orderCount: scoped.length,
        hookahCount,
        grossSales: Math.round(grossSales * 100) / 100,
        discounts: Math.round(discounts * 100) / 100,
        ...gp,
      },
      days,
      branches: branchRows,
      venues: venueRows,
      sync: {
        synced,
        pending,
        failed,
        revoked,
        syncedRevenue: Math.round(syncedRevenue * 100) / 100,
      },
    });
  } catch (err) {
    console.error("rsm finance error", err);
    return NextResponse.json(
      { ok: false, error: "Could not load RSM finance" },
      { status: 500 }
    );
  }
}
