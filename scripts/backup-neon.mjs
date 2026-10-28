/**
 * r69 fix #10 — production database backup (full JSON snapshot).
 *
 * Exports every table of the production PostgreSQL (Neon) database into a
 * single timestamped JSON file, plus a rolling retention policy. Read-only
 * by construction (SELECT only) — safe to run against production at any
 * time.
 *
 * USAGE (from the repo root, no pg_dump needed):
 *   bun scripts/backup-neon.mjs --url "postgresql://user:pass@host/db?sslmode=require" --dir backups
 *   # or: NEON_DATABASE_URL="postgresql://…" bun scripts/backup-neon.mjs
 *
 * Notes:
 *  - Prefer the UNPOOLED Neon host for backups (drop "-pooler" from the
 *    hostname). The pooled endpoint also works for SELECT-only scripts.
 *  - Credentials never appear in the output — only the host + db name are
 *    recorded in the dump's meta block.
 *  - Restore/audit: the JSON is a plain, diffable, table-keyed snapshot;
 *    for a byte-faithful restore use the pg_dump variant (backup-neon.sh).
 */

import { Pool } from "pg";
import { mkdir, writeFile, readdir, unlink } from "node:fs/promises";
import path from "node:path";

const args = process.argv.slice(2);
function argValue(flag) {
  const i = args.indexOf(flag);
  return i >= 0 && i + 1 < args.length ? args[i + 1] : undefined;
}

const url =
  argValue("--url") ??
  process.env.NEON_DATABASE_URL ??
  process.env.DATABASE_URL;
const dir = argValue("--dir") ?? "backups";
const keep = Number(argValue("--keep") ?? 30);

if (!url || !/^postgres(ql)?:\/\//.test(url)) {
  console.error(
    "Usage: bun scripts/backup-neon.mjs --url \"postgresql://…\" [--dir backups] [--keep 30]"
  );
  process.exit(1);
}

// Every table in prisma/schema.prisma — quoted because Prisma keeps
// PascalCase, case-sensitive names (unquoted SQL folds to lowercase).
const TABLES = [
  "Venue",
  "Branch",
  "Employee",
  "InventoryItem",
  "FlavorStock",
  "SupplyItem",
  "ServiceRequest",
  "FavoriteMix",
  "Order",
  "OrderComment",
  "LoyaltyMember",
  "PointsLedger",
  "PushSubscription",
  "Purchase",
  "PlatformSetting",
];

function safeHost(u) {
  try {
    const parsed = new URL(u);
    return `${parsed.host}/${parsed.pathname.replace(/^\//, "")}`;
  } catch {
    return "(unparsed)";
  }
}

const pool = new Pool({
  connectionString: url,
  ssl: url.includes("sslmode=disable") ? false : { rejectUnauthorized: false },
  max: 1,
});

try {
  const data = {};
  const counts = {};
  let totalRows = 0;
  for (const t of TABLES) {
    const res = await pool.query(`SELECT * FROM "${t}"`);
    const key = t;
    data[key] = res.rows;
    counts[key] = res.rowCount ?? res.rows.length;
    totalRows += res.rows.length;
  }

  await mkdir(dir, { recursive: true });
  const stamp = new Date()
    .toISOString()
    .replace(/[:.]/g, "-")
    .replace("T", "_")
    .slice(0, 19);
  const file = path.join(dir, `mazaj-${stamp}.json`);
  const dump = {
    meta: {
      generatedAt: new Date().toISOString(),
      database: safeHost(url),
      tool: "scripts/backup-neon.mjs (r69)",
      totalRows,
      tableCounts: counts,
    },
    data,
  };
  await writeFile(file, JSON.stringify(dump) + "\n", "utf8");
  console.log(
    `[backup] ${file} — ${totalRows} rows across ${TABLES.length} tables (${safeHost(url)})`
  );

  // rolling retention — keep the newest `keep` mazaj-*.json snapshots
  const snapshots = (await readdir(dir))
    .filter((f) => /^mazaj-.*\.json$/.test(f))
    .sort()
    .reverse();
  for (const stale of snapshots.slice(keep)) {
    await unlink(path.join(dir, stale));
    console.log(`[backup] retention: removed ${stale}`);
  }
} finally {
  await pool.end();
}
