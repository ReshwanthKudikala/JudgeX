# JudgeX Security

Production hardening notes for the API (Sprint 32). Feature modules (judge, contests, AI, discussions, admin UI) are unchanged; controls live in middleware and config.

## Authentication model & CSRF

- Access control uses **stateless JWT** in the `Authorization: Bearer` header. Password change and reset increment `token_version`, so older access tokens fail the database check.
- Email verification and password-reset tokens are 32 random bytes, stored as SHA-256, and single-use. Verification lasts 24 hours and is consumed under `SELECT … FOR UPDATE`. Reset lasts 30 minutes. Reuse is rejected by an update that succeeds only while `used_at` is null, and a successful reset increments `token_version`, which invalidates older access tokens. An account is marked verified in the same transaction that consumes a still-unused verification token.
- Browsers do **not** attach custom Authorization headers on cross-site form posts, so classic CSRF against cookie sessions does not apply to the MVP auth model.
- CORS is an explicit allow-list (`CORS_ORIGIN`). Credentials are enabled for forward-compatible cookie auth; until httpOnly refresh cookies ship, CSRF tokens are not required.
- If refresh cookies are added later, introduce double-submit or synchronizer CSRF tokens before enabling cookie-based mutating requests.

## Rate limiting

Redis fixed-window counters (`rl:{tier}:{subject}`):

| Tier | Default | Keyed by | Applied to |
|------|---------|----------|------------|
| `auth` | 10 / min | IP | login, register, verify-email, reset-password, change-password |
| `submission` | 60 / min | user | `POST /submissions` and `POST /code/run` (GETs unscoped for polling) |
| `ai` | 20 / min | user | all `POST /ai/*` |
| `admin` | 120 / min | user | all `/admin/*` |
| `contestJoin` | 15 / min | user | `POST /contests/:id/join` |
| `problems` | 240 / min | IP | public problem/discussion reads and creates |
| `forgotPassword` | 5 / 15 min | IP | `POST /auth/forgot-password` |
| `resendVerification` | 5 / 15 min | IP | public and signed-in resend |

Exceeding a limit returns `429 RATE_LIMITED` with `Retry-After` and `X-RateLimit-*` headers. Auth, admin, forgot-password, and resend fail closed if Redis is down: the API returns the same `429 RATE_LIMITED` code with `Retry-After`, and it does not set the `X-RateLimit-*` count headers. Submission, AI, problems, and contest join fail open so judge throughput is preserved. A signed-in verification resend also waits 60 seconds before replacing an unused token. Public forgot-password and public verification resend return one HTTP 200 body for an unknown address, a suspended account, a successful request, and a delivery failure, so the response does not reveal whether the account exists. A failed send rolls back the new token and does not leave it usable. The profile resend alert keeps rate-limit and expired-session text unchanged. It appends “You can try again.” once, and only for a delivery failure, missing email configuration, a network failure, or another HTTP 5xx response.

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

Both applications resolve `zod@4.6.7`, which includes the [GHSA-mrhx-c7xc-m3w5](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5) fix for unbounded memory growth while validating oversized arrays. Request bodies remain capped by `JSON_BODY_LIMIT` (default `1mb`).
