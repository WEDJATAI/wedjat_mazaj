// Hookah catalog & pricing rules for the Egyptian market.
// Business rules:
//  - Each hookah = 20g molasses.
//  - Regular brands (Mazaya, Al Fakher, Dandash, Nakhla): Fruits 125 EGP, Fruits Mix 145 EGP.
//  - Amy (premium): Fruits 180 EGP, Fruits Mix 180 EGP.
//  - Salom & Kass (special): 45 EGP flat (no fruits/mix distinction).
//  - BYO promo: bring your own hookah OR your own molasses -> 2 hookahs for the price of 1.
//  - Mix & match: a "fruits-mix" hookah may combine flavors from different brands.
//    Its price is the MAX mix price across the chosen brands (Amy 180 wins if included,
//    otherwise 145).

export type FlavorType = "fruits" | "fruits-mix" | "flat";
export type BrandCategory = "regular" | "premium" | "special";

/**
 * Top-level shisha category for the two-step selection flow.
 *  - "regular": Mazaya, Al Fakher, Dandash, Nakhla, Salom, Kass
 *  - "amy":     Amy premium line only
 */
export type ShishaCategory = "regular" | "amy";

export interface ShishaCategoryDef {
  key: ShishaCategory;
  label: string;
  desc: string;
  emoji: string;
  logo: string;
  brandIds: string[];
}

export const SHISHA_CATEGORIES: ShishaCategoryDef[] = [
  {
    key: "regular",
    label: "Regular shisha",
    desc: "Mazaya · Al Fakher · Dandash · Nakhla · Salom · Kass",
    emoji: "🌿",
    logo: "/images/brands/regular.png",
    brandIds: [
      "mazaya",
      "al-fakher",
      "dandash",
      "nakhla",
      "salom",
      "kass",
    ],
  },
  {
    key: "amy",
    label: "Amy shisha",
    desc: "Premium line · fruits & mix 180 EGP",
    emoji: "👑",
    logo: "/images/brands/amy.jpg",
    brandIds: ["amy"],
  },
];

export function getShishaCategory(key: string): ShishaCategoryDef | undefined {
  return SHISHA_CATEGORIES.find((c) => c.key === key);
}

export function brandsForCategory(key: string): Brand[] {
  const cat = getShishaCategory(key);
  if (!cat) return BRANDS;
  return cat.brandIds
    .map((id) => getBrand(id))
    .filter((b): b is Brand => !!b);
}

export interface BrandPricing {
  fruits?: number; // EGP
  fruitsMix?: number; // EGP
  flat?: number; // EGP (Salom / Kass)
}

export interface Brand {
  id: string;
  name: string;
  origin: string;
  category: BrandCategory;
  molassesGrams: number;
  pricing: BrandPricing;
  /** tailwind gradient classes for the brand card accent */
  accent: string;
  /** subtle ring color class */
  ring: string;
  emoji: string;
  /** path to the brand logo image (in /public/images/brands/) */
  logo: string;
  blurb: string;
  flavorTypes: FlavorType[];
  /** flavors available for this brand */
  flavors: string[];
  /** short barcode used by the guest scanner, e.g. "MZ-001" */
  barcode: string;
  /** purchasable pack sizes for this brand (Egyptian market wholesale) */
  packs: PackOption[];
  badge?: string;
}

/** A purchasable pack of molasses. */
export interface PackOption {
  /** grams in the pack (e.g. 250 or 1000) */
  grams: number;
  /** pack label, e.g. "250g pack" */
  label: string;
  /** wholesale cost in EGP to buy this pack */
  costEgp: number;
}

export const MOLASSES_GRAMS = 20;

export const BRANDS: Brand[] = [
  {
    id: "mazaya",
    name: "Mazaya",
    origin: "Jordan · blended for Egypt",
    category: "regular",
    molassesGrams: MOLASSES_GRAMS,
    pricing: { fruits: 125, fruitsMix: 145 },
    accent: "from-rose-500/25 to-amber-500/5",
    ring: "ring-rose-500/40",
    emoji: "🌹",
    blurb: "Juicy, smooth clouds — a modern lounge favourite.",
    flavorTypes: ["fruits", "fruits-mix"],
    flavors: [
      "Blueberry",
      "Watermelon",
      "Grape",
      "Double Apple",
      "Mint",
      "Lemon",
      "Peach",
      "Guava",
    ],
    logo: "/images/brands/mazaya.png",
    barcode: "MZ-001",
    packs: [
      { grams: 250, label: "250g pack", costEgp: 85 },
      { grams: 1000, label: "1kg pack", costEgp: 280 },
    ],
  },
  {
    id: "al-fakher",
    name: "Al Fakher",
    origin: "UAE · market staple",
    category: "regular",
    molassesGrams: MOLASSES_GRAMS,
    pricing: { fruits: 125, fruitsMix: 145 },
    accent: "from-red-500/25 to-orange-500/5",
    ring: "ring-red-500/40",
    emoji: "🔴",
    blurb: "Reliable, flavour-packed sessions every time.",
    flavorTypes: ["fruits", "fruits-mix"],
    flavors: [
      "Double Apple",
      "Mint",
      "Grape",
      "Watermelon",
      "Blueberry",
      "Lemon",
      "Peach",
      "Rose",
    ],
    logo: "/images/brands/al-fakher.jpg",
    barcode: "AF-002",
    packs: [
      { grams: 250, label: "250g pack", costEgp: 90 },
      { grams: 1000, label: "1kg pack", costEgp: 300 },
    ],
  },
  {
    id: "dandash",
    name: "Dandash",
    origin: "Egypt · homegrown",
    category: "regular",
    molassesGrams: MOLASSES_GRAMS,
    pricing: { fruits: 125, fruitsMix: 145 },
    accent: "from-amber-500/25 to-yellow-500/5",
    ring: "ring-amber-500/40",
    emoji: "🟡",
    blurb: "Local classic with rich, traditional taste.",
    flavorTypes: ["fruits", "fruits-mix"],
    flavors: ["Double Apple", "Grape", "Mint", "Watermelon", "Lemon", "Peach"],
    logo: "/images/brands/dandash.png",
    barcode: "DN-003",
    packs: [
      { grams: 250, label: "250g pack", costEgp: 70 },
      { grams: 1000, label: "1kg pack", costEgp: 240 },
    ],
  },
  {
    id: "nakhla",
    name: "Nakhla",
    origin: "Egypt · since 1913",
    category: "regular",
    molassesGrams: MOLASSES_GRAMS,
    pricing: { fruits: 125, fruitsMix: 145 },
    accent: "from-yellow-500/25 to-amber-600/5",
    ring: "ring-yellow-500/40",
    emoji: "📜",
    blurb: "The oldest name in Egyptian molasses.",
    flavorTypes: ["fruits", "fruits-mix"],
    flavors: [
      "Double Apple",
      "Mint",
      "Grape",
      "Cinnamon",
      "Peach",
      "Watermelon",
      "Rose",
    ],
    logo: "/images/brands/nakhla.jpg",
    barcode: "NK-004",
    packs: [
      { grams: 250, label: "250g pack", costEgp: 65 },
      { grams: 1000, label: "1kg pack", costEgp: 220 },
    ],
  },
  {
    id: "amy",
    name: "Amy",
    origin: "Egypt · premium line",
    category: "premium",
    molassesGrams: MOLASSES_GRAMS,
    pricing: { fruits: 180, fruitsMix: 180 },
    accent: "from-amber-400/30 to-yellow-300/5",
    ring: "ring-amber-300/50",
    emoji: "👑",
    blurb: "Top-shelf sessions — fruits & mix both 180 EGP.",
    flavorTypes: ["fruits", "fruits-mix"],
    flavors: [
      "Double Apple",
      "Grape",
      "Mint",
      "Watermelon",
      "Peach",
      "Blueberry",
    ],
    logo: "/images/brands/amy.jpg",
    barcode: "AM-005",
    packs: [
      { grams: 250, label: "250g pack", costEgp: 110 },
      { grams: 1000, label: "1kg pack", costEgp: 380 },
    ],
    badge: "Premium",
  },
  {
    id: "salom",
    name: "Salom",
    origin: "Egypt · everyday",
    category: "special",
    molassesGrams: MOLASSES_GRAMS,
    pricing: { flat: 45 },
    accent: "from-orange-500/25 to-amber-500/5",
    ring: "ring-orange-500/40",
    emoji: "🟠",
    blurb: "Light, budget-friendly sessions — 45 EGP flat.",
    flavorTypes: ["flat"],
    flavors: ["Standard", "Apple", "Grape", "Mint"],
    logo: "/images/brands/salom.jpeg",
    barcode: "SL-006",
    packs: [{ grams: 250, label: "250g pack", costEgp: 35 }],
  },
  {
    id: "kass",
    name: "Kass",
    origin: "Egypt · everyday",
    category: "special",
    molassesGrams: MOLASSES_GRAMS,
    pricing: { flat: 45 },
    accent: "from-red-600/25 to-rose-500/5",
    ring: "ring-red-400/40",
    emoji: "🟥",
    blurb: "Quick, affordable smoke — 45 EGP flat.",
    flavorTypes: ["flat"],
    flavors: ["Standard", "Apple", "Grape", "Mint"],
    logo: "/images/brands/kass.jpg",
    barcode: "KS-007",
    packs: [{ grams: 250, label: "250g pack", costEgp: 35 }],
  },
];

export const FLAVOR_LABELS: Record<FlavorType, string> = {
  fruits: "Fruits",
  "fruits-mix": "Fruits Mix",
  flat: "Standard",
};

/** Stable color per brand for the visual bowl builder (hex). */
export const BRAND_COLORS: Record<string, string> = {
  mazaya: "#f43f5e", // rose
  "al-fakher": "#ef4444", // red
  dandash: "#f59e0b", // amber
  nakhla: "#eab308", // yellow
  amy: "#fbbf24", // gold
  salom: "#f97316", // orange
  kass: "#dc2626", // dark red
};

export function brandColor(brandId: string): string {
  return BRAND_COLORS[brandId] ?? "#f59e0b";
}

/** House-special preset bowls for one-tap quick-add. */
export interface BowlPreset {
  id: string;
  name: string;
  emoji: string;
  components: { brandId: string; flavorName: string }[];
  tag: string;
}

export const BOWL_PRESETS: BowlPreset[] = [
  {
    id: "blue-mint",
    name: "Blue Mint Bliss",
    emoji: "💙",
    tag: "House special",
    components: [
      { brandId: "mazaya", flavorName: "Blueberry" },
      { brandId: "al-fakher", flavorName: "Mint" },
    ],
  },
  {
    id: "double-apple-classic",
    name: "Double Apple Classic",
    emoji: "🍎",
    tag: "Bestseller",
    components: [
      { brandId: "nakhla", flavorName: "Double Apple" },
    ],
  },
  {
    id: "grape-mint-fresh",
    name: "Grape Mint Fresh",
    emoji: "🍇",
    tag: "Refreshing",
    components: [
      { brandId: "al-fakher", flavorName: "Grape" },
      { brandId: "al-fakher", flavorName: "Mint" },
    ],
  },
  {
    id: "watermelon-peach",
    name: "Watermelon Peach",
    emoji: "🍉",
    tag: "Summer",
    components: [
      { brandId: "mazaya", flavorName: "Watermelon" },
      { brandId: "dandash", flavorName: "Peach" },
    ],
  },
  {
    id: "amy-premium",
    name: "Amy Premium Mix",
    emoji: "👑",
    tag: "Premium",
    components: [
      { brandId: "amy", flavorName: "Blueberry" },
      { brandId: "amy", flavorName: "Mint" },
    ],
  },
];

export function getBrand(id: string): Brand | undefined {
  return BRANDS.find((b) => b.id === id);
}

export function getBrandByBarcode(code: string): Brand | undefined {
  const c = code.trim().toUpperCase();
  return BRANDS.find((b) => b.barcode.toUpperCase() === c);
}

/** All mixable brands (everything except flat Salom/Kass used as mix base). */
export const MIXABLE_BRANDS = BRANDS.filter((b) => b.pricing.fruitsMix !== undefined);

/** All known flavors grouped by brand, used by the mix picker. */
export function flavorGroups(): { brandId: string; brandName: string; emoji: string; flavors: string[] }[] {
  return MIXABLE_BRANDS.map((b) => ({
    brandId: b.id,
    brandName: b.name,
    emoji: b.emoji,
    flavors: b.flavors,
  }));
}

/** Unit price for a single-brand hookah (fruits / flat). */
export function unitPrice(brand: Brand, flavor: FlavorType): number {
  if (flavor === "fruits") return brand.pricing.fruits ?? 0;
  if (flavor === "fruits-mix") return brand.pricing.fruitsMix ?? 0;
  return brand.pricing.flat ?? 0;
}

/**
 * Price for a mix hookah given the set of brands involved.
 * Cross-brand mixes use the MAX mix price among the chosen brands
 * (so Amy 180 wins if included, otherwise 145).
 */
export function mixPrice(brandIds: string[]): number {
  const prices = brandIds
    .map((id) => getBrand(id)?.pricing.fruitsMix)
    .filter((p): p is number => typeof p === "number" && p > 0);
  if (prices.length === 0) return 0;
  return Math.max(...prices);
}

/**
 * Chargeable quantity given a raw quantity and whether the BYO (2-for-1)
 * promo is active. With BOGO, every pair costs the price of one, so the
 * chargeable count is ceil(qty / 2).
 */
export function chargeableQty(qty: number, bogo: boolean): number {
  if (!bogo || qty <= 0) return Math.max(0, qty);
  return Math.ceil(qty / 2);
}

/** Format a price in Egyptian Pounds. */
export function egp(n: number): string {
  const rounded = Math.round(n * 100) / 100;
  return `${rounded.toLocaleString("en-US", {
    maximumFractionDigits: rounded % 1 === 0 ? 0 : 2,
  })} EGP`;
}

// ---------------------------------------------------------------------------
// Supplies (consumables: coal, foil). Tracked separately from molasses and
// auto-deducted when an order is placed.
// ---------------------------------------------------------------------------

export interface SupplyDef {
  key: string;
  name: string;
  unit: string; // "pcs" | "sheets"
  emoji: string;
  /** how many units are consumed per single hookah in an order (0 = reusable, not auto-deducted) */
  perHookah: number;
  /** unit cost to the business in EGP (for COGS/profit calc) */
  cost: number;
  /** selling price to the client in EGP when chosen as an add-on (0 = not sellable) */
  sellPrice: number;
  defaultStock: number;
  lowThreshold: number;
}

export const SUPPLIES: SupplyDef[] = [
  {
    key: "regular_coal",
    name: "Regular coal",
    unit: "pcs",
    emoji: "⚫",
    perHookah: 1,
    cost: 1.2, // ~120 EGP / 100 pcs box
    sellPrice: 0, // not sold separately
    defaultStock: 200,
    lowThreshold: 30,
  },
  {
    key: "cubed_coal",
    name: "Cubed coal",
    unit: "pcs",
    emoji: "🟫",
    perHookah: 1,
    cost: 1.8, // ~130 EGP / 72 pcs box
    sellPrice: 0,
    defaultStock: 150,
    lowThreshold: 25,
  },
  {
    key: "foil",
    name: "Foil",
    unit: "sheets",
    emoji: "📄",
    perHookah: 1,
    cost: 0.5, // ~50 EGP / 100 sheets roll
    sellPrice: 0,
    defaultStock: 300,
    lowThreshold: 40,
  },
  {
    key: "medical_hose",
    name: "Medical hose",
    unit: "pcs",
    emoji: "🪈",
    perHookah: 0, // not auto-consumed per hookah; chosen as an add-on
    cost: 10, // cost to the business: 10 EGP per unit
    sellPrice: 20, // client pays 20 EGP when chosen
    defaultStock: 50,
    lowThreshold: 10,
  },
];

export function getSupply(key: string): SupplyDef | undefined {
  return SUPPLIES.find((s) => s.key === key);
}

/** Supplies that can be sold to clients as add-ons (sellPrice > 0). */
export const SELLABLE_ADDONS = SUPPLIES.filter((s) => s.sellPrice > 0);

/** Total supply units consumed for a given number of hookahs (all items). */
export function supplyConsumption(totalHookahs: number): { key: string; amount: number }[] {
  return SUPPLIES.filter((s) => s.perHookah > 0).map((s) => ({
    key: s.key,
    amount: s.perHookah * totalHookahs,
  }));
}

// ---------------------------------------------------------------------------
// Cost-of-goods & profit calculations.
// A hookah's molasses cost is derived from the cheapest pack available for
// each brand (so profit is always reported conservatively).
// ---------------------------------------------------------------------------

/**
 * Cost (EGP) of the molasses in a single 20g hookah for a given brand,
 * derived from the brand's cheapest pack per gram.
 */
export function molassesCostPerHookah(brandId: string): number {
  const brand = getBrand(brandId);
  if (!brand || brand.packs.length === 0) return 0;
  const cheapestPerGram = Math.min(
    ...brand.packs.map((p) => p.costEgp / p.grams)
  );
  return Math.round(cheapestPerGram * MOLASSES_GRAMS * 100) / 100;
}

/**
 * Total cost-of-goods (EGP) for an order: molasses per component + supplies
 * per hookah. Used server-side to record profit on each order.
 */
export function computeOrderCogs(
  items: {
    components: { brandId: string }[];
    qty: number;
  }[]
): { molassesCost: number; suppliesCost: number; totalCogs: number } {
  let molassesCost = 0;
  let totalHookahs = 0;
  for (const it of items) {
    // each component contributes a share of the 20g; cost is per-20g-hookah
    // so we sum per-component hookah cost weighted by component count.
    const perHookahBrandCost = it.components.reduce(
      (sum, c) => sum + molassesCostPerHookah(c.brandId),
      0
    );
    // divide by component count since 20g is split across them
    const componentCount = Math.max(1, it.components.length);
    molassesCost += (perHookahBrandCost / componentCount) * it.qty;
    totalHookahs += it.qty;
  }
  let suppliesCost = 0;
  for (const s of SUPPLIES.filter((x) => x.perHookah > 0)) {
    suppliesCost += s.cost * s.perHookah * totalHookahs;
  }
  const totalCogs = Math.round((molassesCost + suppliesCost) * 100) / 100;
  return {
    molassesCost: Math.round(molassesCost * 100) / 100,
    suppliesCost: Math.round(suppliesCost * 100) / 100,
    totalCogs,
  };
}

export interface ProfitBreakdown {
  revenue: number;
  cogs: number;
  netProfit: number;
  marginPct: number;
}

export function computeProfit(revenue: number, cogs: number): ProfitBreakdown {
  const netProfit = Math.round((revenue - cogs) * 100) / 100;
  const marginPct =
    revenue > 0 ? Math.round((netProfit / revenue) * 1000) / 10 : 0;
  return { revenue, cogs, netProfit, marginPct };
}

/**
 * Split 20g evenly across `count` components, rounded to 2 decimals.
 * Pure helper, safe for server + client.
 */
export function splitGrams(count: number): number[] {
  if (count <= 1) return [MOLASSES_GRAMS];
  const base = Math.floor((MOLASSES_GRAMS / count) * 100) / 100;
  const arr = Array(count).fill(base);
  const remainder = Math.round((MOLASSES_GRAMS - base * count) * 100) / 100;
  arr[0] = Math.round((arr[0] + remainder) * 100) / 100;
  return arr;
}

// ---------------------------------------------------------------------------
// Server-side order pricing (source of truth — NEVER trust client totals).
// ---------------------------------------------------------------------------

/** Authoritative unit price for a configured hookah, computed from the catalog. */
export function serverUnitPrice(
  flavor: FlavorType,
  components: { brandId: string }[]
): number {
  if (components.length === 0) return 0;
  if (flavor === "fruits") {
    return getBrand(components[0].brandId)?.pricing.fruits ?? 0;
  }
  if (flavor === "flat") {
    return getBrand(components[0].brandId)?.pricing.flat ?? 0;
  }
  // fruits-mix: max mix price across involved brands
  return mixPrice(components.map((c) => c.brandId));
}

export interface ServerTotals {
  totalQty: number;
  subtotal: number;
  discount: number;
  total: number;
  bogo: boolean;
}

/**
 * Recompute order totals entirely from validated items + ownType using catalog
 * pricing. Used server-side so a malicious/buggy client cannot submit a
 * tampered `total` of 0.
 */
export function recomputeOrderTotals(
  items: {
    flavor: FlavorType;
    components: { brandId: string }[];
    qty: number;
  }[],
  ownType: string | null
): ServerTotals {
  const bogo = ownType === "hookah" || ownType === "molasses";
  let subtotal = 0;
  let total = 0;
  let totalQty = 0;
  for (const it of items) {
    const unit = serverUnitPrice(it.flavor, it.components);
    subtotal += unit * it.qty;
    total += unit * chargeableQty(it.qty, bogo);
    totalQty += it.qty;
  }
  const discount = Math.max(0, subtotal - total);
  return { totalQty, subtotal, discount, total, bogo };
}

/**
 * Re-derive the per-component gram split for an item so the server never
 * trusts client-supplied grams (which could be tampered to avoid depleting
 * stock). The total per hookah is always MOLASSES_GRAMS (20g).
 */
export function serverComponentGrams(count: number): number[] {
  return splitGrams(count);
}
