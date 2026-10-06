import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { z } from "zod";
import {
  MOLASSES_GRAMS,
  SUPPLIES,
  SELLABLE_ADDONS,
  computeOrderCogs,
  computeProfit,
  getBrand,
  getSupply,
  recomputeOrderTotals,
  serverComponentGrams,
  supplyConsumption,
} from "@/lib/catalog";
import { pushOrderToWedjat } from "@/lib/wedjat";

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
  // Add-ons the client chose (e.g. ["medical_hose"]) — server adds sellPrice to total.
  addons: z.array(z.string()).default([]),
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

    // --- Add-ons (e.g. medical hose): add sell price to revenue, cost to COGS ---
    const validAddons = data.addons.filter((k) =>
      SELLABLE_ADDONS.some((s) => s.key === k)
    );
    const addonRevenue = validAddons.reduce(
      (sum, k) => sum + (getSupply(k)?.sellPrice ?? 0),
      0
    );
    const addonCost = validAddons.reduce(
      (sum, k) => sum + (getSupply(k)?.cost ?? 0),
      0
    );

    // Recompute final totals including add-on revenue.
    const finalTotal = Math.round((totals.total + addonRevenue) * 100) / 100;
    const finalSubtotal = Math.round((totals.subtotal + addonRevenue) * 100) / 100;

    // --- Molasses deductions (per brand×flavor subtype) ---
    // Track exact grams per (brandId, flavorName) so flavor stock is precise.
    const flavorDeductions = new Map<string, number>(); // key: `${brandId}|${flavorName}`
    const molassesDeductions = new Map<string, number>(); // brand totals (kept in sync)
    for (const it of sanitizedItems) {
      for (const c of it.components) {
        const fKey = `${c.brandId}|${c.flavorName}`;
        flavorDeductions.set(
          fKey,
          (flavorDeductions.get(fKey) ?? 0) + c.grams * it.qty
        );
        molassesDeductions.set(
          c.brandId,
          (molassesDeductions.get(c.brandId) ?? 0) + c.grams * it.qty
        );
      }
    }

    // --- Supply deductions (coal + foil, per hookah) ---
    const supplyDeductions = supplyConsumption(totalHookahs); // {key, amount}

    // --- Validate molasses stock (brand + per-flavor) ---
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

    // Per-flavor validation
    const flavorKeys = [...flavorDeductions.keys()].map((k) => {
      const [brandIdRaw, flavorName] = k.split("|");
      return { brandIdRaw, flavorName, key: k };
    });
    const flavorRows = await db.flavorStock.findMany({
      where: {
        OR: flavorKeys.map((k) => ({
          brandIdRaw: k.brandIdRaw,
          flavorName: k.flavorName,
        })),
      },
    });
    const shortFlavors: { name: string; need: number; have: number }[] = [];
    for (const k of flavorKeys) {
      const need = flavorDeductions.get(k.key) ?? 0;
      const row = flavorRows.find(
        (r) => r.brandIdRaw === k.brandIdRaw && r.flavorName === k.flavorName
      );
      const have = row?.stockGrams ?? 0;
      if (need > have + 0.001) {
        const brand = getBrand(k.brandIdRaw);
        shortFlavors.push({
          name: `${brand?.name ?? k.brandIdRaw} · ${k.flavorName}`,
          need: Math.round(need),
          have: Math.round(have),
        });
      }
    }

    const allShort = [...short, ...shortFlavors];
    if (allShort.length > 0) {
      return NextResponse.json(
        {
          ok: false,
          error: `Not enough molasses: ${allShort
            .map((s) => `${s.name} (need ${s.need}g, have ${s.have}g)`)
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

    // Determine assignment: guest self-orders start unassigned; employee
    // orders are immediately theirs.
    const isGuestOrder =
      data.source === "guest_scan" || data.source === "guest_call";
    const assignment = isGuestOrder ? "unassigned" : null;
    const assignedToName = isGuestOrder ? null : data.orderedByName ?? null;
    const assignedToId = isGuestOrder ? null : data.employeeId ?? null;

    // --- Compute cost-of-goods + profit (server-side, from catalog costs) ---
    const cogs = computeOrderCogs(sanitizedItems);
    // Add add-on cost to COGS and add-on revenue to totals for profit.
    const finalCogs = Math.round((cogs.totalCogs + addonCost) * 100) / 100;
    const profit = computeProfit(finalTotal, finalCogs);

    // --- Create order + deduct everything in a single transaction ---
    const order = await db.$transaction(async (tx) => {
      const created = await tx.order.create({
        data: {
          customerName: data.customerName || null,
          phone: data.phone || null,
          table: data.table || null,
          notes: data.notes || null,
          itemsJson: JSON.stringify(sanitizedItems),
          subtotal: finalSubtotal,
          discount: totals.discount,
          total: finalTotal,
          bogo: totals.bogo,
          ownType: data.ownType ?? null,
          itemCount: totalHookahs,
          status: "pending",
          source: data.source,
          orderedByName: isGuestOrder ? null : data.orderedByName || null,
          employeeId: isGuestOrder ? null : data.employeeId || null,
          favoriteMixId: data.favoriteMixId || null,
          assignment,
          assignedToName,
          assignedToId,
          cogs: finalCogs,
          molassesCost: cogs.molassesCost,
          suppliesCost: Math.round((cogs.suppliesCost + addonCost) * 100) / 100,
          netProfit: profit.netProfit,
          marginPct: profit.marginPct,
        },
      });

      // deduct add-on supply stock (e.g. 1 medical hose per order)
      for (const k of validAddons) {
        const existing = await tx.supplyItem.findUnique({ where: { key: k } });
        if (existing) {
          await tx.supplyItem.update({
            where: { key: k },
            data: { stock: { decrement: 1 } },
          });
        }
      }

      // deduct molasses brand totals
      for (const [brandId, grams] of molassesDeductions) {
        await tx.inventoryItem.update({
          where: { brandId },
          data: { stockGrams: { decrement: grams } },
        });
      }

      // deduct per-flavor subtypes (upsert so missing rows are seeded first)
      for (const [key, grams] of flavorDeductions) {
        const [brandIdRaw, flavorName] = key.split("|");
        const brand = getBrand(brandIdRaw);
        const invRow = inventoryRows.find((r) => r.brandId === brandIdRaw);
        const existingFlavor = flavorRows.find(
          (r) => r.brandIdRaw === brandIdRaw && r.flavorName === flavorName
        );
        if (existingFlavor) {
          await tx.flavorStock.update({
            where: { id: existingFlavor.id },
            data: { stockGrams: { decrement: grams } },
          });
        } else if (invRow && brand) {
          // create the flavor subtype row then decrement
          await tx.flavorStock.create({
            data: {
              brandId: invRow.id,
              brandIdRaw: brandIdRaw,
              brandName: brand.name,
              flavorName,
              stockGrams: 150 - grams,
              lowStockThreshold: 60,
            },
          });
        }
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
                sellPrice: def.sellPrice,
              },
            });
          }
        }
      }

      return created;
    });

    // Sync to Wedjat RSM restaurant POS (non-blocking; logged on failure)
    const wedjatItems = sanitizedItems.map((it) => ({
      name: `${it.primaryBrandName} ${it.flavorLabel}`,
      price: it.unitPrice,
      qty: it.qty,
    }));
    void syncToWedjat({
      table: data.table || null,
      items: wedjatItems,
      total: finalTotal,
      customerName: data.customerName || null,
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

/**
 * After a Mazaj order is created, push it to the Wedjat RSM restaurant
 * database so it appears in their POS / kitchen queue. Non-blocking —
 * failures are logged but don't fail the Mazaj order.
 */
async function syncToWedjat(opts: {
  table: string | null;
  items: { name: string; price: number; qty: number }[];
  total: number;
  customerName: string | null;
}) {
  if (!opts.table) return;
  try {
    const result = await pushOrderToWedjat({
      tableName: opts.table,
      items: opts.items,
      total: opts.total,
      customerName: opts.customerName,
      source: "mazaj",
    });
    if (!result.ok) {
      console.warn("[wedjat sync] failed:", result.error);
    } else {
      console.log("[wedjat sync] order pushed, wedjat id:", result.wedjatOrderId);
    }
  } catch (err) {
    console.warn("[wedjat sync] error:", err);
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
