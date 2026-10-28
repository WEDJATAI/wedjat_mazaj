"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  chargeableQty,
  FlavorType,
  getBrand,
  AMY_SESSION_PRICE,
  mixPrice,
  MOLASSES_GRAMS,
  FLAVOR_LABELS,
  splitGrams,
  type HookahType,
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
  /** r67 — the pipe this shisha is smoked on. "amy" = the premium Amy
   * pipe: the session prices flat (AMY_SESSION_PRICE) regardless of the
   * molasses brand. Optional for legacy items (defaults to regular). */
  hookahType?: HookahType;
  /** r67 — per-shisha BYO answer ("I brought my own molasses/hookah").
   * Each shisha at a table can carry its own 2-for-1. */
  ownType?: OwnType;
  /** r67 — who this shisha is for (the per-person label at a shared table) */
  forName?: string;
}

export type OwnType = "hookah" | "molasses" | null;

/** r58 living orders — a stashed draft cart (restored when an amend session ends). */
export interface CartStash {
  items: CartItem[];
  ownType: OwnType;
  addons: string[];
}

interface CartState {
  items: CartItem[];
  ownType: OwnType;
  /** selected supply add-on keys (e.g. ["medical_hose"]) */
  addons: string[];
  /** r58: when set, the cart is EDITING this placed order (amend mode) —
   * the whole ordering UI (brand grid, config sheet, mixes) becomes the
   * editor, and checkout turns into “save changes” via the amend API. */
  amendOrderId: string | null;
  /** display name of the person amending (employee or guest) */
  amendActorName: string | null;
  /** the order's original state, so the drawer can show a delta summary.
   *  r72: baseRevision = the order revision this edit session started
   *  from — the amend API rejects the save if someone else committed a
   *  change in between (optimistic concurrency). */
  amendOriginal: {
    items: CartItem[];
    ownType: OwnType;
    addons: string[];
    baseRevision: number | null;
  } | null;
  /** a draft cart that existed before the amend session started */
  amendStash: CartStash | null;
  addItem: (item: Omit<CartItem, "id">) => void;
  removeItem: (id: string) => void;
  setQty: (id: string, qty: number) => void;
  /** r67 — replace an item in place (edit-a-shisha from the table order). */
  updateItem: (id: string, item: Omit<CartItem, "id">) => void;
  clear: () => void;
  setOwnType: (own: OwnType) => void;
  toggleAddon: (key: string) => void;
  /** r58: start editing a placed order — stashes any draft cart first.
   *  r72: baseRevision pins the edit to the revision the editor loaded. */
  beginAmend: (
    orderId: string,
    items: CartItem[],
    ownType: OwnType,
    addons: string[],
    actorName: string,
    baseRevision?: number | null
  ) => void;
  /** r58: leave amend mode — restores the stashed draft cart (if any) */
  endAmend: () => void;
}

/** Build a stable id from the primary brand, flavor type, the component
 * signature AND the r67 per-shisha attributes (pipe type, BYO answer,
 * person label) — two people at one table ordering identical bowls stay
 * separate lines so each keeps its own identity. */
function makeId(
  primaryBrandId: string,
  flavor: FlavorType,
  components: FlavorComponent[],
  extra?: { hookahType?: HookahType; ownType?: OwnType; forName?: string }
): string {
  const sig = components
    .map((c) => `${c.brandId}:${c.flavorName}`)
    .sort()
    .join("|");
  const ex = extra?.hookahType ?? "regular";
  const own = extra?.ownType ?? "none";
  const who = (extra?.forName ?? "").trim().toLowerCase();
  return `${primaryBrandId}:${flavor}:${sig}:${ex}:${own}:${who}`;
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
    hookahType: (r.hookahType as HookahType) ?? "regular",
    ownType: (r.ownType as OwnType) ?? null,
    forName: (r.forName as string) || undefined,
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
      amendOrderId: null,
      amendActorName: null,
      amendOriginal: null,
      amendStash: null,
      addItem: (item) =>
        set((state) => {
          const id = makeId(item.primaryBrandId, item.flavor, item.components, {
            hookahType: item.hookahType,
            ownType: item.ownType,
            forName: item.forName,
          });
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
      updateItem: (id, item) =>
        set((state) => ({
          items: state.items.map((i) =>
            i.id === id ? { ...item, id } : i
          ),
        })),
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
      beginAmend: (orderId, items, ownType, addons, actorName, baseRevision) =>
        set((state) => ({
          // stash any draft cart so it comes back after the amend session
          amendStash:
            state.items.length > 0 && !state.amendOrderId
              ? { items: state.items, ownType: state.ownType, addons: state.addons }
              : state.amendStash,
          items: items.map((i) => ({ ...i })),
          ownType,
          addons: [...addons],
          amendOrderId: orderId,
          amendActorName: actorName,
          amendOriginal: {
            items: items.map((i) => ({ ...i })),
            ownType,
            addons: [...addons],
            baseRevision: baseRevision ?? null,
          },
        })),
      endAmend: () =>
        set((state) => {
          const stash = state.amendStash;
          return {
            items: stash ? stash.items : [],
            ownType: stash ? stash.ownType : null,
            addons: stash ? stash.addons : [],
            amendOrderId: null,
            amendActorName: null,
            amendOriginal: null,
            amendStash: null,
          };
        }),
    }),
    {
      name: "mazaj-cart",
      version: 2,
      partialize: (state) => ({
        items: state.items,
        ownType: state.ownType,
        addons: state.addons,
        // r67 — persist the amend session too: a reload mid-amend used to
        // drop the amend context while keeping the edited items in the
        // cart, which would send a DUPLICATE order instead of a revision.
        amendOrderId: state.amendOrderId,
        amendActorName: state.amendActorName,
        amendOriginal: state.amendOriginal,
        amendStash: state.amendStash,
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
  const orderBogo = getBogo(ownType);
  let subtotal = 0;
  let total = 0;
  let totalQty = 0;
  let bogo = orderBogo;
  for (const it of items) {
    // r67 — the 2-for-1 can be answered per shisha (each person at the
    // table brings their own), so an item's own answer wins over the
    // order-level fallback.
    const itemBogo = getBogo(it.ownType ?? null) || orderBogo;
    bogo = bogo || itemBogo;
    const unit = typeof it.unitPrice === "number" ? it.unitPrice : 0;
    const qty = typeof it.qty === "number" && it.qty > 0 ? it.qty : 0;
    subtotal += unit * qty;
    total += unit * chargeableQty(qty, itemBogo);
    totalQty += qty;
  }
  const discount = Math.max(0, subtotal - total);
  return { totalQty, subtotal, discount, total, bogo };
}

/**
 * Compute the unit price for a configured hookah.
 *  - amy pipe (r67): flat AMY_SESSION_PRICE for fruits or mix.
 *  - own molasses (r67): no components → pipe+service price.
 *  - fruits / flat: the brand's own price.
 *  - fruits-mix: cross-brand => max mix price among involved brands; single brand => that brand's mix price.
 */
export function priceForConfig(
  flavor: FlavorType,
  components: FlavorComponent[] | undefined,
  hookahType: HookahType = "regular"
): number {
  if (hookahType === "amy") return AMY_SESSION_PRICE;
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
