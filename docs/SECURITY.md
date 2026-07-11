# JudgeX Security

Production hardening notes for the API (Sprint 32). Feature modules (judge, contests, AI, discussions, admin UI) are unchanged; controls live in middleware and config.

## Authentication model & CSRF

- Access control uses **stateless JWT** in the `Authorization: Bearer` header.
- Browsers do **not** attach custom Authorization headers on cross-site form posts, so classic CSRF against cookie sessions does not apply to the MVP auth model.
- CORS is an explicit allow-list (`CORS_ORIGIN`). Credentials are enabled for forward-compatible cookie auth; until httpOnly refresh cookies ship, CSRF tokens are not required.
- If refresh cookies are added later, introduce double-submit or synchronizer CSRF tokens before enabling cookie-based mutating requests.

## Rate limiting

Redis fixed-window counters (`rl:{tier}:{subject}`):

| Tier | Default | Keyed by | Applied to |
|------|---------|----------|------------|
| `auth` | 10 / min | IP | `POST /auth/login`, `POST /auth/register` |
| `submission` | 60 / min | user | `POST /submissions` only (GETs unscoped for polling) |
| `ai` | 20 / min | user | all `POST /ai/*` |
| `admin` | 120 / min | user | all `/admin/*` |
| `contestJoin` | 15 / min | user | `POST /contests/:id/join` |
| `problems` | 240 / min | IP | public problem/discussion reads & creates |

Exceeding a limit returns `429 RATE_LIMITED` with `Retry-After` and `X-RateLimit-*` headers. Auth/admin fail closed if Redis is down; submission/AI fail open so judge throughput is preserved.

Disable only outside production: `RATE_LIMIT_ENABLED=false`. Tests skip limiting unless `RATE_LIMIT_FORCE_IN_TEST=true`.

## Security headers (Helmet)

- CSP: `default-src 'none'`, `frame-ancestors 'none'`
- `X-Frame-Options: DENY`
- `Referrer-Policy: no-referrer`
- Permissions-Policy: camera/mic/geo/payment disabled
- HSTS enabled in production
- `Cross-Origin-Resource-Policy: cross-origin` (SPA on a separate origin)

## Secrets & env

All secrets are validated via `backend/src/config/env.schema.js` + `production.js`. Required production variables are listed in `backend/.env.production.example`. Never commit real `.env` files.

## Security logging

Structured `security:*` warn events (no passwords/tokens):

- `failed_login`
- `permission_denied`
- `rate_limited`
- `security_violation` (CORS reject, unauthenticated, oversized payload)
- Admin mutations continue to write `audit_logs` (Sprint 31)

## Input validation

Zod at the route boundary: UUIDs, pagination bounds, allow-listed sort fields, markdown/source size caps, and `JSON_BODY_LIMIT` (default `1mb`) for body-parser.
