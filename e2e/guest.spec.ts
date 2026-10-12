import { test, expect } from "@playwright/test";
import { branchIds, cleanupE2EState, db } from "./helpers";

/**
 * r69 (audit ⑦) — THE GUEST RITUAL (golden path).
 *
 * Landing → guest check-in → the full wizard (who → setup → pipe →
 * molasses → flavors → review → add) → the corner TABLE ORDER card →
 * send → confirmation. Everything a guest does on their best night.
 */

test.describe.configure({ mode: "serial" });

test.afterAll(async () => {
  await cleanupE2EState();
  await db.$disconnect();
});

test("guest orders a shisha through the full wizard", async ({ page }) => {
  // ensure a clean guest state (a persisted guest session from a previous
  // run would skip the landing)
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

  // ── landing → sign-in ──────────────────────────────────────────────
  await expect(page.getByRole("button", { name: "Order Now" }).first()).toBeVisible({
    timeout: 30_000,
  });
  await page.getByRole("button", { name: "Order Now" }).first().click();
  await expect(page.getByText("I'm a guest")).toBeVisible();

  // ── guest check-in (table number is the identity) ─────────────────
  await page.getByRole("button", { name: "I'm a guest" }).click();
  const tableInput = page.getByLabel("Table number");
  await expect(tableInput).toBeVisible();
  await tableInput.fill("E2E77");
  await page.getByRole("button", { name: "Start ordering" }).click();

  // ── the wizard appears (express guest flow) ────────────────────────
  await expect(page.getByText("Who's this shisha for?")).toBeVisible({
    timeout: 30_000,
  });
  await page.getByLabel("Who's this shisha for?").fill("Omar");
  await page.getByRole("button", { name: /Continue/i }).click();

  // ── setup: from the menu ───────────────────────────────────────────
  await expect(page.getByText("Did you bring your own?")).toBeVisible();
  await page.getByRole("button", { name: /From the menu/i }).click();

  // ── pipe: regular ──────────────────────────────────────────────────
  await expect(page.getByText("Choose your pipe")).toBeVisible();
  await page.getByRole("button", { name: /^Regular/ }).click();

  // ── molasses: Mazaya (availability-filtered grid) ──────────────────
  await expect(page.getByText("Choose your molasses")).toBeVisible();
  const mazaya = page.getByRole("button", { name: /Mazaya/ }).first();
  await expect(mazaya).toBeVisible();
  await mazaya.click();

  // ── flavors: Double Apple, then continue ───────────────────────────
  await expect(page.getByText("Pick your flavors")).toBeVisible();
  await page.getByRole("button", { name: "Double Apple" }).first().click();
  await page.getByRole("button", { name: /Continue/i }).click();

  // ── review: the real price shows (Mazaya fruits = 125) ─────────────
  await expect(page.getByText("Your shisha")).toBeVisible();
  await expect(page.getByText("125 EGP", { exact: true })).toBeVisible();

  // ── add to the table order → the added step ────────────────────────
  await page.getByRole("button", { name: /Add to table order/i }).click();
  await expect(
    page.getByRole("button", { name: "Add another shisha" })
  ).toBeVisible({ timeout: 15_000 });

  // ── the corner TABLE ORDER card shows the stack (r69 clearance keeps
  //    it from covering the wizard's own buttons) ─────────────────────
  const cornerCard = page.getByRole("complementary");
  await expect(cornerCard).toBeVisible();
  await expect(cornerCard.getByText("Table order", { exact: true })).toBeVisible();

  // ── send the table order ───────────────────────────────────────────
  await page.getByRole("button", { name: /Send table order/i }).click();

  // ── express confirm dialog: table prefilled, place the order ──────
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible({ timeout: 15_000 });
  await dialog.getByLabel(/table/i).fill("E2E77");
  await dialog.getByRole("button", { name: /Confirm my order/i }).click();

  // ── the order lands: "Order placed!" confirmation ──────────────────
  await expect(dialog.getByText("Order placed!")).toBeVisible({
    timeout: 30_000,
  });

  // ── and the kitchen really has it (DB, not just UI) ────────────────
  const branches = await branchIds();
  const order = await db.order.findFirst({
    where: { table: "E2E77", branchId: branches["mazaj-zamalek"] },
    orderBy: { createdAt: "desc" },
  });
  expect(order).not.toBeNull();
  expect(order!.status).toBe("pending");
  expect(order!.assignment).toBe("unassigned");
  expect(order!.total).toBe(125);
  const items = JSON.parse(order!.itemsJson);
  expect(items[0].forName).toBe("Omar");
  expect(items[0].hookahType).toBe("regular");
});
