import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { BRANDS } from "@/lib/catalog";
import { resolveBranchScope } from "@/lib/branch-scope";

/**
 * r57 — branch-scoped per-flavor stock.
 * ?branchId=<id> | all | (default branch). The "all" scope sums each
 * flavor across branches (venue-admin matrix).
 */
export async function GET(req: NextRequest) {
  try {
    const raw = req.nextUrl.searchParams.get("branchId");
    const { branchId } = await resolveBranchScope(raw);

    const rows = await db.flavorStock.findMany({
      where: branchId
        ? { brand: { branchId } }
        : undefined,
      orderBy: [{ brandName: "asc" }, { flavorName: "asc" }],
    });

    const merged = BRANDS.flatMap((b) =>
      b.flavors.map((f) => {
        const matches = rows.filter(
          (r) => r.brandIdRaw === b.id && r.flavorName === f
        );
        const total = matches.reduce((s, r) => s + r.stockGrams, 0);
        return {
          id: `${b.id}:${f}`,
          brandIdRaw: b.id,
          brandName: b.name,
          flavorName: f,
          stockGrams: branchId ? (matches[0]?.stockGrams ?? 0) : total,
          lowStockThreshold: matches[0]?.lowStockThreshold ?? 60,
          // r69 (audit ③) — truthfulness: a flavor with no DB row is
          // "untracked" — it no longer fabricates a fake just-updated
          // timestamp (which masked a fully wiped DB during the r68
          // audit). Clients get tracked:false + updatedAt:null and can
          // tell "not stocked yet" from "stocked but sold out" via the
          // branchStocked flag below.
          tracked: matches.length > 0,
          updatedAt: matches[0]?.updatedAt ?? null,
        };
      })
    );
    return NextResponse.json({
      ok: true,
      branchId,
      items: merged,
      // r69 — does this scope have ANY tracked jar? false = the shelf
      // hasn't been stocked at all (guests get the "not stocked yet"
      // empty state instead of a misleading "sold out").
      branchStocked: rows.length > 0,
    });
  } catch (err) {
    console.error("flavor-stock list error", err);
    return NextResponse.json(
      { ok: false, error: "Could not load flavor stock" },
      { status: 500 }
    );
  }
}
