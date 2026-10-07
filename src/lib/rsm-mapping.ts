// R46: mazaj ⇄ Wedjat RSM mapping.
//
// The RSM webhook prices check lines from ITS OWN catalog (house prices),
// matching items by productId | sku | name. This module builds the shared
// vocabulary so both sides always agree:
//
//   · buildRsmCatalogMatrix() — the brand×type price matrix (+ sellable
//     add-ons) pushed to RSM's /api/integrations/mazaj/catalog. Every SKU
//     lives in the MAZAJ- namespace, which is the only range the catalog
//     endpoint is allowed to manage.
//   · mapOrderToWebhook() — a mazaj Order → webhook payload. One mazaj
//     cart item becomes ONE check line: the brand×type product (its price
//     class), the exact flavor mix riding in the line notes. Mixes map to
//     the DOMINANT brand's mix product (the one setting the price — e.g.
//     any mix containing Amy is "Amy Fruits Mix" at 180). The BYO 2-for-1
//     promo is represented by the CHARGEABLE quantity (what the guest
//     pays), with the served count in the notes.
//   · buildAvailabilityItems() — FlavorStock/InventoryItem/SupplyItem →
//     the availability mirror pushed to RSM's inventory endpoint.

import {
  BRANDS,
  SELLABLE_ADDONS,
  MOLASSES_GRAMS,
  chargeableQty,
  getBrand,
  type Brand,
} from "./catalog";

// ── catalog matrix ────────────────────────────────────────────────────

export interface RsmCatalogProduct {
  sku: string;
  name: string;
  nameAr: string | null;
  price: number;
  active: boolean;
}

const AR_BRAND: Record<string, string> = {
  mazaya: "مازايا",
  "al-fakher": "الفاخر",
  dandash: "دندش",
  nakhla: "نخلة",
  amy: "ايمي",
  salom: "سالم",
  kass: "كاس",
};

function skuSlug(brandId: string): string {
  return brandId.toUpperCase();
}

/** The check-side product for a brand + flavor type (fruits / mix / flat). */
export function matrixProduct(brand: Brand, type: "fruits" | "mix" | "flat"): RsmCatalogProduct {
  const ar = AR_BRAND[brand.id] ?? brand.name;
  if (type === "flat") {
    return {
      sku: `MAZAJ-${skuSlug(brand.id)}`,
      name: `${brand.name} Standard`,
      nameAr: `${ar} عادي`,
      price: brand.pricing.flat ?? 0,
      active: true,
    };
  }
  if (type === "fruits") {
    return {
      sku: `MAZAJ-${skuSlug(brand.id)}-FRUITS`,
      name: `${brand.name} Fruits`,
      nameAr: `${ar} فواكه`,
      price: brand.pricing.fruits ?? 0,
      active: true,
    };
  }
  return {
    sku: `MAZAJ-${skuSlug(brand.id)}-MIX`,
    name: `${brand.name} Fruits Mix`,
    nameAr: `${ar} مكس فواكه`,
    price: brand.pricing.fruitsMix ?? 0,
    active: true,
  };
}

/** The full catalog matrix (brand×type price points + sellable add-ons). */
export function buildRsmCatalogMatrix(): RsmCatalogProduct[] {
  const out: RsmCatalogProduct[] = [];
  for (const brand of BRANDS) {
    if (brand.pricing.fruits != null) out.push(matrixProduct(brand, "fruits"));
    if (brand.pricing.fruitsMix != null) out.push(matrixProduct(brand, "mix"));
    if (brand.pricing.flat != null) out.push(matrixProduct(brand, "flat"));
  }
  for (const addon of SELLABLE_ADDONS) {
    out.push({
      sku: `MAZAJ-${addon.key.toUpperCase().replace(/_/g, "-")}`,
      name: addon.name,
      nameAr: null,
      price: addon.sellPrice,
      active: true,
    });
  }
  return out;
}

// ── order mapping ─────────────────────────────────────────────────────

/** Serialized cart item (the itemsJson shape written by POST /api/orders). */
export interface OrderItemJson {
  id: string;
  primaryBrandId: string;
  primaryBrandName: string;
  flavor: "fruits" | "fruits-mix" | "flat";
  flavorLabel: string;
  components: {
    brandId: string;
    brandName: string;
    flavorName: string;
    grams: number;
    emoji?: string;
  }[];
  molassesGrams?: number;
  unitPrice: number;
  qty: number;
}

export interface WebhookItem {
  sku: string;
  name: string;
  quantity: number;
  unitPrice: number;
  notes?: string;
}

/**
 * The brand that sets a mix's price: the component brand with the HIGHEST
 * fruits-mix price (Amy 180 wins over the 145 regulars). Ties resolve to
 * the first component — the price is identical either way.
 */
export function dominantMixBrand(components: { brandId: string }[]): Brand {
  let best = getBrand(components[0]?.brandId ?? "mazaya") ?? BRANDS[0];
  for (const c of components) {
    const b = getBrand(c.brandId);
    if (b && (b.pricing.fruitsMix ?? 0) > (best.pricing.fruitsMix ?? 0)) best = b;
  }
  return best;
}

function componentNotes(item: OrderItemJson): string {
  return item.components
    .map((c) => `${c.brandName} ${c.flavorName}`)
    .join(" + ")
    .slice(0, 180);
}

/**
 * Map a mazaj order to RSM webhook items.
 * `bogo` (BYO 2-for-1) collapses quantities to the CHARGEABLE count — the
 * check must bill exactly what the guest pays — with the served count in
 * the line notes so the shisha man still sees the full order.
 */
export function mapOrderItems(
  items: OrderItemJson[],
  bogo: boolean,
  addons: string[] = [],
): WebhookItem[] {
  const out: WebhookItem[] = [];
  for (const it of items) {
    const brand =
      it.flavor === "fruits-mix"
        ? dominantMixBrand(it.components)
        : (getBrand(it.primaryBrandId) ?? BRANDS[0]);
    const product =
      it.flavor === "fruits"
        ? matrixProduct(brand, "fruits")
        : it.flavor === "fruits-mix"
          ? matrixProduct(brand, "mix")
          : matrixProduct(brand, "flat");
    const served = it.qty;
    const charged = chargeableQty(it.qty, bogo);
    const notes =
      componentNotes(it) +
      (bogo && charged < served ? ` · BYO 2-for-1: ${served} served, ${charged} charged` : "");
    out.push({
      sku: product.sku,
      name: product.name,
      quantity: charged,
      unitPrice: it.unitPrice,
      notes: notes || undefined,
    });
  }
  // sellable add-ons (e.g. medical hose) — one line per unit chosen
  for (const addon of SELLABLE_ADDONS) {
    const count = addons.filter((k) => k === addon.key).length;
    if (count > 0) {
      out.push({
        sku: `MAZAJ-${addon.key.toUpperCase().replace(/_/g, "-")}`,
        name: addon.name,
        quantity: count,
        unitPrice: addon.sellPrice,
      });
    }
  }
  return out.filter((i) => i.quantity > 0);
}

// ── availability mapping ──────────────────────────────────────────────

export interface AvailabilityItem {
  sku: string;
  available: boolean;
  quantity: number;
}

export interface StockSnapshot {
  /** per-brand total grams (InventoryItem) */
  brandTotals: Map<string, number>;
  /** per-brand×flavor grams (FlavorStock) */
  flavorStock: { brandIdRaw: string; flavorName: string; stockGrams: number }[];
  /** per-supply-key units (SupplyItem) */
  supplies: Map<string, number>;
}

/**
 * Availability per catalog product:
 *  · brand products — available when ANY flavor of the brand holds at
 *    least one hookah's worth of molasses (20g); quantity = whole
 *    hookahs the brand's total flavor stock can still make.
 *  · add-ons (medical hose) — available when supply stock > 0.
 */
export function buildAvailabilityItems(snapshot: StockSnapshot): AvailabilityItem[] {
  const out: AvailabilityItem[] = [];
  for (const brand of BRANDS) {
    const flavors = snapshot.flavorStock.filter((f) => f.brandIdRaw === brand.id);
    const flavorGrams = flavors.reduce((s, f) => s + f.stockGrams, 0);
    const totalGrams = flavorGrams > 0 ? flavorGrams : (snapshot.brandTotals.get(brand.id) ?? 0);
    const available = totalGrams >= MOLASSES_GRAMS;
    const quantity = Math.floor(totalGrams / MOLASSES_GRAMS);
    for (const type of ["fruits", "mix", "flat"] as const) {
      if (type === "fruits" && brand.pricing.fruits == null) continue;
      if (type === "mix" && brand.pricing.fruitsMix == null) continue;
      if (type === "flat" && brand.pricing.flat == null) continue;
      out.push({ sku: matrixProduct(brand, type).sku, available, quantity });
    }
  }
  for (const addon of SELLABLE_ADDONS) {
    const stock = snapshot.supplies.get(addon.key) ?? 0;
    out.push({
      sku: `MAZAJ-${addon.key.toUpperCase().replace(/_/g, "-")}`,
      available: stock > 0,
      quantity: Math.floor(stock),
    });
  }
  return out;
}
