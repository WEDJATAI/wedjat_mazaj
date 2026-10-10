#!/usr/bin/env node
/**
 * r60 — Derive the local SQLite schema from the canonical Prisma schema.
 *
 * `prisma/schema.prisma` is committed with provider = "postgresql" because
 * that is what Vercel builds against (Neon PostgreSQL). The sandbox dev
 * environment has no Postgres server, so local dev runs against a SQLite
 * file. Prisma requires the provider to be baked into the schema, so this
 * script derives `prisma/schema.local.prisma` (gitignored) with the sqlite
 * provider — keeping ONE source of truth for all models.
 *
 * Usage:  node scripts/gen-local-schema.mjs
 * Then:   prisma generate --schema prisma/schema.local.prisma
 *         prisma db push  --schema prisma/schema.local.prisma
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const src = join(root, "prisma", "schema.prisma");
const dst = join(root, "prisma", "schema.local.prisma");

const canonical = readFileSync(src, "utf8");

if (!canonical.includes('provider = "postgresql"')) {
  console.error(
    "[gen-local-schema] canonical prisma/schema.prisma must keep provider = \"postgresql\" " +
      "(production source of truth). Refusing to derive a local variant."
  );
  process.exit(1);
}

const local = canonical.replace(
  'provider = "postgresql"',
  'provider = "sqlite" // derived for local sandbox dev — DO NOT COMMIT (gitignored)'
);

writeFileSync(dst, local);
console.log(`[gen-local-schema] wrote ${dst} (sqlite provider, derived from canonical schema)`);
