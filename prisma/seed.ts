import { db } from "../src/lib/db";
import { BRANDS } from "../src/lib/catalog";

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

  // --- Inventory ---
  // Give each brand a starting stock (in grams of molasses).
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
}

main()
  .then(() => db.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await db.$disconnect();
    process.exit(1);
  });
