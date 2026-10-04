import { db } from "../src/lib/db";
import { BRANDS, SUPPLIES } from "../src/lib/catalog";

async function main() {
  // --- Employees (3 roles) ---
  const employees = [
    { name: "Boss", pin: "1111", role: "super_admin" },
    { name: "Manager", pin: "0000", role: "admin" },
    { name: "Hassan", pin: "1234", role: "employee" },
    { name: "Omar", pin: "5678", role: "employee" },
  ];

  for (const e of employees) {
    // super_admin + admin keep role defaults; employees get queue+new_order+requests
    const perms =
      e.role === "super_admin" || e.role === "admin" ? "" : "queue,new_order,requests";
    await db.employee.upsert({
      where: { pin: e.pin },
      update: { name: e.name, role: e.role, active: true, permissions: perms },
      create: { ...e, active: true, permissions: perms },
    });
  }
  console.log(`Seeded ${employees.length} employees (super_admin/admin/employee)`);

  // --- Molasses inventory (brand totals) + per-flavor subtypes ---
  for (const brand of BRANDS) {
    const inv = await db.inventoryItem.upsert({
      where: { brandId: brand.id },
      update: { brandName: brand.name },
      create: {
        brandId: brand.id,
        brandName: brand.name,
        stockGrams: 1000, // 50 hookahs worth (20g each)
        lowStockThreshold: 120, // 6 hookahs
      },
    });

    // Seed a FlavorStock row per flavor (~150g = ~7 hookahs each).
    for (const flavor of brand.flavors) {
      await db.flavorStock.upsert({
        where: { brandIdRaw_flavorName: { brandIdRaw: brand.id, flavorName: flavor } },
        update: {},
        create: {
          brandId: inv.id,
          brandIdRaw: brand.id,
          brandName: brand.name,
          flavorName: flavor,
          stockGrams: 150,
          lowStockThreshold: 60, // 3 hookahs
        },
      });
    }
  }
  const flavorCount = BRANDS.reduce((s, b) => s + b.flavors.length, 0);
  console.log(
    `Seeded inventory for ${BRANDS.length} brands (${flavorCount} flavor subtypes)`
  );

  // --- Supplies (coal + foil + hose) ---
  for (const s of SUPPLIES) {
    await db.supplyItem.upsert({
      where: { key: s.key },
      update: { cost: s.cost },
      create: {
        key: s.key,
        name: s.name,
        unit: s.unit,
        emoji: s.emoji,
        stock: s.defaultStock,
        lowStockThreshold: s.lowThreshold,
        cost: s.cost,
      },
    });
  }
  console.log(`Seeded ${SUPPLIES.length} supply items`);

  // --- A sample guest service request so the Requests panel isn't empty ---
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
      },
    });
    console.log("Seeded sample service request");
  }

  // --- A sample unassigned guest order (so the Queue shows a confirm item) ---
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
      },
    });
    console.log("Seeded sample unassigned guest order");
  }

  // --- A sample favorite mix so returning-guest demo works ---
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
