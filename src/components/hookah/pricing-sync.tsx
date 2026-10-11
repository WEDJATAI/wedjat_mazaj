"use client";

/**
 * r61 — PricingSync (mount once in the AppShell).
 *
 * Keeps every client's in-memory catalog in lockstep with the platform
 * owner's published menu prices: fetches /api/menu/pricing on mount,
 * applies the overrides to the catalog module (the same module every
 * price display + cart computation reads), and re-checks on regaining
 * focus (so a price change published while the app was backgrounded is
 * picked up when the guest returns). Offline-tolerant by design.
 */

import * as React from "react";
import { BRANDS } from "@/lib/catalog";

const CACHE_KEY = "mazaj:menu-pricing-v1";
const RECHECK_DELAY_MS = 1200;

type PricingMap = Record<string, { fruits?: number; fruitsMix?: number; flat?: number }>;

function apply(pricing: PricingMap) {
  for (const brand of BRANDS) {
    const p = pricing[brand.id];
    if (!p) continue;
    if (typeof p.fruits === "number") brand.pricing.fruits = p.fruits;
    if (typeof p.fruitsMix === "number") brand.pricing.fruitsMix = p.fruitsMix;
    if (typeof p.flat === "number") brand.pricing.flat = p.flat;
  }
}

export function PricingSync() {
  React.useEffect(() => {
    let cancelled = false;

    // 1. cached overrides first (instant, offline-safe)
    try {
      const cached = window.localStorage.getItem(CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached) as { pricing?: PricingMap; v?: number };
        // ignore stale-but-malformed cache entries
        if (parsed && typeof parsed.v === "number" && parsed.pricing) {
          apply(parsed.pricing);
        }
      }
    } catch {
      /* private mode — skip the cache */
    }

    // 2. authoritative fetch
    const sync = async () => {
      try {
        const res = await fetch("/api/menu/pricing", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { ok?: boolean; pricing?: PricingMap; v?: number };
        if (cancelled || !data.ok || !data.pricing) return;
        apply(data.pricing);
        try {
          window.localStorage.setItem(
            CACHE_KEY,
            JSON.stringify({ pricing: data.pricing, v: data.v ?? Date.now() })
          );
        } catch {
          /* storage full/blocked — the in-memory application still holds */
        }
      } catch {
        /* offline — cached application stays */
      }
    };
    void sync();

    // 3. re-check when the tab regains focus (backgrounded price changes)
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        window.setTimeout(() => void sync(), RECHECK_DELAY_MS);
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  return null;
}
