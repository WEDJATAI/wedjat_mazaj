import { test, expect } from "@playwright/test";
import { branchIds, cleanupE2EState, db } from "./helpers";

/**
 * r69 (audit ⑦) — SERVER-AUTHORITY golden paths.
 *
 * The r68 audit's tamper tests, now permanent: pricing recompute, stock
 * validation, schema guards, flavor-stock truthfulness, and the PIN
 * brute-force lockout. These are the rules that MUST hold no matter what
 * a tampered client sends.
 */

test.describe.configure({ mode: "serial" });

let branches: Record<string, string> = {};

test.beforeAll(async () => {
  branches = await branchIds();
});

test.afterAll(async () => {
  await cleanupE2EState();
  await db.$disconnect();
});

test("health endpoint reports a live deployment", async ({ request }) => {
  const res = await request.get("/api/health");
  expect(res.ok()).toBeTruthy();
  const data = await res.json();
  expect(data.ok).toBe(true);
  expect(data.db).toBe("up");
  // local dev has no VERCEL_GIT_COMMIT_SHA → commit is null; on Vercel it's
  // the deployment SHA. Both are healthy — a missing deployment object is not.
  expect(data.deployment).toBeTruthy();
  expect(
    data.deployment.commit === null || typeof data.deployment.commit === "string"
  ).toBe(true);
});

test("flavor-stock is truthful about tracked jars (r69 audit ③)", async ({ request }) => {
  const res = await request.get(`/api/flavor-stock?branchId=${branches["mazaj-zamalek"]}`);
  expect(res.ok()).toBeTruthy();
  const data = await res.json();
  expect(data.ok).toBe(true);
  // a stocked branch reports stocked
  expect(data.branchStocked).toBe(true);
  // every catalog flavor appears exactly once with an honest tracked flag
  expect(Array.isArray(data.items)).toBeTruthy();
  for (const it of data.items) {
    expect(typeof it.tracked).toBe("boolean");
    if (!it.tracked) {
      // untracked jars carry NO fabricated freshness stamp
      expect(it.updatedAt).toBeNull();
      expect(it.stockGrams).toBe(0);
    } else {
      expect(it.updatedAt).not.toBeNull();
    }
  }
});

test("unstocked branch reports branchStocked=false (r69 audit ③)", async ({ request }) => {
  const res = await request.get(`/api/flavor-stock?branchId=${branches["nile-deck-maadi"]}`);
  const data = await res.json();
  expect(data.ok).toBe(true);
  expect(data.branchStocked).toBe(false);
});

test("server recomputes totals — a tampered client total never sticks (r68 tamper)", async ({ request }) => {
  const res = await request.post("/api/orders", {
    data: {
      customerName: null,
      phone: null,
      table: "E2E-TAMPER",
      items: [
        {
          id: "e2e:amy:tamper",
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
          unitPrice: 1, // ← tampered
          qty: 1,
          hookahType: "amy", // Amy pipe → 180 EGP flat, server-side
          ownType: null,
          forName: "Tamper Test",
        },
      ],
      subtotal: 1,
      discount: 0,
      total: 1, // ← tampered
      bogo: false,
      ownType: null,
      source: "guest_call",
      branchId: branches["mazaj-zamalek"],
    },
  });
  const data = await res.json();
  expect(res.status()).toBe(200);
  expect(data.ok).toBe(true);
  // the server charged the real Amy session price, not the tampered 1 EGP
  expect(data.order.total).toBe(180);
});

test("stock is deducted by a real order (atomic r69 guard)", async ({ request }) => {
  const before = await db.flavorStock.findFirst({
    where: { brandIdRaw: "mazaya", flavorName: "Double Apple", brand: { branchId: branches["mazaj-zamalek"] } },
  });
  expect(before).not.toBeNull();

  const res = await request.post("/api/orders", {
    data: {
      customerName: null,
      phone: null,
      table: "E2E-STOCK",
      items: [
        {
          id: "e2e:mazaya:stock",
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
          forName: "Stock Test",
        },
      ],
      subtotal: 125,
      discount: 0,
      total: 125,
      bogo: false,
      ownType: null,
      source: "guest_call",
      branchId: branches["mazaj-zamalek"],
    },
  });
  const data = await res.json();
  expect(res.status()).toBe(200);

  const after = await db.flavorStock.findFirst({
    where: { id: before!.id },
  });
  // exactly one bowl's worth (20g) was deducted
  expect(after!.stockGrams).toBeCloseTo(before!.stockGrams - 20, 5);
});

test("an impossible order is rejected 409 with the shortage spelled out", async ({ request }) => {
  const res = await request.post("/api/orders", {
    data: {
      customerName: null,
      phone: null,
      table: "E2E-TOOBIG",
      items: [
        {
          id: "e2e:mazaya:toobig",
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
          qty: 99, // 99 bowls of one flavor — no jar survives that
          hookahType: "regular",
          ownType: null,
          forName: "Too Big",
        },
      ],
      subtotal: 12375,
      discount: 0,
      total: 12375,
      bogo: false,
      ownType: null,
      source: "guest_call",
      branchId: branches["mazaj-zamalek"],
    },
  });
  expect(res.status()).toBe(409);
  const data = await res.json();
  expect(data.ok).toBe(false);
  expect(data.error).toContain("Not enough molasses");
  // and nothing was written — no order with that table exists
  const count = await db.order.count({ where: { table: "E2E-TOOBIG" } });
  expect(count).toBe(0);
});

test("empty components without ownType are rejected 400 (r67 guard)", async ({ request }) => {
  const res = await request.post("/api/orders", {
    data: {
      customerName: null,
      phone: null,
      table: "E2E-EMPTY",
      items: [
        {
          id: "e2e:mazaya:empty",
          primaryBrandId: "mazaya",
          primaryBrandName: "Mazaya",
          emoji: "🍇",
          accent: "#7c6ee6",
          flavor: "fruits",
          flavorLabel: "Fruits",
          components: [], // no components AND no ownType → nonsense order
          molassesGrams: 20,
          unitPrice: 125,
          qty: 1,
          hookahType: "regular",
          ownType: null,
          forName: "Empty Test",
        },
      ],
      subtotal: 125,
      discount: 0,
      total: 125,
      bogo: false,
      ownType: null,
      source: "guest_call",
      branchId: branches["mazaj-zamalek"],
    },
  });
  expect(res.status()).toBe(400);
});

test("own-molasses BYO orders price the pipe+service flat (125 regular / 180 amy)", async ({ request }) => {
  const res = await request.post("/api/orders", {
    data: {
      customerName: null,
      phone: null,
      table: "E2E-BYO",
      items: [
        {
          id: "e2e:own:regular",
          primaryBrandId: "own-molasses",
          primaryBrandName: "Own molasses",
          emoji: "🎒",
          accent: "#7c6ee6",
          flavor: "fruits",
          flavorLabel: "Fruits",
          components: [],
          molassesGrams: 0,
          unitPrice: 125,
          qty: 2, // 2-for-1 BYO → one chargeable
          hookahType: "regular",
          ownType: "molasses",
          forName: "BYO Test",
        },
      ],
      subtotal: 250,
      discount: 125,
      total: 125,
      bogo: true,
      ownType: "molasses",
      source: "guest_call",
      branchId: branches["mazaj-zamalek"],
    },
  });
  const data = await res.json();
  expect(res.status()).toBe(200);
  // 2 shishas, BYO 2-for-1 → exactly one 125 EGP session charged
  expect(data.order.total).toBe(125);
  expect(data.order.itemCount).toBe(2);
});

test("PIN brute-force is locked out after 8 failures (r69 audit ⑥)", async ({ request }) => {
  let sawLimit = false;
  for (let i = 1; i <= 10; i++) {
    const res = await request.post("/api/auth/employee", {
      data: { pin: "9998" }, // not a real PIN
    });
    if (i <= 8) {
      expect(res.status()).toBe(401);
    } else {
      expect(res.status()).toBe(429);
      sawLimit = true;
    }
  }
  expect(sawLimit).toBe(true);
  // and even the CORRECT pin is blocked during the lockout window
  const blocked = await request.post("/api/auth/employee", {
    data: { pin: "1234" },
  });
  expect(blocked.status()).toBe(429);
});
