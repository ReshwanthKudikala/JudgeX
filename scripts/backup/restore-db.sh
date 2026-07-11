#!/usr/bin/env bash
# Restore a JudgeX PostgreSQL dump created by backup-db.sh.
# WARNING: replaces the target database contents.
#
# Usage:
#   ./scripts/backup/restore-db.sh backups/postgres/judgex-judgex-YYYYMMDDTHHMMSSZ.sql.gz

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
ENV_FILE="${ENV_FILE:-.env.production}"
CONTAINER="${POSTGRES_CONTAINER:-judgex-prod-postgres}"
POSTGRES_USER="${POSTGRES_USER:-judgex}"
POSTGRES_DB="${POSTGRES_DB:-judgex}"

DUMP="${1:-}"
if [[ -z "$DUMP" || ! -f "$DUMP" ]]; then
  echo "Usage: $0 <path-to-backup.sql.gz>" >&2
  exit 1
fi

echo "[restore] Restoring $DUMP into ${POSTGRES_DB} on ${CONTAINER}"
echo "[restore] This will DROP and recreate the public schema. Ctrl+C within 5s to abort."
sleep 5

RESTORE_SQL="DROP SCHEMA public CASCADE; CREATE SCHEMA public; GRANT ALL ON SCHEMA public TO ${POSTGRES_USER}; GRANT ALL ON SCHEMA public TO public;"

if docker ps --format '{{.Names}}' | grep -qx "$CONTAINER"; then
  docker exec -i "$CONTAINER" psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1 -c "$RESTORE_SQL"
  gunzip -c "$DUMP" | docker exec -i "$CONTAINER" psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1
else
  cd "$ROOT_DIR"
  docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" exec -T postgres \
    psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1 -c "$RESTORE_SQL"
  gunzip -c "$DUMP" | docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" exec -T postgres \
    psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1
fi

echo "[restore] Complete. Restart API/workers if they held stale connections:"
echo "  docker compose -f $COMPOSE_FILE --env-file $ENV_FILE restart api worker cleanup-worker"
