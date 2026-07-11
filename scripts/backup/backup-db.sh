#!/usr/bin/env bash
# PostgreSQL logical backup for JudgeX.
# Usage:
#   ./scripts/backup/backup-db.sh
#   COMPOSE_FILE=docker-compose.prod.yml ENV_FILE=.env.production ./scripts/backup/backup-db.sh
#
# Rotation: keeps the newest RETAIN_DAYS days of backups (default 14).

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
ENV_FILE="${ENV_FILE:-.env.production}"
BACKUP_DIR="${BACKUP_DIR:-$ROOT_DIR/backups/postgres}"
RETAIN_DAYS="${RETAIN_DAYS:-14}"
CONTAINER="${POSTGRES_CONTAINER:-judgex-prod-postgres}"
POSTGRES_USER="${POSTGRES_USER:-judgex}"
POSTGRES_DB="${POSTGRES_DB:-judgex}"

mkdir -p "$BACKUP_DIR"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
OUT="$BACKUP_DIR/judgex-${POSTGRES_DB}-${STAMP}.sql.gz"

echo "[backup] Writing $OUT"

if docker ps --format '{{.Names}}' | grep -qx "$CONTAINER"; then
  docker exec -t "$CONTAINER" pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --no-owner --no-acl \
    | gzip -c > "$OUT"
else
  # Fallback: compose exec from repo root
  cd "$ROOT_DIR"
  docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" exec -T postgres \
    pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --no-owner --no-acl \
    | gzip -c > "$OUT"
fi

echo "[backup] Done ($(du -h "$OUT" | cut -f1))"

# Rotation
find "$BACKUP_DIR" -type f -name 'judgex-*.sql.gz' -mtime "+$RETAIN_DAYS" -print -delete \
  || true

echo "[backup] Rotation complete (retain ${RETAIN_DAYS}d)"
