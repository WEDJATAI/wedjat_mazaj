import { test, expect } from "@playwright/test";
import { db, branchIds, cleanupE2EState, E2E_TABLE_PREFIX } from "./helpers";

/**
 * r69 session B — the three guards the base suite doesn't cover:
 *   1. a TRUE concurrency race on the last 20g of a jar (two parallel
 *      orders — exactly one may commit)
 *   2. the PIN brute-force lockout (8 fails / 10 min per IP, then 429 —
 *      even a valid PIN is refused while locked)
 *   3. the per-flavor "tracked" contract (a jar row deleted →
 *      tracked:false + updatedAt:null + 0g — never a fake timestamp)
 */

const JAR = { brandIdRaw: "mazaya", flavorName: "Double Apple" };

async function flagshipId(): Promise<string> {
  const ids = await branchIds();
  return ids["mazaj-zamalek"] ?? Object.values(ids)[0];
}

test("concurrent race on the last 20g — exactly one order commits", async ({
  request,
}) => {
  const branchId = await flagshipId();
  const table = `${E2E_TABLE_PREFIX} RACE`;

  await db.flavorStock.updateMany({
    where: {
      brandIdRaw: JAR.brandIdRaw,
      flavorName: JAR.flavorName,
      brand: { branchId },
    },
    data: { stockGrams: 20 },
  });

  const fire = () =>
    request.post("/api/orders", {
      data: {
        customerName: null,
        phone: null,
        table,
        items: [
          {
            id: "e2e:mazaya:race",
            primaryBrandId: "mazaya",
            primaryBrandName: "Mazaya",
            emoji: "🍇",
            accent: "",
            flavor: "fruits",
            flavorLabel: "Fruits",
            components: [
              {
                brandId: "mazaya",
                brandName: "Mazaya",
                flavorName: "Double Apple",
                emoji: "🍇",
                grams: 20,
              },
            ],
            molassesGrams: 20,
            unitPrice: 125,
            qty: 1,
            hookahType: "regular",
            ownType: null,
            forName: "Race Tester",
          },
        ],
        subtotal: 125,
        discount: 0,
        total: 125,
        bogo: false,
        ownType: null,
        source: "guest_call",
        branchId,
      },
    });

  const [a, b] = await Promise.all([fire(), fire()]);
  const statuses = [a.status(), b.status()].sort();
  expect(statuses).toEqual([200, 409]); // never two 200s — no oversell

  const loser = [a, b].find((r) => r.status() === 409)!;
  const errBody = await loser.json();
  expect(errBody.error).toContain("Not enough molasses");
  expect(errBody.error).toContain("Double Apple");

  const jar = await db.flavorStock.findFirst({
    where: {
      brandIdRaw: JAR.brandIdRaw,
      flavorName: JAR.flavorName,
      brand: { branchId },
    },
  });
  expect(jar?.stockGrams).toBe(0); // exactly the one bowl, never negative
});

test("PIN brute force: 8 failures lock the client out (429)", async ({
  request,
}) => {
  // fresh bucket per run — spoofed XFF is honored by the local dev server
  const ip = `198.51.100.${Math.floor(Math.random() * 254) + 1}`;
  const post = (pin: string) =>
    request.post("/api/auth/employee", {
      headers: { "X-Forwarded-For": ip },
      data: { pin },
    });

  // the per-IP bucket allows 8 failures inside 10 minutes…
  for (const pin of ["1010", "2020", "4242", "9111", "8642", "1357", "2468", "3344"]) {
    const res = await post(pin);
    expect(res.status()).toBe(401);
  }

  // …the 9th attempt is refused even when the PIN is CORRECT
  const blocked = await post("1234");
  expect(blocked.status()).toBe(429);
  const body = await blocked.json();
  expect(body.error).toContain("Too many attempts");
  const retryAfter = Number(blocked.headers()["retry-after"]);
  expect(retryAfter).toBeGreaterThan(0);

  // another client is untouched
  const other = await request.post("/api/auth/employee", {
    headers: { "X-Forwarded-For": "198.51.100.200" },
    data: { pin: "1010" },
  });
  expect(other.status()).toBe(401);
});

test("per-flavor tracked contract: a deleted jar is never faked", async ({
  request,
}) => {
  const branchId = await flagshipId();
  const inv = await db.inventoryItem.findFirst({
    where: { brandId: JAR.brandIdRaw, branchId },
  });
  expect(inv).toBeTruthy();

  const stock = await db.flavorStock.findFirst({
    where: {
      brandIdRaw: JAR.brandIdRaw,
      flavorName: JAR.flavorName,
      brand: { branchId },
    },
  });
  expect(stock).toBeTruthy(); // seeded jar exists

  await db.flavorStock.deleteMany({
    where: {
      brandIdRaw: JAR.brandIdRaw,
      flavorName: JAR.flavorName,
      brand: { branchId },
    },
  });

  const res = await request.get(`/api/flavor-stock?branchId=${branchId}`);
  const data = await res.json();
  expect(data.ok).toBe(true);

  const missing = data.items.find(
    (i: { id: string }) => i.id === `${JAR.brandIdRaw}:${JAR.flavorName}`
  );
  expect(missing).toBeTruthy();
  expect(missing.tracked).toBe(false);
  expect(missing.updatedAt).toBeNull(); // never a fabricated "just updated"
  expect(missing.stockGrams).toBe(0);

  // the rest of the shelf is still tracked and the branch still "stocked"
  expect(data.branchStocked).toBe(true);
  const mazayaMint = data.items.find(
    (i: { id: string }) => i.id === "mazaya:Mint"
  );
  expect(mazayaMint.tracked).toBe(true);

  // restore the jar so the availability-filtered UI flows stay intact
  await db.flavorStock.create({
    data: {
      brandId: inv!.id,
      brandIdRaw: JAR.brandIdRaw,
      brandName: "Mazaya",
      flavorName: JAR.flavorName,
      stockGrams: 150,
      lowStockThreshold: 60,
    },
  });
});

test.afterAll(async () => {
  await cleanupE2EState();
});
