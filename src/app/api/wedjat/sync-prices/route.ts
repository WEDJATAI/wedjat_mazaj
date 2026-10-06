import { NextRequest, NextResponse } from "next/server";
import { syncProductPriceToWedjat } from "@/lib/wedjat";
import { BRANDS } from "@/lib/catalog";
import { z } from "zod";

// POST /api/wedjat/sync-prices
// Pushes Mazaj shisha prices to Wedjat RSM products (matched by name).
// Call this when prices change, or manually from the sync dashboard.
const Schema = z.object({
  // Optional: specific product name + price. If omitted, syncs ALL shisha prices.
  productName: z.string().optional(),
  price: z.number().positive().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const parsed = Schema.safeParse(body);

    // Build the list of products to sync
    const toSync: { name: string; price: number }[] = [];

    if (parsed.success && parsed.data.productName && parsed.data.price) {
      toSync.push({ name: parsed.data.productName, price: parsed.data.price });
    } else {
      // Sync all shisha prices: each brand × flavor type → a product name
      for (const brand of BRANDS) {
        if (brand.pricing.fruits) {
          toSync.push({
            name: `${brand.name} Fruits`,
            price: brand.pricing.fruits,
          });
        }
        if (brand.pricing.fruitsMix) {
          toSync.push({
            name: `${brand.name} Fruits Mix`,
            price: brand.pricing.fruitsMix,
          });
        }
        if (brand.pricing.flat) {
          toSync.push({
            name: `${brand.name} Standard`,
            price: brand.pricing.flat,
          });
        }
      }
    }

    const results: { name: string; ok: boolean; updated: number; error?: string }[] = [];
    for (const item of toSync) {
      const result = await syncProductPriceToWedjat(item.name, item.price);
      results.push({
        name: item.name,
        ok: result.ok,
        updated: result.updated,
        error: result.error,
      });
    }

    const successCount = results.filter((r) => r.ok).length;
    return NextResponse.json({
      ok: true,
      synced: successCount,
      total: toSync.length,
      results,
    });
  } catch (err) {
    console.error("sync prices error", err);
    return NextResponse.json(
      { ok: false, error: "Could not sync prices" },
      { status: 500 }
    );
  }
}
