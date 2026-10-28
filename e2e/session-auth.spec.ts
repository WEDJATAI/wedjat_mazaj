import { test, expect } from "@playwright/test";
import { cleanupE2EState, db } from "./helpers";

/**
 * r70 — SESSION AUTH guards (regression net).
 *
 * Before r70 every privileged route trusted a client-supplied employeeId
 * (query/body): anyone who learned a cuid could impersonate staff, read
 * the PIN directory, or rewrite venue status. These specs pin the new
 * contract:
 *
 *  1. no cookie            → 401 on every staff/platform endpoint
 *  2. spoofed employeeId   → still 401 (the param is ignored entirely)
 *  3. staff session        → 200 on staff routes, 403 on platform routes
 *  4. sign-out             → the session is dead on the server
 *  5. staff orders require a session; guest orders never do
 */

const BASE = "http://localhost:3000";

test.describe.configure({ mode: "serial" });

test.afterAll(async () => {
  await cleanupE2EState();
  await db.$disconnect();
});

const PROTECTED_GETS = [
  "/api/orders",
  "/api/requests",
  "/api/employees",
  "/api/profit",
  "/api/analytics",
  "/api/inventory",
  "/api/purchases",
  "/api/rsm/finance",
];

test("no cookie → 401 on every protected endpoint; spoofing employeeId does not help", async ({
  request,
}) => {
  // grab a real employee id (Hassan's) to prove the param is ignored
  const hassan = await db.employee.findFirst({ where: { pin: "1234" } });
  expect(hassan).not.toBeNull();

  for (const ep of PROTECTED_GETS) {
    const res = await request.get(`${BASE}${ep}`);
    expect(res.status(), `no-cookie ${ep}`).toBe(401);

    const spoofed = await request.get(
      `${BASE}${ep}?employeeId=${hassan!.id}`
    );
    expect(spoofed.status(), `spoofed ${ep}`).toBe(401);
  }

  // platform layer too
  const venues = await request.get(
    `${BASE}/api/platform/venues?employeeId=${hassan!.id}`
  );
  expect(venues.status()).toBe(401);

  // guest-facing surfaces stay open
  const open = await request.get(`${BASE}/api/flavor-stock`);
  expect(open.status()).toBe(200);
});

test("staff session: staff routes 200, platform routes 403, sign-out kills the session", async ({
  request,
}) => {
  // login through the same request context (captures the Set-Cookie)
  const login = await request.post(`${BASE}/api/auth/employee`, {
    data: { pin: "1234" },
  });
  const data = await login.json();
  expect(data.ok).toBe(true);

  // whoami works
  const me = await request.get(`${BASE}/api/auth/session`);
  expect(me.status()).toBe(200);
  const meData = await me.json();
  expect(meData.employee.name).toBe("Hassan");

  // staff endpoints work for Hassan (queue + requests permissions)
  const orders = await request.get(`${BASE}/api/orders`);
  expect(orders.status()).toBe(200);
  const requests = await request.get(`${BASE}/api/requests`);
  expect(requests.status()).toBe(200);

  // but the staff session cannot touch the platform layer…
  const venues = await request.get(`${BASE}/api/platform/venues`);
  expect(venues.status()).toBe(403);
  // …or management surfaces Hassan lacks permissions for
  const employees = await request.get(`${BASE}/api/employees`);
  expect(employees.status()).toBe(403);

  // sign out — the session row dies server-side
  const out = await request.delete(`${BASE}/api/auth/session`);
  expect(out.status()).toBe(200);
  const after = await request.get(`${BASE}/api/auth/session`);
  expect(after.status()).toBe(401);
  const ordersAfter = await request.get(`${BASE}/api/orders`);
  expect(ordersAfter.status()).toBe(401);
});

test("a staff-source order without a session is refused; a guest order never is", async ({
  request,
}) => {
  const branches = await db.branch.findMany();
  const branchId = branches[0].id;

  const item = {
    id: "e2e:r70",
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
    forName: "R70 Guard",
  };
  const base = {
    customerName: null,
    phone: null,
    table: "E2E-R70",
    items: [item],
    subtotal: 125,
    discount: 0,
    total: 125,
    bogo: false,
    ownType: null,
    branchId,
  };

  // staff-source without a session → 401 (spoofed employeeId in the body
  // used to make this pass)
  const hassan = await db.employee.findFirst({ where: { pin: "1234" } });
  const staffRes = await request.post(`${BASE}/api/orders`, {
    data: {
      ...base,
      source: "employee",
      employeeId: hassan!.id,
      orderedByName: "Hassan",
    },
  });
  expect(staffRes.status()).toBe(401);

  // guest-source without a session → 200 (the wizard flow)
  const guestRes = await request.post(`${BASE}/api/orders`, {
    data: { ...base, source: "guest_call" },
  });
  const guestData = await guestRes.json();
  expect(guestRes.status()).toBe(200);
  expect(guestData.ok).toBe(true);
  // a guest order is never attributed to an employee
  expect(guestData.order.employeeId).toBeNull();
});
