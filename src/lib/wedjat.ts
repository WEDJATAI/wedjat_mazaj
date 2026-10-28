// Wedjat RSM integration — R46 HTTPS edition.
//
// The platform talks to the restaurant POS EXCLUSIVELY through Wedjat
// RSM's key-authenticated integration API (the same x-rsm-key family as
// the delivery webhook). The OLD direct-Turso writes were retired: that
// database is a one-way Neon→Turso mirror which is wiped and rebuilt on
// every sync — anything written there is invisible to the POS and gets
// destroyed (this is exactly how the r44 "phantom orders" happened).
//
// Endpoints used (base URL = WEDJAT_RSM_URL):
//   POST /api/integrations/delivery/webhook  — orders → table checks
//   POST /api/integrations/mazaj/catalog     — types + prices matrix
//   POST /api/integrations/mazaj/inventory   — availability mirror
//   GET  /api/integrations/mazaj/status      — tables + menu + check statuses
//
// Design principle (unchanged): NON-BLOCKING and BEST-EFFORT. Mazaj never
// depends on Wedjat being available to function. Every call is wrapped in
// try/catch, logged, never thrown. Failures mark orders wedjatSyncStatus
// "failed" and the Inngest retry job re-pushes them.

import { db } from "@/lib/db";
import {
  buildAvailabilityItems,
  buildRsmCatalogMatrix,
  mapOrderItems,
  type OrderItemJson,
  type WebhookItem,
} from "@/lib/rsm-mapping";

const TIMEOUT_MS = 12_000;

export function rsmConfigured(): boolean {
  return Boolean(process.env.WEDJAT_RSM_URL && process.env.WEDJAT_RSM_KEY);
}

function rsmBaseUrl(): string {
  return (process.env.WEDJAT_RSM_URL ?? "").replace(/\/+$/, "");
}

async function rsmFetch(
  path: string,
  init: RequestInit & { body?: string },
): Promise<{ status: number; json: any }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(rsmBaseUrl() + path, {
      ...init,
      headers: {
        "content-type": "application/json",
        "x-rsm-key": process.env.WEDJAT_RSM_KEY ?? "",
        ...(init.headers ?? {}),
      },
      signal: controller.signal,
      cache: "no-store",
    });
    const json = await res.json().catch(() => ({}));
    return { status: res.status, json };
  } finally {
    clearTimeout(timer);
  }
}

// ── types (kept stable for the UI) ────────────────────────────────────

export interface WedjatTable {
  id: number;
  name: string;
  status: string;
  floor?: string | null;
}

export interface WedjatProduct {
  id: number;
  sku: string | null;
  name: string;
  nameAr: string | null;
  price: number;
  active: boolean;
}

export interface WedjatRevocation {
  wedjatOrderId: number;
  status: string;
  revokedBy: string;
  revokedAt: string;
}

// ── READ: status (tables, menu, tracked check states) ────────────────

export interface RsmStatusFeed {
  ok: boolean;
  now: string;
  tables: WedjatTable[];
  menu: WedjatProduct[];
  orders: {
    id: number;
    externalRef: string | null;
    status: string;
    tableId: number | null;
    totalAmount: number;
    createdAt: string;
    updatedAt: string;
    closedAt: string | null;
  }[];
}

export async function fetchRsmStatus(ids?: number[]): Promise<RsmStatusFeed | null> {
  if (!rsmConfigured()) return null;
  try {
    const qs = ids && ids.length ? `?ids=${encodeURIComponent(ids.join(","))}` : "";
    const { status, json } = await rsmFetch(`/api/integrations/mazaj/status${qs}`, {
      method: "GET",
    });
    if (status !== 200 || !json?.ok) return null;
    return json as RsmStatusFeed;
  } catch (err) {
    console.warn("[rsm] status fetch failed:", err);
    return null;
  }
}

/** Compatibility surface for the sync dashboard. */
export async function fetchWedjatTables(): Promise<WedjatTable[]> {
  const feed = await fetchRsmStatus();
  return feed?.tables ?? [];
}

export async function fetchWedjatProducts(): Promise<WedjatProduct[]> {
  const feed = await fetchRsmStatus();
  return feed?.menu ?? [];
}

export async function checkWedjatHealth(): Promise<{
  connected: boolean;
  tableCount: number;
  productCount: number;
  latencyMs: number;
}> {
  const start = Date.now();
  try {
    const feed = await fetchRsmStatus();
    if (!feed) return { connected: false, tableCount: 0, productCount: 0, latencyMs: 0 };
    return {
      connected: true,
      tableCount: feed.tables.length,
      productCount: feed.menu.length,
      latencyMs: Date.now() - start,
    };
  } catch {
    return { connected: false, tableCount: 0, productCount: 0, latencyMs: 0 };
  }
}

// ── WRITE: push an order to the table's check ─────────────────────────

export interface PushOrderResult {
  ok: boolean;
  wedjatOrderId?: number;
  addedToCheck?: boolean;
  duplicate?: boolean;
  unmatched?: string[];
  error?: string;
  alreadySynced?: boolean;
}

/**
 * Push a Mazaj order onto its table's check in Wedjat RSM. Idempotent per
 * mazaj order id (external_ref "mazaj:<id>" for NEW checks + the RSM-side
 * seen-ledger for add-to-check deliveries) — replays are safe no-ops.
 */
export async function pushOrderToWedjat(order: {
  id: string;
  customerName: string | null;
  phone: string | null;
  table: string | null;
  wedjatTableId: number | null;
  notes: string | null;
  itemsJson: string;
  bogo: boolean;
  addonsJson?: string[];
}): Promise<PushOrderResult> {
  if (!rsmConfigured()) return { ok: false, error: "Wedjat RSM not configured" };

  let items: OrderItemJson[] = [];
  try {
    items = JSON.parse(order.itemsJson) as OrderItemJson[];
  } catch {
    return { ok: false, error: "Corrupt itemsJson on the order" };
  }
  const addons = Array.isArray(order.addonsJson) ? order.addonsJson : [];
  const webhookItems = mapOrderItems(items, order.bogo, addons);
  if (webhookItems.length === 0) {
    return { ok: false, error: "Order has no mappable items" };
  }
  return pushWebhookItemsToWedjat(order, webhookItems, order.id);
}

/**
 * r74 — push PRE-MAPPED webhook lines (an amendment DELTA: only the net
 * added lines) to the table's check. Same envelope + idempotency contract
 * as pushOrderToWedjat but the caller controls the externalId (e.g.
 * "<orderId>:r2" per revision) and the exact lines delivered.
 */
export async function pushWebhookItemsToWedjat(
  order: {
    customerName: string | null;
    phone: string | null;
    table: string | null;
    wedjatTableId: number | null;
    notes: string | null;
  },
  webhookItems: WebhookItem[],
  externalId: string
): Promise<PushOrderResult> {
  if (!rsmConfigured()) return { ok: false, error: "Wedjat RSM not configured" };
  if (webhookItems.length === 0 || webhookItems.every((i) => i.quantity <= 0)) {
    return { ok: false, error: "No items to deliver" };
  }

  const payload: Record<string, unknown> = {
    provider: "mazaj",
    externalId,
    customerName: (order.customerName || "Mazaj guest").slice(0, 60),
    notes: [order.notes ? order.notes.slice(0, 260) : null, "mazaj order"]
      .filter(Boolean)
      .join(" · ")
      .slice(0, 300),
    items: webhookItems,
  };
  if (order.phone) payload.customerPhone = order.phone.slice(0, 20);
  // the numeric table id is the ONLY unambiguous reference (names repeat
  // across floors) — send it whenever we have it, fall back to the name
  if (order.wedjatTableId != null) payload.tableId = order.wedjatTableId;
  else if (order.table) payload.table = order.table;

  try {
    const { status, json } = await rsmFetch("/api/integrations/delivery/webhook", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    if (status === 201 || (status === 200 && json?.order)) {
      return {
        ok: true,
        wedjatOrderId: json?.order?.id,
        addedToCheck: Boolean(json?.addedToCheck),
        duplicate: Boolean(json?.duplicate),
        unmatched: json?.unmatched ?? [],
      };
    }
    if (json?.error) return { ok: false, error: String(json.error).slice(0, 300) };
    return { ok: false, error: `RSM webhook responded ${status}` };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Could not push to Wedjat",
    };
  }
}

// ── r74: floor-plan mirror + guest table-label resolution ────────────

/**
 * Refresh the local WedjatTable mirror from RSM's status feed (called by
 * the availability Inngest job every 15 min + on-demand). The mirror is
 * what resolves a guest-typed table NUMBER to the numeric RSM table id —
 * the only unambiguous reference for the delivery webhook (names repeat
 * across the restaurant's floors: indoor "5" and outdoor "5" are different
 * checks). Rows that disappeared from the feed are deleted so resolutions
 * never use stale tables.
 */
export async function syncWedjatTables(): Promise<{
  ok: boolean;
  tables: number;
  error?: string;
}> {
  if (!rsmConfigured()) return { ok: false, tables: 0, error: "Wedjat RSM not configured" };
  try {
    const feed = await fetchRsmStatus();
    if (!feed) return { ok: false, tables: 0, error: "RSM status feed unavailable" };
    const now = new Date();
    const seen = new Set<number>();
    for (const t of feed.tables) {
      if (!Number.isFinite(t.id)) continue;
      seen.add(t.id);
      await db.wedjatTable.upsert({
        where: { id: t.id },
        create: {
          id: t.id,
          name: String(t.name ?? "").trim(),
          floorName: String(t.floor ?? "Unknown").trim(),
          status: String(t.status ?? "free"),
          active: true,
          syncedAt: now,
        },
        update: {
          name: String(t.name ?? "").trim(),
          floorName: String(t.floor ?? "Unknown").trim(),
          status: String(t.status ?? "free"),
          active: true,
          syncedAt: now,
        },
      });
    }
    // drop tables that no longer exist on the RSM side (floor plan edited)
    const all = await db.wedjatTable.findMany({ select: { id: true } });
    const gone = all.filter((t) => !seen.has(t.id)).map((t) => t.id);
    if (gone.length > 0) {
      await db.wedjatTable.deleteMany({ where: { id: { in: gone } } });
    }
    return { ok: true, tables: seen.size };
  } catch (err) {
    return {
      ok: false,
      tables: 0,
      error: err instanceof Error ? err.message : "Table mirror sync failed",
    };
  }
}

export interface TableRefResolution {
  /** the numeric RSM table id — null when it could not be resolved */
  tableId: number | null;
  /** the RSM floor the table sits on (when resolved or hinted) */
  floor: string | null;
  /** label matches tables on several floors and no usable hint was given */
  ambiguous: boolean;
  /** the floor-plan mirror has never synced (fresh deploy / RSM down) */
  mirrorEmpty: boolean;
  /** human explanation when tableId is null */
  reason?: string;
}

/** "Table 24" / "طاولة 24" / "T24" / " 24 " → "24" (guests type numbers). */
export function normalizeTableLabel(label: string): string {
  const raw = label.trim();
  if (!raw) return "";
  const m = raw.match(/^(?:table|طاولة|t)\s*[-#.]?\s*(\d+)$/i);
  if (m) return m[1];
  return raw;
}

/** does the RSM floor name match the guest's floor hint ("in"/"out"/full name)? */
function floorMatches(floorName: string, hint: string): boolean {
  const f = floorName.trim().toLowerCase();
  const h = hint.trim().toLowerCase();
  if (!h) return false;
  if (f === h || f.includes(h) || h.includes(f)) return true;
  const hintIndoor = /^(in|indoors?|indoor|داخلي)/.test(h) || h.includes("in door");
  const hintOutdoor = /^(out|outdoors?|outdoor|خارجي)/.test(h) || h.includes("out door");
  const floorIndoor = f.startsWith("in") || f.includes("داخلي");
  const floorOutdoor = f.startsWith("out") || f.includes("خارجي");
  if (hintIndoor && floorIndoor) return true;
  if (hintOutdoor && floorOutdoor) return true;
  return false;
}

/**
 * Resolve a guest-typed table label to the numeric RSM table id using the
 * WedjatTable mirror. Never throws — an unresolved label returns tableId
 * null with the reason (the order still proceeds; the push will fail with
 * that reason stored on the order for the sync dashboard).
 */
export async function resolveWedjatTableRef(
  label: string,
  floorHint?: string | null
): Promise<TableRefResolution> {
  const normalized = normalizeTableLabel(label);
  if (!normalized) {
    return {
      tableId: null,
      floor: null,
      ambiguous: false,
      mirrorEmpty: false,
      reason: "no table reference",
    };
  }
  let rows: { id: number; name: string; floorName: string }[];
  try {
    rows = await db.wedjatTable.findMany({
      where: { active: true },
      select: { id: true, name: true, floorName: true },
    });
  } catch {
    return {
      tableId: null,
      floor: null,
      ambiguous: false,
      mirrorEmpty: true,
      reason: "table mirror unavailable",
    };
  }
  if (rows.length === 0) {
    return {
      tableId: null,
      floor: null,
      ambiguous: false,
      mirrorEmpty: true,
      reason: "RSM floor plan not synced yet — will resolve on retry",
    };
  }
  const wanted = normalized.toLowerCase();
  const candidates = rows.filter(
    (r) =>
      r.name.trim().toLowerCase() === wanted ||
      r.name.trim().toLowerCase() === `t${wanted}` ||
      r.name.trim().toLowerCase() === `table ${wanted}`
  );
  if (candidates.length === 0) {
    return {
      tableId: null,
      floor: null,
      ambiguous: false,
      mirrorEmpty: false,
      reason: `table "${normalized}" is not in the restaurant's floor plan`,
    };
  }
  if (candidates.length === 1) {
    return {
      tableId: candidates[0].id,
      floor: candidates[0].floorName,
      ambiguous: false,
      mirrorEmpty: false,
    };
  }
  // ambiguous across floors — try the guest's floor hint
  const hint = (floorHint ?? "").trim();
  if (hint) {
    const narrowed = candidates.filter((c) => floorMatches(c.floorName, hint));
    if (narrowed.length === 1) {
      return {
        tableId: narrowed[0].id,
        floor: narrowed[0].floorName,
        ambiguous: false,
        mirrorEmpty: false,
      };
    }
  }
  return {
    tableId: null,
    floor: hint || null,
    ambiguous: true,
    mirrorEmpty: false,
    reason: `table "${normalized}" exists on several floors (${candidates
      .map((c) => c.floorName)
      .join(" / ")}) — ask the guest indoors or outdoors`,
  };
}

// ── WRITE: catalog (types + prices) and availability mirrors ─────────

export interface CatalogPushResult {
  ok: boolean;
  pushed?: number;
  created?: number;
  updated?: number;
  unchanged?: number;
  deactivated?: number;
  error?: string;
}

export async function pushCatalogToWedjat(): Promise<CatalogPushResult> {
  if (!rsmConfigured()) return { ok: false, error: "Wedjat RSM not configured" };
  const products = buildRsmCatalogMatrix();
  try {
    const { status, json } = await rsmFetch("/api/integrations/mazaj/catalog", {
      method: "POST",
      body: JSON.stringify({ products }),
    });
    if (status === 200 && json?.ok) {
      return {
        ok: true,
        pushed: json.pushed,
        created: json.created,
        updated: json.updated,
        unchanged: json.unchanged,
        deactivated: json.deactivated,
      };
    }
    return { ok: false, error: json?.error ?? `RSM catalog responded ${status}` };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Catalog push failed" };
  }
}

export interface AvailabilityPushResult {
  ok: boolean;
  matched?: number;
  shown?: number;
  hidden?: number;
  unmatched?: string[];
  error?: string;
}

/** Snapshot the live stock and mirror availability onto the RSM menu. */
export async function pushAvailabilityToWedjat(): Promise<AvailabilityPushResult> {
  if (!rsmConfigured()) return { ok: false, error: "Wedjat RSM not configured" };
  try {
    const [brands, flavors, supplies] = await Promise.all([
      db.inventoryItem.findMany(),
      db.flavorStock.findMany(),
      db.supplyItem.findMany(),
    ]);
    const items = buildAvailabilityItems({
      brandTotals: new Map(brands.map((b) => [b.brandId, b.stockGrams])),
      flavorStock: flavors.map((f) => ({
        brandIdRaw: f.brandIdRaw,
        flavorName: f.flavorName,
        stockGrams: f.stockGrams,
      })),
      supplies: new Map(supplies.map((s) => [s.key, s.stock])),
    });
    const { status, json } = await rsmFetch("/api/integrations/mazaj/inventory", {
      method: "POST",
      body: JSON.stringify({ mode: "full", items }),
    });
    if (status === 200 && json?.ok) {
      return {
        ok: true,
        matched: json.matched,
        shown: json.shown,
        hidden: json.hidden,
        unmatched: json.unmatched ?? [],
      };
    }
    return { ok: false, error: json?.error ?? `RSM inventory responded ${status}` };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Availability push failed" };
  }
}

/** Catalog + availability in one shot (the hourly self-heal job). */
export async function fullMenuSyncToWedjat(): Promise<{
  catalog: CatalogPushResult;
  availability: AvailabilityPushResult;
}> {
  const catalog = await pushCatalogToWedjat();
  const availability = await pushAvailabilityToWedjat();
  return { catalog, availability };
}

// ── REVOCATIONS: detect checks cancelled inside the restaurant POS ────

/**
 * Check the tracked RSM checks for cancellations. A mazaj order whose RSM
 * check was cancelled/revoked by the restaurant is marked revoked here so
 * it leaves the active queue (the shisha man sees it as pulled).
 */
export async function fetchWedjatRevocations(): Promise<WedjatRevocation[]> {
  const tracked = await db.order.findMany({
    where: { wedjatOrderId: { not: null }, wedjatSyncStatus: { in: ["synced", "failed", "pending"] } },
    select: { id: true, wedjatOrderId: true },
    take: 200,
    orderBy: { createdAt: "desc" },
  });
  if (tracked.length === 0) return [];
  const ids = tracked.map((t) => t.wedjatOrderId!);
  const feed = await fetchRsmStatus(ids);
  if (!feed) return [];
  const byId = new Map(tracked.map((t) => [t.wedjatOrderId!, t.id]));
  const revoked: WedjatRevocation[] = [];
  for (const o of feed.orders) {
    if (o.status !== "cancelled") continue;
    if (!byId.has(o.id)) continue;
    revoked.push({
      wedjatOrderId: o.id,
      status: o.status,
      revokedBy: "Wedjat POS",
      revokedAt: o.updatedAt ?? o.closedAt ?? new Date().toISOString(),
    });
  }
  return revoked;
}
