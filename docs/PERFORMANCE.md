# JudgeX Performance & Scalability

Sprint 35 guidance for production performance: indexing, Redis caching, query patterns, frontend splitting, worker horizontal scale, load tests, and metrics.

Judge execution logic, security policies, core observability wiring, and deployment architecture are unchanged.

---

## Benchmarks

### Scripts

| Script | npm | Measures |
|--------|-----|----------|
| `scripts/benchmark-load.js` | `npm run benchmark:load` | Read API throughput (health, problems, leaderboard, contests) under concurrency |
| `scripts/benchmark-queue.js` | `npm run benchmark:queue` | Submission **enqueue** rate / latency (requires `AUTH_TOKEN` + problem id/slug) |
| `scripts/benchmark-security.js` | `npm run benchmark:security` | Auth/health latency smoke |
| `scripts/explain-hot-queries.js` | `npm run benchmark:explain` | `EXPLAIN` / `EXPLAIN ANALYZE` for hot SQL |

Environment knobs: `BASE_URL`, `CONCURRENCY`, `REQUESTS`, `AUTH_TOKEN`, `PROBLEM_ID` / `PROBLEM_SLUG`, `ANALYZE=1`.

### Reference results (local / staging)

Capture numbers after a warm cache and document them here when you run against a real environment:

| Metric | How to measure | Notes |
|--------|----------------|-------|
| API throughput (reads) | `benchmark:load` RPS + p95 | Expect Redis cache to lift leaderboard / problems / contests |
| Concurrent users | `CONCURRENCY` in load script | Synthetic clients, not browser sessions |
| Submissions/sec (enqueue) | `benchmark:queue` | Bound by rate limits + DB insert + Redis enqueue |
| Queue latency | `judgex_queue_wait_seconds` | Enqueue → worker start |
| Judge duration | `judgex_judge_duration_seconds` | Existing histogram; do not change pipeline |

Example local run template:

```bash
cd backend
npm run benchmark:load
# AUTH_TOKEN=... PROBLEM_SLUG=two-sum npm run benchmark:queue
```

---

## Indexing strategy

### Migration `007_sprint35_performance.sql`

| Index | Purpose |
|-------|---------|
| `idx_submissions_submitted_at` | Timeframe / recency scans |
| `idx_submissions_verdict_submitted` | Accepted-only aggregates (partial) |
| `idx_problems_published_difficulty_created` | Public catalog by difficulty |
| `idx_contests_public_status_start` | Public contest lists |
| `idx_discussions_title_trgm` / `body_trgm` | ILIKE / trigram search |
| `idx_contest_participants_user_contest` | Batch “joined?” checks `(user_id, contest_id)` |

### Removed redundant index

- Dropped `idx_contest_participants_user` (`user_id` alone) — covered by the composite `(user_id, contest_id)`.

### Retained (not redundant)

Discussion indexes on `(problem_id, created_at)`, `(problem_id, updated_at)`, and `(problem_id, like_count, …)` serve different `ORDER BY` paths — keep all three.

### EXPLAIN review (hot paths)

Use `npm run benchmark:explain` (add `ANALYZE=1` on staging).

Expected index usage after migration:

- **Submissions list** → `idx_submissions_user_created` / `submitted_at`
- **Leaderboard CTE** → join users↔submissions; timeframe uses `submitted_at`; accepted filter benefits from partial verdict index
- **Contests list** → `idx_contests_public_status_start`
- **Discussions search** → GIN trigram on title/body
- **Editorials** → problem slug lookup + editorial FK (existing indexes); response also Redis-cached

Leaderboard still aggregates live from `submissions` (not `user_statistics`) for correctness across timeframes. For very large datasets, consider a later materialized/refresh strategy without changing the public API.

### Query improvements (Sprint 35)

- Leaderboard page: **one** CTE pass with `COUNT(*) OVER()` (removed duplicate count query).
- Contest list: batch `findParticipatingContestIds` (eliminates N+1 `findParticipant`).
- Contest create/update: batch `findExistingIds` for problem IDs.
- Discussion comments: soft `LIMIT 2000` on detail load.

---

## Redis usage

Shared helper: `backend/src/infrastructure/cache/json-cache.js` (hit/miss/error → Prometheus).

| Namespace | Keys | TTL | Invalidation |
|-----------|------|-----|--------------|
| `leaderboard` | page + user-rank | 30s | On accepted verdict (worker); TTL otherwise |
| `problem` | detail by slug; list pages | 120s / 60s | Problem create/update/delete |
| `contest` | public list pages | 20s | Contest create/update/delete |
| `editorial` | published by slug | 300s | Editorial publish/update (existing) |
| admin | dashboard snippets | short | Existing admin cache |

Contest list cache stores **viewer-agnostic** repository rows; `joined` is overlaid per request after a single batch membership query.

Cache failures never break reads/writes.

---

## Worker scaling

### Concurrency

`JUDGE_WORKER_CONCURRENCY` (default `2`) is wired into BullMQ `Worker({ concurrency })` in `judge.worker.js`.

Tune per host CPU / Docker capacity. Higher concurrency increases parallel sandboxes on that worker process.

### Horizontal workers

Run multiple processes (or containers) against the **same** Redis queue (`SUBMISSIONS_QUEUE_NAME`):

```bash
npm run worker:judge
# or N replicas of the worker service in Compose/K8s
```

BullMQ distributes jobs across workers. Throughput ≈ `workers × concurrency` (bounded by Docker, CPU, and DB).

Heartbeats continue to publish per-process concurrency for admin/queue visibility.

Do **not** change judge pipeline code when scaling — only replica count and `JUDGE_WORKER_CONCURRENCY`.

---

## Frontend performance

- Route-level `React.lazy` + `Suspense` for app/admin pages (auth login/register stay eager).
- Monaco / markdown remain component-lazy.
- TanStack Query defaults: `staleTime` 60s, `gcTime` 5m; list hooks align with server TTLs.
- `LeaderboardTable` memoized; existing memo on editor/problem panels retained.

Review bundles with `npm run build` in `frontend/` and inspect chunk sizes (admin/recharts and problem detail/Monaco should be separate async chunks).

---

## Metrics (extensions)

| Metric | Meaning |
|--------|---------|
| `judgex_cache_access_total{namespace,result}` | Cache hit / miss / error |
| Hit ratio | `sum(hit) / sum(hit+miss)` per namespace |
| `judgex_judge_duration_seconds` | Average judge duration (existing) |
| `judgex_queue_wait_seconds` | Queue latency (enqueue → worker start) |
| `judgex_db_query_duration_seconds` | DB query latency at shared `query()` helper |
| `judgex_queue_depth` | Waiting/active/etc. (existing) |

Scraped at `GET /metrics`.

---

## Scaling recommendations

1. **API replicas** behind a load balancer; shared Postgres + Redis.
2. **Worker replicas** for judge throughput; raise `JUDGE_WORKER_CONCURRENCY` carefully per node.
3. Keep Redis for BullMQ **and** JSON caches; size memory for queue retention + cache keys.
4. Apply migrations through `007` before load tests that expect new indexes.
5. Prefer short TTLs + write-path invalidation over long stale windows for contests/leaderboard.
6. Watch `judgex_db_query_duration_seconds` p95 and cache hit ratio under load; index or cache before vertical DB scale.

---

## Verification checklist

- [ ] `007_sprint35_performance.sql` applied
- [ ] `npm run lint` / unit / integration (backend)
- [ ] Frontend lint + build
- [ ] Optional: `benchmark:load` against staging with warm Redis
