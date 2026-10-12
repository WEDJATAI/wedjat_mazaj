/**
 * r69 (audit ⑧) — Neon PostgreSQL backup.
 *
 * The production DB (Neon) had NO backup story: Neon keeps its own PITR
 * windows, but the owner wanted portable, restorable snapshots outside the
 * provider. The sandbox has no pg_dump, so this exports every table to a
 * gzipped JSON snapshot through a dedicated postgres Prisma client.
 *
 * Usage (DATABASE_URL = the Neon connection string):
 *   bun run backup:neon
 * Restoring:
 *   gunzip db/backups/neon-<stamp>.json.gz → scripts/restore-neon.ts (rows)
 *   or inspect the JSON directly (it's one file, one key per table).
 *
 * Automation: the sandbox cron calls this daily (see worklog r69);
 * `bun run backup` still covers the local SQLite dev DB.
 */

import { PrismaClient } from "../.prisma-neon/index.js";
import { gzipSync } from "node:zlib";
import { mkdirSync, writeFileSync, readdirSync, statSync, unlinkSync, existsSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dir, "..");
const BACKUP_DIR = join(ROOT, "db", "backups");
const KEEP = 14; // snapshots retained

const db = new PrismaClient();

// Table order matters for a future restore (parents before children).
const TABLES = [
  "venue",
  "branch",
  "employee",
  "inventoryItem",
  "flavorStock",
  "supplyItem",
  "order",
  "orderComment",
  "serviceRequest",
  "loyaltyMember",
  "pointsLedger",
  "favoriteMix",
  "purchase",
  "platformSetting",
  "pushSubscription",
  "pinAttempt",
] as const;

async function main() {
  if (!process.env.DATABASE_URL?.startsWith("postgres")) {
    console.error(
      "[backup-neon] DATABASE_URL must be the Neon postgres connection string."
    );
    process.exit(1);
  }
  mkdirSync(BACKUP_DIR, { recursive: true });

  const snapshot: Record<string, unknown[]> = {};
  const skipped: string[] = [];
  let totalRows = 0;
  for (const table of TABLES) {
    try {
      const rows = await (db as any)[table].findMany();
      snapshot[table] = rows;
      totalRows += rows.length;
    } catch (err) {
      // P2021 = table missing (schema drift between app + this snapshot) —
      // snapshot what exists rather than failing the whole backup
      if ((err as { code?: string }).code === "P2021") {
        skipped.push(table);
        snapshot[table] = [];
      } else {
        throw err;
      }
    }
  }
  if (skipped.length > 0) {
    console.warn(`[backup-neon] skipped (not in DB yet): ${skipped.join(", ")}`);
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const dest = join(BACKUP_DIR, `neon-${stamp}.json.gz`);
  const payload = {
    exportedAt: new Date().toISOString(),
    database: process.env.DATABASE_URL.replace(/\/\/[^@]*@/, "//***@"),
    rowCount: totalRows,
    tables: snapshot,
  };
  writeFileSync(dest, gzipSync(JSON.stringify(payload)));

  const sizeKb = Math.round(statSync(dest).size / 1024);
  console.log(`[backup-neon] ${totalRows} rows → ${dest} (${sizeKb} KB)`);

  // prune: keep the newest KEEP neon snapshots
  const snapshots = readdirSync(BACKUP_DIR)
    .filter((f) => f.startsWith("neon-") && f.endsWith(".json.gz"))
    .sort()
    .reverse();
  for (const old of snapshots.slice(KEEP)) {
    unlinkSync(join(BACKUP_DIR, old));
  }
  if (snapshots.length > KEEP) {
    console.log(`[backup-neon] pruned ${snapshots.length - KEEP} old snapshot(s)`);
  }

  if (totalRows === 0) {
    console.warn(
      "[backup-neon] WARNING: 0 rows exported — is DATABASE_URL pointing at the right database?"
    );
  }
}

main()
  .catch((err) => {
    console.error("[backup-neon] FAILED:", err);
    process.exit(1);
  })
  .finally(() => db.$disconnect());

// keep existsSync referenced for future preflight checks
void existsSync;
