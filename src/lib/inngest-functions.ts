// Inngest background functions for Mazaj.
// These run on Inngest's serverless infrastructure, NOT blocking the main app.
//
// R46: every Wedjat integration job now goes through the RSM HTTPS API
// (webhook/catalog/inventory/status — see src/lib/wedjat.ts). The old
// direct-Turso writes are retired: that database is a one-way mirror that
// gets wiped on every restaurant sync.

import { inngest } from "@/lib/inngest";
import { db } from "@/lib/db";
import {
  fetchWedjatRevocations,
  fullMenuSyncToWedjat,
  pushAvailabilityToWedjat,
  pushOrderToWedjat,
  resolveWedjatTableRef,
  syncWedjatTables,
} from "@/lib/wedjat";

/**
 * Job 1: Poll Wedjat RSM for revoked checks every 2 minutes.
 * A cancelled check (revoked by the restaurant) marks the mazaj order
 * revoked and pulls it from the active queue.
 */
export const pollRevocations = inngest.createFunction(
  {
    id: "poll-wedjat-revocations",
    name: "Check Wedjat revocations",
    triggers: [{ cron: "*/2 * * * *" }],
  },
  async ({ step }) => {
    return await step.run("check-revocations", async () => {
      const revocations = await fetchWedjatRevocations();

      let updated = 0;
      for (const rev of revocations) {
        // find the mazaj order tracking this wedjat check
        const tracked = await db.order.findFirst({
          where: { wedjatOrderId: rev.wedjatOrderId, wedjatSyncStatus: { not: "revoked" } },
          select: { id: true, wedjatSyncStatus: true },
        });
        if (!tracked) continue;

        await db.order.update({
          where: { id: tracked.id },
          data: {
            wedjatSyncStatus: "revoked",
            wedjatRevokedBy: rev.revokedBy,
            wedjatRevokedAt: new Date(rev.revokedAt),
            status: "done",
          },
        });
        updated++;
      }
      return { checked: revocations.length, updated };
    });
  }
);

/**
 * Job 2: Retry failed order syncs to Wedjat every 5 minutes.
 * r74: the window is 72h (was 24h — a weekend of RSM downtime used to
 * leave orders failed forever) and each attempt RE-RESOLVES the table
 * label against the floor-plan mirror, so an order that failed because
 * its table wasn't in the RSM floor plan self-heals the moment the
 * restaurant adds that table. Older failures stay failed for manual
 * review.
 *
 * r47: also re-drives orders stuck in "pending" for >5 minutes. The order
 * POST fire-and-forget (void syncToWedjat) can be suspended by the serverless
 * runtime after the HTTP response is sent — the webhook may have DELIVERED
 * (check created on the restaurant side) while the status write-back was
 * lost. The webhook's external_ref idempotency makes the re-push a safe
 * no-op (duplicate:true) — the retry just heals the local status stamp.
 */
export const retryFailedSyncs = inngest.createFunction(
  {
    id: "retry-failed-syncs",
    name: "Retry failed Wedjat syncs",
    triggers: [{ cron: "*/5 * * * *" }],
  },
  async ({ step }) => {
    return await step.run("retry-syncs", async () => {
      const since = new Date(Date.now() - 72 * 60 * 60 * 1000);
      const stuckPendingBefore = new Date(Date.now() - 5 * 60 * 1000);
      const failed = await db.order.findMany({
        where: {
          OR: [
            { wedjatSyncStatus: "failed", createdAt: { gte: since } },
            { wedjatSyncStatus: "pending", createdAt: { lte: stuckPendingBefore } },
          ],
        },
        take: 20,
      });

      let succeeded = 0;
      let healed = 0;
      for (const order of failed) {
        try {
          let addons: string[] = [];
          try {
            addons = order.addonsJson ? (JSON.parse(order.addonsJson) as string[]) : [];
          } catch {
            addons = [];
          }
          // r74 — re-resolve the table label against the (fresh) floor-plan
          // mirror before pushing: an unresolved label was the #1 failure
          // cause, and the mirror may have learned the table since.
          let wedjatTableId = order.wedjatTableId;
          if (wedjatTableId == null && (order.table ?? "").trim()) {
            const ref = await resolveWedjatTableRef(order.table ?? "", order.wedjatFloor);
            if (ref.tableId != null) {
              wedjatTableId = ref.tableId;
              healed++;
              await db.order
                .update({
                  where: { id: order.id },
                  data: { wedjatTableId, wedjatFloor: ref.floor },
                })
                .catch(() => {});
            } else if (ref.reason && ref.reason !== order.wedjatSyncError) {
              // keep the stored reason current (floor plan changed → the
              // reason text may name different floors now)
              await db.order
                .update({
                  where: { id: order.id },
                  data: { wedjatSyncError: ref.reason.slice(0, 300) },
                })
                .catch(() => {});
            }
          }
          const result = await pushOrderToWedjat({
            id: order.id,
            customerName: order.customerName,
            phone: order.phone,
            table: order.table,
            wedjatTableId,
            notes: order.notes,
            itemsJson: order.itemsJson,
            bogo: order.bogo,
            addonsJson: addons,
          });
          if (result.ok) {
            await db.order.update({
              where: { id: order.id },
              data: {
                wedjatOrderId: result.wedjatOrderId ?? null,
                wedjatSyncStatus: "synced",
                wedjatSyncError: null,
              },
            });
            succeeded++;
          } else {
            await db.order
              .update({
                where: { id: order.id },
                data: {
                  wedjatSyncStatus: "failed",
                  wedjatSyncError: (result.error ?? "push failed").slice(0, 300),
                },
              })
              .catch(() => {});
          }
        } catch {
          // still failed, will be retried next cycle
        }
      }
      return { retried: failed.length, succeeded, healed };
    });
  }
);

/**
 * Job 3: Full menu sync to Wedjat every hour — the shisha type/price
 * matrix (catalog) + the live availability mirror. Self-healing: any
 * drift on the restaurant side is corrected on the next run.
 */
export const syncPricesHourly = inngest.createFunction(
  {
    id: "sync-prices-hourly",
    name: "Sync menu & prices to Wedjat",
    triggers: [{ cron: "0 * * * *" }],
  },
  async ({ step }) => {
    return await step.run("sync-menu", async () => {
      const { catalog, availability } = await fullMenuSyncToWedjat();
      return {
        catalogOk: catalog.ok,
        pushed: catalog.pushed ?? 0,
        created: catalog.created ?? 0,
        updated: catalog.updated ?? 0,
        unchanged: catalog.unchanged ?? 0,
        availabilityOk: availability.ok,
        matched: availability.matched ?? 0,
      };
    });
  }
);

/**
 * Job 5 (R46): Availability mirror every 15 minutes — the POS shisha menu
 * always shows only what the mazaj inventory can actually make. (Orders
 * also trigger an immediate push; this is the self-healing safety net.)
 * r74: also refreshes the WedjatTable floor-plan mirror (the guest table
 * label → numeric tableId resolver's source of truth).
 */
export const availabilityMirror = inngest.createFunction(
  {
    id: "availability-mirror",
    name: "Mirror availability to Wedjat",
    triggers: [{ cron: "*/15 * * * *" }],
  },
  async ({ step }) => {
    return await step.run("push-availability", async () => {
      const r = await pushAvailabilityToWedjat();
      const t = await syncWedjatTables();
      return { ok: r.ok, matched: r.matched ?? 0, tables: t.ok ? t.tables : 0 };
    });
  }
);

/**
 * Job 4: Daily profit digest at 11 PM Cairo time.
 */
export const dailyProfitDigest = inngest.createFunction(
  {
    id: "daily-profit-digest",
    name: "Daily profit digest",
    triggers: [{ cron: "0 21 * * *" }], // 21:00 UTC = 23:00 Cairo (EEST+2)
  },
  async ({ step }) => {
    return await step.run("generate-digest", async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const orders = await db.order.findMany({
        where: { createdAt: { gte: today } },
      });
      const revenue = orders.reduce((s, o) => s + o.total, 0);
      const cogs = orders.reduce((s, o) => s + o.cogs, 0);
      const profit = revenue - cogs;
      const revoked = orders.filter((o) => o.wedjatSyncStatus === "revoked").length;

      return {
        date: today.toISOString().split("T")[0],
        orders: orders.length,
        revenue: Math.round(revenue * 100) / 100,
        cogs: Math.round(cogs * 100) / 100,
        netProfit: Math.round(profit * 100) / 100,
        revoked,
      };
    });
  }
);

export const functions = [
  pollRevocations,
  retryFailedSyncs,
  syncPricesHourly,
  availabilityMirror,
  dailyProfitDigest,
];
