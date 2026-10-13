#!/usr/bin/env bash
# r69 fix #10 — production database backup (pg_dump variant).
#
# Byte-faithful logical backup of the Neon PostgreSQL database, gzipped,
# with a rolling retention of the newest 30 snapshots. Runs on any machine
# with pg_dump (postgres-client package) — no Node/Bun needed.
#
# USAGE:
#   NEON_DATABASE_URL="postgresql://…unpooled-host…/neondb?sslmode=require" ./scripts/backup-neon.sh [output-dir]
#
# IMPORTANT: use the UNPOOLED Neon host (drop "-pooler" from the
# hostname) — PgBouncer rejects pg_dump's session-level commands.
#
# CRON (daily at 03:15 on any always-on machine):
#   15 3 * * * cd /path/to/wedjat_mazaj && NEON_DATABASE_URL="postgresql://…" ./scripts/backup-neon.sh >> backups/backup.log 2>&1
#
# RESTORE:
#   gunzip -c backups/mazaj-<stamp>.sql.gz | psql "postgresql://…target…/neondb?sslmode=require"

set -euo pipefail

: "${NEON_DATABASE_URL:?Set NEON_DATABASE_URL to the UNPOOLED Neon connection string}"
DIR="${1:-backups}"
KEEP="${BACKUP_KEEP:-30}"

command -v pg_dump >/dev/null 2>&1 || {
  echo "pg_dump not found — install postgresql-client (or use scripts/backup-neon.mjs instead)" >&2
  exit 1
}

mkdir -p "$DIR"
STAMP="$(date -u +%Y%m%d-%H%M%S)"
OUT="$DIR/mazaj-$STAMP.sql.gz"

pg_dump "$NEON_DATABASE_URL" --no-owner --no-privileges --clean --if-exists \
  | gzip > "$OUT"

echo "[backup] $OUT ($(du -h "$OUT" | cut -f1))"

# rolling retention — keep the newest $KEEP snapshots
ls -1t "$DIR"/mazaj-*.sql.gz 2>/dev/null | tail -n +"$((KEEP + 1))" | while read -r stale; do
  rm -- "$stale"
  echo "[backup] retention: removed $stale"
done
echo "[backup] $(ls -1 "$DIR"/mazaj-*.sql.gz 2>/dev/null | wc -l) snapshots kept in $DIR/"
