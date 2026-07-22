# JudgeX Deployment Guide

Production deployment, scaling, backups, monitoring, and troubleshooting.

Companion docs: `docs/SECURITY.md`, `docs/OBSERVABILITY.md`, `backend/.env.production.example`, `.env.production.example`.

---

## 1. Architecture (prod compose)

`docker-compose.prod.yml` runs:

| Service | Role |
|---------|------|
| `nginx` | Edge reverse proxy (compression, security headers, soft rate limits) |
| `frontend` | Static SPA (Vite build → nginx alpine) |
| `api` | Express API (+ migrations on start) |
| `worker` | BullMQ judge worker (Docker socket for sandboxes) |
| `cleanup-worker` | Stuck-queue reaper |
| `postgres` | Source of truth |
| `redis` | BullMQ + cache + rate limits (AOF) |

Dev-only Postgres/Redis/Ollama for host-run apps remains in `docker-compose.yml`.

---

## 2. Environment variables

1. Copy root template:
   ```bash
   cp .env.production.example .env.production
   ```
2. Set at minimum:
   - `POSTGRES_PASSWORD`
   - `JWT_SECRET` (≥32 chars)
   - `CORS_ORIGIN` (public HTTPS origin; **no localhost** in real deploys)
   - `FRONTEND_URL` (same public SPA origin; used in verification / password-reset email links)
3. Optional release metadata: `APP_VERSION`, `GIT_SHA`, `BUILD_TIME` (CI injects these).

### Email links (`FRONTEND_URL`)

Verification and password-reset emails embed absolute frontend URLs built from `FRONTEND_URL` (not the API host):

```bash
FRONTEND_URL=https://judgex.example.com
# Local nginx compose:  FRONTEND_URL=http://localhost
# Local Vite only:      FRONTEND_URL=http://localhost:5173
```

`EMAIL_PROVIDER` defaults to `console` (logs `email_outbound` with the full link). Set `EMAIL_PROVIDER=smtp` plus `SMTP_*` for real delivery; both modes use `FRONTEND_URL`.

### Gmail SMTP

To send real verification / password-reset mail via Gmail:

1. Enable **2-Step Verification** on the Google Account.
2. Create an **App Password** (Google Account → Security → App passwords → Mail). Do **not** use the account’s normal password.
3. Set:

```bash
EMAIL_PROVIDER=smtp
EMAIL_FROM=JudgeX <your.address@gmail.com>
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your.address@gmail.com
SMTP_PASS=your-16-char-app-password
FRONTEND_URL=https://judgex.example.com
```

Incomplete SMTP config logs a startup warning and falls back to console (the API still boots). SMTP passwords are never logged. Keep `EMAIL_PROVIDER=console` for local development when you do not need real delivery.

### Local production Docker testing (Vite on localhost)

When running `docker-compose.prod.yml` against a host Vite app (`http://localhost:5173`), keep `NODE_ENV=production` and set:

```bash
CORS_ORIGIN=http://localhost:5173
FRONTEND_URL=http://localhost:5173
ALLOW_LOCALHOST_CORS_IN_PRODUCTION=true
```

For the full nginx stack on port 80, use `CORS_ORIGIN=http://localhost` and `FRONTEND_URL=http://localhost` instead.

`ALLOW_LOCALHOST_CORS_IN_PRODUCTION` defaults to `false`. Without it, production validation still rejects localhost CORS origins. **Never enable this flag on a publicly reachable deployment.**

API-only secrets are also documented in `backend/.env.production.example`.

---

## 3. First deploy

```bash
# Build language sandbox images (once per host)
docker build -t judgex-python:latest docker/images/python
docker build -t judgex-cpp:latest docker/images/cpp

# Bring up the stack
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build

# Tail API logs
docker compose -f docker-compose.prod.yml logs -f api worker
```

Probes:

- Liveness: `GET /health` or `/health/live`
- Readiness: `GET /ready` or `/health/ready`
- Metrics: `GET /metrics`
- Edge: `GET /nginx-health`

---

## 4. HTTPS

Nginx is HTTPS-ready:

1. Place `fullchain.pem` and `privkey.pem` in `docker/nginx/certs/` (or set `NGINX_CERTS_DIR`).
2. Uncomment / enable the TLS `server { listen 443 ... }` block in `docker/nginx/nginx.conf`.
3. Redirect `:80` → `:443`.
4. Ensure `CORS_ORIGIN=https://your.domain`.

Until certs exist, serve HTTP on port 80 (default compose mapping).

---

## 5. Scaling workers

Judge throughput scales with worker replicas **and** host Docker capacity:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production up -d \
  --scale worker=3
```

Notes:

- Each worker needs Docker socket access.
- Tune `JUDGE_WORKER_CONCURRENCY` carefully (CPU/memory for sandboxes).
- API instances can also be scaled behind nginx (`--scale api=2`) once sticky sessions are unnecessary (JWT is already stateless).

Rolling update example:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --no-deps --build api worker
```

API uses `tini` + `SIGTERM`; compose `stop_grace_period` allows in-flight drains.

---

## 6. Backups & disaster recovery

### PostgreSQL (required)

```bash
chmod +x scripts/backup/*.sh
./scripts/backup/backup-db.sh
# restore (destructive):
./scripts/backup/restore-db.sh backups/postgres/judgex-judgex-YYYYMMDDTHHMMSSZ.sql.gz
```

Rotation: `RETAIN_DAYS` (default 14) deletes older gzip dumps.

Schedule via cron:

```cron
15 2 * * * cd /opt/judgex && ./scripts/backup/backup-db.sh >> /var/log/judgex-backup.log 2>&1
```

### Redis

See `scripts/backup/REDIS.md`. AOF is enabled (`appendonly yes`). Postgres is authoritative for submissions; Redis loss is recoverable via the reaper.

---

## 7. Monitoring

- Prometheus scrape: `/metrics` (restrict network exposure in real deployments).
- Admin Overview → **Platform monitoring** (15s refresh): DB/Redis/BullMQ/worker/Docker, queue depth, recent failures, release version.
- Structured logs: JSON in production (`LOG_FORMAT=json`); request IDs via `X-Request-ID`.

---

## 8. Release metadata

Build args / env:

| Variable | Where |
|----------|--------|
| `APP_VERSION` / `VITE_APP_VERSION` | `/health`, admin monitoring, footer |
| `GIT_SHA` / `VITE_GIT_SHA` | `/health.build.gitSha`, footer short SHA |
| `BUILD_TIME` / `VITE_BUILD_TIME` | `/health.build.buildTime` |

Generate locally:

```bash
cd backend && eval "$(npm run build:info --silent -- --export)"
```

CI (`.github/workflows/ci.yml`) builds frontend with commit SHA metadata.

---

## 9. Troubleshooting

| Symptom | Check |
|---------|--------|
| API unhealthy | `docker compose ... logs api`; `/ready` checks; migrations |
| Jobs stuck queued | Worker logs + Docker socket; cleanup-worker reaper |
| CORS errors | `CORS_ORIGIN` must match browser origin exactly; for local Vite + prod compose set `ALLOW_LOCALHOST_CORS_IN_PRODUCTION=true` |
| 413 / large body | nginx `client_max_body_size` + `JSON_BODY_LIMIT` |
| Redis AOF growth | Monitor volume size; ephemeral keys are short-lived |
| Judge can't start containers | Socket mount, image tags `judgex-python` / `judgex-cpp` |

---

## 10. CI

GitHub Actions (`.github/workflows/ci.yml`) on `pull_request` and `push` to `main`:

1. Frontend lint + build  
2. Backend lint (syntax)  
3. Backend unit tests  
4. Backend integration tests (Postgres + Redis services)

Jobs fail fast (`concurrency` cancels stale runs). npm caches use lockfiles.
