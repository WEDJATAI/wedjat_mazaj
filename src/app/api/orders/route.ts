import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { z } from "zod";
import { getBrand, mixPrice, chargeableQty, MOLASSES_GRAMS } from "@/lib/catalog";

const ComponentSchema = z.object({
  brandId: z.string(),
  brandName: z.string(),
  flavorName: z.string(),
  grams: z.number().positive(),
  emoji: z.string().default(""),
});

const CartItemSchema = z.object({
  id: z.string(),
  primaryBrandId: z.string(),
  primaryBrandName: z.string(),
  emoji: z.string().default(""),
  accent: z.string().default(""),
  flavor: z.enum(["fruits", "fruits-mix", "flat"]),
  flavorLabel: z.string(),
  components: z.array(ComponentSchema).min(1),
  molassesGrams: z.number().default(MOLASSES_GRAMS),
  unitPrice: z.number().nonnegative(),
  qty: z.number().int().positive(),
});

const CreateOrderSchema = z.object({
  customerName: z.string().trim().max(80).optional().or(z.literal("")),
  phone: z.string().trim().max(20).optional().or(z.literal("")),
  table: z.string().trim().max(40).optional().or(z.literal("")),
  notes: z.string().trim().max(400).optional().or(z.literal("")),
  items: z.array(CartItemSchema).min(1, "Add at least one hookah"),
  subtotal: z.number().nonnegative(),
  discount: z.number().nonnegative(),
  total: z.number().nonnegative(),
  bogo: z.boolean(),
  ownType: z.enum(["hookah", "molasses"]).optional().nullable(),
  source: z.enum(["employee", "guest_scan", "guest_call"]).default("employee"),
  orderedByName: z.string().trim().max(80).optional().nullable(),
  employeeId: z.string().optional().nullable(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = CreateOrderSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          ok: false,
          error: parsed.error.issues[0]?.message ?? "Invalid order data",
        },
        { status: 400 }
      );
    }

    const data = parsed.data;

    // --- Inventory deduction (transactional) ---
    // For each cart line, deduct component grams × qty from each brand's stock.
    // Build a map of brandId -> total grams to deduct.
    const deductions = new Map<string, number>();
    for (const it of data.items) {
      for (const c of it.components) {
        deductions.set(
          c.brandId,
          (deductions.get(c.brandId) ?? 0) + c.grams * it.qty
        );
      }
    }

    // Validate enough stock before writing.
    const inventoryRows = await db.inventoryItem.findMany({
      where: { brandId: { in: [...deductions.keys()] } },
    });
    const short: { brandName: string; need: number; have: number }[] = [];
    for (const row of inventoryRows) {
      const need = deductions.get(row.brandId) ?? 0;
      if (need > row.stockGrams + 0.001) {
        short.push({
          brandName: row.brandName,
          need: Math.round(need),
          have: Math.round(row.stockGrams),
        });
      }
    }
    if (short.length > 0) {
      return NextResponse.json(
        {
          ok: false,
          error: `Not enough molasses in stock: ${short
            .map((s) => `${s.brandName} (need ${s.need}g, have ${s.have}g)`)
            .join("; ")}`,
        },
        { status: 409 }
      );
    }

    // Create order + deduct stock in a single transaction.
    const order = await db.$transaction(async (tx) => {
      const created = await tx.order.create({
        data: {
          customerName: data.customerName || null,
          phone: data.phone || null,
          table: data.table || null,
          notes: data.notes || null,
          itemsJson: JSON.stringify(data.items),
          subtotal: data.subtotal,
          discount: data.discount,
          total: data.total,
          bogo: data.bogo,
          ownType: data.ownType ?? null,
          itemCount: data.items.reduce((sum, i) => sum + i.qty, 0),
          status: "pending",
          source: data.source,
          orderedByName: data.orderedByName || null,
          employeeId: data.employeeId || null,
        },
      });

      for (const [brandId, grams] of deductions) {
        await tx.inventoryItem.update({
          where: { brandId },
          data: { stockGrams: { decrement: grams } },
        });
      }

      return created;
    });

    return NextResponse.json({ ok: true, order });
  } catch (err) {
    console.error("create order error", err);
    return NextResponse.json(
      { ok: false, error: "Could not place order" },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const orders = await db.order.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    return NextResponse.json({ ok: true, orders });
  } catch (err) {
    console.error("list orders error", err);
    return NextResponse.json(
      { ok: false, error: "Could not load orders" },
      { status: 500 }
    );
  }
}
