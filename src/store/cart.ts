"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { chargeableQty, FlavorType, getBrand, MOLASSES_GRAMS } from "@/lib/catalog";
import { FLAVOR_LABELS } from "@/lib/catalog";

export interface CartItem {
  id: string; // `${brandId}:${flavor}`
  brandId: string;
  brandName: string;
  flavor: FlavorType;
  flavorLabel: string;
  molassesGrams: number;
  unitPrice: number;
  qty: number;
  emoji: string;
  accent: string;
}

export type OwnType = "hookah" | "molasses" | null;

interface CartState {
  items: CartItem[];
  ownType: OwnType;
  addItem: (brandId: string, flavor: FlavorType, qty: number) => void;
  removeItem: (id: string) => void;
  setQty: (id: string, qty: number) => void;
  clear: () => void;
  setOwnType: (own: OwnType) => void;
}

function makeItem(
  brandId: string,
  flavor: FlavorType,
  qty: number
): CartItem | null {
  const brand = getBrand(brandId);
  if (!brand) return null;
  return {
    id: `${brandId}:${flavor}`,
    brandId,
    brandName: brand.name,
    flavor,
    flavorLabel: FLAVOR_LABELS[flavor],
    molassesGrams: MOLASSES_GRAMS,
    unitPrice:
      flavor === "fruits"
        ? brand.pricing.fruits ?? 0
        : flavor === "fruits-mix"
        ? brand.pricing.fruitsMix ?? 0
        : brand.pricing.flat ?? 0,
    qty,
    emoji: brand.emoji,
    accent: brand.accent,
  };
}

export const useCart = create<CartState>()(
  persist(
    (set) => ({
      items: [],
      ownType: null,
      addItem: (brandId, flavor, qty) =>
        set((state) => {
          const existing = state.items.find((i) => i.id === `${brandId}:${flavor}`);
          if (existing) {
            return {
              items: state.items.map((i) =>
                i.id === existing.id ? { ...i, qty: i.qty + qty } : i
              ),
            };
          }
          const item = makeItem(brandId, flavor, qty);
          if (!item) return state;
          return { items: [...state.items, item] };
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

// --- selectors (pure helpers, safe to import in server components too) ---

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
