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

Readiness checks Postgres, Redis, BullMQ. Worker heartbeat + Docker ping are reported; API `ready` stays true when the data plane is up (worker/Docker may run on another host → `degraded`).

## Metrics

`GET /metrics` — Prometheus text format (`prom-client`), prefix `judgex_`.

Includes HTTP request counts/latency, submissions, judge duration, queue depth, AI requests, contest joins, and process defaults.

## Admin monitoring

`GET /api/v1/admin/monitoring` — live (uncached) snapshot for the Admin Overview page (15s refresh).
