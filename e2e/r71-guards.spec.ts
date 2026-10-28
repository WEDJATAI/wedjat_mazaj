import { test, expect, request as playwrightRequest } from "@playwright/test";
import { cleanupE2EState, db } from "./helpers";

/**
 * r71 — HARDENING guards (regression net).
 *
 *  1. wedjat/* integration routes are staff-guarded (they were fully
 *     anonymous until r71 — including a POST that writes to the POS)
 *  2. guest tracking lookups (?guest= / ?id=) return a SAFE PROJECTION
 *     (no phone / internals) and ?guest= can be branch-scoped
 *  3. the guest write rate limit trips at 15 requests / 10 min per IP,
 *     isolated per IP, and bypassed by a staff session
 *  4. the platform owner can revoke an account's sessions instantly;
 *     disabling an account kills its sessions too
 */

const BASE = "http://localhost:3000";

test.describe.configure({ mode: "serial" });

test.afterAll(async () => {
  await cleanupE2EState();
  await db.$disconnect();
});

test("wedjat routes: anonymous 401, staff 200, push-order needs sync permission", async ({
  request,
}) => {
  // anonymous → 401 everywhere on the integration surface
  for (const ep of [
    "/api/wedjat/tables",
    "/api/wedjat/health",
    "/api/wedjat/products",
    "/api/wedjat/sync-revocations",
  ]) {
    const res = await request.get(`${BASE}${ep}`);
    expect(res.status(), `no-cookie ${ep}`).toBe(401);
  }
  const anonPush = await request.post(`${BASE}/api/wedjat/push-order`, {
    data: { orderId: "does-not-matter" },
  });
  expect(anonPush.status()).toBe(401);

  // Hassan (plain staff) → the four dashboard GETs work…
  const staff = await playwrightRequest.newContext();
  const login = await staff.post(`${BASE}/api/auth/employee`, {
    data: { pin: "1234" },
  });
  expect((await login.json()).ok).toBe(true);
  for (const ep of [
    "/api/wedjat/tables",
    "/api/wedjat/health",
    "/api/wedjat/products",
    "/api/wedjat/sync-revocations",
  ]) {
    const res = await staff.get(`${BASE}${ep}`);
    expect(res.status(), `staff ${ep}`).toBe(200);
  }
  // …but push-order (a POS write) needs the "sync" permission → 403
  const staffPush = await staff.post(`${BASE}/api/wedjat/push-order`, {
    data: { orderId: "does-not-matter" },
  });
  expect(staffPush.status()).toBe(403);
  await staff.dispose();

  // a super_admin (Boss) → passes auth + permission (unknown order → 404);
  // "sync" belongs to the restaurant admins who run the sync dashboard —
  // the platform owner intentionally has no operational permissions
  const boss = await playwrightRequest.newContext();
  const bossLogin = await boss.post(`${BASE}/api/auth/employee`, {
    data: { pin: "1111" },
  });
  expect((await bossLogin.json()).ok).toBe(true);
  const bossPush = await boss.post(`${BASE}/api/wedjat/push-order`, {
    data: { orderId: "does-not-exist" },
  });
  expect(bossPush.status()).toBe(404);
  await boss.dispose();
});

test("guest tracking lookups: safe projection + branch scoping", async ({
  request,
}) => {
  const branches = await db.branch.findMany({ orderBy: { createdAt: "asc" } });
  expect(branches.length).toBeGreaterThanOrEqual(2);
  const [br1, br2] = branches;

  const item = {
    id: "e2e:r71",
    primaryBrandId: "mazaya",
    primaryBrandName: "Mazaya",
    emoji: "🍇",
    accent: "#7c6ee6",
    flavor: "fruits",
    flavorLabel: "Fruits",
    components: [
      { brandId: "mazaya", brandName: "Mazaya", flavorName: "Double Apple", grams: 20 },
    ],
    molassesGrams: 20,
    unitPrice: 125,
    qty: 1,
    hookahType: "regular",
    ownType: null,
    forName: "R71 Guard",
  };

  // same guest name, TWO branches, WITH a phone number
  for (const [branch, table] of [
    [br1, "E2E-PRIV-1"],
    [br2, "E2E-PRIV-2"],
  ] as const) {
    const res = await request.post(`${BASE}/api/orders`, {
      data: {
        customerName: "E2E-Privacy",
        phone: "+201000000099",
        table,
        items: [item],
        subtotal: 125,
        discount: 0,
        total: 125,
        bogo: false,
        ownType: null,
        source: "guest_call",
        branchId: branch.id,
      },
    });
    expect(res.status(), `order on ${table}`).toBe(200);
  }

  // unscoped name lookup (legacy): both branches, but ONLY the safe fields
  const both = await request.get(`${BASE}/api/orders?guest=E2E-Privacy`);
  const bothData = await both.json();
  expect(bothData.ok).toBe(true);
  expect(bothData.orders.length).toBe(2);
  const ALLOWED = new Set([
    "id", "customerName", "table", "status", "itemCount", "itemsJson",
    "total", "createdAt", "rating", "pointsEarned", "ownType", "addonsJson",
    "revision",
  ]);
  for (const o of bothData.orders) {
    for (const key of Object.keys(o)) {
      expect(ALLOWED.has(key), `field ${key} must not leak to guests`).toBe(true);
    }
  }

  // branch-scoped lookup: only this branch's orders
  const scoped = await request.get(
    `${BASE}/api/orders?guest=E2E-Privacy&branchId=${br1.id}`
  );
  const scopedData = await scoped.json();
  expect(scopedData.ok).toBe(true);
  expect(scopedData.orders.length).toBe(1);
  expect(scopedData.orders[0].table).toBe("E2E-PRIV-1");

  // focused id lookup: same safe projection
  const focused = await request.get(
    `${BASE}/api/orders?id=${bothData.orders[0].id}`
  );
  const focusedData = await focused.json();
  expect(focusedData.ok).toBe(true);
  expect(focusedData.orders.length).toBe(1);
  expect("phone" in focusedData.orders[0]).toBe(false);
});

test("guest write rate limit: 15/10min per IP, isolated, staff bypass", async () => {
  // an isolated fake client IP so the shared 127.0.0.1 bucket stays clean
  // for the other specs (local dev reads x-forwarded-for directly)
  const ip = "198.51.100.71";
  const post = (headers: Record<string, string>) =>
    fetch(`${BASE}/api/requests`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify({
        type: "coal",
        guestName: "E2E-RL",
        table: "E2E-RL",
      }),
    });

  const codes: number[] = [];
  for (let i = 0; i < 16; i++) {
    const res = await post({ "x-forwarded-for": ip });
    codes.push(res.status);
  }
  // exactly the first 15 pass, the 16th is blocked
  expect(codes.filter((c) => c === 200).length).toBe(15);
  expect(codes[15]).toBe(429);

  // the blocked response carries a Retry-After
  const blocked = await post({ "x-forwarded-for": ip });
  expect(blocked.status).toBe(429);
  expect(blocked.headers.get("retry-after")).toBeTruthy();

  // a DIFFERENT ip is not affected (per-IP buckets)
  const other = await post({ "x-forwarded-for": "198.51.100.72" });
  expect(other.status).toBe(200);

  // a signed-in staff member bypasses the guest limit entirely
  const staff = await playwrightRequest.newContext();
  const login = await staff.post(`${BASE}/api/auth/employee`, {
    data: { pin: "1234" },
  });
  expect((await login.json()).ok).toBe(true);
  const staffReq = await staff.post(`${BASE}/api/requests`, {
    data: { type: "coal", guestName: "E2E-RL", table: "E2E-RL" },
  });
  expect(staffReq.status()).toBe(200);
  await staff.dispose();
});

test("session revocation: owner signs an account out of every device instantly", async () => {
  const hassan = await db.employee.findFirst({ where: { pin: "1234" } });
  expect(hassan).not.toBeNull();

  // Hassan signs in (his cookie works)
  const staff = await playwrightRequest.newContext();
  await staff.post(`${BASE}/api/auth/employee`, { data: { pin: "1234" } });
  const before = await staff.get(`${BASE}/api/orders`);
  expect(before.status()).toBe(200);

  // the owner sees Hassan online…
  const owner = await playwrightRequest.newContext();
  await owner.post(`${BASE}/api/auth/employee`, { data: { pin: "9999" } });
  const people = await owner.get(`${BASE}/api/platform/employees`);
  expect(people.status()).toBe(200);
  const peopleData = await people.json();
  const hassanRow = peopleData.employees.find(
    (e: { id: string }) => e.id === hassan!.id
  );
  expect(hassanRow.activeSessions).toBeGreaterThanOrEqual(1);

  // …and revokes every session
  const revoke = await owner.delete(
    `${BASE}/api/platform/employees/${hassan!.id}/sessions`
  );
  expect(revoke.status()).toBe(200);
  const revokeData = await revoke.json();
  expect(revokeData.ok).toBe(true);
  expect(revokeData.revoked).toBeGreaterThanOrEqual(1);

  // Hassan's cookie is dead IMMEDIATELY
  const after = await staff.get(`${BASE}/api/orders`);
  expect(after.status()).toBe(401);
  await staff.dispose();

  // disabling an account also kills its sessions on the spot
  const staff2 = await playwrightRequest.newContext();
  await staff2.post(`${BASE}/api/auth/employee`, { data: { pin: "1234" } });
  const disable = await owner.patch(
    `${BASE}/api/platform/employees/${hassan!.id}`,
    { data: { active: false } }
  );
  const disableData = await disable.json();
  expect(disableData.ok).toBe(true);
  expect(disableData.sessionsKilled).toBeGreaterThanOrEqual(1);
  const afterDisable = await staff2.get(`${BASE}/api/orders`);
  expect(afterDisable.status()).toBe(401);
  await staff2.dispose();

  // restore Hassan for the other specs
  const enable = await owner.patch(
    `${BASE}/api/platform/employees/${hassan!.id}`,
    { data: { active: true } }
  );
  expect((await enable.json()).ok).toBe(true);
  await owner.dispose();
});
