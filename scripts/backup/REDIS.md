# Redis persistence & recovery notes for JudgeX
#
# Production compose runs Redis with AOF enabled:
#   redis-server --appendonly yes --appendfsync everysec
#
# Data directory (named volume): judgex_redisdata → /data inside the container.
#
# What Redis stores for JudgeX
# - BullMQ job queues (waiting/active/delayed/failed metadata)
# - Rate-limit counters (ephemeral)
# - Admin dashboard cache keys (ephemeral)
# - Worker heartbeat key (ephemeral)
#
# PostgreSQL remains the source of truth for submissions. If Redis is lost:
# 1. API/workers reconnect automatically once Redis is healthy.
# 2. Stuck `queued` submissions are re-enqueued by the cleanup/reaper worker.
# 3. In-flight BullMQ job state may be lost; reaper + retries recover judging.
#
# Manual volume backup (optional)
#   docker run --rm -v judgex_redisdata:/data -v "$PWD/backups/redis:/out" alpine \
#     tar czf /out/redis-$(date -u +%Y%m%dT%H%M%SZ).tgz -C /data .
#
# Restore
#   Stop redis, extract archive into the volume, start redis.
# Prefer recovering queue via reaper rather than restoring stale AOF unless
# you fully understand BullMQ state consistency.
#
# Rotation
# - Prefer RDB/AOF on the volume with host disk snapshots.
# - Application-level backups prioritize PostgreSQL (scripts/backup/backup-db.sh).
