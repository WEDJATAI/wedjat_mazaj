import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePlatformAdmin } from "@/lib/platform-auth";

/**
 * r61 — Platform Control Center · ORDERS explorer.
 *
 * GET /api/platform/orders?employeeId=…&venueId=&status=&days=&limit=&cursor=
 *
 * Cross-venue order feed for the platform owner (shisha-corner orders —
 * the platform's own product; the venues' food & beverage checks live in
 * their own POS and are none of the platform's business).
 *
 * Filters:
 *   venueId — restrict to one venue ("all"/omitted = every venue)
 *   status  — pending | preparing | done (omitted = all)
 *   days    — 1 | 7 | 30 (default 7)
 *   limit   — page size (default 25, max 100)
 *   cursor  — createdAt cursor for pagination (ISO string, exclusive)
 */

interface OrderItemLite {
  primaryBrandName?: string;
  flavorLabel?: string;
  qty?: number;
}

const STATUSES = new Set(["pending", "preparing", "done"]);

export async function GET(req: NextRequest) {
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

    const venueParam = req.nextUrl.searchParams.get("venueId");
    const statusParam = req.nextUrl.searchParams.get("status");
    const daysParam = Number(req.nextUrl.searchParams.get("days") ?? "7");
    const limitParam = Number(req.nextUrl.searchParams.get("limit") ?? "25");
    const cursorParam = req.nextUrl.searchParams.get("cursor");

    const days = [1, 7, 30].includes(daysParam) ? daysParam : 7;
    const limit = Math.min(Math.max(Number.isFinite(limitParam) ? limitParam : 25, 1), 100);

    // venue filter → its branch ids
    let branchFilter: string[] | null = null;
    if (venueParam && venueParam !== "all") {
      const venue = await db.venue.findUnique({
        where: { id: venueParam },
        include: { branches: { select: { id: true } } },
      });
      if (!venue) {
        return NextResponse.json({ ok: false, error: "Unknown venue" }, { status: 400 });
      }
      branchFilter = venue.branches.map((b) => b.id);
    }

    const start = new Date();
    start.setDate(start.getDate() - (days - 1));
    start.setHours(0, 0, 0, 0);

    const where = {
      createdAt: {
        gte: start,
        ...(cursorParam ? { lt: new Date(cursorParam) } : {}),
      },
      ...(statusParam && STATUSES.has(statusParam) ? { status: statusParam } : {}),
      ...(branchFilter
        ? { branchId: { in: branchFilter } }
        : {}),
    };

    const [orders, branches] = await Promise.all([
      db.order.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit + 1,
        select: {
          id: true,
          customerName: true,
          table: true,
          itemsJson: true,
          total: true,
          itemCount: true,
          status: true,
          source: true,
          revision: true,
          branchId: true,
          createdAt: true,
        },
      }),
      db.branch.findMany({
        select: {
          id: true,
          name: true,
          nameAr: true,
          venue: { select: { id: true, name: true, nameAr: true } },
        },
      }),
    ]);

    const branchById = new Map(branches.map((b) => [b.id, b]));
    const hasMore = orders.length > limit;
    const page = hasMore ? orders.slice(0, limit) : orders;

    return NextResponse.json({
      ok: true,
      orders: page.map((o) => {
        const b = o.branchId ? branchById.get(o.branchId) : undefined;
        let items: OrderItemLite[] = [];
        try {
          items = JSON.parse(o.itemsJson) as OrderItemLite[];
        } catch {
          items = [];
        }
        return {
          id: o.id,
          customer: o.customerName ?? null,
          table: o.table ?? null,
          total: o.total,
          hookahs: o.itemCount,
          status: o.status,
          source: o.source,
          revision: o.revision,
          venue: b?.venue ? { id: b.venue.id, name: b.venue.name, nameAr: b.venue.nameAr } : null,
          branch: b ? { id: b.id, name: b.name, nameAr: b.nameAr } : null,
          itemSummary: items
            .slice(0, 3)
            .map((it) => `${it.primaryBrandName ?? "?"} ${it.flavorLabel ?? ""}`.trim())
            .join(" · "),
          createdAt: o.createdAt.toISOString(),
        };
      }),
      nextCursor: hasMore ? page[page.length - 1]?.createdAt.toISOString() ?? null : null,
    });
  } catch (err) {
    console.error("platform orders error", err);
    return NextResponse.json(
      { ok: false, error: "Could not load orders" },
      { status: 500 }
    );
  }
}
