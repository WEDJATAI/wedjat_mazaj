import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { z } from "zod";
import { pushToGuest } from "@/lib/push";
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
import { pointsEarnedOn, tierForLifetime } from "@/lib/loyalty";

/**
 * ─────────────────────────────────────────────────────────────────
 *  r58 — LIVING ORDERS · POST /api/orders/[id]/amend
 * ─────────────────────────────────────────────────────────────────
 *  An order stays a LIVING document until it is served: guests and
 *  staff can modify items (add / remove / change qty, full mix
 *  configs, BYO, add-ons) even after the order was confirmed.
 *
 *  Everything is recomputed server-side and inventory is reconciled
 *  to the NET delta:
 *    • added bowls   → stock deducted (validated first)
 *    • removed bowls → grams returned to the branch jars
 *    • loyalty earn  → adjusted with an audit ledger entry
 *    • the diff      → written into the order's comment thread
 *    • the guest     → receives a push that their order changed
 *
 *  Locked once status === "done" (served).
 * ─────────────────────────────────────────────────────────────────
 */

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

const AmendSchema = z.object({
  items: z.array(CartItemSchema).min(1, "Order must keep at least one bowl"),
  ownType: z.enum(["hookah", "molasses"]).optional().nullable(),
  addons: z.array(z.string()).default([]),
  notes: z.string().trim().max(400).optional().nullable(),
  table: z.string().trim().max(40).optional().nullable(),
  actorName: z.string().trim().max(80).optional().nullable(),
  actorId: z.string().optional().nullable(),
});

type ParsedItem = z.infer<typeof CartItemSchema>;

/* ── human-readable diff between two item sets ───────────────────── */

function itemLabel(it: {
  primaryBrandName: string;
  flavorLabel: string;
  components: { flavorName: string }[];
}): string {
  const mix =
    it.components.length > 1
      ? ` (${it.components.map((c) => c.flavorName).join("+")})`
      : it.components.length === 1
        ? ` · ${it.components[0].flavorName}`
        : "";
  return `${it.primaryBrandName} ${it.flavorLabel}${mix}`;
}

function buildDiff(
  oldItems: ParsedItem[],
  newItems: ParsedItem[],
  oldTotal: number,
  newTotal: number
): string {
  const qtyByKey = (items: ParsedItem[]) => {
    const m = new Map<string, { label: string; qty: number }>();
    for (const it of items) {
      const label = itemLabel(it);
      m.set(label, { label, qty: (m.get(label)?.qty ?? 0) + it.qty });
    }
    return m;
  };
  const before = qtyByKey(oldItems);
  const after = qtyByKey(newItems);
  const lines: string[] = [];

  for (const [label, { qty }] of after) {
    const oldQty = before.get(label)?.qty ?? 0;
    if (oldQty === 0) lines.push(`+ ${qty}× ${label}`);
    else if (qty !== oldQty) lines.push(`± ${label}: ${oldQty} → ${qty}`);
  }
  for (const [label, { qty }] of before) {
    if (!after.has(label)) lines.push(`− ${qty}× ${label}`);
  }
  if (lines.length === 0) lines.push("No item changes");
  if (Math.abs(oldTotal - newTotal) > 0.001) {
    lines.push(`Total: ${Math.round(oldTotal)} → ${Math.round(newTotal)} EGP`);
  }
  return lines.join("\n");
}

/* ── consumption maps ─────────────────────────────────────────────── */

function gramsMaps(items: ParsedItem[]) {
  const flavor = new Map<string, number>(); // `${brandId}|${flavorName}`
  const brand = new Map<string, number>();
  for (const it of items) {
    for (const c of it.components) {
      const fk = `${c.brandId}|${c.flavorName}`;
      flavor.set(fk, (flavor.get(fk) ?? 0) + c.grams * it.qty);
      brand.set(c.brandId, (brand.get(c.brandId) ?? 0) + c.grams * it.qty);
    }
  }
  return { flavor, brand };
}

function addonCounts(addons: string[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const k of addons) m.set(k, (m.get(k) ?? 0) + 1);
  return m;
}

/* ── the route ────────────────────────────────────────────────────── */

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const parsed = AmendSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          ok: false,
          error: parsed.error.issues[0]?.message ?? "Invalid amendment data",
        },
        { status: 400 }
      );
    }
    const data = parsed.data;

    const order = await db.order.findUnique({ where: { id } });
    if (!order) {
      return NextResponse.json(
        { ok: false, error: "Order not found" },
        { status: 404 }
      );
    }
    if (order.status === "done") {
      return NextResponse.json(
        {
          ok: false,
          error:
            "This order is already served — it can no longer be modified.",
        },
        { status: 409 }
      );
    }

    // ── validate + sanitize the new items (never trust the client) ──
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
    const sanitized: ParsedItem[] = data.items.map((it) => {
      const grams = serverComponentGrams(it.components.length);
      return {
        ...it,
        components: it.components.map((c, i) => ({ ...c, grams: grams[i] })),
      };
    });

    // ── old state ────────────────────────────────────────────────────
    let oldItems: ParsedItem[] = [];
    try {
      const arr = JSON.parse(order.itemsJson);
      if (Array.isArray(arr)) oldItems = arr;
    } catch {
      oldItems = [];
    }
    let oldAddons: string[] = [];
    try {
      const arr = JSON.parse(order.addonsJson ?? "[]");
      if (Array.isArray(arr)) oldAddons = arr;
    } catch {
      oldAddons = [];
    }

    // ── new totals (server-authoritative) ───────────────────────────
    const newOwnType = data.ownType ?? null;
    const totals = recomputeOrderTotals(sanitized, newOwnType);
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
    // loyalty redemption stays as originally applied; earn re-adjusts below
    const grandTotal =
      Math.round((totals.total + addonRevenue - order.loyaltyDiscount) * 100) /
      100;
    const finalSubtotal =
      Math.round((totals.subtotal + addonRevenue) * 100) / 100;

    // ── net consumption deltas (new − old) ──────────────────────────
    const oldMaps = gramsMaps(oldItems);
    const newMaps = gramsMaps(sanitized);
    const flavorDelta = new Map<string, number>();
    for (const k of new Set([...oldMaps.flavor.keys(), ...newMaps.flavor.keys()])) {
      flavorDelta.set(
        k,
        (newMaps.flavor.get(k) ?? 0) - (oldMaps.flavor.get(k) ?? 0)
      );
    }
    const brandDelta = new Map<string, number>();
    for (const k of new Set([...oldMaps.brand.keys(), ...newMaps.brand.keys()])) {
      brandDelta.set(
        k,
        (newMaps.brand.get(k) ?? 0) - (oldMaps.brand.get(k) ?? 0)
      );
    }

    // supplies: per-hookah consumption from the NEW vs OLD hookah counts
    const oldSupplies = supplyConsumption(order.itemCount);
    const newSupplies = supplyConsumption(totals.totalQty);
    const supplyDelta = new Map<string, number>();
    for (const s of newSupplies) {
      const old = oldSupplies.find((o) => o.key === s.key)?.amount ?? 0;
      supplyDelta.set(s.key, s.amount - old);
    }

    // add-on stock deltas (count per key)
    const oldAddonCounts = addonCounts(oldAddons);
    const newAddonCounts = addonCounts(validAddons);
    const addonDelta = new Map<string, number>();
    for (const k of new Set([...oldAddonCounts.keys(), ...newAddonCounts.keys()])) {
      addonDelta.set(
        k,
        (newAddonCounts.get(k) ?? 0) - (oldAddonCounts.get(k) ?? 0)
      );
    }

    // ── validate NET INCREASES against stock ─────────────────────────
    const branchId = order.branchId;
    const brandRows = await db.inventoryItem.findMany({
      where: {
        brandId: {
          in: [...brandDelta.keys()].filter((b) => (brandDelta.get(b) ?? 0) > 0),
        },
        branchId,
      },
    });
    const shortBrands: string[] = [];
    for (const row of brandRows) {
      const need = brandDelta.get(row.brandId) ?? 0;
      if (need > row.stockGrams + 0.001) {
        shortBrands.push(
          `${row.brandName} (need ${Math.round(need)}g more, have ${Math.round(row.stockGrams)}g)`
        );
      }
    }

    const flavorKeys = [...flavorDelta.keys()].filter(
      (k) => (flavorDelta.get(k) ?? 0) > 0
    );
    const flavorRows = await db.flavorStock.findMany({
      where: {
        OR: flavorKeys.map((k) => {
          const [brandIdRaw, flavorName] = k.split("|");
          return { brandIdRaw, flavorName };
        }),
        brand: { branchId },
      },
    });
    const shortFlavors: string[] = [];
    for (const k of flavorKeys) {
      const [brandIdRaw, flavorName] = k.split("|");
      const need = flavorDelta.get(k) ?? 0;
      const row = flavorRows.find(
        (r) => r.brandIdRaw === brandIdRaw && r.flavorName === flavorName
      );
      const have = row?.stockGrams ?? 0;
      if (need > have + 0.001) {
        shortFlavors.push(
          `${getBrand(brandIdRaw)?.name ?? brandIdRaw} · ${flavorName} (need ${Math.round(need)}g more, have ${Math.round(have)}g)`
        );
      }
    }

    const supplyRows = await db.supplyItem.findMany({
      where: {
        key: {
          in: [...supplyDelta.keys(), ...addonDelta.keys()].filter(
            (k) => (supplyDelta.get(k) ?? 0) + (addonDelta.get(k) ?? 0) > 0
          ),
        },
        branchId,
      },
    });
    const shortSupplies: string[] = [];
    for (const k of new Set([...supplyDelta.keys(), ...addonDelta.keys()])) {
      const net = (supplyDelta.get(k) ?? 0) + (addonDelta.get(k) ?? 0);
      if (net <= 0) continue;
      const row = supplyRows.find((r) => r.key === k);
      const have = row?.stock ?? 0;
      if (net > have + 0.001) {
        const def = SUPPLIES.find((s) => s.key === k);
        shortSupplies.push(
          `${def?.name ?? k} (need ${net}, have ${Math.round(have)})`
        );
      }
    }

    const allShort = [...shortBrands, ...shortFlavors, ...shortSupplies];
    if (allShort.length > 0) {
      return NextResponse.json(
        {
          ok: false,
          error: `Not enough stock to add: ${allShort.join("; ")}`,
        },
        { status: 409 }
      );
    }

    // ── profitability (server-side) ──────────────────────────────────
    const cogs = computeOrderCogs(sanitized);
    const finalCogs = Math.round((cogs.totalCogs + addonCost) * 100) / 100;
    const profit = computeProfit(grandTotal, finalCogs);

    const diff = buildDiff(oldItems, sanitized, order.total, grandTotal);
    const actorName = data.actorName?.trim() || "Mazaj";
    const revision = order.revision + 1;

    // ── commit: reconcile stock + adjust loyalty + update order ─────
    const updated = await db.$transaction(async (tx) => {
      // molasses: brand totals (increment returns, decrement consumption)
      for (const [brandId, delta] of brandDelta) {
        if (Math.abs(delta) < 0.001) continue;
        const row = await tx.inventoryItem.findFirst({
          where: { brandId, branchId },
        });
        if (!row) continue;
        await tx.inventoryItem.update({
          where: { id: row.id },
          data: {
            stockGrams:
              delta > 0 ? { decrement: delta } : { increment: -delta },
          },
        });
      }

      // molasses: per-flavor subtypes
      for (const [key, delta] of flavorDelta) {
        if (Math.abs(delta) < 0.001) continue;
        const [brandIdRaw, flavorName] = key.split("|");
        const row = await tx.flavorStock.findFirst({
          where: { brandIdRaw, flavorName, brand: { branchId } },
        });
        if (row) {
          await tx.flavorStock.update({
            where: { id: row.id },
            data: {
              stockGrams:
                delta > 0 ? { decrement: delta } : { increment: -delta },
            },
          });
        }
      }

      // supplies + add-on units
      for (const key of new Set([...supplyDelta.keys(), ...addonDelta.keys()])) {
        const delta = (supplyDelta.get(key) ?? 0) + (addonDelta.get(key) ?? 0);
        if (Math.abs(delta) < 0.001) continue;
        const row = await tx.supplyItem.findFirst({
          where: { key, branchId },
        });
        if (!row) continue;
        await tx.supplyItem.update({
          where: { id: row.id },
          data: {
            stock: delta > 0 ? { decrement: delta } : { increment: -delta },
          },
        });
      }

      // loyalty earn adjustment (audit-logged, clamped to the balance)
      let pointsEarnedFinal = order.pointsEarned;
      if (order.loyaltyMemberId) {
        const member = await tx.loyaltyMember.findUnique({
          where: { id: order.loyaltyMemberId },
        });
        if (member) {
          const newEarn = pointsEarnedOn(grandTotal, member.tier);
          let delta = newEarn - order.pointsEarned;
          if (delta < 0 && member.points < -delta) {
            delta = -member.points; // can't take back what they already spent
          }
          if (delta !== 0) {
            const points = member.points + delta;
            const lifetime = Math.max(0, member.lifetimePoints + delta);
            await tx.loyaltyMember.update({
              where: { id: member.id },
              data: {
                points,
                lifetimePoints: lifetime,
                tier: tierForLifetime(lifetime).key,
              },
            });
            await tx.pointsLedger.create({
              data: {
                memberId: member.id,
                orderId: order.id,
                delta,
                reason: "adjustment",
              },
            });
            pointsEarnedFinal = order.pointsEarned + delta;
          }
        }
      }

      const saved = await tx.order.update({
        where: { id: order.id },
        data: {
          itemsJson: JSON.stringify(sanitized),
          addonsJson: JSON.stringify(validAddons),
          subtotal: finalSubtotal,
          discount: totals.discount + order.loyaltyDiscount,
          total: grandTotal,
          bogo: totals.bogo,
          ownType: newOwnType,
          itemCount: totals.totalQty,
          cogs: finalCogs,
          molassesCost: cogs.molassesCost,
          suppliesCost: Math.round((cogs.suppliesCost + addonCost) * 100) / 100,
          netProfit: profit.netProfit,
          marginPct: profit.marginPct,
          pointsEarned: pointsEarnedFinal,
          notes: data.notes !== undefined ? data.notes || null : order.notes,
          table: data.table !== undefined ? data.table || null : order.table,
          revision,
          amendedAt: new Date(),
          amendedByName: actorName,
        },
      });

      // the amendment diff lands in the staff comment thread
      await tx.orderComment.create({
        data: {
          orderId: order.id,
          author: `${actorName} · amendment #${revision}`,
          body: diff,
        },
      });

      return saved;
    });

    // Cloud → phone: tell the guest their order changed (best-effort).
    const guestName = updated.customerName?.trim();
    if (guestName) {
      void pushToGuest(guestName, {
        title: "Your order was updated",
        body: `Revision ${revision}: ${updated.itemCount} bowl${updated.itemCount > 1 ? "s" : ""} · ${Math.round(updated.total)} EGP`,
        url: `/?track=${updated.id}`,
        tag: `order-${updated.id}`,
      }).catch(() => {});
    }

    return NextResponse.json({ ok: true, order: updated, revision });
  } catch (err) {
    console.error("amend order error", err);
    return NextResponse.json(
      { ok: false, error: "Could not update the order" },
      { status: 500 }
    );
  }
}
