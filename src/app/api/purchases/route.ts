import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { resolveBranchScope } from "@/lib/branch-scope";
import { z } from "zod";
import { BRANDS, SUPPLIES, getBrand, getSupply } from "@/lib/catalog";

export async function GET() {
  try {
    const purchases = await db.purchase.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return NextResponse.json({ ok: true, purchases });
  } catch (err) {
    console.error("list purchases error", err);
    return NextResponse.json(
      { ok: false, error: "Could not load purchases" },
      { status: 500 }
    );
  }
}

const CreateSchema = z.object({
  kind: z.enum(["molasses", "supply"]),
  refId: z.string().min(1),
  // for molasses: grams per pack (250/1000); for supply: units per pack
  gramsOrUnits: z.number().positive(),
  packCount: z.number().int().positive().max(1000),
  unitCost: z.number().positive(),
  buyerName: z.string().trim().max(80).optional().nullable(),
  // r57: the branch this purchase restocks (optional — defaults to flagship)
  branchId: z.string().trim().optional().nullable(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = CreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          ok: false,
          error: parsed.error.issues[0]?.message ?? "Invalid purchase",
        },
        { status: 400 }
      );
    }
    const { kind, refId, gramsOrUnits, packCount, unitCost, buyerName } =
      parsed.data;
    const totalCost = Math.round(unitCost * packCount * 100) / 100;

    // r57: which branch receives this purchase's stock
    const { branchId: purchaseBranchId } = await resolveBranchScope(
      parsed.data.branchId ?? null
    );

    // Validate + build display name
    let name = "";
    if (kind === "molasses") {
      const brand = getBrand(refId);
      if (!brand) {
        return NextResponse.json(
          { ok: false, error: "Unknown brand" },
          { status: 400 }
        );
      }
      name = `${brand.name} · ${gramsOrUnits}g pack`;
    } else {
      const supply = getSupply(refId);
      if (!supply) {
        return NextResponse.json(
          { ok: false, error: "Unknown supply" },
          { status: 400 }
        );
      }
      name = `${supply.name} · ${gramsOrUnits} ${supply.unit}/pack`;
    }

    // Create purchase + restock inventory in a single transaction.
    const purchase = await db.$transaction(async (tx) => {
      const created = await tx.purchase.create({
        data: {
          kind,
          refId,
          name,
          gramsOrUnits,
          packCount,
          unitCost,
          totalCost,
          buyerName: buyerName || null,
          branchId: purchaseBranchId,
        },
      });

      if (kind === "molasses") {
        const addGrams = gramsOrUnits * packCount;
        const existing = await tx.inventoryItem.findFirst({
          where: { brandId: refId, branchId: purchaseBranchId },
        });
        if (existing) {
          await tx.inventoryItem.update({
            where: { id: existing.id },
            data: { stockGrams: { increment: addGrams } },
          });
        } else {
          const brand = getBrand(refId)!;
          await tx.inventoryItem.create({
            data: {
              brandId: refId,
              brandName: brand.name,
              stockGrams: addGrams,
              lowStockThreshold: 120,
              branchId: purchaseBranchId,
            },
          });
        }
      } else {
        const addUnits = gramsOrUnits * packCount;
        const existing = await tx.supplyItem.findFirst({
          where: { key: refId, branchId: purchaseBranchId },
        });
        if (existing) {
          await tx.supplyItem.update({
            where: { id: existing.id },
            data: { stock: { increment: addUnits } },
          });
        } else {
          const supply = getSupply(refId)!;
          await tx.supplyItem.create({
            data: {
              key: supply.key,
              name: supply.name,
              unit: supply.unit,
              emoji: supply.emoji,
              stock: addUnits,
              lowStockThreshold: supply.lowThreshold,
              cost: supply.cost,
              branchId: purchaseBranchId,
            },
          });
        }
      }

      return created;
    });

    return NextResponse.json({ ok: true, purchase });
  } catch (err) {
    console.error("create purchase error", err);
    return NextResponse.json(
      { ok: false, error: "Could not record purchase" },
      { status: 500 }
    );
  }
}
