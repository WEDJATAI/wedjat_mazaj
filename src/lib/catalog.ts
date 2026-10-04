// Hookah catalog & pricing rules for the Egyptian market.
// Business rules:
//  - Each hookah = 20g molasses.
//  - Regular brands (Mazaya, Al Fakher, Dandash, Nakhla): Fruits 125 EGP, Fruits Mix 145 EGP.
//  - Amy (premium): Fruits 180 EGP, Fruits Mix 180 EGP.
//  - Salom & Kass (special): 45 EGP flat (no fruits/mix distinction).
//  - BYO promo: bring your own hookah OR your own molasses -> 2 hookahs for the price of 1.

export type FlavorType = "fruits" | "fruits-mix" | "flat";
export type BrandCategory = "regular" | "premium" | "special";

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
  blurb: string;
  flavorTypes: FlavorType[];
  badge?: string;
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
  },
];

export const FLAVOR_LABELS: Record<FlavorType, string> = {
  fruits: "Fruits",
  "fruits-mix": "Fruits Mix",
  flat: "Standard",
};

export function getBrand(id: string): Brand | undefined {
  return BRANDS.find((b) => b.id === id);
}

/** Unit price for a brand + flavor combo (EGP). */
export function unitPrice(brand: Brand, flavor: FlavorType): number {
  if (flavor === "fruits") return brand.pricing.fruits ?? 0;
  if (flavor === "fruits-mix") return brand.pricing.fruitsMix ?? 0;
  return brand.pricing.flat ?? 0;
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
