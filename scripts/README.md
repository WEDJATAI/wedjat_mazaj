# Scripts — ops tooling

## Database backups (r69 fix #10 — two verified variants)

Production runs on Neon PostgreSQL. Neon keeps its own short point-in-time
restore window, but the only *full, owner-controlled* copy of the business
data (orders, loyalty points, inventory) is what these scripts produce.
Run one of them on a schedule from any machine that stays on.

| Script | How | Verified |
|---|---|---|
| `scripts/backup-neon.mjs` | `pg` (SELECT-only) → one timestamped JSON file, rolling retention | **live Neon — 250 rows / 15 tables exported, no credentials in dump** |
| `scripts/backup-neon.sh` | `pg_dump` → gzip, byte-faithful restorable dump, retention | needs pg_dump on the host (cron recipe inside) |
| `scripts/backup-neon.ts` | Prisma-based export → gzipped JSON (`bun run backup:neon`; a restore companion is planned) | written in the parallel r69 session; same contract, pick your flavor |

```bash
# JSON snapshot (recommended — no pg_dump needed):
bun scripts/backup-neon.mjs --url "postgresql://USER:PASS@UNPOOLED-HOST/neondb?sslmode=require" --dir backups

# pg_dump variant (byte-faithful):
NEON_DATABASE_URL="postgresql://…unpooled-host…/neondb?sslmode=require" ./scripts/backup-neon.sh backups
```

**Use the UNPOOLED Neon host** (drop `-pooler` from the hostname) for
pg_dump — PgBouncer rejects it. Retention: newest 30 kept.

### Scheduling (cron, daily 03:15)

```cron
15 3 * * * cd /path/to/wedjat_mazaj && NEON_DATABASE_URL="postgresql://…" ./scripts/backup-neon.sh >> backups/backup.log 2>&1
```

### Restoring

```bash
# pg_dump snapshot:
gunzip -c backups/mazaj-<stamp>.sql.gz | psql "postgresql://…target…/neondb?sslmode=require"
# JSON snapshots: table-keyed data for audit / partial recovery.
```

`backups/` (and `db/backups/`) are gitignored — never commit dumps (they
contain guest data).
