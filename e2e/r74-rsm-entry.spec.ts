import { test, expect, request as playwrightRequest } from "@playwright/test";
import { db, cleanupE2EState, branchIds, guestOrderPayload } from "./helpers";

/**
 * r74 — "be sure that orders from wedjat mazaj are entered to wedjat rsm".
 *
 * Root cause being fixed: guest orders carried free-typed table LABELS
 * ("21", "44", "24") that don't resolve in the restaurant POS floor plan
 * (names repeat across floors; half the numbers don't exist), so every
 * push since Oct 11 failed silently. The full pipeline is now exercised
 * against the mock RSM (mini-services/mock-rsm :3021 — same contract as
 * the production wedjatrsm webhook):
 *
 *  1. the floor plan mirror: public /api/wedjat/floors bootstraps from RSM
 *  2. a UNIQUE table label resolves to the numeric id and the order lands
 *     on that table's check (synced + wedjatOrderId + the check exists)
 *  3. an AMBIGUOUS label + the guest's floor hint resolves the right table
 *  4. an ambiguous label withOUT a hint fails with the reason STORED on
 *     the order (visible in the sync panel)
 *  5. an unknown table fails with the reason stored
 *  6. amendment ADDITIONS are delivered as a delta to the same check
 *  7. amendment REMOVALS cannot be retracted (webhook is add-only) — the
 *     staff gets a "void it in the POS" comment + warning stamp instead
 *  8. self-heal: when the restaurant later ADDS the missing table, the
 *     stored failure re-resolves and the manual retry lands the order
 *
 * NOTE: orders use REAL numeric table labels (what guests type — the
 * resolver normalizes "Table 5"/"طاولة 5"/"5" but NOT test prefixes), so
 * this spec tracks its order ids and removes them itself in afterAll.
 */

const BASE = "http://localhost:3000";
const MOCK = "http://localhost:3021";
const INDOOR_FLOOR = "In Door داخلي";
const OUTDOOR_FLOOR = "Out Door خارجي";
/** the Mazaj Owner (venue_admin — carries the "sync" permission) */
const OWNER_PIN = "8888";

let branches: Record<string, string> = {};
const NEWCAIRO = () => branches["mazaj-newcairo"];
/** every order this spec creates (cleaned up in afterAll by id) */
const createdIds: string[] = [];
/** specific orders later tests need to find again */
let ambiguousOrderId = "";
let unknownOrderId = "";
let amendOrderId = "";

async function placeOrder(extra?: Record<string, unknown>) {
  const res = await fetch(`${BASE}/api/orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...guestOrderPayload({ branchId: NEWCAIRO(), table: "19" }),
      ...extra,
    }),
  });
  const data = await res.json();
  if (!data.ok) throw new Error(`placeOrder failed: ${JSON.stringify(data)}`);
  createdIds.push(data.order.id);
  return data.order as { id: string; total: number };
}

/** poll the local DB until the fire-and-forget push stamps the order */
async function waitForSync(
  id: string,
  predicate: (o: { wedjatSyncStatus: string; wedjatOrderId: number | null; wedjatSyncError: string | null }) => boolean,
  ms = 8000
) {
  const deadline = Date.now() + ms;
  let last: unknown = null;
  while (Date.now() < deadline) {
    const order = await db.order.findUnique({
      where: { id },
      select: { wedjatSyncStatus: true, wedjatOrderId: true, wedjatSyncError: true },
    });
    if (order && predicate(order)) return order;
    last = order;
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`order ${id} never satisfied the sync predicate — last: ${JSON.stringify(last)}`);
}

async function mockState() {
  const res = await fetch(`${MOCK}/__state`);
  return (await res.json()).state as {
    tables: { id: number; name: string; floor: string; status: string }[];
    checks: {
      id: number;
      externalRef: string | null;
      tableId: number | null;
      status: string;
      items: { sku: string; quantity: number }[];
    }[];
    webhookCalls: { externalId: string; tableId: number | null; status: number }[];
  };
}

async function resetMirror() {
  // force a fresh bootstrap: empty the mirror, then hit the public floors
  // endpoint (it kicks a background sync when empty) and poll until the
  // FULL floor plan landed — the bootstrap upserts table-by-table, so a
  // "count > 0" check would race a partial mirror (the mock layout has 36
  // base tables; the self-heal test injects one more before calling this)
  await db.wedjatTable.deleteMany({});
  await fetch(`${BASE}/api/wedjat/floors`).catch(() => {});
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    const count = await db.wedjatTable.count();
    if (count >= 36) return;
    // the kick may have been missed (request raced the deleteMany) — retry
    if (count === 0) {
      await fetch(`${BASE}/api/wedjat/floors`).catch(() => {});
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error("floor-plan mirror never fully bootstrapped");
}

/** the two-item amend payload (base Mazaya + one Amy mix bowl) */
const AMEND_ITEMS = [
  {
    id: "e2e:mazaya:fruits",
    primaryBrandId: "mazaya",
    primaryBrandName: "Mazaya",
    emoji: "🍇",
    accent: "#7c6ee6",
    flavor: "fruits",
    flavorLabel: "Fruits",
    components: [
      { brandId: "mazaya", brandName: "Mazaya", flavorName: "Double Apple", emoji: "🍇", grams: 20 },
    ],
    molassesGrams: 20,
    unitPrice: 125,
    qty: 1,
    hookahType: "regular",
    ownType: null,
    forName: "E2E Tester",
  },
  {
    id: "e2e:amy:mix",
    primaryBrandId: "amy",
    primaryBrandName: "Amy",
    emoji: "💎",
    accent: "#b98a2f",
    flavor: "fruits-mix",
    flavorLabel: "Fruits Mix",
    components: [
      { brandId: "amy", brandName: "Amy", flavorName: "Blueberry", emoji: "🫐", grams: 10 },
      { brandId: "mazaya", brandName: "Mazaya", flavorName: "Watermelon", emoji: "🍉", grams: 10 },
    ],
    molassesGrams: 20,
    unitPrice: 180,
    qty: 1,
    hookahType: "amy",
    ownType: null,
    forName: "E2E Tester",
  },
];

const BASE_ITEM = AMEND_ITEMS[0];

async function amendOrder(id: string, items: unknown[]) {
  const res = await fetch(`${BASE}/api/orders/${id}/amend`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ items, addons: [], notes: null, actorName: "E2E" }),
  });
  return { status: res.status, data: await res.json() };
}

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  branches = await branchIds();
});

test.afterAll(async () => {
  // remove THIS spec's orders by id (numeric table labels aren't covered
  // by the E2E-prefix cleanup) + the standard suite cleanup
  for (const id of createdIds) {
    await db.orderComment.deleteMany({ where: { orderId: id } });
    await db.pointsLedger.deleteMany({ where: { orderId: id } });
    await db.order.delete({ where: { id } }).catch(() => {});
  }
  await cleanupE2EState();
  await db.$disconnect();
});

test("floor plan mirror: public floors endpoint bootstraps from RSM", async ({
  request,
}) => {
  await fetch(`${MOCK}/__reset`, { method: "POST" });
  await resetMirror();

  const res = await request.get(`${BASE}/api/wedjat/floors`);
  expect(res.status()).toBe(200);
  const data = await res.json();
  expect(data.ok).toBe(true);
  expect(data.floors.length).toBe(2);
  const indoor = data.floors.find((f: { floor: string }) => f.floor === INDOOR_FLOOR);
  const outdoor = data.floors.find((f: { floor: string }) => f.floor === OUTDOOR_FLOOR);
  expect(indoor?.tables.length).toBe(20);
  expect(outdoor?.tables.length).toBe(16);
  // table "5" exists on BOTH floors — the ambiguity the guest must resolve
  expect(indoor?.tables).toContain("5");
  expect(outdoor?.tables).toContain("5");
});

test("unique table label resolves + the order lands on that table's check", async () => {
  // "19" exists only indoors (#55) — no floor question needed
  const order = await placeOrder({ table: "19" });
  const id = order.id;

  const row = await db.order.findUnique({ where: { id } });
  expect(row?.wedjatTableId).toBe(55); // indoor table named "19"
  expect(row?.wedjatFloor).toBe(INDOOR_FLOOR);

  await waitForSync(id, (o) => o.wedjatSyncStatus === "synced");
  const synced = (await db.order.findUnique({ where: { id } }))!;
  expect(synced.wedjatOrderId).not.toBeNull();

  // the check EXISTS on the RSM side, on the right table, with the item
  const st = await mockState();
  const check = st.checks.find((c) => c.externalRef === `mazaj:${id}`);
  expect(check).toBeDefined();
  expect(check!.tableId).toBe(55);
  expect(check!.items.map((i) => ({ sku: i.sku, quantity: i.quantity }))).toEqual([
    { sku: "MAZAJ-MAZAYA-FRUITS", quantity: 1 },
  ]);
});

test("ambiguous label + the guest's floor hint resolves the right table", async () => {
  // "5" exists on both floors; the guest said outdoors → #25
  const order = await placeOrder({ table: "5", tableFloor: OUTDOOR_FLOOR });
  const id = order.id;

  const row = await db.order.findUnique({ where: { id } });
  expect(row?.wedjatTableId).toBe(25); // OUTDOOR table named "5"
  expect(row?.wedjatFloor).toBe(OUTDOOR_FLOOR);

  await waitForSync(id, (o) => o.wedjatSyncStatus === "synced");
  const st = await mockState();
  const check = st.checks.find((c) => c.externalRef === `mazaj:${id}`);
  expect(check?.tableId).toBe(25);

  // and the indoor hint resolves the indoor twin instead
  const order2 = await placeOrder({ table: "5", tableFloor: "indoors" });
  const row2 = await db.order.findUnique({ where: { id: order2.id } });
  expect(row2?.wedjatTableId).toBe(41); // INDOOR table named "5"
  expect(row2?.wedjatFloor).toBe(INDOOR_FLOOR);
});

test("ambiguous label without a hint fails with the reason STORED on the order", async () => {
  const order = await placeOrder({ table: "7", tableFloor: null }); // no hint
  ambiguousOrderId = order.id;
  const id = order.id;

  const row = await db.order.findUnique({ where: { id } });
  expect(row?.wedjatTableId).toBeNull(); // could not resolve
  expect(row?.wedjatFloor).toBeNull();

  await waitForSync(id, (o) => o.wedjatSyncStatus === "failed");
  const failed = (await db.order.findUnique({ where: { id } }))!;
  // the stored reason names the ambiguity (mazaj's own resolver or the
  // RSM 409 — both carry the word "ambiguous")
  expect(failed.wedjatSyncError?.toLowerCase()).toContain("ambiguous");
  // and it never created a check
  const st = await mockState();
  expect(st.checks.find((c) => c.externalRef === `mazaj:${id}`)).toBeUndefined();
});

test("unknown table number fails with the floor-plan reason stored", async () => {
  const order = await placeOrder({ table: "44" });
  unknownOrderId = order.id;

  await waitForSync(order.id, (o) => o.wedjatSyncStatus === "failed");
  const failed = (await db.order.findUnique({ where: { id: order.id } }))!;
  expect(failed.wedjatTableId).toBeNull();
  // mazaj's resolver ("not in the restaurant's floor plan") or the RSM 404
  // ("table not found") — either way the staff sees WHY in the sync panel
  const err = failed.wedjatSyncError?.toLowerCase() ?? "";
  expect(err.includes("floor plan") || err.includes("not found")).toBe(true);
});

test("amendment ADDITIONS are delivered to the same check as a delta", async () => {
  // fresh order on a unique table ("20" → indoor #56)
  const order = await placeOrder({ table: "20" });
  amendOrderId = order.id;
  const id = order.id;
  await waitForSync(id, (o) => o.wedjatSyncStatus === "synced");
  const baseCheckId = (await db.order.findUnique({ where: { id } }))!.wedjatOrderId;

  // amend: ADD one Amy mix bowl
  const { status, data } = await amendOrder(id, AMEND_ITEMS);
  expect(status).toBe(200);
  expect(data.ok).toBe(true);
  expect(data.revision).toBe(1);

  // the delta delivery lands on the SAME check (add-to-check), as its own
  // idempotent externalId "<orderId>:r1"
  const deadline = Date.now() + 8000;
  let check: { items: { sku: string; quantity: number }[] } | undefined;
  while (Date.now() < deadline) {
    const st = await mockState();
    check = st.checks.find((c) => c.id === baseCheckId);
    if (check && check.items.length >= 2) break;
    await new Promise((r) => setTimeout(r, 250));
  }
  expect(check).toBeDefined();
  expect(check!.items.map((i) => ({ sku: i.sku, quantity: i.quantity }))).toEqual([
    { sku: "MAZAJ-MAZAYA-FRUITS", quantity: 1 },
    { sku: "MAZAJ-AMY-MIX", quantity: 1 }, // the delta line
  ]);
  const st = await mockState();
  expect(
    st.webhookCalls.some((c) => c.externalId === `${id}:r1` && c.status === 201)
  ).toBe(true);
  // no removal warning for a pure addition
  const warnComment = await db.orderComment.findFirst({
    where: { orderId: id, author: "Wedjat sync" },
  });
  expect(warnComment).toBeNull();
});

test("amendment REMOVALS warn the staff instead of silently diverging", async () => {
  // remove the Amy bowl from the amendment test's order
  const id = amendOrderId;
  const { status, data } = await amendOrder(id, [BASE_ITEM]);
  expect(status).toBe(200);
  expect(data.ok).toBe(true);
  expect(data.revision).toBe(2);

  // the webhook cannot retract lines: the staff comment tells them to void
  // it in the POS, and the warning is stamped on the order
  const warn = await db.orderComment.findFirst({
    where: { orderId: id, author: "Wedjat sync" },
  });
  expect(warn).not.toBeNull();
  expect(warn!.body).toContain("void");
  const order = (await db.order.findUnique({ where: { id } }))!;
  expect(order.wedjatSyncError).toContain("removed items still on the POS check");
});

test("self-heal: a table added on the RSM side later resolves the stored failure", async () => {
  // the restaurant adds table #77 named "44" to its floor plan
  await fetch(`${MOCK}/__tables`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: 77, name: "44", floor: INDOOR_FLOOR }),
  });
  // refresh mazaj's mirror (the Inngest job does this every 15 min in prod)
  await resetMirror();
  const mirror = await db.wedjatTable.findUnique({ where: { id: 77 } });
  expect(mirror?.name).toBe("44");

  // the "44" order failed earlier — a staff retry re-resolves + lands it
  const staff = await playwrightRequest.newContext();
  const login = await staff.post(`${BASE}/api/auth/employee`, {
    data: { pin: OWNER_PIN },
  });
  expect((await login.json()).ok).toBe(true);
  const failedOrder = (await db.order.findUnique({ where: { id: unknownOrderId } }))!;
  expect(failedOrder.wedjatSyncStatus).toBe("failed");

  const retry = await staff.post(`${BASE}/api/wedjat/push-order`, {
    data: { orderId: failedOrder.id },
  });
  expect(retry.status()).toBe(200);
  const retryData = await retry.json();
  expect(retryData.ok).toBe(true);

  const healed = (await db.order.findUnique({ where: { id: failedOrder.id } }))!;
  expect(healed.wedjatSyncStatus).toBe("synced");
  expect(healed.wedjatTableId).toBe(77);
  expect(healed.wedjatSyncError).toBeNull();

  const st = await mockState();
  const check = st.checks.find((c) => c.externalRef === `mazaj:${failedOrder.id}`);
  expect(check?.tableId).toBe(77);
  await staff.dispose();
});

test("manual retry on a still-ambiguous order returns the reason (409)", async () => {
  const staff = await playwrightRequest.newContext();
  await staff.post(`${BASE}/api/auth/employee`, { data: { pin: OWNER_PIN } });
  const retry = await staff.post(`${BASE}/api/wedjat/push-order`, {
    data: { orderId: ambiguousOrderId },
  });
  expect(retry.status()).toBe(409);
  const data = await retry.json();
  expect(data.ok).toBe(false);
  expect(data.error?.toLowerCase()).toContain("ambiguous");
  await staff.dispose();
});
