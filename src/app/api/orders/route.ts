import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { z } from "zod";
import {
  MOLASSES_GRAMS,
  SUPPLIES,
  getBrand,
  recomputeOrderTotals,
  serverComponentGrams,
  supplyConsumption,
} from "@/lib/catalog";

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
  qty: z.number().int().positive().max(99),
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
  favoriteMixId: z.string().optional().nullable(),
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

    // --- Validate every component brandId exists in the catalog ---
    for (const it of data.items) {
      for (const c of it.components) {
        if (!getBrand(c.brandId)) {
          return NextResponse.json(
            { ok: false, error: `Unknown molasses brand: ${c.brandId}` },
            { status: 400 }
          );
        }
      }
    }

    // --- SERVER-SIDE PRICE RECOMPUTE (do NOT trust client totals) ---
    // Re-derive per-component grams so a client can't tamper with grams to
    // avoid depleting stock (always 20g per hookah, split evenly).
    const sanitizedItems = data.items.map((it) => {
      const grams = serverComponentGrams(it.components.length);
      return {
        ...it,
        components: it.components.map((c, i) => ({ ...c, grams: grams[i] })),
      };
    });
    const totals = recomputeOrderTotals(sanitizedItems, data.ownType ?? null);

    const totalHookahs = totals.totalQty;

    // --- Molasses deductions (per brand, from server-derived grams) ---
    const molassesDeductions = new Map<string, number>();
    for (const it of sanitizedItems) {
      for (const c of it.components) {
        molassesDeductions.set(
          c.brandId,
          (molassesDeductions.get(c.brandId) ?? 0) + c.grams * it.qty
        );
      }
    }

    // --- Supply deductions (coal + foil, per hookah) ---
    const supplyDeductions = supplyConsumption(totalHookahs); // {key, amount}

    // --- Validate molasses stock ---
    const inventoryRows = await db.inventoryItem.findMany({
      where: { brandId: { in: [...molassesDeductions.keys()] } },
    });
    const short: { brandName: string; need: number; have: number }[] = [];
    for (const row of inventoryRows) {
      const need = molassesDeductions.get(row.brandId) ?? 0;
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

    // --- Validate supply stock ---
    const supplyRows = await db.supplyItem.findMany({
      where: { key: { in: supplyDeductions.map((d) => d.key) } },
    });
    const shortSupplies: { name: string; need: number; have: number }[] = [];
    for (const d of supplyDeductions) {
      const row = supplyRows.find((r) => r.key === d.key);
      const have = row?.stock ?? 0;
      if (d.amount > have + 0.001) {
        const def = SUPPLIES.find((s) => s.key === d.key);
        shortSupplies.push({
          name: def?.name ?? d.key,
          need: d.amount,
          have: Math.round(have),
        });
      }
    }
    if (shortSupplies.length > 0) {
      return NextResponse.json(
        {
          ok: false,
          error: `Not enough supplies: ${shortSupplies
            .map((s) => `${s.name} (need ${s.need}, have ${s.have})`)
            .join("; ")}`,
        },
        { status: 409 }
      );
    }

    // --- Create order + deduct everything in a single transaction ---
    const order = await db.$transaction(async (tx) => {
      const created = await tx.order.create({
        data: {
          customerName: data.customerName || null,
          phone: data.phone || null,
          table: data.table || null,
          notes: data.notes || null,
          itemsJson: JSON.stringify(sanitizedItems),
          subtotal: totals.subtotal,
          discount: totals.discount,
          total: totals.total,
          bogo: totals.bogo,
          ownType: data.ownType ?? null,
          itemCount: totalHookahs,
          status: "pending",
          source: data.source,
          orderedByName: data.orderedByName || null,
          employeeId: data.employeeId || null,
          favoriteMixId: data.favoriteMixId || null,
        },
      });

      // deduct molasses
      for (const [brandId, grams] of molassesDeductions) {
        await tx.inventoryItem.update({
          where: { brandId },
          data: { stockGrams: { decrement: grams } },
        });
      }

      // deduct supplies (upsert so missing rows are created then decremented)
      for (const d of supplyDeductions) {
        const existing = await tx.supplyItem.findUnique({
          where: { key: d.key },
        });
        if (existing) {
          await tx.supplyItem.update({
            where: { key: d.key },
            data: { stock: { decrement: d.amount } },
          });
        } else {
          const def = SUPPLIES.find((s) => s.key === d.key);
          if (def) {
            await tx.supplyItem.create({
              data: {
                key: def.key,
                name: def.name,
                unit: def.unit,
                emoji: def.emoji,
                stock: def.defaultStock - d.amount,
                lowStockThreshold: def.lowThreshold,
                cost: def.cost,
              },
            });
          }
        }
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

// PATCH used to update order status (pending -> preparing -> done)
const ALLOWED_STATUSES = new Set(["pending", "preparing", "done"]);
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { id, status } = body as { id?: string; status?: string };
    if (!id || !status) {
      return NextResponse.json(
        { ok: false, error: "id and status required" },
        { status: 400 }
      );
    }
    if (!ALLOWED_STATUSES.has(status)) {
      return NextResponse.json(
        { ok: false, error: `Invalid status. Allowed: ${[...ALLOWED_STATUSES].join(", ")}` },
        { status: 400 }
      );
    }
    const updated = await db.order.update({
      where: { id },
      data: { status },
    });
    return NextResponse.json({ ok: true, order: updated });
  } catch (err) {
    console.error("update order error", err);
    return NextResponse.json(
      { ok: false, error: "Could not update order" },
      { status: 500 }
    );
  }
}
