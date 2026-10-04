import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { z } from "zod";

const CartItemSchema = z.object({
  id: z.string(),
  brandId: z.string(),
  brandName: z.string(),
  flavor: z.enum(["fruits", "fruits-mix", "flat"]),
  flavorLabel: z.string(),
  molassesGrams: z.number(),
  unitPrice: z.number(),
  qty: z.number().int().positive(),
  emoji: z.string(),
  accent: z.string(),
});

const CreateOrderSchema = z.object({
  customerName: z.string().trim().min(1, "Name is required").max(80),
  phone: z
    .string()
    .trim()
    .min(6, "Enter a valid phone number")
    .max(20),
  table: z.string().trim().max(40).optional().or(z.literal("")),
  notes: z.string().trim().max(400).optional().or(z.literal("")),
  items: z.array(CartItemSchema).min(1, "Add at least one hookah"),
  subtotal: z.number().nonnegative(),
  discount: z.number().nonnegative(),
  total: z.number().nonnegative(),
  bogo: z.boolean(),
  ownType: z.enum(["hookah", "molasses"]).optional().nullable(),
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

    const order = await db.order.create({
      data: {
        customerName: data.customerName,
        phone: data.phone,
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
      },
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
