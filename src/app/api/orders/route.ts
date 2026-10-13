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
import { pushOrderToWedjat, pushAvailabilityToWedjat } from "@/lib/wedjat";
import { resolveBranchScope } from "@/lib/branch-scope";
import { applyCatalogOverrides } from "@/lib/platform-settings";
import { requireStaff, sessionEmployee } from "@/lib/auth";
import {
  clientIp,
  GUEST_LIMITS,
  guestRateLimitResponse,
  hitGuestRateLimit,
} from "@/lib/rate-limit";
import {
  pointsEarnedOn,
  redeemDiscount,
  maxRedeemable,
  tierForLifetime,
  SIGNUP_BONUS,
} from "@/lib/loyalty";
import { StockShortError, shortLine } from "@/lib/stock-guard";

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
  // r67 — components may be EMPTY when the guest brings their own
  // molasses (the venue only supplies the pipe + service).
  components: z.array(ComponentSchema),
  molassesGrams: z.number().default(MOLASSES_GRAMS),
  unitPrice: z.number().nonnegative(),
  qty: z.number().int().positive().max(99),
  /** r67 — the pipe this shisha is smoked on (amy = premium flat price) */
  hookahType: z.enum(["regular", "amy"]).optional().nullable(),
  /** r67 — per-shisha BYO answer (the 2-for-1 applies per person) */
  ownType: z.enum(["hookah", "molasses"]).optional().nullable(),
  /** r67 — who this shisha is for (label at a shared table) */
  forName: z.string().trim().max(60).optional().nullable(),
});

const CreateOrderSchema = z.object({
  customerName: z.string().trim().max(80).nullish().or(z.literal("")),
  phone: z.string().trim().max(20).nullish().or(z.literal("")),
  table: z.string().trim().max(40).nullish().or(z.literal("")),
  // R46: the NUMERIC Wedjat RSM table id — the unambiguous reference for
  // the check (names repeat across the restaurant's floors). Comes from
  // the POS "Order Shisha" button URL (?tableId=) or the table picker.
  tableId: z.number().int().positive().max(1_000_000_000).optional().nullable(),
  notes: z.string().trim().max(400).nullish().or(z.literal("")),
  items: z.array(CartItemSchema).min(1, "Add at least one hookah"),
  subtotal: z.number().nonnegative(),
  discount: z.number().nonnegative(),
  total: z.number().nonnegative(),
  bogo: z.boolean(),
  ownType: z.enum(["hookah", "molasses"]).optional().nullable(),
  source: z.enum(["employee", "guest_scan", "guest_call"]).default("employee"),
  favoriteMixId: z.string().optional().nullable(),
  // Add-ons the client chose (e.g. ["medical_hose"]) — server adds sellPrice to total.
  addons: z.array(z.string()).default([]),
  // R49 loyalty: member phone to earn/redeem points for. Redemption is
  // validated + applied SERVER-SIDE (client totals are never trusted).
  loyaltyPhone: z.string().trim().max(20).nullish().or(z.literal("")),
  redeemPoints: z.number().int().nonnegative().max(100000).optional().nullable(),
  // r57: the branch receiving this order (stock deducts from ITS jars)
  branchId: z.string().trim().optional().nullable(),
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

    // r70 — WHO is creating this order? Guest flows (guest_scan /
    // guest_call) stay cookie-free; a staff order (source "employee") MUST
    // carry a staff session, and the creator is derived from it — the
    // client-sent employeeId/orderedByName are never trusted.
    const caller = await sessionEmployee(req);
    const isGuestOrder =
      data.source === "guest_scan" || data.source === "guest_call";
    if (!isGuestOrder && !caller) {
      return NextResponse.json(
        { ok: false, error: "Staff sign-in required to place an order" },
        { status: 401 }
      );
    }
    // r71 — cookie-free guest orders are rate-limited per IP (a staff
    // session bypasses: the kitchen can fire as many orders as service
    // needs)
    if (isGuestOrder) {
      const limit = await hitGuestRateLimit(
        `order:${clientIp(req.headers)}`,
        GUEST_LIMITS.order.max,
        GUEST_LIMITS.order.windowMs
      );
      if (!limit.ok) return guestRateLimitResponse(limit);
    }
    const creatorEmployee = !isGuestOrder && caller ? caller : null;

    // r57: which branch receives (and stock-deducts) this order
    const { branchId: effectiveBranchId } = await resolveBranchScope(
      data.branchId ?? null
    );

    // --- Validate every component brandId exists in the catalog ---
    for (const it of data.items) {
      // r67 — an own-molasses shisha has NO components; anything else
      // (menu order / own hookah) must carry at least one flavor.
      if (it.components.length === 0 && it.ownType !== "molasses") {
        return NextResponse.json(
          { ok: false, error: "A shisha needs flavors unless you bring your own molasses" },
          { status: 400 }
        );
      }
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
    // r61: apply the platform owner's live menu-price overrides first —
    // the catalog module is the single pricing authority, so overrides
    // applied here flow through every price computation below.
    await applyCatalogOverrides();
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

    // --- R49 loyalty resolution (server-authoritative) ---
    // Lookup the member by phone (read-only here). Auto-enrollment happens
    // INSIDE the transaction below so a failed order never creates an
    // orphan member. Redemption is validated against the real balance.
    let loyaltyMember: {
      id: string;
      name: string;
      phone: string;
      points: number;
      lifetimePoints: number;
      tier: string;
    } | null = null;
    let loyaltyWasNew = false;
    if (data.loyaltyPhone && data.loyaltyPhone.trim().length >= 5) {
      const phone = data.loyaltyPhone.trim();
      const found = await db.loyaltyMember.findUnique({ where: { phone } });
      if (found) {
        loyaltyMember = found;
      } else {
        // will be created in the transaction; earns the signup bonus
        loyaltyWasNew = true;
      }
    }

    let pointsRedeemed = 0;
    let loyaltyDiscount = 0;
    if (loyaltyMember && data.redeemPoints && data.redeemPoints > 0) {
      const requested = data.redeemPoints;
      const allowed = maxRedeemable(loyaltyMember.points, finalTotal);
      if (requested > allowed) {
        return NextResponse.json(
          {
            ok: false,
            error: `Can redeem at most ${allowed} points on this order (balance ${loyaltyMember.points} pts, order ${finalTotal} EGP)`,
          },
          { status: 409 }
        );
      }
      pointsRedeemed = requested;
      loyaltyDiscount = redeemDiscount(requested);
    }

    // Apply the loyalty discount AFTER all price recompute — the final,
    // authoritative total.
    const grandTotal = Math.round((finalTotal - loyaltyDiscount) * 100) / 100;
    const earnTier = loyaltyMember?.tier ?? "bronze";
    const pointsEarned =
      loyaltyMember || loyaltyWasNew
        ? pointsEarnedOn(grandTotal, earnTier)
        : 0;

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

    // r69 (audit ⑤) — stock validation moved INSIDE the write transaction
    // below (with atomic conditional decrements). The pre-transaction reads
    // here used to be the only guard: two concurrent orders could both
    // pass against the same jar and both deduct it (oversell race).

    // Determine assignment: guest self-orders start unassigned; employee
    // orders are immediately theirs (r70: creator identity comes from the
    // session, never from the request body).
    const assignment = isGuestOrder ? "unassigned" : null;
    const assignedToName = creatorEmployee?.name ?? null;
    const assignedToId = creatorEmployee?.id ?? null;

    // --- Compute cost-of-goods + profit (server-side, from catalog costs) ---
    const cogs = computeOrderCogs(sanitizedItems);
    // Add add-on cost to COGS and add-on revenue to totals for profit.
    const finalCogs = Math.round((cogs.totalCogs + addonCost) * 100) / 100;
    const profit = computeProfit(grandTotal, finalCogs);

    // --- Create order + deduct everything in a single transaction ---
    // R49 loyalty summary — populated inside the transaction and returned
    // to the confirmation UI.
    let loyaltySummary: {
      memberName: string;
      tier: string;
      pointsEarned: number;
      pointsRedeemed: number;
      discount: number;
      balanceAfter: number;
      isNew: boolean;
    } | null = null;
    // r69 — StockShortError aborts the whole transaction (rolled back:
    // no partial order, no negative stock) and surfaces as the same 409
    // the pre-r69 pre-transaction validation used to return.
    let order: Awaited<ReturnType<typeof db.order.create>>;
    try {
      order = await db.$transaction(async (tx) => {
      // ── r69 (audit ⑤): validate stock INSIDE the transaction ─────────
      // Same rules + messages as before — but on rows read after the
      // transaction opened, and backed by conditional decrements below.
      const inventoryRows = await tx.inventoryItem.findMany({
        where: {
          brandId: { in: [...molassesDeductions.keys()] },
          branchId: effectiveBranchId,
        },
      });
      const short: { name: string; need: number; have: number }[] = [];
      for (const row of inventoryRows) {
        const need = molassesDeductions.get(row.brandId) ?? 0;
        if (need > row.stockGrams + 0.001) {
          short.push({
            name: row.brandName,
            need: Math.round(need),
            have: Math.round(row.stockGrams),
          });
        }
      }

      const flavorKeys = [...flavorDeductions.keys()].map((k) => {
        const [brandIdRaw, flavorName] = k.split("|");
        return { brandIdRaw, flavorName, key: k };
      });
      // r67 — own-molasses shishas deduct nothing: skip the jar lookups
      const flavorRows =
        flavorKeys.length > 0
          ? await tx.flavorStock.findMany({
              where: {
                OR: flavorKeys.map((k) => ({
                  brandIdRaw: k.brandIdRaw,
                  flavorName: k.flavorName,
                })),
                // r57: only this branch's flavor jars count
                brand: { branchId: effectiveBranchId },
              },
            })
          : [];
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
        throw new StockShortError(
          `Not enough molasses: ${allShort
            .map((s) => `${s.name} (need ${s.need}g, have ${s.have}g)`)
            .join("; ")}`
        );
      }

      const supplyRows = await tx.supplyItem.findMany({
        where: {
          key: { in: supplyDeductions.map((d) => d.key) },
          branchId: effectiveBranchId,
        },
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
        throw new StockShortError(
          `Not enough supplies: ${shortSupplies
            .map((s) => `${s.name} (need ${s.need}, have ${s.have})`)
            .join("; ")}`
        );
      }

      const created = await tx.order.create({
        data: {
          customerName: data.customerName || null,
          phone: data.phone || null,
          table: data.table || null,
          wedjatTableId: data.tableId ?? null,
          notes: data.notes || null,
          itemsJson: JSON.stringify(sanitizedItems),
          addonsJson: JSON.stringify(validAddons),
          subtotal: finalSubtotal,
          discount: totals.discount + loyaltyDiscount,
          total: grandTotal,
          bogo: totals.bogo,
          ownType: data.ownType ?? null,
          itemCount: totalHookahs,
          status: "pending",
          source: data.source,
          orderedByName: creatorEmployee?.name ?? null,
          employeeId: creatorEmployee?.id ?? null,
          favoriteMixId: data.favoriteMixId || null,
          assignment,
          assignedToName,
          assignedToId,
          branchId: effectiveBranchId,
          cogs: finalCogs,
          molassesCost: cogs.molassesCost,
          suppliesCost: Math.round((cogs.suppliesCost + addonCost) * 100) / 100,
          netProfit: profit.netProfit,
          marginPct: profit.marginPct,
          loyaltyMemberId: loyaltyMember?.id ?? null,
          pointsEarned,
          pointsRedeemed,
          loyaltyDiscount,
        },
      });

      // R49 loyalty ledger + member upsert: signup bonus for fresh members,
      // redemption debit, and the earn credit — all in the same transaction.
      let memberBalanceAfter = 0;
      let memberLifetimeAfter = 0;
      let memberTierAfter = "bronze";
      let memberNameForSummary: string | null = null;
      if (loyaltyMember || loyaltyWasNew) {
        let memberId: string;
        let basePoints: number;
        let baseLifetime: number;
        if (loyaltyMember) {
          memberId = loyaltyMember.id;
          basePoints = loyaltyMember.points;
          baseLifetime = loyaltyMember.lifetimePoints;
          memberNameForSummary = loyaltyMember.name;
        } else {
          // auto-enroll now (inside the transaction)
          const createdMember = await tx.loyaltyMember.create({
            data: {
              phone: data.loyaltyPhone!.trim(),
              name: data.customerName?.trim() || "Guest",
              points: SIGNUP_BONUS,
              lifetimePoints: SIGNUP_BONUS,
              tier: tierForLifetime(SIGNUP_BONUS).key,
            },
          });
          memberId = createdMember.id;
          basePoints = SIGNUP_BONUS;
          baseLifetime = SIGNUP_BONUS;
          memberNameForSummary = createdMember.name;
          await tx.pointsLedger.create({
            data: {
              memberId,
              delta: SIGNUP_BONUS,
              reason: "signup_bonus",
            },
          });
          await tx.order.update({
            where: { id: created.id },
            data: { loyaltyMemberId: memberId },
          });
        }
        if (pointsRedeemed > 0) {
          await tx.pointsLedger.create({
            data: {
              memberId,
              orderId: created.id,
              delta: -pointsRedeemed,
              reason: "redeem",
            },
          });
        }
        if (pointsEarned > 0) {
          await tx.pointsLedger.create({
            data: {
              memberId,
              orderId: created.id,
              delta: pointsEarned,
              reason: "order_earn",
            },
          });
        }
        memberBalanceAfter = basePoints - pointsRedeemed + pointsEarned;
        memberLifetimeAfter = baseLifetime + pointsEarned;
        memberTierAfter = tierForLifetime(memberLifetimeAfter).key;
        await tx.loyaltyMember.update({
          where: { id: memberId },
          data: {
            points: memberBalanceAfter,
            lifetimePoints: memberLifetimeAfter,
            tier: memberTierAfter,
          },
        });
        loyaltySummary = {
          memberName: memberNameForSummary ?? "Member",
          tier: memberTierAfter,
          pointsEarned,
          pointsRedeemed,
          discount: loyaltyDiscount,
          balanceAfter: memberBalanceAfter,
          isNew: loyaltyWasNew,
        };
      }

      // deduct add-on supply stock (e.g. 1 medical hose per order).
      // r69 — conditional decrement: silently skip when the add-on row is
      // missing (pre-r69 semantics) and never drive stock negative.
      for (const k of validAddons) {
        await tx.supplyItem.updateMany({
          where: { key: k, branchId: effectiveBranchId, stock: { gte: 1 } },
          data: { stock: { decrement: 1 } },
        });
      }

      // deduct molasses brand totals — r69 atomic conditional decrement:
      // if a concurrent order drained the jar between our read and this
      // write, updateMany matches zero rows and the whole order aborts.
      for (const [brandId, grams] of molassesDeductions) {
        const row = inventoryRows.find((r) => r.brandId === brandId);
        if (!row) continue; // untracked brand — no jar to deduct
        const res = await tx.inventoryItem.updateMany({
          where: { id: row.id, stockGrams: { gte: grams } },
          data: { stockGrams: { decrement: grams } },
        });
        if (res.count === 0) {
          throw new StockShortError(
            `Not enough molasses: ${shortLine(row.brandName, grams, 0)}`
          );
        }
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
          // r69 — atomic conditional decrement (race-loss abort)
          const res = await tx.flavorStock.updateMany({
            where: { id: existingFlavor.id, stockGrams: { gte: grams } },
            data: { stockGrams: { decrement: grams } },
          });
          if (res.count === 0) {
            throw new StockShortError(
              `Not enough molasses: ${shortLine(
                `${brand?.name ?? brandIdRaw} · ${flavorName}`,
                grams,
                0
              )}`
            );
          }
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
        const row = supplyRows.find((r) => r.key === d.key);
        if (row) {
          // r69 — atomic conditional decrement (race-loss abort)
          const res = await tx.supplyItem.updateMany({
            where: { id: row.id, stock: { gte: d.amount } },
            data: { stock: { decrement: d.amount } },
          });
          if (res.count === 0) {
            const def = SUPPLIES.find((s) => s.key === d.key);
            throw new StockShortError(
              `Not enough supplies: ${def?.name ?? d.key} (need ${d.amount}, have 0)`
            );
          }
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
                branchId: effectiveBranchId,
              },
            });
          }
        }
      }

      return created;
      });
    } catch (err) {
      if (err instanceof StockShortError) {
        return NextResponse.json(
          { ok: false, error: err.message },
          { status: 409 }
        );
      }
      throw err;
    }

    // Sync to Wedjat RSM restaurant POS (non-blocking; best-effort):
    // the items land on the table's CHECK via the delivery webhook, and
    // the fresh stock state mirrors onto the POS shisha menu.
    void syncToWedjat({
      order: {
        id: order.id,
        customerName: order.customerName,
        phone: order.phone,
        table: order.table,
        wedjatTableId: order.wedjatTableId,
        notes: order.notes,
        itemsJson: order.itemsJson,
        bogo: order.bogo,
        addonsJson: validAddons,
      },
    });
    void pushAvailabilityToWedjat().catch(() => {});

    // R49 loyalty summary for the confirmation UI (recomputed from the
    // transaction's outcome captured in the closure above).
    const loyalty = (loyaltyMember || loyaltyWasNew) && loyaltySummary
      ? loyaltySummary
      : null;

    return NextResponse.json({ ok: true, order, loyalty });
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
 * POS via the delivery webhook so it appears on the table's check /
 * kitchen queue. Non-blocking — failures are logged but don't fail the
 * Mazaj order. Idempotent per mazaj order id (external_ref "mazaj:<id>"
 * + the RSM seen-ledger), so the Inngest retry job can safely re-push.
 * Records the Wedjat order ID + sync status back on the Mazaj order.
 */
async function syncToWedjat(opts: {
  order: {
    id: string;
    customerName: string | null;
    phone: string | null;
    table: string | null;
    wedjatTableId: number | null;
    notes: string | null;
    itemsJson: string;
    bogo: boolean;
    addonsJson?: string[];
  };
}) {
  try {
    const result = await pushOrderToWedjat(opts.order);
    if (!result.ok) {
      console.warn("[rsm sync] failed:", result.error);
      // Record failure so it can be retried
      await db.order.update({
        where: { id: opts.order.id },
        data: { wedjatSyncStatus: "failed" },
      }).catch(() => {});
    } else {
      console.log(
        "[rsm sync] order pushed, wedjat id:",
        result.wedjatOrderId,
        result.duplicate ? "(duplicate — already on the check)" : "",
      );
      await db.order.update({
        where: { id: opts.order.id },
        data: {
          wedjatOrderId: result.wedjatOrderId ?? null,
          wedjatSyncStatus: "synced",
        },
      }).catch(() => {});
    }
  } catch (err) {
    console.warn("[rsm sync] error:", err);
  }
}

export async function GET(req: NextRequest) {
  try {
    // r71 — the guest tracking surfaces (?guest= name lookup + ?id= focused
    // lookup) now return a SAFE PROJECTION only: no phone, no staff ids, no
    // loyalty member id, no cogs/profit internals, no Wedjat sync fields.
    // (They used to ship the full order row — a guessed name leaked every
    // matching guest's phone number across ALL branches.)
    const GUEST_SELECT = {
      id: true,
      customerName: true,
      table: true,
      status: true,
      itemCount: true,
      itemsJson: true,
      total: true,
      createdAt: true,
      rating: true,
      pointsEarned: true,
      ownType: true,
      addonsJson: true,
      revision: true,
    } as const;

    // Guest privacy filter: ?guest=<name> returns only that guest's orders
    // (server-side, case-insensitive) so the tracking sheet never receives
    // other guests' data — same-name collisions included. Filtering happens
    // in the handler (not via `mode:"insensitive"`) so it works identically
    // on PostgreSQL (production) and SQLite (local dev).
    //
    // r71: optional &branchId= scopes the match to ONE branch — the guest's
    // QR context — so a common first name no longer pulls same-name guests
    // from other branches. (Absent = legacy unscoped behavior.)
    const guest = req.nextUrl.searchParams.get("guest")?.trim();
    if (guest) {
      const branchId = req.nextUrl.searchParams.get("branchId")?.trim();
      const recent = await db.order.findMany({
        where: branchId ? { branchId } : undefined,
        orderBy: { createdAt: "desc" },
        take: 200,
        select: {
          ...GUEST_SELECT,
          orderedByName: true, // needed for the name match, stripped below
        },
      });
      const needle = guest.toLowerCase();
      const orders = recent
        .filter(
          (o) =>
            o.customerName?.toLowerCase() === needle ||
            o.orderedByName?.toLowerCase() === needle
        )
        .slice(0, 50)
        .map(({ orderedByName: _drop, ...safe }) => safe);
      return NextResponse.json({ ok: true, orders });
    }
    // r70 — focused lookup by order id (?id=): the guest already holds the
    // cuid from placing the order (same trust model as the rate endpoint),
    // so no session is needed to re-find a just-placed order after a name
    // change. Everything else (the full staff queue) requires a session.
    const focusId = req.nextUrl.searchParams.get("id")?.trim();
    if (focusId) {
      const focused = await db.order.findUnique({
        where: { id: focusId },
        select: GUEST_SELECT,
      });
      return NextResponse.json({
        ok: true,
        orders: focused ? [focused] : [],
      });
    }
    // full queue → staff session required (r70)
    {
      const guard = await requireStaff(req);
      if ("resp" in guard) return guard.resp;
    }
    // r57: ?branchId= scopes the staff queue (absent/"all" = every branch)
    const branchParam = req.nextUrl.searchParams.get("branchId");
    const scoped = branchParam && branchParam !== "all" ? branchParam : null;
    const orders = await db.order.findMany({
      where: scoped ? { branchId: scoped } : undefined,
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    // attach branch names for the queue cards (admin all-branches view)
    const branchIds = [...new Set(orders.map((o) => o.branchId).filter(Boolean))] as string[];
    const branches = branchIds.length
      ? await db.branch.findMany({
          where: { id: { in: branchIds } },
          select: { id: true, name: true, nameAr: true },
        })
      : [];
    const branchName = new Map(branches.map((b) => [b.id, b.name]));
    const branchNameAr = new Map(branches.map((b) => [b.id, b.nameAr]));
    return NextResponse.json({
      ok: true,
      orders: orders.map((o) => ({
        ...o,
        branchName: o.branchId ? branchName.get(o.branchId) ?? null : null,
        branchNameAr: o.branchId ? branchNameAr.get(o.branchId) ?? null : null,
      })),
    });
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
    {
      const guard = await requireStaff(req);
      if ("resp" in guard) return guard.resp;
    }
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
    const existing = await db.order.findUnique({ where: { id } });
    const updated = await db.order.update({
      where: { id },
      data: { status },
    });

    // Cloud → phone: push the status change to the guest's installed app.
    // Fire-and-forget style: the update is already committed; a push
    // failure must not fail the request. Only push on forward transitions
    // (never when a status is set back / unchanged).
    if (existing && existing.status !== status) {
      const name = updated.customerName?.trim();
      if (name) {
        const pushPayload =
          status === "preparing"
            ? {
                title: "Your hookah is being prepared 🔥",
                body: `${name}, we're on it — hang tight, it's almost time.`,
                url: `/?track=${updated.id}`,
                tag: `order-${updated.id}`,
              }
            : status === "done"
              ? {
                  title: "Your hookah is served! 🎉",
                  body: `Enjoy, ${name}! Tap to rate your session ✨`,
                  url: `/?track=${updated.id}`,
                  tag: `order-${updated.id}`,
                }
              : null;
        if (pushPayload) {
          void pushToGuest(name, pushPayload).catch(() => {
            // never fatal
          });
        }
      }
    }

    return NextResponse.json({ ok: true, order: updated });
  } catch (err) {
    console.error("update order error", err);
    return NextResponse.json(
      { ok: false, error: "Could not update order" },
      { status: 500 }
    );
  }
}
