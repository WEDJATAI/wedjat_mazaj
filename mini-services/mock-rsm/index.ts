// Mock Wedjat RSM — a faithful in-memory stand-in for the restaurant POS
// integration API, used by local dev + e2e to exercise the FULL Mazaj →
// RSM delivery path (order → table check, amendment deltas, retries)
// without touching the production POS.
//
// Port: 3021 (fixed). Wire the Next.js dev env to it:
//   WEDJAT_RSM_URL=http://localhost:3021
//   WEDJAT_RSM_KEY=test-rsm-key
//
// Implements the exact contract of wedjatrsm's /api/integrations routes:
//   POST /api/integrations/delivery/webhook — key auth (x-rsm-key), item
//        matching by sku|name against the MAZAJ-* catalog, tableId
//        resolution (names → active-floor tables; 404 unknown / 409
//        ambiguous), NEW dine-in check or ADD-to-open-check, externalRef
//        + seen-ledger idempotency, tax 26% (informational).
//   POST /api/integrations/mazaj/catalog   — accepts the price matrix
//   POST /api/integrations/mazaj/inventory — accepts the availability mirror
//   GET  /api/integrations/mazaj/status    — tables + menu + tracked checks
//        (this is what Mazaj's floor-plan mirror + revocation poll read)
//   GET  /__state  — the whole mock state (e2e assertions)
//   POST /__reset  — wipe everything (e2e setup)
//
// The floor plan mirrors the REAL restaurant layout (r74 audit):
//   In Door داخلي  = tables #37–56 named "1"…"20"
//   Out Door خارجي = tables #21–36 named "1"…"16"
// so name "5" is intentionally ambiguous (two floors) while "17"–"20"
// are unique — exactly the production failure modes.

const PORT = 3021;
const API_KEY = "test-rsm-key";

// ── the MAZAJ-* catalog (what the webhook matches items against) ──────
const CATALOG: { sku: string; name: string; price: number; active: boolean }[] =
  [
    { sku: "MAZAJ-MAZAYA-FRUITS", name: "Mazaya Fruits", price: 125, active: true },
    { sku: "MAZAJ-MAZAYA-MIX", name: "Mazaya Fruits Mix", price: 145, active: true },
    { sku: "MAZAJ-AL-FAKHER-FRUITS", name: "Al Fakher Fruits", price: 125, active: true },
    { sku: "MAZAJ-AL-FAKHER-MIX", name: "Al Fakher Fruits Mix", price: 145, active: true },
    { sku: "MAZAJ-DANDASH-FRUITS", name: "Dandash Fruits", price: 125, active: true },
    { sku: "MAZAJ-DANDASH-MIX", name: "Dandash Fruits Mix", price: 145, active: true },
    { sku: "MAZAJ-NAKHLA-FRUITS", name: "Nakhla Fruits", price: 125, active: true },
    { sku: "MAZAJ-NAKHLA-MIX", name: "Nakhla Fruits Mix", price: 145, active: true },
    { sku: "MAZAJ-AMY-FRUITS", name: "Amy Fruits", price: 180, active: true },
    { sku: "MAZAJ-AMY-MIX", name: "Amy Fruits Mix", price: 180, active: true },
    { sku: "MAZAJ-SALOM", name: "Salom Standard", price: 45, active: true },
    { sku: "MAZAJ-KASS", name: "Kass Standard", price: 45, active: true },
    { sku: "MAZAJ-MEDICAL-HOSE", name: "Medical hose", price: 20, active: true },
  ];

interface Table {
  id: number;
  name: string;
  floor: string;
  status: "free" | "occupied";
}
interface CheckItem {
  id: number;
  sku: string;
  name: string;
  quantity: number;
  unitPrice: number;
  notes: string | null;
  status: string;
}
interface Check {
  id: number;
  externalRef: string | null;
  tableId: number | null;
  clientName: string;
  status: "open" | "cancelled" | "paid";
  items: CheckItem[];
  createdAt: string;
  updatedAt: string;
}

interface State {
  tables: Table[];
  checks: Check[];
  seenLedger: Record<string, { orderId: number; at: string }>;
  catalogPushes: number;
  inventoryPushes: number;
  webhookCalls: { externalId: string; tableId: number | null; items: { sku: string; quantity: number }[]; status: number; at: string }[];
}

function freshState(): State {
  const tables: Table[] = [];
  // In Door داخلي: #37–56 named 1–20
  for (let i = 1; i <= 20; i++) {
    tables.push({ id: 36 + i, name: String(i), floor: "In Door داخلي", status: "free" });
  }
  // Out Door خارجي: #21–36 named 1–16
  for (let i = 1; i <= 16; i++) {
    tables.push({ id: 20 + i, name: String(i), floor: "Out Door خارجي", status: "free" });
  }
  return {
    tables,
    checks: [],
    seenLedger: {},
    catalogPushes: 0,
    inventoryPushes: 0,
    webhookCalls: [],
  };
}

let state = freshState();
let nextCheckId = 3000;
let nextItemId = 1;

function json(res: Response, body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function authorized(req: Request): boolean {
  const key =
    req.headers.get("x-rsm-key") ??
    new URL(req.url).searchParams.get("key") ??
    "";
  return key === API_KEY;
}

const server = Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);

    // ── test-control endpoints (no key) ────────────────────────────────
    if (req.method === "GET" && url.pathname === "/__state") {
      return json(res0(), { ok: true, state });
    }
    if (req.method === "POST" && url.pathname === "/__reset") {
      state = freshState();
      return json(res0(), { ok: true });
    }
    // e2e hook: inject a table (simulates the restaurant editing its floor
    // plan — lets tests prove mazaj re-resolution heals old failures)
    if (req.method === "POST" && url.pathname === "/__tables") {
      const body = (await req.json().catch(() => ({}))) as {
        id?: number;
        name?: string;
        floor?: string;
      };
      if (body.id != null && body.name) {
        if (!state.tables.some((t) => t.id === body.id)) {
          state.tables.push({
            id: Number(body.id),
            name: String(body.name),
            floor: String(body.floor ?? "In Door داخلي"),
            status: "free",
          });
        }
        return json(res0(), { ok: true, tables: state.tables.length });
      }
      return json(res0(), { error: "id and name required" }, 400);
    }

    // ── integration API (key-authenticated, mirrors the real RSM) ─────
    if (url.pathname.startsWith("/api/integrations/")) {
      if (!authorized(req)) {
        return json(res0(), { error: "Invalid webhook key" }, 401);
      }

      // GET status — tables + menu + tracked checks
      if (req.method === "GET" && url.pathname === "/api/integrations/mazaj/status") {
        return json(res0(), {
          ok: true,
          now: new Date().toISOString(),
          tables: state.tables.map((t) => ({
            id: t.id,
            name: t.name,
            status: t.status,
            floor: t.floor,
          })),
          menu: CATALOG,
          orders: state.checks.map((c) => ({
            id: c.id,
            externalRef: c.externalRef,
            status: c.status,
            tableId: c.tableId,
            totalAmount:
              Math.round(c.items.reduce((s, i) => s + i.quantity * i.unitPrice, 0) * 100) / 100,
            createdAt: c.createdAt,
            updatedAt: c.updatedAt,
            closedAt: c.status === "open" ? null : c.updatedAt,
          })),
        });
      }

      // POST catalog — accept the price matrix
      if (req.method === "POST" && url.pathname === "/api/integrations/mazaj/catalog") {
        const body = (await req.json().catch(() => ({}))) as {
          products?: { sku: string; name: string; price: number; active: boolean }[];
        };
        let created = 0;
        let updated = 0;
        let unchanged = 0;
        for (const p of body.products ?? []) {
          const existing = CATALOG.find((c) => c.sku === p.sku);
          if (!existing) {
            CATALOG.push({ sku: p.sku, name: p.name, price: p.price, active: p.active });
            created++;
          } else if (existing.price !== p.price || existing.name !== p.name) {
            existing.price = p.price;
            existing.name = p.name;
            updated++;
          } else {
            unchanged++;
          }
        }
        state.catalogPushes++;
        return json(res0(), {
          ok: true,
          pushed: (body.products ?? []).length,
          created,
          updated,
          unchanged,
          deactivated: 0,
        });
      }

      // POST inventory — accept the availability mirror
      if (req.method === "POST" && url.pathname === "/api/integrations/mazaj/inventory") {
        const body = (await req.json().catch(() => ({}))) as { items?: unknown[] };
        state.inventoryPushes++;
        return json(res0(), {
          ok: true,
          matched: (body.items ?? []).length,
          shown: (body.items ?? []).length,
          hidden: 0,
          unmatched: [],
        });
      }

      // POST delivery webhook — THE orders path
      if (req.method === "POST" && url.pathname === "/api/integrations/delivery/webhook") {
        const body = (await req.json().catch(() => null)) as
          | {
              provider?: string;
              externalId?: string;
              customerName?: string;
              items?: { sku?: string; name?: string; productId?: number; quantity: number; notes?: string; unitPrice?: number }[];
              tableId?: number;
              table?: string;
            }
          | null;

        if (!body) return json(res0(), { error: "Invalid JSON body" }, 400);
        const provider = String(body.provider ?? "generic").toLowerCase();
        if (provider !== "mazaj" && provider !== "generic") {
          return json(res0(), { error: "provider must be one of: mazaj, generic" }, 400);
        }
        const externalId = String(body.externalId ?? "").trim();
        if (!externalId || externalId.length > 80) {
          return json(res0(), { error: "externalId is required (1-80 characters)" }, 400);
        }
        if (!Array.isArray(body.items) || body.items.length === 0) {
          return json(res0(), { error: "items must be a non-empty array" }, 400);
        }

        // idempotency #1: externalRef replay (NEW-check orders)
        const externalRef = `${provider}:${externalId}`;
        const replay = state.checks.find((c) => c.externalRef === externalRef);
        if (replay) {
          state.webhookCalls.push({
            externalId,
            tableId: null,
            items: [],
            status: 200,
            at: new Date().toISOString(),
          });
          return json(res0(), { order: serialize(replay), duplicate: true });
        }

        // item matching (productId | sku | name, case-insensitive)
        const unmatched: string[] = [];
        const matched: { sku: string; name: string; quantity: number; unitPrice: number; notes: string | null }[] = [];
        for (const raw of body.items) {
          const quantity = Number(raw?.quantity);
          if (!Number.isFinite(quantity) || quantity <= 0 || quantity > 100) {
            return json(res0(), { error: "item quantity must be between 0 and 100" }, 400);
          }
          const product =
            (raw.sku ? CATALOG.find((c) => c.sku.toLowerCase() === String(raw.sku).toLowerCase()) : undefined) ??
            (raw.name
              ? CATALOG.find(
                  (c) =>
                    c.name.toLowerCase() === String(raw.name).trim().toLowerCase() ||
                    c.sku.toLowerCase() === String(raw.name).trim().toLowerCase()
                )
              : undefined);
          if (!product) {
            unmatched.push(String(raw.name ?? raw.sku ?? raw.productId ?? "item"));
            continue;
          }
          matched.push({
            sku: product.sku,
            name: product.name,
            quantity,
            unitPrice: product.price,
            notes: raw.notes ? String(raw.notes).slice(0, 200) : null,
          });
        }
        if (matched.length === 0) {
          return json(res0(), { error: `No items matched the menu. Unmatched: ${unmatched.slice(0, 5).join(", ")}` }, 422);
        }

        // table resolution — EXACTLY the real rules
        let table: Table | null = null;
        if (body.tableId != null && Number.isFinite(Number(body.tableId))) {
          table = state.tables.find((t) => t.id === Number(body.tableId)) ?? null;
          if (!table) {
            return json(res0(), { error: `tableId ${Number(body.tableId)} not found or not on an active floor`, }, 404);
          }
        } else if (body.table != null && String(body.table).trim() !== "") {
          const refStr = String(body.table).trim().toLowerCase();
          const candidates = state.tables.filter(
            (t) => t.name.trim().toLowerCase() === refStr || t.name.trim().toLowerCase() === `t${refStr}`
          );
          if (candidates.length === 1) table = candidates[0];
          else if (candidates.length > 1) {
            return json(
              res0(),
              {
                error: `table reference "${refStr}" is ambiguous (${candidates.length} tables share this name across floors: ${candidates
                  .map((c) => `#${c.id} ${c.name}`)
                  .join(", ")}) — send the numeric tableId instead`,
              },
              409
            );
          } else {
            return json(res0(), { error: `table not found: "${refStr}" — send the numeric tableId`, }, 404);
          }
        }

        // idempotency #2: the mazaj seen-ledger (add-to-check deliveries)
        const seenKey = `mazaj.seen.${provider}:${externalId}`;
        const seen = state.seenLedger[seenKey];
        if (seen) {
          const existing = state.checks.find((c) => c.id === seen.orderId);
          if (existing) {
            state.webhookCalls.push({
              externalId,
              tableId: null,
              items: [],
              status: 200,
              at: new Date().toISOString(),
            });
            return json(res0(), { order: serialize(existing), duplicate: true, addedToCheck: true, unmatched: [] });
          }
        }

        // case 1: open check on the table → ADD items
        const openCheck = table ? state.checks.find((c) => c.tableId === table!.id && c.status === "open") : undefined;
        if (openCheck) {
          for (const m of matched) {
            openCheck.items.push({
              id: nextItemId++,
              sku: m.sku,
              name: m.name,
              quantity: m.quantity,
              unitPrice: m.unitPrice,
              notes: m.notes,
              status: "new",
            });
          }
          openCheck.updatedAt = new Date().toISOString();
          state.seenLedger[seenKey] = { orderId: openCheck.id, at: new Date().toISOString() };
          state.webhookCalls.push({
            externalId,
            tableId: table?.id ?? null,
            items: matched.map((m) => ({ sku: m.sku, quantity: m.quantity })),
            status: 201,
            at: new Date().toISOString(),
          });
          return json(res0(), { order: serialize(openCheck), duplicate: false, addedToCheck: true, table: table?.name ?? null, unmatched }, 201);
        }

        // case 2/3: NEW check (dine-in on the table, or takeaway fallback)
        const check: Check = {
          id: nextCheckId++,
          externalRef,
          tableId: table?.id ?? null,
          clientName: body.customerName ?? "Mazaj guest",
          status: "open",
          items: matched.map((m) => ({
            id: nextItemId++,
            sku: m.sku,
            name: m.name,
            quantity: m.quantity,
            unitPrice: m.unitPrice,
            notes: m.notes,
            status: "new",
          })),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        state.checks.push(check);
        if (table) table.status = "occupied";
        state.seenLedger[seenKey] = { orderId: check.id, at: new Date().toISOString() };
        state.webhookCalls.push({
          externalId,
          tableId: table?.id ?? null,
          items: matched.map((m) => ({ sku: m.sku, quantity: m.quantity })),
          status: 201,
          at: new Date().toISOString(),
        });
        return json(res0(), { order: serialize(check), duplicate: false, addedToCheck: false, table: table?.name ?? null, unmatched }, 201);
      }

      return json(res0(), { error: "Not found" }, 404);
    }

    return json(res0(), { error: "Not found" }, 404);
  },
});

function serialize(c: Check) {
  return {
    id: c.id,
    orderType: c.tableId ? "dinein" : "takeaway",
    tableId: c.tableId,
    clientName: c.clientName,
    externalRef: c.externalRef,
    status: c.status,
    totalAmount: Math.round(c.items.reduce((s, i) => s + i.quantity * i.unitPrice, 0) * 100) / 100,
    items: c.items,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
  };
}

// tiny helper so json() has a Response-typed first arg without using it
function res0(): Response {
  return new Response(null);
}

console.log(`[mock-rsm] listening on :${PORT} (key "${API_KEY}", 36 tables, ${CATALOG.length} MAZAJ products)`);
