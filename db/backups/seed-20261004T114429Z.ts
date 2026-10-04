import { db } from "../src/lib/db";
import { BRANDS, SUPPLIES } from "../src/lib/catalog";

async function main() {
  // --- Employees ---
  const employees = [
    { name: "Hassan", pin: "1234", role: "shisha_man" },
    { name: "Omar", pin: "5678", role: "shisha_man" },
    { name: "Manager", pin: "0000", role: "admin" },
  ];

  for (const e of employees) {
    await db.employee.upsert({
      where: { pin: e.pin },
      update: { name: e.name, role: e.role, active: true },
      create: { ...e, active: true },
    });
  }
  console.log(`Seeded ${employees.length} employees`);

  // --- Molasses inventory ---
  for (const brand of BRANDS) {
    await db.inventoryItem.upsert({
      where: { brandId: brand.id },
      update: {},
      create: {
        brandId: brand.id,
        brandName: brand.name,
        stockGrams: 1000, // 50 hookahs worth (20g each)
        lowStockThreshold: 120, // 6 hookahs
      },
    });
  }
  console.log(`Seeded inventory for ${BRANDS.length} brands`);

  // --- Supplies (coal + foil) ---
  for (const s of SUPPLIES) {
    await db.supplyItem.upsert({
      where: { key: s.key },
      update: {},
      create: {
        key: s.key,
        name: s.name,
        unit: s.unit,
        emoji: s.emoji,
        stock: s.defaultStock,
        lowStockThreshold: s.lowThreshold,
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
          {
            brandId: "mazaya",
            brandName: "Mazaya",
            flavorName: "Blueberry",
            emoji: "🌹",
            grams: 10,
          },
          {
            brandId: "al-fakher",
            brandName: "Al Fakher",
            flavorName: "Mint",
            emoji: "🔴",
            grams: 10,
          },
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
