#!/bin/sh
# API container entrypoint: apply SQL migrations, then start the HTTP server.
# Failures abort the container so orchestrators never route traffic to an
# un-migrated schema.
set -eu

echo "[entrypoint] Running database migrations..."
node scripts/migrate.js

echo "[entrypoint] Starting JudgeX API..."
exec node src/server.js
