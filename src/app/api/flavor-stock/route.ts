import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { BRANDS } from "@/lib/catalog";
import { resolveBranchScope } from "@/lib/branch-scope";

/**
 * r57 — branch-scoped per-flavor stock.
 * r68-audit — `stocked: false` when the branch has NO flavor jars at all
 * (a brand-new / pending branch): the client can then say "not stocked
 * yet" instead of "sold out", and we stop fabricating fresh `updatedAt`
 * stamps for jars that don't exist.
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

    // r68-audit: no jars at this branch → the menu is NOT stocked (don't
    // invent a full 0g catalog with fresh timestamps — say it plainly).
    if (rows.length === 0) {
      return NextResponse.json({
        ok: true,
        branchId,
        stocked: false,
        items: [],
      });
    }

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
          updatedAt: matches[0]?.updatedAt ?? new Date().toISOString(),
        };
      })
    );
    return NextResponse.json({ ok: true, branchId, stocked: true, items: merged });
  } catch (err) {
    console.error("flavor-stock list error", err);
    return NextResponse.json(
      { ok: false, error: "Could not load flavor stock" },
      { status: 500 }
    );
  }
}
