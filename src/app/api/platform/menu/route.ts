import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { z } from "zod";
import { requirePlatformAdminSession } from "@/lib/auth";
import { BRANDS, type BrandPricing } from "@/lib/catalog";
import {
  SETTING_KEYS,
  getMenuPricing,
  invalidateSettingsCache,
  applyPricingMap,
} from "@/lib/platform-settings";

/**
 * r61 — Platform Control Center · MENU (the platform-owned shisha menu).
 *
 * GET /api/platform/menu?employeeId=…
 *   → every brand with: current EFFECTIVE pricing (defaults + overrides),
 *     the compiled-in defaults (for one-tap reset), flavor list, packs.
 *
 * PUT /api/platform/menu
 *   { employeeId, pricing: { [brandId]: { fruits?, fruitsMix?, flat? } } }
 *   → replaces the override map. Empty per-brand object = back to default.
 *
 * Overrides apply server-side at order/amend recompute (the authoritative
 * charge) and are broadcast to clients through /api/menu/pricing.
 */

/** Pristine compiled-in pricing, captured at module load (before any
 *  runtime override can mutate the BRANDS array) — powers “reset to
 *  default” in the Menu tab. */
const DEFAULT_PRICING: Record<string, BrandPricing> = Object.fromEntries(
  BRANDS.map((b) => [b.id, { ...b.pricing }])
);

export async function GET(req: NextRequest) {
  try {
    const guard = await requirePlatformAdminSession(req);
    if ("resp" in guard) return guard.resp;
    const overrides = await getMenuPricing();
    // reflect the persisted overrides in this instance before reporting
    applyPricingMap(overrides);
    return NextResponse.json({
      ok: true,
      brands: BRANDS.map((b) => ({
        id: b.id,
        name: b.name,
        logo: b.logo,
        category: b.category,
        badge: b.badge ?? null,
        flavorCount: b.flavors.length,
        flavors: b.flavors,
        packs: b.packs,
        pricing: b.pricing, // effective (overrides applied above)
        defaults: { ...DEFAULT_PRICING[b.id] },
        overridden: Object.keys(overrides[b.id] ?? {}).length > 0,
      })),
    });
  } catch (err) {
    console.error("platform menu get error", err);
    return NextResponse.json(
      { ok: false, error: "Could not load the menu" },
      { status: 500 }
    );
  }
}

const PutSchema = z.object({
  pricing: z.record(
    z.string(),
    z.object({
      fruits: z.number().min(0).max(100000).optional(),
      fruitsMix: z.number().min(0).max(100000).optional(),
      flat: z.number().min(0).max(100000).optional(),
    })
  ),
});

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = PutSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 }
      );
    }
    const data = parsed.data;
    const guard = await requirePlatformAdminSession(req);
    if ("resp" in guard) return guard.resp;
    const adminName = guard.emp.name;

    // keep only known brands + at least one field each
    const known = new Set(BRANDS.map((b) => b.id));
    const clean: Record<string, Partial<BrandPricing>> = {};
    for (const [brandId, pricing] of Object.entries(data.pricing)) {
      if (!known.has(brandId)) continue;
      const entry: Partial<BrandPricing> = {};
      if (typeof pricing.fruits === "number") entry.fruits = pricing.fruits;
      if (typeof pricing.fruitsMix === "number") entry.fruitsMix = pricing.fruitsMix;
      if (typeof pricing.flat === "number") entry.flat = pricing.flat;
      if (Object.keys(entry).length > 0) clean[brandId] = entry;
    }

    await db.platformSetting.upsert({
      where: { key: SETTING_KEYS.menu },
      update: { value: JSON.stringify(clean), updatedBy: adminName },
      create: { key: SETTING_KEYS.menu, value: JSON.stringify(clean), updatedBy: adminName },
    });
    invalidateSettingsCache(SETTING_KEYS.menu);
    applyPricingMap(clean); // apply immediately in this instance

    return NextResponse.json({ ok: true, pricing: clean });
  } catch (err) {
    console.error("platform menu put error", err);
    return NextResponse.json(
      { ok: false, error: "Could not save menu pricing" },
      { status: 500 }
    );
  }
}
