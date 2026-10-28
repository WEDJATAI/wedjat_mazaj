# Scripts — ops tooling

## Database backups

Production runs on Neon PostgreSQL. The **primary** backup path is the
automated one (r73): a nightly Vercel cron snapshots all tables and pushes
timestamped JSON to the private `wedjat_mazaj_backups` repo (30-snapshot
retention) — see `/api/platform/backup/cron` and the Settings → Off-site
backups card.

The scripts below are the **manual / offline** fallback:

| Script | What it does |
|---|---|
| `scripts/backup-neon.mjs` | `pg` (SELECT-only) → one timestamped JSON file, rolling retention. **Live-verified against Neon.** |
| `scripts/backup-db.sh` | Local SQLite dev database + schema/seed snapshot. |

```bash
# Neon JSON snapshot (use the UNPOOLED host — PgBouncer rejects tooling):
bun scripts/backup-neon.mjs --url "postgresql://USER:PASS@UNPOOLED-HOST/neondb?sslmode=require" --dir backups
# or: NEON_DATABASE_URL="postgresql://…" bun run backup:neon

# Local dev database:
bun run backup
```

Retention: newest 30 snapshots. `backups/` (and `db/backups/`) are
gitignored — never commit dumps (they contain guest data).

## Other tooling

| Script | Purpose |
|---|---|
| `gen-local-schema.mjs` | Derives `prisma/schema.local.prisma` (SQLite) from the Neon schema — runs automatically in every `dev`/`db:*` script. |
| `make-pwa-icons.mjs` · `render-logo-icons.ts` | Regenerate the PWA icon set from the logo. |
| `make-android-art.mjs` | Regenerate Android store art. |
| `r74-prod-verify.ts` | Mazaj → Wedjat RSM pipeline verification (backfill + live order proof). **Credentials via env only** (`NEON_DATABASE_URL`, `WEDJAT_RSM_KEY`). |
