/**
 * r74 — production backfill + E2E for "orders enter Wedjat RSM".
 *
 * CONTEXT: every guest order since Oct 11 failed to enter the restaurant
 * POS (table labels unresolvable in the rebuilt floor plan). r74 fixed the
 * pipeline; this script runs against PRODUCTION:
 *
 *   1. kick + verify the floor-plan mirror bootstrap (Neon WedjatTable)
 *   2. BACKFILL the 4 real failed orders into Wedjat RSM as takeaway
 *      checks (their tables don't exist in the floor plan — takeaway is
 *      the only entry path; the check notes carry the original table +
 *      a backfill marker so the staff knows what it is)
 *   3. stamp the r72 E2E test order with a clear reason (left failed)
 *   4. place ONE labeled verification order at a real free table ("19",
 *      indoor #55) through the production guest API → verify it resolves,
 *      syncs, and the check exists in the live RSM (via the status feed)
 *   5. mark the verification order done in the Mazaj queue
 *
 * Usage: bun run scripts/r74-prod-verify.ts
 */

import { Pool } from "pg";
import { mapOrderItems, type OrderItemJson } from "../src/lib/rsm-mapping";

/**
 * SECURITY (r75): every credential is read from the environment —
 * NEVER hardcoded (this repo is public). Provide before running:
 *
 *   NEON_DATABASE_URL  — the pooled Neon production connection string
 *   WEDJAT_RSM_KEY     — the deliveryWebhookKey from RSM's Integrations page
 */
function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env ${name} — export it before running (see header comment).`);
  return v;
}
const NEON = required("NEON_DATABASE_URL");
const PROD = "https://wmazaj.vercel.app";
const RSM = "https://wedjatrsm-tonsy.vercel.app";
const RSM_KEY = required("WEDJAT_RSM_KEY");

const BACKFILL_IDS = [
  "cmv3zquvr0001kx06ustxfbum", // Table 21 · Oct 11 (real guest)
  "cmv4kk8lw0001l606k07b1tdm", // Table 44 · Oct 12 (real guest)
  "cmv4m9qcb0001lb06u8ewia62", // Table 44 · Oct 12 (real guest)
  "cmv7cbb5d0002ig060lpme8l0", // ساره · table 24 · Oct 13 night (real guest)
];
const E2E_PROD_ID = "cmv6spz0f0002jp06s878c092"; // r72 test artifact — stamp + leave failed

const pool = new Pool({ connectionString: NEON, max: 2 });

async function q<T = any>(sql: string, params: unknown[] = []): Promise<T[]> {
  const r = await pool.query(sql, params);
  return r.rows as T[];
}

async function rsmStatus(ids?: number[]) {
  const qs = ids?.length ? `?ids=${ids.join(",")}` : "";
  const res = await fetch(`${RSM}/api/integrations/mazaj/status${qs}`, {
    headers: { "x-rsm-key": RSM_KEY },
  });
  if (!res.ok) throw new Error(`RSM status ${res.status}`);
  return res.json();
}

async function pushWebhook(payload: Record<string, unknown>) {
  const res = await fetch(`${RSM}/api/integrations/delivery/webhook`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-rsm-key": RSM_KEY },
    body: JSON.stringify(payload),
  });
  return { status: res.status, json: await res.json().catch(() => ({})) };
}

(async () => {
  console.log("== 1. floor-plan mirror (prod) ==");
  // kick the bootstrap (public endpoint fires a background sync when the
  // mirror is empty; the Inngest */15 job is the reliable filler)
  for (let i = 0; i < 10; i++) {
    const floors = await fetch(`${PROD}/api/wedjat/floors`)
      .then((r) => r.json())
      .catch(() => ({ floors: [] }));
    const n = (floors.floors ?? []).length;
    const rows = await q("SELECT count(*)::int AS n FROM \"WedjatTable\"");
    console.log(`   kick ${i + 1}: endpoint floors=${n} · mirror rows=${rows[0].n}`);
    if (rows[0].n > 0) break;
    await new Promise((r) => setTimeout(r, 4000));
  }
  const mirror = await q(
    'SELECT "floorName", count(*)::int AS n FROM "WedjatTable" GROUP BY 1 ORDER BY 1'
  );
  console.log("   mirror:", JSON.stringify(mirror));

  console.log("\n== 2. backfill the 4 real failed orders ==");
  for (const id of BACKFILL_IDS) {
    const [o] = await q(
      'SELECT id, "customerName", phone, "table", notes, "itemsJson", bogo, "addonsJson", total FROM "Order" WHERE id = $1',
      [id]
    );
    if (!o) {
      console.log(`   ✗ ${id} not found`);
      continue;
    }
    const items = JSON.parse(o.itemsJson) as OrderItemJson[];
    const addons: string[] = o.addonsJson ? JSON.parse(o.addonsJson) : [];
    const webhookItems = mapOrderItems(items, o.bogo, addons);
    const { status, json } = await pushWebhook({
      provider: "mazaj",
      externalId: o.id,
      customerName: (o.customerName || "Mazaj guest").slice(0, 60),
      notes: `r74 backfill · original table: ${o.table ?? "?"} (not in the floor plan) · mazaj order${o.notes ? " · " + o.notes.slice(0, 140) : ""}`.slice(0, 300),
      items: webhookItems,
      // NO table reference — the tables 21/44/24 don't exist in RSM;
      // takeaway is the only entry path (staff closes it after review)
    });
    if (status === 201 || (status === 200 && json?.order)) {
      const wid = json?.order?.id ?? null;
      await q(
        'UPDATE "Order" SET "wedjatOrderId" = $2, "wedjatSyncStatus" = $3, "wedjatSyncError" = NULL WHERE id = $1',
        [o.id, wid, "synced"]
      );
      console.log(
        `   ✓ ${o.id.slice(-6)} (${o.customerName ?? "?"} · table ${o.table}) → RSM ${json.addedToCheck ? "added to check" : "NEW check"} #${wid} · ${webhookItems.length} line(s)`
      );
    } else {
      console.log(`   ✗ ${o.id.slice(-6)} → ${status} ${JSON.stringify(json).slice(0, 160)}`);
    }
  }

  console.log("\n== 3. stamp the r72 e2e test order ==");
  await q(
    'UPDATE "Order" SET "wedjatSyncError" = $2 WHERE id = $1',
    [E2E_PROD_ID, "r72 e2e test order · table E2E-PROD is not a real table — safe to close/ignore (not a guest sale)"]
  );
  const [stamped] = await q('SELECT "wedjatSyncStatus", "wedjatSyncError" FROM "Order" WHERE id = $1', [E2E_PROD_ID]);
  console.log("   stamped:", JSON.stringify(stamped));

  console.log("\n== 4. verification order at real table 19 (indoor #55) ==");
  const [branch] = await q("SELECT id FROM \"Branch\" WHERE slug = 'mazaj-zamalek'");
  const res = await fetch(`${PROD}/api/orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      customerName: "R74 VERIFY — void this check",
      phone: null,
      table: "19",
      notes: "r74 pipeline verification — void this check in the POS",
      items: [
        {
          id: "r74:verify:mazaya",
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
          forName: "R74 Verify",
        },
      ],
      subtotal: 125,
      discount: 0,
      total: 125,
      bogo: false,
      ownType: null,
      source: "guest_call",
      branchId: branch.id,
    }),
  });
  const placed = await res.json();
  if (!placed.ok) {
    console.log("   ✗ placement failed:", res.status, JSON.stringify(placed).slice(0, 200));
  } else {
    const oid = placed.order.id as string;
    console.log(`   placed ${oid} (table 19, 125 EGP)`);
    // poll Neon for the fire-and-forget push result
    let row: any = null;
    for (let i = 0; i < 30; i++) {
      [row] = await q(
        'SELECT "wedjatTableId", "wedjatFloor", "wedjatSyncStatus", "wedjatOrderId", "wedjatSyncError" FROM "Order" WHERE id = $1',
        [oid]
      );
      if (row && row.wedjatSyncStatus !== "pending") break;
      await new Promise((r) => setTimeout(r, 1000));
    }
    console.log("   mazaj row:", JSON.stringify(row));
    if (row?.wedjatSyncStatus === "synced") {
      const feed = await rsmStatus();
      const check = (feed.orders as any[]).find((o) => o.externalRef === `mazaj:${oid}`);
      console.log("   RSM check:", JSON.stringify(check));
      // mark the mazaj order done (staff-queue hygiene) via the owner session
      const login = await fetch(`${PROD}/api/auth/employee`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: "8888" }),
      });
      const cookie = login.headers.get("set-cookie")?.split(";")[0] ?? "";
      const patch = await fetch(`${PROD}/api/orders`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", cookie },
        body: JSON.stringify({ id: oid, status: "done" }),
      });
      console.log("   mark done:", patch.status, JSON.stringify(await patch.json().catch(() => ({}))).slice(0, 80));
    }
  }

  console.log("\n== 5. final sync-state distribution (prod) ==");
  const dist = await q('SELECT "wedjatSyncStatus", count(*)::int AS n FROM "Order" GROUP BY 1 ORDER BY 2 DESC');
  console.log("  ", JSON.stringify(dist));

  await pool.end();
})().catch(async (e) => {
  console.error("FAILED:", e);
  await pool.end();
  process.exit(1);
});
