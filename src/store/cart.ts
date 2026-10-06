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
  splitGrams,
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
  /** selected supply add-on keys (e.g. ["medical_hose"]) */
  addons: string[];
  addItem: (item: Omit<CartItem, "id">) => void;
  removeItem: (id: string) => void;
  setQty: (id: string, qty: number) => void;
  clear: () => void;
  setOwnType: (own: OwnType) => void;
  toggleAddon: (key: string) => void;
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

/**
 * Normalize a possibly-stale cart item into the current CartItem shape.
 * Older app versions persisted items WITHOUT `components` (and used
 * `brandId`/`brandName` instead of `primaryBrandId`/`primaryBrandName`).
 * This reconstructs a single-component entry from those legacy fields so
 * old carts survive the schema change instead of crashing the UI.
 */
function normalizeItem(raw: unknown): CartItem | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;

  // Prefer the new `components` field; otherwise rebuild one from legacy fields.
  let components: FlavorComponent[] | undefined;
  if (Array.isArray(r.components) && r.components.length > 0) {
    components = r.components as FlavorComponent[];
  } else {
    const brandId = (r.primaryBrandId as string) ?? (r.brandId as string);
    const brandName = (r.primaryBrandName as string) ?? (r.brandName as string);
    if (!brandId || !brandName) return null; // unrecoverable
    const emoji = (r.emoji as string) ?? "🔥";
    const flavorName =
      (r.flavorLabel as string) ?? // legacy fallback
      "Standard";
    components = [
      { brandId, brandName, flavorName, emoji, grams: MOLASSES_GRAMS },
    ];
  }

  const primaryBrandId =
    (r.primaryBrandId as string) ??
    (components[0]?.brandId as string | undefined) ??
    "";
  const primaryBrandName =
    (r.primaryBrandName as string) ??
    (components[0]?.brandName as string | undefined) ??
    "";

  const flavor = (r.flavor as FlavorType) ?? "fruits";
  const flavorLabel =
    (r.flavorLabel as string) ?? FLAVOR_LABELS[flavor] ?? "Fruits";
  const id =
    (r.id as string) ?? makeId(primaryBrandId, flavor, components);

  return {
    id,
    primaryBrandId,
    primaryBrandName,
    emoji: (r.emoji as string) ?? "🔥",
    accent: (r.accent as string) ?? "from-amber-500/25 to-amber-500/5",
    flavor,
    flavorLabel,
    components,
    molassesGrams: (r.molassesGrams as number) ?? MOLASSES_GRAMS,
    unitPrice: (r.unitPrice as number) ?? 0,
    qty: typeof r.qty === "number" && r.qty > 0 ? r.qty : 1,
  };
}

/** Persisted-state shape (may include legacy fields). */
interface PersistedCart {
  items?: unknown[];
  ownType?: OwnType;
}

// splitGrams is now imported from catalog (single source of truth).
export { splitGrams };

export const useCart = create<CartState>()(
  persist(
    (set) => ({
      items: [],
      ownType: null,
      addons: [],
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
      clear: () => set({ items: [], ownType: null, addons: [] }),
      setOwnType: (own) => set({ ownType: own }),
      toggleAddon: (key) =>
        set((state) => ({
          addons: state.addons.includes(key)
            ? state.addons.filter((k) => k !== key)
            : [...state.addons, key],
        })),
    }),
    {
      name: "mazaj-cart",
      version: 2,
      partialize: (state) => ({
        items: state.items,
        ownType: state.ownType,
        addons: state.addons,
      }),
      // Rehydrate legacy persisted carts (pre-`components` schema) into the
      // current CartItem shape so the UI never sees a missing `components`.
      migrate: (persisted: unknown) => {
        const p = (persisted ?? {}) as PersistedCart;
        const items = Array.isArray(p.items)
          ? p.items
              .map(normalizeItem)
              .filter((i): i is CartItem => i !== null)
          : [];
        return { items, ownType: p.ownType ?? null };
      },
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
    const unit = typeof it.unitPrice === "number" ? it.unitPrice : 0;
    const qty = typeof it.qty === "number" && it.qty > 0 ? it.qty : 0;
    subtotal += unit * qty;
    total += unit * chargeableQty(qty, bogo);
    totalQty += qty;
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
  components: FlavorComponent[] | undefined
): number {
  if (!components || components.length === 0) return 0;
  const primary = getBrand(components[0].brandId);
  if (flavor === "fruits") return primary?.pricing.fruits ?? 0;
  if (flavor === "flat") return primary?.pricing.flat ?? 0;
  // fruits-mix
  const brandIds = components.map((c) => c.brandId);
  return mixPrice(brandIds);
}

/** Human-readable summary of a cart item's flavors. */
export function flavorSummary(item: CartItem): string {
  const comps = item.components;
  if (!Array.isArray(comps) || comps.length === 0) {
    return item.flavorLabel ?? item.primaryBrandName ?? "Hookah";
  }
  if (comps.length === 1) {
    return comps[0].flavorName || item.flavorLabel || "Standard";
  }
  return comps
    .map((c) => `${c.brandName} ${c.flavorName}`)
    .filter(Boolean)
    .join(" + ");
}

export { FLAVOR_LABELS, MOLASSES_GRAMS };
