#!/usr/bin/env bash
# Back up the SQLite database + Prisma schema/seed to a timestamped snapshot.
# Usage: bash scripts/backup-db.sh
set -euo pipefail

cd "$(dirname "$0")/.."

PROJECT_DIR="$(pwd)"
DB_FILE="db/custom.db"
BACKUP_DIR="db/backups"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"

mkdir -p "$BACKUP_DIR"

# 1. SQLite DB snapshot (use sqlite3 .backup if available for a safe online copy,
#    otherwise fall back to a plain file copy).
if [ -f "$DB_FILE" ]; then
  DB_DEST="$BACKUP_DIR/custom-$STAMP.db"
  if command -v sqlite3 >/dev/null 2>&1; then
    sqlite3 "$DB_FILE" ".backup '$DB_DEST'" 2>/dev/null || cp "$DB_FILE" "$DB_DEST"
  else
    cp "$DB_FILE" "$DB_DEST"
  fi
  echo "DB backed up → $DB_DEST ($(du -h "$DB_DEST" | cut -f1))"
else
  echo "No DB file at $DB_FILE, skipping DB backup."
fi

# 2. Prisma schema + seed snapshot (small, version-controllable).
SCHEMA_DEST="$BACKUP_DIR/schema-$STAMP.prisma"
cp prisma/schema.prisma "$SCHEMA_DEST"
cp prisma/seed.ts "$BACKUP_DIR/seed-$STAMP.ts" 2>/dev/null || true
echo "Schema backed up → $SCHEMA_DEST"

# 3. Full source snapshot (tarball) — useful as a hardening restore point.
SRC_DEST="$BACKUP_DIR/src-$STAMP.tar.gz"
tar -czf "$SRC_DEST" \
  --exclude='node_modules' \
  --exclude='.next' \
  --exclude='db/backups' \
  --exclude='db/custom.db' \
  --exclude='db/custom.db-journal' \
  src prisma public next.config.ts package.json tsconfig.json 2>/dev/null || true
echo "Source snapshot → $SRC_DEST ($(du -h "$SRC_DEST" | cut -f1))"

# 4. Prune: keep only the 10 most recent DB backups to avoid unbounded growth.
ls -1t "$BACKUP_DIR"/custom-*.db 2>/dev/null | tail -n +11 | xargs -r rm -f
ls -1t "$BACKUP_DIR"/src-*.tar.gz 2>/dev/null | tail -n +11 | xargs -r rm -f

echo "Backup complete at $STAMP."
