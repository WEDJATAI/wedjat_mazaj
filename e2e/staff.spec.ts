import { test, expect, type Page } from "@playwright/test";
import { branchIds, cleanupE2EState, db, placeGuestOrder } from "./helpers";

/**
 * r69 (audit ⑦) — STAFF golden paths.
 *
 * PIN sign-in → the queue lifecycle (incoming → confirm & take →
 * preparing → done) → the New tab (bowl builder, with the r69 Amy-flat
 * pricing regression) → the requests lifecycle.
 *
 * The PIN UI is exercised once in the first test; the rest inject the
 * exact session the real sign-in produces (fetched through the live auth
 * API) so each test starts from a known state.
 */

test.describe.configure({ mode: "serial" });

const BASE = "http://localhost:3000";

test.afterAll(async () => {
  await cleanupE2EState();
  await db.$disconnect();
});

/** Inject the real Hassan session (what POST /api/auth/employee returns).
 *
 * r70: the login MUST go through page.request — it shares the browser
 * context's cookie jar, so the httpOnly session cookie lands where the
 * staff UI's subsequent API calls will send it from. A plain node fetch
 * would set no cookie and every guarded endpoint would 401.
 */
async function signInAsHassan(page: Page) {
  const res = await page.request.post(`${BASE}/api/auth/employee`, {
    data: { pin: "1234" },
  });
  const data = await res.json();
  if (!data.ok) throw new Error(`auth failed: ${JSON.stringify(data)}`);
  const session = JSON.stringify({
    state: { role: "employee", employee: data.employee, guest: null },
    version: 3,
  });
  await page.addInitScript((s) => {
    localStorage.setItem("mazaj-session", s);
    localStorage.removeItem("mazaj-cart");
    localStorage.setItem(
      "mazaj-lang",
      JSON.stringify({ state: { lang: "en" }, version: 0 })
    );
  }, session);
  // skip the cinematic boot splash (it intercepts clicks for ~2.7s)
  await page.addInitScript(() => {
    try {
      sessionStorage.setItem("mazaj:boot-splash-v1", "1");
    } catch {}
  });
}

test("staff PIN sign-in", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.removeItem("mazaj-session");
    localStorage.removeItem("mazaj-cart");
    localStorage.setItem(
      "mazaj-lang",
      JSON.stringify({ state: { lang: "en" }, version: 0 })
    );
    // skip the one-per-session cinematic boot splash — tests click fast
    try {
      sessionStorage.setItem("mazaj:boot-splash-v1", "1");
    } catch {}
  });
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Order Now" }).first()).toBeVisible({
    timeout: 30_000,
  });
  await page.getByRole("button", { name: "Order Now" }).first().click();
  await page.getByRole("button", { name: "I'm staff" }).click();

  // the PIN pad: Hassan is 1234 — it auto-submits on the 4th digit
  for (const digit of ["1", "2", "3", "4"]) {
    await page.getByRole("button", { name: digit, exact: true }).click();
  }

  // the employee dashboard appears with the Queue
  await expect(page.getByText(/Active sessions & history/i)).toBeVisible({
    timeout: 30_000,
  });
});

test("queue lifecycle: incoming → confirm & take → preparing → done", async ({ page }) => {
  // a guest order arrives through the real API
  const branches = await branchIds();
  const placed = await placeGuestOrder(BASE, branches["mazaj-zamalek"], "E2E-Q1");

  await signInAsHassan(page);
  await page.goto("/");
  await expect(page.getByText(/Active sessions & history/i)).toBeVisible({
    timeout: 30_000,
  });

  // the incoming order is visible with the per-person label (r69 audit ②)
  const card = page.locator(".glass", { hasText: "E2E-Q1" }).first();
  await expect(card).toBeVisible({ timeout: 30_000 });
  await expect(card.getByText("E2E Tester")).toBeVisible(); // forName now surfaces (r69 audit ②)
  await expect(card.getByText("Guest self-order")).toBeVisible();

  // confirm & take → assigned to Hassan, preparing
  await card.getByRole("button", { name: /Confirm & take/i }).click();
  await expect(page.getByText(/Order confirmed/i).first()).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByText(/Assigned: Hassan/i).first()).toBeVisible({
    timeout: 30_000,
  });

  // confirm & take lands directly on Preparing/Assigned (r67 kitchen rule)
  await expect(
    page
      .locator(".glass", { hasText: "E2E-Q1" })
      .first()
      .getByText("Preparing")
  ).toBeVisible({ timeout: 30_000 });

  // mark done from the preparing card
  await page
    .locator(".glass", { hasText: "E2E-Q1" })
    .first()
    .getByRole("button", { name: /Mark done/i })
    .click();

  // the DB reflects the final state
  await expect
    .poll(
      async () => {
        const o = await db.order.findUnique({ where: { id: placed.id } });
        return o?.status;
      },
      { timeout: 30_000 }
    )
    .toBe("done");
});

test("New tab: Amy-category bowls price 180 EGP flat (r69 audit ④ regression)", async ({ page }) => {
  await signInAsHassan(page);
  await page.goto("/");
  await expect(page.getByText(/Active sessions & history/i)).toBeVisible({
    timeout: 30_000,
  });

  // open the New tab (badge counts ride along in the accessible name)
  const tabBar = page.getByRole("navigation", { name: "Sections" });
  await tabBar.getByRole("button", { name: /New/ }).click();
  await expect(page.getByText("Choose shisha type")).toBeVisible({
    timeout: 30_000,
  });

  // the Amy tile names exactly the four premium brands (r69 copy fix)
  await expect(
    page.getByText(/Premium pipe · Mazaya · Al Fakher · Dandash · Nakhla · 180 flat/i)
  ).toBeVisible();

  // open the Amy category
  await page.getByRole("button", { name: /Amy shisha/i }).click();

  // every brand card prices the flat session — never "from 125" (audit ④)
  const mazayaCard = page.getByRole("button", { name: /Mazaya/ }).first();
  await expect(mazayaCard).toBeVisible();
  await expect(mazayaCard.getByText(/180 EGP flat/i)).toBeVisible();

  // build the bowl: Mazaya → editor shows flat 180 pricing → add flavor
  await mazayaCard.click();
  await expect(page.getByText(/Build a bowl/i)).toBeVisible({ timeout: 15_000 });

  // add a flavor: the "Add a flavor" button opens the cross-brand picker
  await page.getByRole("button", { name: /Add a flavor/i }).click();
  await expect(page.getByText(/Pick a flavor/i)).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: "Double Apple" }).last().click();
  await page.getByRole("button", { name: /Add to order/i }).click();

  // the bowl appears in the order with the Amy pipe chip
  await expect(page.getByText(/Amy pipe · 180 flat/i).first()).toBeVisible({
    timeout: 15_000,
  });

  // sending without a table number is refused
  await page.getByRole("button", { name: /Send order/i }).click();
  await expect(page.getByText("Table number is required")).toBeVisible({
    timeout: 15_000,
  });

  // fill the table and send
  await page.getByLabel("Table number (required)").fill("E2E-BB");
  await page.getByLabel("Customer name").fill("Ahmed");
  await page.getByRole("button", { name: /Send order/i }).click();
  await expect(page.getByText("Order sent!")).toBeVisible({ timeout: 30_000 });

  // the server charged the flat Amy price for it
  const order = await db.order.findFirst({
    where: { table: "E2E-BB" },
    orderBy: { createdAt: "desc" },
  });
  expect(order).not.toBeNull();
  expect(order!.total).toBe(180);
  expect(order!.itemsJson).toContain('"hookahType":"amy"');
});

test("requests lifecycle: pending → acknowledged → done", async ({ page }) => {
  // a guest calls the shisha man through the real API
  const branches = await branchIds();
  await fetch(`${BASE}/api/requests`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      type: "call_shisha_man",
      guestName: "E2E-Q1",
      table: "E2E-Q1",
      branchId: branches["mazaj-zamalek"],
    }),
  });

  await signInAsHassan(page);
  await page.goto("/");
  await expect(page.getByText(/Active sessions & history/i)).toBeVisible({
    timeout: 30_000,
  });
  const tabBar2 = page.getByRole("navigation", { name: "Sections" });
  await tabBar2.getByRole("button", { name: /Requests/ }).click();
  await expect(page.getByText("Guest calls for the shisha man")).toBeVisible({
    timeout: 30_000,
  });

  // the request appears as pending with the gold stepper
  await expect(page.getByText("Call the shisha man").first()).toBeVisible({
    timeout: 30_000,
  });

  // acknowledge → in progress
  await page.getByRole("button", { name: /Acknowledge/i }).first().click();
  await expect(
    page.getByText("Request acknowledged").first()
  ).toBeVisible({ timeout: 15_000 });

  // mark done
  await page.getByRole("button", { name: /Mark done/i }).first().click();
  await expect(
    page.getByText("Request marked done").first()
  ).toBeVisible({ timeout: 15_000 });
});
