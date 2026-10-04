"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  chargeableQty,
  FlavorType,
  getBrand,
  mixPrice,
  MOLASSES_GRAMS,
  FLAVOR_LABELS,
} from "@/lib/catalog";

/** A single flavor component inside a hookah. */
export interface FlavorComponent {
  brandId: string;
  brandName: string;
  flavorName: string;
  emoji: string;
  /** grams of molasses this component contributes (sums to 20 per hookah) */
  grams: number;
}

export interface CartItem {
  id: string;
  primaryBrandId: string; // the brand card used to add it
  primaryBrandName: string;
  emoji: string;
  accent: string;
  flavor: FlavorType;
  flavorLabel: string;
  components: FlavorComponent[];
  molassesGrams: number; // 20
  unitPrice: number;
  qty: number;
}

export type OwnType = "hookah" | "molasses" | null;

interface CartState {
  items: CartItem[];
  ownType: OwnType;
  addItem: (item: Omit<CartItem, "id">) => void;
  removeItem: (id: string) => void;
  setQty: (id: string, qty: number) => void;
  clear: () => void;
  setOwnType: (own: OwnType) => void;
}

/** Build a stable id from the primary brand, flavor type and the component signature. */
function makeId(
  primaryBrandId: string,
  flavor: FlavorType,
  components: FlavorComponent[]
): string {
  const sig = components
    .map((c) => `${c.brandId}:${c.flavorName}`)
    .sort()
    .join("|");
  return `${primaryBrandId}:${flavor}:${sig}`;
}

/** Split 20g evenly across components, rounded to 2 decimals. */
export function splitGrams(count: number): number[] {
  if (count <= 1) return [MOLASSES_GRAMS];
  const base = Math.floor((MOLASSES_GRAMS / count) * 100) / 100;
  const arr = Array(count).fill(base);
  const remainder = Math.round((MOLASSES_GRAMS - base * count) * 100) / 100;
  arr[0] = Math.round((arr[0] + remainder) * 100) / 100;
  return arr;
}

export const useCart = create<CartState>()(
  persist(
    (set) => ({
      items: [],
      ownType: null,
      addItem: (item) =>
        set((state) => {
          const id = makeId(item.primaryBrandId, item.flavor, item.components);
          const existing = state.items.find((i) => i.id === id);
          if (existing) {
            return {
              items: state.items.map((i) =>
                i.id === id ? { ...i, qty: i.qty + item.qty } : i
              ),
            };
          }
          return { items: [...state.items, { ...item, id }] };
        }),
      removeItem: (id) =>
        set((state) => ({ items: state.items.filter((i) => i.id !== id) })),
      setQty: (id, qty) =>
        set((state) => ({
          items: state.items
            .map((i) => (i.id === id ? { ...i, qty: Math.max(1, qty) } : i))
            .filter((i) => i.qty > 0),
        })),
      clear: () => set({ items: [], ownType: null }),
      setOwnType: (own) => set({ ownType: own }),
    }),
    {
      name: "mazaj-cart",
      partialize: (state) => ({ items: state.items, ownType: state.ownType }),
    }
  )
);

// --- selectors (pure helpers) ---

export function getBogo(ownType: OwnType): boolean {
  return ownType === "hookah" || ownType === "molasses";
}

export interface CartTotals {
  totalQty: number;
  subtotal: number;
  discount: number;
  total: number;
  bogo: boolean;
}

export function computeTotals(items: CartItem[], ownType: OwnType): CartTotals {
  const bogo = getBogo(ownType);
  let subtotal = 0;
  let total = 0;
  let totalQty = 0;
  for (const it of items) {
    subtotal += it.unitPrice * it.qty;
    total += it.unitPrice * chargeableQty(it.qty, bogo);
    totalQty += it.qty;
  }
  const discount = Math.max(0, subtotal - total);
  return { totalQty, subtotal, discount, total, bogo };
}

/**
 * Compute the unit price for a configured hookah.
 *  - fruits / flat: the brand's own price.
 *  - fruits-mix: cross-brand => max mix price among involved brands; single brand => that brand's mix price.
 */
export function priceForConfig(
  flavor: FlavorType,
  components: FlavorComponent[]
): number {
  if (components.length === 0) return 0;
  const primary = getBrand(components[0].brandId);
  if (flavor === "fruits") return primary?.pricing.fruits ?? 0;
  if (flavor === "flat") return primary?.pricing.flat ?? 0;
  // fruits-mix
  const brandIds = components.map((c) => c.brandId);
  return mixPrice(brandIds);
}

/** Human-readable summary of a cart item's flavors. */
export function flavorSummary(item: CartItem): string {
  if (item.components.length === 1) {
    return item.components[0].flavorName;
  }
  return item.components.map((c) => `${c.brandName} ${c.flavorName}`).join(" + ");
}

export { FLAVOR_LABELS, MOLASSES_GRAMS };
