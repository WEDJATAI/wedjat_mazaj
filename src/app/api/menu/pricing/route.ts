import { NextResponse } from "next/server";
import { BRANDS } from "@/lib/catalog";
import { getMenuPricing, applyPricingMap } from "@/lib/platform-settings";

/**
 * r61 — PUBLIC effective menu pricing (client price sync).
 *
 * GET /api/menu/pricing  →  { pricing: { [brandId]: {fruits, fruitsMix, flat} },
 *                             overrides: { [brandId]: {...} }, v: timestamp }
 *
 * No auth — prices are public menu information. Every client (guest or
 * staff) fetches this once on app mount and applies it to the in-memory
 * catalog so the WHOLE app (cards, config sheets, cart, checkout) shows
 * exactly what the platform owner published. The server charge path
 * applies the same overrides at order time — one source of truth.
 */

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const overrides = await getMenuPricing();
    applyPricingMap(overrides);
    const pricing: Record<string, { fruits?: number; fruitsMix?: number; flat?: number }> = {};
    for (const b of BRANDS) {
      pricing[b.id] = { ...b.pricing };
    }
    return NextResponse.json({
      ok: true,
      pricing,
      overrides,
      v: Date.now(),
    });
  } catch {
    // DB down → the compiled defaults are already correct; clients simply
    // keep whatever they cached last (offline-first)
    const pricing: Record<string, { fruits?: number; fruitsMix?: number; flat?: number }> = {};
    for (const b of BRANDS) pricing[b.id] = { ...b.pricing };
    return NextResponse.json({ ok: true, pricing, overrides: {}, v: 0 });
  }
}
