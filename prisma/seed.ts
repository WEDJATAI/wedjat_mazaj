import { db } from "../src/lib/db";
import { BRANDS, SUPPLIES } from "../src/lib/catalog";

/**
 * r57 multi-tenant seed:
 *   Platform Owner (PIN 9999, platform_admin) → the super-admin console
 *   Mazaj (flagship venue, hookah lounge) — 2 branches:
 *     · Zamalek Corniche (flagship) — Hassan (1234), Manager (0000)
 *     · New Cairo — Omar (5678)
 *   Mazaj Owner (PIN 8888, venue_admin) → all-branches view + inventory matrix
 *   Boss (PIN 1111, super_admin) floats across Mazaj branches
 *   Qasr El-Nil Café (active, cafe) — one branch + its own admin (7777)
 *   Nile Deck Restaurant (pending) — onboarded but awaiting connection
 *
 * Inventory + supplies are seeded PER BRANCH (different levels so the
 * admin matrix view is interesting).
 */

async function main() {
  // ── Venues ────────────────────────────────────────────────────────────
  const venues = [
    { slug: "mazaj", name: "Mazaj", nameAr: "مزاج", kind: "hookah", status: "active" },
    { slug: "qasr-el-nil", name: "Qasr El-Nil Café", nameAr: "قصر النيل", kind: "cafe", status: "active" },
    { slug: "nile-deck", name: "Nile Deck Restaurant", nameAr: "مطعم كاسر النيل", kind: "restaurant", status: "pending" },
  ];
  const venueIds: Record<string, string> = {};
  for (const v of venues) {
    const row = await db.venue.upsert({
      where: { slug: v.slug },
      update: { name: v.name, nameAr: v.nameAr, kind: v.kind, status: v.status },
      create: v,
    });
    venueIds[v.slug] = row.id;
  }
  console.log(`Seeded ${venues.length} venues`);

  // ── Branches ──────────────────────────────────────────────────────────
  const branches = [
    { slug: "mazaj-zamalek", venueSlug: "mazaj", name: "Zamalek Corniche", nameAr: "زامليكس الكورنيش", isFlagship: true, isActive: true },
    { slug: "mazaj-newcairo", venueSlug: "mazaj", name: "New Cairo", nameAr: "القاهرة الجديدة", isFlagship: false, isActive: true },
    { slug: "qasr-el-nil-tahrir", venueSlug: "qasr-el-nil", name: "Tahrir", nameAr: "التحرير", isFlagship: true, isActive: true },
    { slug: "nile-deck-maadi", venueSlug: "nile-deck", name: "Maadi Deck", nameAr: "المعادي", isFlagship: true, isActive: true },
  ];
  const branchIds: Record<string, string> = {};
  for (const b of branches) {
    const row = await db.branch.upsert({
      where: { slug: b.slug },
      update: { name: b.name, nameAr: b.nameAr, isFlagship: b.isFlagship, isActive: b.isActive, venueId: venueIds[b.venueSlug] },
      create: {
        slug: b.slug,
        name: b.name,
        nameAr: b.nameAr,
        isFlagship: b.isFlagship,
        isActive: b.isActive,
        venueId: venueIds[b.venueSlug],
      },
    });
    branchIds[b.slug] = row.id;
  }
  console.log(`Seeded ${branches.length} branches`);

  // ── Employees (multi-tenant roles) ────────────────────────────────────
  const employees = [
    // the platform super admin — owns the console that onboards venues
    { name: "Platform Owner", pin: "9999", role: "platform_admin", venueId: null, branchId: null, permissions: "" },
    // Mazaj's owner — every branch, inventory matrix, staff management
    { name: "Mazaj Owner", pin: "8888", role: "venue_admin", venueId: venueIds["mazaj"], branchId: null, permissions: "" },
    // legacy super admin — floats across Mazaj branches (QA + boss)
    { name: "Boss", pin: "1111", role: "super_admin", venueId: venueIds["mazaj"], branchId: null, permissions: "" },
    // branch-pinned staff
    { name: "Manager", pin: "0000", role: "admin", venueId: venueIds["mazaj"], branchId: branchIds["mazaj-zamalek"], permissions: "" },
    { name: "Hassan", pin: "1234", role: "employee", venueId: venueIds["mazaj"], branchId: branchIds["mazaj-zamalek"], permissions: "queue,new_order,requests" },
    { name: "Omar", pin: "5678", role: "employee", venueId: venueIds["mazaj"], branchId: branchIds["mazaj-newcairo"], permissions: "queue,new_order,requests" },
    { name: "Ember QA", pin: "3131", role: "super_admin", venueId: venueIds["mazaj"], branchId: branchIds["mazaj-zamalek"], permissions: "" },
    // a second venue's own admin (created by the platform owner, in real life)
    { name: "Café Admin", pin: "7777", role: "venue_admin", venueId: venueIds["qasr-el-nil"], branchId: null, permissions: "" },
  ];

  for (const e of employees) {
    await db.employee.upsert({
      where: { pin: e.pin },
      update: { name: e.name, role: e.role, active: true, permissions: e.permissions, venueId: e.venueId, branchId: e.branchId },
      create: { ...e, active: true },
    });
  }
  console.log(`Seeded ${employees.length} employees (platform/venue/branch roles)`);

  // ── Molasses inventory + flavor subtypes + supplies — PER BRANCH ──────
  // Different stock levels per branch so the admin matrix tells a story.
  const branchStock: Record<string, { brandGrams: number; flavorGrams: number; supplyScale: number }> = {
    "mazaj-zamalek": { brandGrams: 1000, flavorGrams: 150, supplyScale: 1 },
    "mazaj-newcairo": { brandGrams: 700, flavorGrams: 110, supplyScale: 0.6 },
    "qasr-el-nil-tahrir": { brandGrams: 600, flavorGrams: 90, supplyScale: 0.5 },
    "nile-deck-maadi": { brandGrams: 0, flavorGrams: 0, supplyScale: 0 }, // pending venue — nothing stocked
  };

  for (const [slug, cfg] of Object.entries(branchStock)) {
    const branchId = branchIds[slug];
    if (cfg.brandGrams <= 0) continue;

    for (const brand of BRANDS) {
      const existing = await db.inventoryItem.findFirst({
        where: { brandId: brand.id, branchId },
      });
      if (!existing) {
        await db.inventoryItem.create({
          data: {
            brandId: brand.id,
            brandName: brand.name,
            stockGrams: cfg.brandGrams,
            lowStockThreshold: 120,
            branchId,
          },
        });
      }
      const inv = await db.inventoryItem.findFirstOrThrow({
        where: { brandId: brand.id, branchId },
      });

      for (const flavor of brand.flavors) {
        await db.flavorStock.upsert({
          where: { brandId_flavorName: { brandId: inv.id, flavorName: flavor } },
          update: {},
          create: {
            brandId: inv.id,
            brandIdRaw: brand.id,
            brandName: brand.name,
            flavorName: flavor,
            stockGrams: cfg.flavorGrams,
            lowStockThreshold: 60,
          },
        });
      }
    }

    for (const s of SUPPLIES) {
      const stock = Math.round(s.defaultStock * cfg.supplyScale);
      const existing = await db.supplyItem.findFirst({
        where: { key: s.key, branchId },
      });
      if (!existing) {
        await db.supplyItem.create({
          data: {
            key: s.key,
            name: s.name,
            unit: s.unit,
            emoji: s.emoji,
            stock,
            lowStockThreshold: s.lowThreshold,
            cost: s.cost,
            sellPrice: s.sellPrice,
            branchId,
          },
        });
      }
    }
  }
  const flavorCount = BRANDS.reduce((s, b) => s + b.flavors.length, 0);
  console.log(
    `Seeded per-branch inventory (${BRANDS.length} brands, ${flavorCount} flavors, ${SUPPLIES.length} supplies per stocked branch)`
  );

  // ── Sample service requests (branch-scoped) ───────────────────────────
  const existingReq = await db.serviceRequest.findFirst({
    where: { table: "Table 3", status: "pending" },
  });
  if (!existingReq) {
    await db.serviceRequest.create({
      data: {
        type: "call_shisha_man",
        guestName: "Sara",
        table: "Table 3",
        note: "Need help choosing flavors",
        status: "pending",
        branchId: branchIds["mazaj-zamalek"],
      },
    });
    console.log("Seeded sample service request (Zamalek)");
  }

  // ── Sample unassigned guest order (branch-scoped) ─────────────────────
  const existingUnassigned = await db.order.findFirst({
    where: { assignment: "unassigned" },
  });
  if (!existingUnassigned) {
    await db.order.create({
      data: {
        customerName: "Sara",
        table: "Table 5",
        itemsJson: JSON.stringify([
          {
            id: "mazaya:fruits",
            primaryBrandId: "mazaya",
            primaryBrandName: "Mazaya",
            emoji: "🌹",
            accent: "from-rose-500/25 to-amber-500/5",
            flavor: "fruits",
            flavorLabel: "Fruits",
            components: [
              {
                brandId: "mazaya",
                brandName: "Mazaya",
                flavorName: "Blueberry",
                emoji: "🌹",
                grams: 20,
              },
            ],
            molassesGrams: 20,
            unitPrice: 125,
            qty: 1,
          },
        ]),
        subtotal: 125,
        discount: 0,
        total: 125,
        bogo: false,
        itemCount: 1,
        status: "pending",
        source: "guest_call",
        orderedByName: "Sara",
        assignment: "unassigned",
        branchId: branchIds["mazaj-zamalek"],
      },
    });
    console.log("Seeded sample unassigned guest order (Zamalek)");
  }

  // ── Sample favorite mix ───────────────────────────────────────────────
  const existingFav = await db.favoriteMix.findFirst({
    where: { guestName: "Sara", label: "Sara's Signature" },
  });
  if (!existingFav) {
    await db.favoriteMix.create({
      data: {
        guestName: "Sara",
        label: "Sara's Signature",
        componentsJson: JSON.stringify([
          { brandId: "mazaya", brandName: "Mazaya", flavorName: "Blueberry", emoji: "🌹", grams: 10 },
          { brandId: "al-fakher", brandName: "Al Fakher", flavorName: "Mint", emoji: "🔴", grams: 10 },
        ]),
      },
    });
    console.log("Seeded sample favorite mix (Sara's Signature)");
  }
}

main()
  .then(() => db.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await db.$disconnect();
    process.exit(1);
  });
