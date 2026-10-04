import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { z } from "zod";

const RestockSchema = z.object({
  addGrams: z.number().positive().max(100000),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const parsed = RestockSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 }
      );
    }
    const { addGrams } = parsed.data;

    // id may be a real DB row id OR a composite "brandIdRaw:flavorName" fallback.
    let row = await db.flavorStock.findUnique({ where: { id } });
    if (!row) {
      // try composite key
      const [brandIdRaw, ...flavorParts] = id.split(":");
      const flavorName = flavorParts.join(":");
      if (brandIdRaw && flavorName) {
        row = await db.flavorStock.findUnique({
          where: { brandIdRaw_flavorName: { brandIdRaw, flavorName } },
        }) ?? undefined;
      }
    }

    if (!row) {
      return NextResponse.json(
        { ok: false, error: "Flavor stock not found" },
        { status: 404 }
      );
    }

    // Restock the flavor subtype + bump the brand total to match.
    const updated = await db.$transaction(async (tx) => {
      const flavor = await tx.flavorStock.update({
        where: { id: row!.id },
        data: { stockGrams: { increment: addGrams } },
      });
      await tx.inventoryItem.update({
        where: { id: row!.brandId },
        data: { stockGrams: { increment: addGrams } },
      });
      return flavor;
    });

    return NextResponse.json({ ok: true, item: updated });
  } catch (err) {
    console.error("flavor-stock restock error", err);
    return NextResponse.json(
      { ok: false, error: "Could not restock flavor" },
      { status: 500 }
    );
  }
}
