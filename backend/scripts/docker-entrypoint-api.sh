#!/bin/sh
# API container entrypoint: serve HTTP only.
# Schema changes run once in the Compose `migrate` service. Replicas must not
# each apply migrations. That service has to exit 0 before this process starts.
set -eu

echo "[entrypoint] Starting JudgeX API..."
exec node src/server.js
