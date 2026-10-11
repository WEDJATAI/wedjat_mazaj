import { db } from "@/lib/db";
import { BRANDS, type BrandPricing } from "@/lib/catalog";
import {
  SHISHA_COMMISSION_PCT,
  WEDJAT_SHARE_PCT,
} from "@/lib/rsm-finance";

/**
 * r61 — Platform Control Center settings layer.
 *
 * A tiny audited key→JSON store (PlatformSetting rows) that lets the
 * platform owner steer the platform at runtime — WITHOUT touching the
 * registered venues' own businesses:
 *
 *   rsm_config    → the revenue-share engine constants (commission % on
 *                   shisha + WEDJAT's share of it). Defaults: 12 / 40.
 *   menu_pricing  → per-brand price overrides for the platform-owned
 *                   shisha menu. Applied on top of the catalog defaults
 *                   both server-side (order recompute — the authoritative
 *                   charge) and client-side (menu display).
 *   platform_info → platform display name.
 *
 * Every read goes through a short-lived request cache so a single order
 * flow never hits the settings table more than once.
 */

export const SETTING_KEYS = {
  rsm: "rsm_config",
  menu: "menu_pricing",
  info: "platform_info",
} as const;

/* ------------------------------------------------------------------ */
/* RSM config                                                          */
/* ------------------------------------------------------------------ */

export interface RsmConfig {
  /** commission % charged on shisha sales (default 12) */
  commissionPct: number;
  /** WEDJAT's share of that commission (default 40) */
  wedjatSharePct: number;
}

export const DEFAULT_RSM_CONFIG: RsmConfig = {
  commissionPct: SHISHA_COMMISSION_PCT,
  wedjatSharePct: WEDJAT_SHARE_PCT,
};

/** Runtime-parameterized gross-profit math (same shape as the lib fn). */
export function computeWithConfig(cfg: RsmConfig, shishaRevenue: number) {
  const r2 = (n: number) => Math.round(n * 100) / 100;
  const revenue = Math.max(0, r2(shishaRevenue));
  const commission = r2(revenue * (cfg.commissionPct / 100));
  const wedjatGross = r2(commission * (cfg.wedjatSharePct / 100));
  const partnerShare = r2(commission - wedjatGross);
  const effectivePct = r2(cfg.commissionPct * (cfg.wedjatSharePct / 100));
  return {
    shishaRevenue: revenue,
    commission,
    wedjatGross,
    partnerShare,
    effectivePct,
  };
}

/* ------------------------------------------------------------------ */
/* Menu pricing overrides                                              */
/* ------------------------------------------------------------------ */

export type PricingOverride = Partial<BrandPricing>;
export type MenuPricingMap = Record<string, PricingOverride>;

/* ------------------------------------------------------------------ */
/* Settings access (request-cached)                                    */
/* ------------------------------------------------------------------ */

type CacheEntry = { at: number; value: unknown };
const CACHE_TTL_MS = 5_000;

const globalForSettings = globalThis as unknown as {
  __mazajSettingsCache?: Map<string, CacheEntry>;
};
const cache: Map<string, CacheEntry> =
  globalForSettings.__mazajSettingsCache ?? new Map();
globalForSettings.__mazajSettingsCache = cache;

async function readSetting<T>(key: string, fallback: T): Promise<T> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.value as T;
  try {
    const row = await db.platformSetting.findUnique({ where: { key } });
    const value = row ? (JSON.parse(row.value) as T) : fallback;
    cache.set(key, { at: Date.now(), value });
    return value;
  } catch {
    // DB hiccup → behave exactly like the compiled-in defaults
    return fallback;
  }
}

export function invalidateSettingsCache(key?: string) {
  if (key) cache.delete(key);
  else cache.clear();
}

export async function getRsmConfig(): Promise<RsmConfig> {
  const raw = await readSetting<Partial<RsmConfig>>(SETTING_KEYS.rsm, {});
  const commissionPct = clampPct(raw.commissionPct, DEFAULT_RSM_CONFIG.commissionPct, 0.5, 90);
  const wedjatSharePct = clampPct(raw.wedjatSharePct, DEFAULT_RSM_CONFIG.wedjatSharePct, 1, 100);
  return { commissionPct, wedjatSharePct };
}

export async function getMenuPricing(): Promise<MenuPricingMap> {
  const raw = await readSetting<MenuPricingMap>(SETTING_KEYS.menu, {});
  // sanitize: keep only known brands + numeric price fields
  const clean: MenuPricingMap = {};
  const known = new Set(BRANDS.map((b) => b.id));
  for (const [brandId, pricing] of Object.entries(raw ?? {})) {
    if (!known.has(brandId) || !pricing || typeof pricing !== "object") continue;
    const entry: PricingOverride = {};
    for (const field of ["fruits", "fruitsMix", "flat"] as const) {
      const v = pricing[field];
      if (typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 100_000) {
        entry[field] = Math.round(v * 100) / 100;
      }
    }
    if (Object.keys(entry).length > 0) clean[brandId] = entry;
  }
  return clean;
}

export async function getPlatformInfo(): Promise<{ displayName: string }> {
  const raw = await readSetting<{ displayName?: string }>(SETTING_KEYS.info, {});
  const displayName =
    typeof raw.displayName === "string" && raw.displayName.trim().length > 0
      ? raw.displayName.trim().slice(0, 60)
      : "Mazaj Platform";
  return { displayName };
}

/* ------------------------------------------------------------------ */
/* Catalog mutation (server-side authoritative pricing)                 */
/* ------------------------------------------------------------------ */

/**
 * Pristine compiled-in pricing, captured at module load — BEFORE any
 * runtime override can mutate the BRANDS array. Resetting an override
 * must restore these values (an empty override map alone would leave
 * the previously-applied override stuck in memory).
 */
const PRISTINE_PRICING: Record<string, BrandPricing> = Object.fromEntries(
  BRANDS.map((b) => [b.id, { ...b.pricing }])
);

const appliedSig = { sig: "" };

function applyToCatalog(map: MenuPricingMap): void {
  for (const brand of BRANDS) {
    // always start from the pristine default, then apply the override —
    // this makes resets (empty/partial maps) work correctly
    const def = PRISTINE_PRICING[brand.id];
    if (def) brand.pricing = { ...def };
    const ov = map[brand.id];
    if (!ov) continue;
    if (typeof ov.fruits === "number") brand.pricing.fruits = ov.fruits;
    if (typeof ov.fruitsMix === "number") brand.pricing.fruitsMix = ov.fruitsMix;
    if (typeof ov.flat === "number") brand.pricing.flat = ov.flat;
  }
}

/**
 * Apply the persisted menu-price overrides onto the in-memory catalog
 * (BRANDS array). Idempotent: a no-op when the override signature hasn't
 * changed. Call this at the top of every server pricing path (order
 * create / amend recompute) — the catalog module is the single source
 * of pricing math, so overrides applied here flow through
 * serverUnitPrice / mixPrice / recomputeOrderTotals untouched.
 */
export async function applyCatalogOverrides(): Promise<void> {
  const map = await getMenuPricing();
  const sig = JSON.stringify(map);
  if (sig === appliedSig.sig) return;
  applyToCatalog(map);
  appliedSig.sig = sig;
}

/** Force-apply a map without touching the DB (used right after a PUT). */
export function applyPricingMap(map: MenuPricingMap): void {
  applyToCatalog(map);
  appliedSig.sig = JSON.stringify(map);
}

function clampPct(v: unknown, fallback: number, min: number, max: number): number {
  const n = typeof v === "number" ? v : Number.NaN;
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n * 10) / 10));
}
