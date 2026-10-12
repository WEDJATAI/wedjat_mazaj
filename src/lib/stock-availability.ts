"use client";

import * as React from "react";
import { Brand, MOLASSES_GRAMS } from "@/lib/catalog";

/**
 * r66 — guest ordering shows only AVAILABLE molasses.
 *
 * The branch's FlavorStock jars (brand × flavor) are the source of truth.
 * A flavor is orderable when its jar holds at least one full bowl
 * (20g). A brand is orderable when at least one of its flavors is.
 *
 * The server ALWAYS re-validates stock at placement time (see
 * /api/orders) — this module is the guest-side UX layer that keeps
 * guests from building a bowl the kitchen would reject.
 *
 * Fail-open by design: if the stock API cannot be reached (offline
 * PWA, cold start), every flavor stays visible so the menu never
 * blanks out — the server remains the guard.
 */

export type StockMap = Record<string, number>;

export const flavorKey = (brandId: string, flavor: string) =>
  `${brandId}:${flavor}`;

/** A single flavor is available when its jar has >= one bowl (20g). */
export function isFlavorAvailable(
  map: StockMap | null,
  brandId: string,
  flavor: string
): boolean {
  if (!map) return true; // fail open (offline / loading)
  return (map[flavorKey(brandId, flavor)] ?? 0) >= MOLASSES_GRAMS;
}

/** A brand is available when at least one of its flavors is. */
export function isBrandAvailable(
  map: StockMap | null,
  brand: Brand
): boolean {
  if (!map) return true;
  return brand.flavors.some((f) => isFlavorAvailable(map, brand.id, f));
}

/** The brand's flavors, availability-filtered (fail-open). */
export function availableFlavorsOf(
  map: StockMap | null,
  brand: Brand
): string[] {
  if (!map) return brand.flavors;
  return brand.flavors.filter((f) => isFlavorAvailable(map, brand.id, f));
}

/** How many of the brand's flavors are live right now (for the card chip). */
export function availableFlavorCount(
  map: StockMap | null,
  brand: Brand
): number {
  if (!map) return brand.flavors.length;
  return brand.flavors.filter((f) => isFlavorAvailable(map, brand.id, f))
    .length;
}

interface StockState {
  /** null = unknown yet (loading or offline) → everything shown */
  map: StockMap | null;
  loading: boolean;
}

/**
 * Fetches the branch's per-flavor stock once per mount / branch change.
 * `enabled` should be false for staff surfaces (staff see the full menu;
 * the server still guards placement).
 */
export function useFlavorStock(
  branchId: string | null | undefined,
  enabled: boolean
): StockState {
  const [state, setState] = React.useState<StockState>({
    map: null,
    loading: enabled,
  });

  // reset when the branch changes or the surface toggles
  React.useEffect(() => {
    setState({ map: null, loading: enabled });
  }, [branchId, enabled]);

  React.useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const qs = branchId ? `?branchId=${encodeURIComponent(branchId)}` : "";
    fetch(`/api/flavor-stock${qs}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("bad status"))))
      .then((data: { ok: boolean; items?: { id: string; stockGrams: number }[] }) => {
        if (cancelled || !data.ok || !Array.isArray(data.items)) return;
        const map: StockMap = {};
        for (const it of data.items) map[it.id] = it.stockGrams;
        setState({ map, loading: false });
      })
      .catch(() => {
        // offline / error → fail open, keep everything visible
        if (!cancelled) setState({ map: null, loading: false });
      });
    return () => {
      cancelled = true;
    };
  }, [branchId, enabled]);

  return state;
}
