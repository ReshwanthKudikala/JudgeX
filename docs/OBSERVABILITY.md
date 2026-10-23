# JudgeX Observability

Sprint 33 production observability notes.

## Logging

- **Production / test:** newline-delimited JSON (`LOG_FORMAT=json` or `auto` outside development).
- **Development:** pretty single-line logs (`LOG_FORMAT=pretty` or `auto` in development).
- Every HTTP access line includes: `timestamp`, `requestId`, `userId`, `method`, `path`, `statusCode`, `durationMs`, `ip`, `userAgent`.
- Secrets and source code fields are redacted.

## Request IDs

- Headers: `X-Request-ID` and `X-Correlation-Id` (same value).
- Accepted from either inbound header; otherwise a UUIDv7 is minted.
- Propagated into BullMQ job payloads as `requestId` (optional; does not change judge schema version).
- Judge worker and AI controllers attach the ID to child loggers.

## Health

| Path | Purpose |
|------|---------|
| `GET /health` | Liveness (process) |
| `GET /health/live` | Liveness alias |
| `GET /ready` | Readiness |
| `GET /health/ready` | Readiness alias |
| `GET /api/v1/health` | Readiness (API contract) |

Readiness requires Postgres, Redis, and BullMQ. `ready` stays true when that data plane is up. `degraded` is true when the judge worker heartbeat is missing or stale, or when that heartbeat says the worker cannot reach Docker. The API process does not ping Docker and does not mount the Docker socket; sandbox execution runs on the judge worker.

## Metrics

`GET /metrics` on the API process — Prometheus text format (`prom-client`), prefix `judgex_`.

The public Nginx listener does not proxy this path (`location = /metrics` returns `404`). Scrape `http://api:4000/metrics` from the Compose network. Production Compose does not publish the API port, and this repository has no Prometheus service.

Includes HTTP request counts/latency, submissions, judge duration, queue depth, AI requests, contest joins, and process defaults.

## Admin monitoring

`GET /api/v1/admin/monitoring` — live (uncached) snapshot for the Admin Overview page (15s refresh).
