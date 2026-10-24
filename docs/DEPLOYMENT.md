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
| `migrate` | One-shot `node scripts/migrate.js`. Exits when pending SQL migrations are applied. Not an API replica |
| `api` | Express API. Starts only after `migrate` exits 0. Does not run migrations itself |
| `worker` | BullMQ judge worker (Docker socket for sandboxes). Starts only after `migrate` exits 0 |
| `cleanup-worker` | Stuck-queue reaper. Starts only after `migrate` exits 0 |
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

`EMAIL_PROVIDER=console` writes the message to `backend/.local-mailbox/latest.txt` in development and does not email it. The API log records the recipient and subject, not the link. `EMAIL_PROVIDER=smtp` submits to the configured server. A successful SMTP response means the server accepted the message, not that an inbox received it. Both modes build links from `FRONTEND_URL` and put the token in the URL fragment.

Signed-in verification resend returns HTTP 503 when delivery fails and does not mark the account verified. Public verification resend stays generic. Forgot-password also stays generic: HTTP 200 and “If an account exists for that email, a password reset message has been requested.” A failed send rolls the new reset token back. The response does not say the link was sent and does not reveal whether the address exists.

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

If `EMAIL_PROVIDER=smtp` and `EMAIL_FROM`, `SMTP_HOST`, `SMTP_USER`, or `SMTP_PASS` is missing, the process exits at startup. It does not fall back to console. Connection, authentication, recipient, and timeout failures return HTTP 503 on the signed-in resend route with a generic message; the API log records a redacted error and never the password, raw token, or full verification URL. Keep `EMAIL_PROVIDER=console` for local development. Use the SMTP test (`npm run test:smtp`) instead of a live mailbox when checking the transport. Production requires `EMAIL_PROVIDER=smtp` with those settings.

### Local production Compose is not the public site

`docker-compose.prod.yml` (project `judgex-prod`) on this machine is a second local stack. `http://localhost` is Nginx in that stack. The API container is `judgex-prod-api` and does not publish port 4000. Postgres is `judgex-prod-postgres`, with no host port, on the volume `judgex_pgdata`. It is not `judgex-postgres` on host port 5432, and it is not a publicly deployed website. Development stays on `http://localhost:5173` and `http://localhost:4000`.

### Optional: production Compose with the host Vite app

This is not the default local production layout. When running `docker-compose.prod.yml` against a host Vite app (`http://localhost:5173`), keep `NODE_ENV=production` and set:

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

# Build images, apply migrations, then start the stack.
# `up` waits until Postgres is healthy, runs the one-shot `migrate` service
# to completion, and only then starts api, worker, and cleanup-worker.
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build

# Tail API logs
docker compose -f docker-compose.prod.yml logs -f api worker
```

`migrate` uses the API image and runs `node scripts/migrate.js` once. The runner applies `backend/src/infrastructure/database/migrations/*.sql` in filename order and records each id in `schema_migrations`. A file that is already recorded is skipped, so a later deploy can run the same service again.

If `migrate` exits non-zero, Compose does not start the API. The API healthcheck (`GET /ready`) therefore never passes, and nginx does not become ready. API replicas do not apply migrations themselves, including when the API is scaled.

### Later deploys

`docker compose up -d --build` recreates `migrate` when the API image changes, then waits for that one-shot container to exit 0 before replacing the API. `--no-deps` skips that wait. Use it only to recreate `api` and `frontend` when the new image has no new SQL, as described in the README. If the image adds a migration, do not roll the API forward with `--no-deps`; the new process can start before the SQL is applied.

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build migrate api worker cleanup-worker
```

To re-run migrations against an unchanged image (still idempotent):

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --force-recreate --no-deps migrate
docker compose -f docker-compose.prod.yml --env-file .env.production up -d
```

The second command waits for the recreated `migrate` container to exit 0 before it treats the API as ready.

Probes:

- Liveness: `GET /health` or `/health/live`
- Readiness: `GET /ready` or `/health/ready`
- Metrics: not on the public edge. Nginx returns `404` for `GET /metrics`. Scrape `http://api:4000/metrics` from the Compose network. The `api` service does not publish that port.
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
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build migrate api worker
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

- Prometheus scrape: `http://api:4000/metrics` from the Compose network only. The public Nginx listener returns `404` for `/metrics` and does not proxy it. There is no Prometheus service in this repository.
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
| API never becomes healthy | `docker compose ... logs migrate`; a non-zero migrate exit blocks API startup. Then `/ready` |
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
