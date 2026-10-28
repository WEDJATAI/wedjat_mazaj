import { PrismaClient } from "@prisma/client";

/**
 * r69 — shared helpers for the golden-path E2E suite.
 *
 * Direct SQLite access (the same DB the dev server uses) so every spec can
 * start from a deterministic state and clean up after itself: orders placed
 * via the API/UI are removed, touched flavor jars are topped back up, and
 * the PIN rate-limit bucket is reset.
 */

process.env.DATABASE_URL ??=
  process.env.E2E_DATABASE_URL ?? "file:/home/z/my-project/db/custom.db";

export const db = new PrismaClient();

export const E2E_TABLE_PREFIX = "E2E";

/** The seeded branch ids (slugs from prisma/seed.ts). */
export async function branchIds(): Promise<Record<string, string>> {
  const rows = await db.branch.findMany();
  const out: Record<string, string> = {};
  for (const b of rows) out[b.slug] = b.id;
  return out;
}

/** A minimal valid guest order payload (guest self-order → unassigned). */
export function guestOrderPayload(opts: {
  branchId: string;
  table: string;
  items?: unknown[];
  total?: number;
}) {
  return {
    customerName: null,
    phone: null,
    table: opts.table,
    items: opts.items ?? [
      {
        id: "e2e:mazaya:fruits",
        primaryBrandId: "mazaya",
        primaryBrandName: "Mazaya",
        emoji: "🍇",
        accent: "#7c6ee6",
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
        unitPrice: 125, // server recomputes anyway — that's the point
        qty: 1,
        hookahType: "regular",
        ownType: null,
        forName: "E2E Tester",
      },
    ],
    subtotal: opts.total ?? 125,
    discount: 0,
    total: opts.total ?? 125,
    bogo: false,
    ownType: null,
    source: "guest_call",
    branchId: opts.branchId,
  };
}

/** Remove every order this suite created + top the touched jars back up. */
export async function cleanupE2EState(): Promise<void> {
  const orders = await db.order.findMany({
    where: { table: { startsWith: E2E_TABLE_PREFIX } },
    select: { id: true },
  });
  for (const o of orders) {
    await db.orderComment.deleteMany({ where: { orderId: o.id } });
    await db.pointsLedger.deleteMany({ where: { orderId: o.id } });
    await db.order.delete({ where: { id: o.id } }).catch(() => {});
  }
  // top every flavor jar of the seeded branches back to its seed level so
  // repeated runs never starve the availability-filtered UI flows
  await db.flavorStock.updateMany({ data: { stockGrams: 150 } });
  await db.inventoryItem.updateMany({ data: { stockGrams: 1000 } });
  // reset the PIN rate-limit bucket (the api spec deliberately trips it)
  await db.pinAttempt.deleteMany({});
  // r71 — reset the guest write rate-limit buckets too (specs place guest
  // orders / requests through the real API from one shared IP)
  await db.guestAttempt.deleteMany({});
  // requests created by the suite
  await db.serviceRequest.deleteMany({
    where: { guestName: { startsWith: E2E_TABLE_PREFIX } },
  });
  // r72 — junk rows the limiter specs create
  await db.favoriteMix.deleteMany({
    where: { guestName: { startsWith: E2E_TABLE_PREFIX } },
  });
  await db.pushSubscription.deleteMany({
    where: { endpoint: { startsWith: "https://r72-e2e.push.local" } },
  });
  await db.errorLog.deleteMany({
    where: { message: { startsWith: "r72-e2e" } },
  });
  // r73 — backup runs the specs recorded
  await db.backupRun.deleteMany({});
}

/** Place a guest order through the real API (kitchen-visible). */
export async function placeGuestOrder(
  base: string,
  branchId: string,
  table: string,
  items?: unknown[]
): Promise<{ id: string; total: number }> {
  const res = await fetch(`${base}/api/orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(guestOrderPayload({ branchId, table, items })),
  });
  const data = await res.json();
  if (!res.ok || !data.ok) {
    throw new Error(`placeGuestOrder failed: ${res.status} ${JSON.stringify(data)}`);
  }
  return { id: data.order.id, total: data.order.total };
}
