// Inngest background functions for Mazaj.
// These run on Inngest's serverless infrastructure, NOT blocking the main app.

import { inngest } from "@/lib/inngest";
import { db } from "@/lib/db";
import { fetchWedjatRevocations, syncProductPriceToWedjat } from "@/lib/wedjat";
import { BRANDS as CATALOG_BRANDS } from "@/lib/catalog";

/**
 * Job 1: Poll Wedjat RSM for revoked orders every 2 minutes.
 */
export const pollRevocations = inngest.createFunction(
  {
    id: "poll-wedjat-revocations",
    name: "Check Wedjat revocations",
    cron: "*/2 * * * *",
  },
  async ({ step }) => {
    return await step.run("check-revocations", async () => {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const revocations = await fetchWedjatRevocations(since);

      let updated = 0;
      for (const rev of revocations) {
        if (!rev.mazajOrderId) continue;
        const existing = await db.order.findUnique({
          where: { id: rev.mazajOrderId },
          select: { wedjatSyncStatus: true },
        });
        if (!existing || existing.wedjatSyncStatus === "revoked") continue;

        await db.order.update({
          where: { id: rev.mazajOrderId },
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
 */
export const retryFailedSyncs = inngest.createFunction(
  {
    id: "retry-failed-syncs",
    name: "Retry failed Wedjat syncs",
    cron: "*/5 * * * *",
  },
  async ({ step }) => {
    return await step.run("retry-syncs", async () => {
      const failed = await db.order.findMany({
        where: { wedjatSyncStatus: "failed" },
        take: 20,
      });

      let succeeded = 0;
      for (const order of failed) {
        try {
          const items = JSON.parse(order.itemsJson) as {
            primaryBrandName: string;
            flavorLabel: string;
            unitPrice: number;
            qty: number;
          }[];
          const { pushOrderToWedjat } = await import("@/lib/wedjat");
          const result = await pushOrderToWedjat({
            mazajOrderId: order.id,
            tableName: order.table || "",
            items: items.map((it) => ({
              name: `${it.primaryBrandName} ${it.flavorLabel}`,
              price: it.unitPrice,
              qty: it.qty,
            })),
            total: order.total,
            customerName: order.customerName,
          });
          if (result.ok) {
            await db.order.update({
              where: { id: order.id },
              data: {
                wedjatOrderId: result.wedjatOrderId,
                wedjatSyncStatus: "synced",
              },
            });
            succeeded++;
          }
        } catch {
          // still failed, will be retried next cycle
        }
      }
      return { retried: failed.length, succeeded };
    });
  }
);

/**
 * Job 3: Sync Mazaj prices to Wedjat every hour.
 */
export const syncPricesHourly = inngest.createFunction(
  {
    id: "sync-prices-hourly",
    name: "Sync prices to Wedjat",
    cron: "0 * * * *",
  },
  async ({ step }) => {
    return await step.run("sync-prices", async () => {
      let synced = 0;
      for (const brand of CATALOG_BRANDS) {
        if (brand.pricing.fruits) {
          const r = await syncProductPriceToWedjat(`${brand.name} Fruits`, brand.pricing.fruits);
          if (r.ok) synced++;
        }
        if (brand.pricing.fruitsMix) {
          const r = await syncProductPriceToWedjat(`${brand.name} Fruits Mix`, brand.pricing.fruitsMix);
          if (r.ok) synced++;
        }
        if (brand.pricing.flat) {
          const r = await syncProductPriceToWedjat(`${brand.name} Standard`, brand.pricing.flat);
          if (r.ok) synced++;
        }
      }
      return { synced };
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
    cron: "0 21 * * *", // 21:00 UTC = 23:00 Cairo (EEST+2)
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
  dailyProfitDigest,
];
