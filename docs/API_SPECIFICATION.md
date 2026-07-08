# JudgeX — REST API Specification

> **Companion to (only sources of truth):** `docs/PRD.md`, `docs/ARCHITECTURE.md`, `docs/DATABASE_DESIGN.md`, `docs/BACKEND_STRUCTURE.md`
> **Document Type:** API Contract (the "external interface")
> **Style:** Production SaaS REST API (JSON over HTTPS). **No GraphQL.**
> **Status:** Draft v1.0
> **Base URL:** `https://api.judgex.app`
> **Base Path:** `/api/v1`
> **Last Updated:** 2026-07-08

> **Scope of this document:** the API *contract* only. It contains **no implementation code, no Express routes, no controllers, no SQL, and no database models**. Request/response bodies are illustrative JSON shapes describing the contract, not code.

> **Consistency note:** every endpoint here maps to a module in `BACKEND_STRUCTURE.md` §5, respects the data model in `DATABASE_DESIGN.md`, and honors the flows/invariants in `ARCHITECTURE.md` (persist-before-enqueue, hidden-test protection, guarded AI). MVP scope follows `PRD.md`: languages **Python & C++**, AI = **compile-error explanation only**, leaderboard **in MVP**.

---

## Table of Contents

1. [API Design Philosophy](#1-api-design-philosophy)
2. [Authentication APIs](#2-authentication-apis)
3. [Problem APIs](#3-problem-apis)
4. [Submission APIs](#4-submission-apis)
5. [Leaderboard APIs](#5-leaderboard-apis)
6. [Admin APIs](#6-admin-apis)
7. [AI APIs (MVP vs Future)](#7-ai-apis-mvp-vs-future)
8. [Common Response Format](#8-common-response-format)
9. [Error Codes](#9-error-codes)
10. [Pagination, Sorting, Filtering, Searching](#10-pagination-sorting-filtering-searching)
11. [Security](#11-security)
12. [API Versioning Strategy](#12-api-versioning-strategy)
13. [Sequence Examples](#13-sequence-examples)
14. [Interview Questions](#14-interview-questions)
15. [Endpoint Summary Table (Quick Reference)](#15-endpoint-summary-table-quick-reference)

---

## 1. API Design Philosophy

### 1.1 REST Principles
- **Resource-oriented:** URLs name **nouns** (resources), HTTP methods express **verbs**. Collections are plural (`/problems`, `/submissions`).
- **Correct method semantics:**
  - `GET` — safe, idempotent reads.
  - `POST` — create / non-idempotent actions (submit, run, login).
  - `PUT`/`PATCH` — full/partial update.
  - `DELETE` — remove (soft-delete server-side per `DATABASE_DESIGN.md` §1.5).
- **Proper status codes** (see §8/§9), never `200` for everything.
- **HATEOAS-lite:** we return related IDs and pagination links but do not over-engineer hypermedia (pragmatic SaaS style).

### 1.2 Resource Naming
- Plural, lowercase, hyphenless nouns: `/problems`, `/submissions`, `/leaderboard`, `/tags`.
- Sub-resources nest under their parent: `/problems/{slug}/submissions`, `/admin/problems/{id}/test-cases`.
- Actions that aren't CRUD use a **verb sub-path on the resource** sparingly: `/code/run`, `/submissions/{id}/status`, `/auth/login`. This keeps the surface predictable without RPC sprawl.
- **Identifiers:** problems are addressed publicly by **`slug`**; all other entities by **UUID v7 `id`** (per `DATABASE_DESIGN.md` §1.4). UUIDs are non-enumerable, protecting against IDOR probing.

### 1.3 Versioning Strategy (summary; full detail §12)
- **URI versioning:** `/api/v1/...`. Simple, cache-friendly, unambiguous for a SaaS product. Breaking changes → `/api/v2`; additive changes stay in `v1`.

### 1.4 Stateless Design
- **No server session state.** Every request carries a **JWT** (`Authorization: Bearer <token>`); any API instance can serve any request (`ARCHITECTURE.md` §7, `BACKEND_STRUCTURE.md` §1). This is what makes horizontal scaling trivial.
- Idempotency/state lives in Postgres/Redis, not in-process.

### 1.5 Error Consistency
- **One envelope for everything** (§8): the same `success`, `data`, `error`, `meta` shape on every response, success or failure.
- **Stable machine-readable `error.code`** (§9) that clients switch on — messages are for humans and may change; codes do not.
- Every response carries a **`correlationId`** (echoing `BACKEND_STRUCTURE.md` §8.3) for support/tracing.

### 1.6 Conventions
- **Content type:** `application/json` for requests and responses.
- **Timestamps:** ISO-8601 UTC strings (`2026-07-08T13:20:00Z`), per `DATABASE_DESIGN.md` §1.6.
- **Casing:** `camelCase` JSON fields.
- **Auth header:** `Authorization: Bearer <accessToken>`.
- **Correlation:** clients may send `X-Correlation-Id`; the server generates one if absent and returns it.

---

## 2. Authentication APIs

Base: `/api/v1/auth`. Backed by the **Auth Module** (`BACKEND_STRUCTURE.md` §5.1) and `users` table. Auth endpoints are **rate-limited more strictly** (§11).

### 2.1 Register — `POST /auth/register` — Auth: No `[MVP]`
- **Request body:**
```json
{ "username": "ada", "email": "ada@example.com", "password": "S3cure!pass" }
```
- **Response body (201):**
```json
{
  "success": true,
  "data": {
    "user": { "id": "uuid", "username": "ada", "email": "ada@example.com", "role": "user", "createdAt": "2026-07-08T13:20:00Z" },
    "accessToken": "jwt"
  },
  "error": null,
  "meta": { "correlationId": "..." }
}
```
- **Status codes:** `201 Created`, `400` (validation), `409` (email/username taken), `429`, `500`.
- **Possible errors:** `VALIDATION_ERROR`, `EMAIL_ALREADY_EXISTS`, `USERNAME_ALREADY_EXISTS`, `RATE_LIMITED`.

### 2.2 Login — `POST /auth/login` — Auth: No `[MVP]`
- **Request body:**
```json
{ "emailOrUsername": "ada@example.com", "password": "S3cure!pass" }
```
- **Response body (200):**
```json
{ "success": true, "data": { "user": { "id": "uuid", "username": "ada", "role": "user" }, "accessToken": "jwt" }, "error": null, "meta": { "correlationId": "..." } }
```
- **Status codes:** `200`, `400`, `401` (bad credentials), `429`, `500`.
- **Possible errors:** `VALIDATION_ERROR`, `INVALID_CREDENTIALS`, `RATE_LIMITED`.
- **Note:** identical response/timing for "user not found" vs "wrong password" (no user enumeration).

### 2.3 Current User — `GET /auth/me` — Auth: Yes `[MVP]`
- **Request:** no body; JWT required.
- **Response body (200):**
```json
{ "success": true, "data": { "id": "uuid", "username": "ada", "email": "ada@example.com", "role": "user", "createdAt": "..." }, "error": null, "meta": { "correlationId": "..." } }
```
- **Status codes:** `200`, `401` (missing/expired token), `500`.
- **Possible errors:** `UNAUTHENTICATED`, `TOKEN_EXPIRED`.

### 2.4 Logout — `POST /auth/logout` — Auth: Yes `[V1]`
- **Purpose:** invalidate the current session/refresh token. In MVP (stateless short-lived access token) this is a client-side token discard; server-side invalidation arrives with refresh tokens (`ARCHITECTURE.md` §7.1, `PRD` `FR-AUTH-9`).
- **Response body (200):** `{ "success": true, "data": { "loggedOut": true }, "error": null, "meta": {...} }`
- **Status codes:** `200`, `401`, `500`.

### 2.5 Refresh Token — `POST /auth/refresh` — Auth: Refresh cookie/token `[Future / V1]`
- **Purpose:** exchange a valid refresh token for a new access token (rotation). Backed by a future `refresh_tokens` table (`DATABASE_DESIGN.md` §9.6).
- **Request body:** `{ "refreshToken": "..." }` (or httpOnly cookie).
- **Response body (200):** `{ "success": true, "data": { "accessToken": "jwt" }, "error": null, "meta": {...} }`
- **Status codes:** `200`, `401` (invalid/expired/revoked refresh), `500`.
- **Possible errors:** `INVALID_REFRESH_TOKEN`, `REFRESH_TOKEN_REVOKED`.

### 2.6 Password Reset — `POST /auth/forgot-password` & `POST /auth/reset-password` — Auth: No `[Future]`
- **Purpose:** email-based reset (`PRD` `FR-AUTH-7`). `forgot-password` accepts `{ email }` and always returns `200` (no enumeration); `reset-password` accepts `{ token, newPassword }`.
- **Status codes:** `200`, `400`, `410` (expired reset token), `500`.
- **Possible errors:** `VALIDATION_ERROR`, `RESET_TOKEN_INVALID`, `RESET_TOKEN_EXPIRED`.

### 2.7 Google OAuth — `GET /auth/google` & `GET /auth/google/callback` — Auth: No `[Future]`
- **Purpose:** OAuth sign-in (`PRD` `FR-AUTH-8`, `DATABASE_DESIGN.md` §9.5). Redirect-based flow; callback issues JWT like login.
- **Status codes:** `302` (redirects), `200` (final token), `401` (OAuth failure), `500`.

---

## 3. Problem APIs

Base: `/api/v1/problems`. Backed by the **Problems Module** (`BACKEND_STRUCTURE.md` §5.2). Reads are Redis-cached (`ARCHITECTURE.md` §2.2). **Hidden test cases are never returned** on any endpoint here (`DATABASE_DESIGN.md` §10.5).

### 3.1 List / Search / Filter Problems — `GET /problems` — Auth: Optional `[MVP]`
Combines listing, searching, filtering, tags, difficulty via query params (see §10).
- **Query params:** `page`, `limit`, `sort`, `q` (keyword), `difficulty` (`easy|medium|hard`), `tags` (csv), `status` (`solved|attempted|unsolved` — requires auth).
- **Response body (200):**
```json
{
  "success": true,
  "data": [
    { "id": "uuid", "slug": "two-sum", "title": "Two Sum", "difficulty": "easy",
      "tags": ["arrays", "hash-map"], "acceptanceRate": 48.5, "solvedByMe": true }
  ],
  "error": null,
  "meta": { "correlationId": "...", "pagination": { "page": 1, "limit": 20, "total": 137, "totalPages": 7 } }
}
```
- **Status codes:** `200`, `400` (bad query), `429`, `500`.
- **Notes:** `solvedByMe`/`status` filter only populated when authenticated; otherwise omitted. Supported by indexes in `DATABASE_DESIGN.md` §6 (`idx_problems_published`, `idx_problems_difficulty`, trigram, tag index).

### 3.2 Problem Details — `GET /problems/{slug}` — Auth: Optional `[MVP]`
- **Response body (200):**
```json
{
  "success": true,
  "data": {
    "id": "uuid", "slug": "two-sum", "title": "Two Sum", "difficulty": "easy",
    "statement": "…markdown…", "constraints": "…",
    "timeLimitMs": 2000, "memoryLimitMb": 256,
    "tags": ["arrays", "hash-map"],
    "examples": [ { "input": "…", "output": "…", "explanation": "…" } ],
    "publicTestCases": [ { "input": "…", "expectedOutput": "…" } ],
    "acceptanceRate": 48.5, "totalSubmissions": 10432, "solvedByMe": false
  },
  "error": null, "meta": { "correlationId": "..." }
}
```
- **Status codes:** `200`, `404` (not found / unpublished / soft-deleted), `429`, `500`.
- **Possible errors:** `PROBLEM_NOT_FOUND`.
- **Note:** only `examples` + `publicTestCases` are exposed; hidden cases are excluded by contract.

### 3.3 List Tags — `GET /tags` — Auth: No `[MVP]`
- **Purpose:** the tag vocabulary for filter UIs (reference data, cached).
- **Response body (200):** `{ "success": true, "data": [ { "id": "uuid", "name": "arrays" } ], "error": null, "meta": {...} }`
- **Status codes:** `200`, `500`.

### 3.4 Problem Submission Feed — `GET /problems/{slug}/submissions` — Auth: Yes `[MVP]`
- **Purpose:** the current user's submissions for this problem (problem-page feed), served by `idx_submissions_user_problem_created` (`DATABASE_DESIGN.md` §6).
- **Query params:** pagination (§10).
- **Response body (200):** list of submission summaries (see §4.4 shape).
- **Status codes:** `200`, `401`, `404`, `500`.

---

## 4. Submission APIs

Base: `/api/v1`. Backed by the **Submission Module** (`BACKEND_STRUCTURE.md` §5.3). Implements **persist-before-enqueue** and async judging (`ARCHITECTURE.md` §3). All require authentication and are rate-limited.

### 4.1 Create Submission (Submit) — `POST /submissions` — Auth: Yes `[MVP]`
- **Request body:**
```json
{ "problemId": "uuid", "language": "cpp", "sourceCode": "…" }
```
- **Response body (202 Accepted):**
```json
{
  "success": true,
  "data": { "submissionId": "uuid", "status": "queued", "submittedAt": "2026-07-08T13:20:00Z" },
  "error": null, "meta": { "correlationId": "..." }
}
```
- **Status codes:** `202 Accepted` (queued, judged async), `400` (validation), `401`, `404` (problem missing/unpublished), `409` (duplicate in-flight, optional), `413` (code too large), `429`, `503` (queue/Redis down), `500`.
- **Possible errors:** `VALIDATION_ERROR`, `UNSUPPORTED_LANGUAGE`, `SOURCE_TOO_LARGE`, `PROBLEM_NOT_FOUND`, `RATE_LIMITED`, `JUDGING_UNAVAILABLE`.
- **Notes:** `language ∈ {python, cpp}` (MVP). Returns immediately; client polls status (§4.3). `503 JUDGING_UNAVAILABLE` when enqueue can't happen (Redis down, `ARCHITECTURE.md` §12).

### 4.2 Run Code (fast feedback, not scored) — `POST /code/run` — Auth: Yes `[MVP]`
- **Purpose:** run against **public/sample cases** (+ optional custom stdin); **not persisted as a submission** (`ARCHITECTURE.md` §2.3, `DATABASE_DESIGN.md` §2 note).
- **Request body:**
```json
{ "problemId": "uuid", "language": "python", "sourceCode": "…", "customInput": "optional" }
```
- **Response body (202):** `{ "success": true, "data": { "runId": "uuid", "status": "queued" }, "error": null, "meta": {...} }`
- **Run result — `GET /code/run/{runId}` — Auth: Yes:**
```json
{ "success": true, "data": {
    "runId": "uuid", "status": "completed",
    "results": [ { "input": "…", "expectedOutput": "…", "actualOutput": "…", "passed": true, "runtimeMs": 12 } ]
  }, "error": null, "meta": {...} }
```
- **Status codes:** `202`, `200` (result), `400`, `401`, `404`, `429`, `503`, `500`.
- **Notes:** transient result (cached briefly in Redis), never written to `submissions`.

### 4.3 Submission Status — `GET /submissions/{id}/status` — Auth: Yes (owner) `[MVP]`
- **Purpose:** lightweight polling of lifecycle (`queued → running → <verdict>`).
- **Response body (200):**
```json
{ "success": true, "data": {
    "submissionId": "uuid", "status": "completed", "verdict": "accepted",
    "runtimeMs": 88, "memoryKb": 20480, "failedTestIndex": null, "judgedAt": "…"
  }, "error": null, "meta": {...} }
```
- **Status codes:** `200`, `401`, `403` (not owner), `404`, `500`.
- **Possible errors:** `UNAUTHENTICATED`, `FORBIDDEN`, `SUBMISSION_NOT_FOUND`.

### 4.4 Submission History — `GET /submissions` — Auth: Yes `[MVP]`
- **Purpose:** the current user's submissions (global), optionally filtered by `problemId`.
- **Query params:** `page`, `limit`, `sort` (default `submittedAt desc`), `problemId`, `verdict`, `language` (§10). Served by `idx_submissions_user_created` / `idx_submissions_user_problem_created`.
- **Response body (200):**
```json
{ "success": true, "data": [
    { "submissionId": "uuid", "problemSlug": "two-sum", "language": "cpp",
      "status": "completed", "verdict": "wrong_answer", "runtimeMs": 40, "memoryKb": 15000, "submittedAt": "…" }
  ], "error": null, "meta": { "correlationId": "...", "pagination": {...} } }
```
- **Status codes:** `200`, `401`, `400`, `500`.

### 4.5 Submission Details — `GET /submissions/{id}` — Auth: Yes (owner) `[MVP]`
- **Purpose:** full detail incl. the user's own source code, verdict, metrics, and per-case outcomes (**indexes/metrics only — never hidden I/O**, `DATABASE_DESIGN.md` §3.8).
- **Response body (200):**
```json
{ "success": true, "data": {
    "submissionId": "uuid", "problem": { "slug": "two-sum", "title": "Two Sum" },
    "language": "cpp", "sourceCode": "…", "status": "completed", "verdict": "wrong_answer",
    "runtimeMs": 40, "memoryKb": 15000, "failedTestIndex": 7,
    "compileOutput": null,
    "testResults": [ { "testIndex": 1, "status": "accepted", "runtimeMs": 10 }, { "testIndex": 7, "status": "wrong_answer" } ],
    "submittedAt": "…", "judgedAt": "…"
  }, "error": null, "meta": {...} }
```
- **Status codes:** `200`, `401`, `403` (not owner), `404`, `500`.
- **Note:** `compileOutput` is populated only for `compile_error` verdicts (feeds the AI explanation, §7).

---

## 5. Leaderboard APIs

Base: `/api/v1/leaderboard`. Backed by the **Leaderboard Module** (`BACKEND_STRUCTURE.md` §5.5), reading `user_statistics`/materialized view, Redis-fronted (`DATABASE_DESIGN.md` §3.9/§5.6). **In MVP** per `PRD`.

### 5.1 Global Leaderboard — `GET /leaderboard` — Auth: Optional `[MVP]`
- **Query params:** `page`, `limit` (§10).
- **Response body (200):**
```json
{ "success": true, "data": [
    { "rank": 1, "userId": "uuid", "username": "ada", "problemsSolved": 312, "acceptanceRate": 71.2 }
  ], "error": null, "meta": { "correlationId": "...", "pagination": {...} } }
```
- **Status codes:** `200`, `400`, `429`, `500`.
- **Notes:** ranking = problems solved, then acceptance rate, then recency (`DATABASE_DESIGN.md` §3.9). May be slightly stale (cache/matview) by design.

### 5.2 Problem-Specific Leaderboard — `GET /problems/{slug}/leaderboard` — Auth: Optional `[Future]`
- **Purpose:** fastest/most-efficient accepted submissions for a problem (ranked by runtime/memory). Marked **Future** (contest-adjacent; MVP leaderboard is global-only per `PRD`).
- **Status codes:** `200`, `404`, `500`.

### 5.3 User Statistics — `GET /users/{username}/statistics` — Auth: Optional `[MVP]`
- **Purpose:** a user's public stats (profile page): problems solved, acceptance rate, totals.
- **Response body (200):**
```json
{ "success": true, "data": {
    "username": "ada", "problemsSolved": 312, "totalSubmissions": 980,
    "totalAccepted": 698, "acceptanceRate": 71.2, "lastSolvedAt": "…"
  }, "error": null, "meta": {...} }
```
- **Status codes:** `200`, `404` (unknown user), `500`.

---

## 6. Admin APIs

Base: `/api/v1/admin`. Backed by the **Admin Module** (`BACKEND_STRUCTURE.md` §5.6). **All require Auth: Admin (RBAC)** — `authenticate` + `authorize('admin')`. Writes are transactional (`DATABASE_DESIGN.md` §7). All admin endpoints can return `401` (unauthenticated), `403` (`FORBIDDEN` — not admin), and `500`.

### 6.1 Create Problem — `POST /admin/problems` — Auth: Admin `[MVP]`
- **Request body:**
```json
{ "slug": "two-sum", "title": "Two Sum", "statement": "…", "constraints": "…",
  "difficulty": "easy", "timeLimitMs": 2000, "memoryLimitMb": 256,
  "tags": ["arrays"], "isPublished": false }
```
- **Response body (201):** the created problem (as §3.2, admin view includes `isPublished`).
- **Status codes:** `201`, `400`, `409` (`SLUG_ALREADY_EXISTS`), `401`, `403`, `500`.

### 6.2 Update Problem — `PATCH /admin/problems/{id}` — Auth: Admin `[MVP]`
- **Request body:** any subset of editable fields.
- **Status codes:** `200`, `400`, `404`, `409`, `401`, `403`, `500`.

### 6.3 Delete Problem — `DELETE /admin/problems/{id}` — Auth: Admin `[MVP]`
- **Purpose:** **soft delete** (`DATABASE_DESIGN.md` §1.5/§7.2); submissions preserved.
- **Response body (200):** `{ "success": true, "data": { "id": "uuid", "deleted": true }, "error": null, "meta": {...} }`
- **Status codes:** `200`, `404`, `401`, `403`, `500`.

### 6.4 Manage Test Cases — Auth: Admin `[MVP]`
Base: `/admin/problems/{id}/test-cases`. Hidden + public; large payloads may reference object storage (`DATABASE_DESIGN.md` §3.6).
- **List:** `GET /admin/problems/{id}/test-cases` → all cases incl. hidden (admin-only).
- **Add:** `POST /admin/problems/{id}/test-cases`
```json
{ "isHidden": true, "input": "…", "expectedOutput": "…", "displayOrder": 3 }
```
- **Update:** `PATCH /admin/problems/{id}/test-cases/{testCaseId}`
- **Delete:** `DELETE /admin/problems/{id}/test-cases/{testCaseId}`
- **Bulk replace (transactional set):** `PUT /admin/problems/{id}/test-cases` (replaces the whole set atomically, `DATABASE_DESIGN.md` §7.3).
- **Status codes:** `200/201`, `400`, `404`, `401`, `403`, `413` (payload too large), `500`.

### 6.5 Manage Examples — Auth: Admin `[MVP]`
Base: `/admin/problems/{id}/examples`.
- **Add:** `POST` `{ "input": "…", "output": "…", "explanation": "…", "displayOrder": 1 }`
- **Update:** `PATCH /admin/problems/{id}/examples/{exampleId}`
- **Delete:** `DELETE /admin/problems/{id}/examples/{exampleId}`
- **Status codes:** `200/201`, `400`, `404`, `401`, `403`, `500`.

### 6.6 Manage Tags — Auth: Admin `[MVP]`
Base: `/admin/tags`.
- **Create:** `POST /admin/tags` `{ "name": "graphs" }` → `201` / `409` (`TAG_ALREADY_EXISTS`).
- **Delete:** `DELETE /admin/tags/{id}` → cascades associations (`DATABASE_DESIGN.md` §8.2).
- **Assign to problem:** handled via problem `tags` field on create/update (§6.1/§6.2).
- **Status codes:** `200/201`, `400`, `404`, `409`, `401`, `403`, `500`.

### 6.7 Admin Dashboard Stats — `GET /admin/stats` — Auth: Admin `[Future]`
- **Purpose:** platform counts + verdict distribution (`PRD` `FR-ADMIN-7`); precomputed rollups at scale (`DATABASE_DESIGN.md` §10). Marked **Future**.

---

## 7. AI APIs (MVP vs Future)

Base: `/api/v1/ai`. Backed by the **AI Module** (`BACKEND_STRUCTURE.md` §5.7). All AI runs through a single **`AIService`** using a **provider pattern** — **Ollama (local, free, no API key) is the default provider; OpenAI is optional and selected via the `AI_PROVIDER` configuration** (`ARCHITECTURE.md` §9.1). The provider choice is a server-side concern and is **not exposed in the API contract** — request/response shapes are identical regardless of provider, so JudgeX runs and demos with no paid services. **Hard guardrail: never returns a full solution** (three-layer guardrails, `ARCHITECTURE.md` §9). All require auth, are rate-limited (§11), and are a **non-critical path** (failure never affects judging). All AI endpoints can return `503 AI_UNAVAILABLE` if the active provider is down.

### 7.1 Compilation Error Explanation — `POST /ai/explain-compile-error` — Auth: Yes `[MVP]`
- **Purpose:** explain a submission's compiler error in natural language (no solution). Only valid when the submission's verdict is `compile_error`.
- **Request body:** `{ "submissionId": "uuid" }`
- **Response body (200):**
```json
{ "success": true, "data": {
    "submissionId": "uuid",
    "explanation": "The compiler reports a missing semicolon before line 12 …",
    "wasBlocked": false
  }, "error": null, "meta": {...} }
```
- **Status codes:** `200`, `400`, `401`, `403` (not owner), `404`, `409` (`NOT_A_COMPILE_ERROR` — verdict isn't CE), `429`, `503`, `500`.
- **Possible errors:** `NOT_A_COMPILE_ERROR`, `AI_UNAVAILABLE`, `AI_OUTPUT_BLOCKED` (guardrail redaction), `RATE_LIMITED`.

### 7.2 Bug Detection — `POST /ai/detect-bugs` — Auth: Yes `[Future]`
- **Purpose:** point at likely faulty region in the user's own code (never rewrite it). `PRD` Future / advanced AI.

### 7.3 Complexity Analysis — `POST /ai/analyze-complexity` — Auth: Yes `[Future]`
- **Purpose:** describe time/space complexity of the user's approach.

### 7.4 Optimization Suggestions — `POST /ai/suggest-optimizations` — Auth: Yes `[Future]`
- **Purpose:** suggest optimization *directions*, not implementations.

### 7.5 Hint Generation — `POST /ai/generate-hint` — Auth: Yes `[Future]`
- **Purpose:** progressive hints toward the approach; never the solution.

> **MVP vs Future:** Only **7.1 (Compilation Error Explanation)** is MVP. 7.2–7.5 are **Future/Advanced**, added behind the same AI provider port + guardrails and gated by feature flags (`BACKEND_STRUCTURE.md` §7.4, §15). All share the `wasBlocked`/guardrail contract and the 0%-leakage requirement (`PRD` §7.3).

---

## 8. Common Response Format

**Every** response uses one envelope. `data` is populated on success; `error` on failure; `meta` always present.

### 8.1 Success Response
```json
{ "success": true, "data": { "...": "..." }, "error": null,
  "meta": { "correlationId": "c-123", "pagination": { "page": 1, "limit": 20, "total": 137, "totalPages": 7 } } }
```
(`meta.pagination` only on collection endpoints.)

### 8.2 Validation Error (`400`)
```json
{ "success": false, "data": null,
  "error": { "code": "VALIDATION_ERROR", "message": "Invalid request.",
    "details": [ { "field": "email", "issue": "must be a valid email" }, { "field": "password", "issue": "min length 8" } ] },
  "meta": { "correlationId": "c-123" } }
```

### 8.3 Authentication Error (`401`)
```json
{ "success": false, "data": null,
  "error": { "code": "UNAUTHENTICATED", "message": "Authentication required." },
  "meta": { "correlationId": "c-123" } }
```

### 8.4 Authorization Error (`403`)
```json
{ "success": false, "data": null,
  "error": { "code": "FORBIDDEN", "message": "You do not have permission to perform this action." },
  "meta": { "correlationId": "c-123" } }
```

### 8.5 Business Error (`400/404/409/422`)
```json
{ "success": false, "data": null,
  "error": { "code": "PROBLEM_NOT_FOUND", "message": "The requested problem does not exist." },
  "meta": { "correlationId": "c-123" } }
```

### 8.6 Server Error (`500`)
```json
{ "success": false, "data": null,
  "error": { "code": "INTERNAL_ERROR", "message": "Something went wrong. Please try again." },
  "meta": { "correlationId": "c-123" } }
```
(No stack traces or internals leak to clients; the `correlationId` links to server logs — `BACKEND_STRUCTURE.md` §9.1.)

---

## 9. Error Codes

Stable, machine-readable codes clients switch on. Grouped by domain; HTTP status shown for the typical case.

### 9.1 Generic / Cross-cutting
| Code | HTTP | Meaning |
|------|------|---------|
| `VALIDATION_ERROR` | 400 | Request failed schema/format validation. |
| `UNAUTHENTICATED` | 401 | Missing/invalid token. |
| `TOKEN_EXPIRED` | 401 | JWT expired. |
| `FORBIDDEN` | 403 | Authenticated but lacks permission (RBAC). |
| `NOT_FOUND` | 404 | Generic resource missing. |
| `CONFLICT` | 409 | Generic state/uniqueness conflict. |
| `RATE_LIMITED` | 429 | Too many requests. |
| `PAYLOAD_TOO_LARGE` | 413 | Body/source exceeds limit. |
| `INTERNAL_ERROR` | 500 | Unhandled server error. |
| `SERVICE_UNAVAILABLE` | 503 | Dependency down (generic). |

### 9.2 Auth
| Code | HTTP | Meaning |
|------|------|---------|
| `EMAIL_ALREADY_EXISTS` | 409 | Email taken. |
| `USERNAME_ALREADY_EXISTS` | 409 | Username taken. |
| `INVALID_CREDENTIALS` | 401 | Bad login (no enumeration). |
| `INVALID_REFRESH_TOKEN` | 401 | Refresh token invalid. |
| `REFRESH_TOKEN_REVOKED` | 401 | Refresh token revoked. |
| `RESET_TOKEN_INVALID` | 400 | Password reset token invalid. |
| `RESET_TOKEN_EXPIRED` | 410 | Reset token expired. |

### 9.3 Problems / Admin
| Code | HTTP | Meaning |
|------|------|---------|
| `PROBLEM_NOT_FOUND` | 404 | Problem missing/unpublished/deleted. |
| `SLUG_ALREADY_EXISTS` | 409 | Duplicate problem slug. |
| `TAG_ALREADY_EXISTS` | 409 | Duplicate tag name. |
| `TEST_CASE_NOT_FOUND` | 404 | Test case missing. |
| `EXAMPLE_NOT_FOUND` | 404 | Example missing. |

### 9.4 Submissions / Judge
| Code | HTTP | Meaning |
|------|------|---------|
| `UNSUPPORTED_LANGUAGE` | 400 | Language not in {python, cpp} (MVP). |
| `SOURCE_TOO_LARGE` | 413 | Source code exceeds size limit. |
| `SUBMISSION_NOT_FOUND` | 404 | Submission missing. |
| `JUDGING_UNAVAILABLE` | 503 | Cannot enqueue (Redis/queue down). |

### 9.5 AI
| Code | HTTP | Meaning |
|------|------|---------|
| `NOT_A_COMPILE_ERROR` | 409 | Explanation requested on non-CE verdict. |
| `AI_UNAVAILABLE` | 503 | Active AI provider (default Ollama, or optional OpenAI) down/timeout (non-critical path). |
| `AI_OUTPUT_BLOCKED` | 200/422 | Guardrail redacted a would-be solution leak. |

---

## 10. Pagination, Sorting, Filtering, Searching

Consistent conventions across all collection endpoints.

### 10.1 Pagination (offset/page-based)
- **Query:** `page` (default `1`), `limit` (default `20`, max `100`).
- **Response `meta.pagination`:** `{ page, limit, total, totalPages }`.
- **Rationale:** page-based is simple and sufficient for our catalog/history sizes; keyset pagination is a documented future optimization for very deep submission history (aligns with `DATABASE_DESIGN.md` time-ordered indexes).

### 10.2 Sorting
- **Query:** `sort=field:direction` (e.g., `sort=submittedAt:desc`, `sort=difficulty:asc`).
- **Whitelist per resource** (only indexed/safe fields sortable): problems → `difficulty`, `title`, `acceptanceRate`; submissions → `submittedAt`; leaderboard → fixed ranking order.

### 10.3 Filtering
- **Query:** resource-specific whitelisted filters, e.g. problems: `difficulty`, `tags` (csv, AND semantics), `status`; submissions: `problemId`, `verdict`, `language`.
- Backed by the indexes in `DATABASE_DESIGN.md` §6 (partial published index, difficulty index, tag join index).

### 10.4 Searching
- **Query:** `q` — keyword/substring search on problem `title` (trigram GIN index, `DATABASE_DESIGN.md` §6). Case-insensitive; combinable with filters.

### 10.5 Combining
- All four combine in one request, e.g.:
  `GET /problems?q=tree&difficulty=medium&tags=graphs,dfs&sort=acceptanceRate:desc&page=2&limit=20`.

---

## 11. Security

Aligns with `ARCHITECTURE.md` §10, `BACKEND_STRUCTURE.md` §11/§12, `PRD` NFR-SEC.

### 11.1 JWT
- Access via `Authorization: Bearer <jwt>`; signed, short-lived, verified statelessly on every protected request. Secret from env (never committed). Refresh/rotation is V1.

### 11.2 Rate Limiting
- Redis-backed per-user/IP limits. **Tiered:** auth endpoints strictest; `POST /submissions`, `POST /code/run`, and all `/ai/*` limited to protect judge/AI capacity and cost. Exceeding → `429 RATE_LIMITED` with `Retry-After`.

### 11.3 Input Validation
- Every request validated at the boundary (types, sizes, enums like `language`, source-code length) before controllers — four-layer validation (`BACKEND_STRUCTURE.md` §10). Unknown fields stripped (no mass-assignment).

### 11.4 RBAC
- Roles `user` / `admin`. `/admin/*` requires `authenticate` + `authorize('admin')`; ownership checks on submission detail/status (owner-only) — server-side, never trusting the client. Hidden test cases never exposed on user endpoints.

### 11.5 Transport & Misc
- HTTPS only; UUIDs (non-enumerable) for resource IDs; no user enumeration on auth; consistent generic error messages that don't leak existence where sensitive.

---

## 12. API Versioning Strategy

- **URI-based versioning:** all endpoints under `/api/v1`. Chosen for clarity, cacheability, and unambiguous routing in a SaaS product (over header-based versioning, which is harder to discover/test).
- **What stays in `v1` (non-breaking, additive):** new endpoints (e.g., Future AI/contest routes), new optional request fields, new response fields, new optional query params, new error codes. Clients must ignore unknown fields.
- **What triggers `v2` (breaking):** removing/renaming fields, changing types/semantics, changing auth requirements, altering the response envelope.
- **Deprecation policy:** breaking changes ship as `/api/v2` while `/api/v1` remains supported for a documented window; deprecations announced via `Deprecation`/`Sunset` response headers and changelog.
- **Feature gating within a version:** not-yet-GA features (advanced AI, contests) are exposed behind **feature flags** (`BACKEND_STRUCTURE.md` §7.4), so they can be enabled per environment without a version bump.

---

## 13. Sequence Examples

Full request/response examples (headers abbreviated). Envelope per §8.

### 13.1 Login
**Request**
```
POST /api/v1/auth/login
Content-Type: application/json

{ "emailOrUsername": "ada@example.com", "password": "S3cure!pass" }
```
**Response `200`**
```json
{ "success": true,
  "data": { "user": { "id": "3f...uuid", "username": "ada", "role": "user" }, "accessToken": "eyJhbGciOi..." },
  "error": null, "meta": { "correlationId": "c-9a1" } }
```
**Failure `401`**
```json
{ "success": false, "data": null,
  "error": { "code": "INVALID_CREDENTIALS", "message": "Invalid email/username or password." },
  "meta": { "correlationId": "c-9a1" } }
```

### 13.2 Problem Fetch
**Request**
```
GET /api/v1/problems/two-sum
Authorization: Bearer eyJhbGciOi...   (optional)
```
**Response `200`**
```json
{ "success": true,
  "data": { "id": "uuid", "slug": "two-sum", "title": "Two Sum", "difficulty": "easy",
    "statement": "…", "constraints": "…", "timeLimitMs": 2000, "memoryLimitMb": 256,
    "tags": ["arrays","hash-map"],
    "examples": [ { "input": "2 7 11 15\n9", "output": "0 1" } ],
    "publicTestCases": [ { "input": "2 7 11 15\n9", "expectedOutput": "0 1" } ],
    "acceptanceRate": 48.5, "totalSubmissions": 10432, "solvedByMe": false },
  "error": null, "meta": { "correlationId": "c-9a2" } }
```

### 13.3 Create Submission
**Request**
```
POST /api/v1/submissions
Authorization: Bearer eyJhbGciOi...
Content-Type: application/json

{ "problemId": "uuid", "language": "cpp", "sourceCode": "#include<bits/stdc++.h> ..." }
```
**Response `202`**
```json
{ "success": true,
  "data": { "submissionId": "sub-uuid", "status": "queued", "submittedAt": "2026-07-08T13:20:00Z" },
  "error": null, "meta": { "correlationId": "c-9a3" } }
```
**Then poll**
```
GET /api/v1/submissions/sub-uuid/status
Authorization: Bearer eyJhbGciOi...
```
**Response `200` (terminal)**
```json
{ "success": true,
  "data": { "submissionId": "sub-uuid", "status": "completed", "verdict": "accepted",
    "runtimeMs": 88, "memoryKb": 20480, "failedTestIndex": null, "judgedAt": "2026-07-08T13:20:03Z" },
  "error": null, "meta": { "correlationId": "c-9a4" } }
```

### 13.4 Run Code
**Request**
```
POST /api/v1/code/run
Authorization: Bearer eyJhbGciOi...
Content-Type: application/json

{ "problemId": "uuid", "language": "python", "sourceCode": "print(input())", "customInput": "hello" }
```
**Response `202`**
```json
{ "success": true, "data": { "runId": "run-uuid", "status": "queued" }, "error": null, "meta": { "correlationId": "c-9a5" } }
```
**Result `GET /api/v1/code/run/run-uuid` → `200`**
```json
{ "success": true,
  "data": { "runId": "run-uuid", "status": "completed",
    "results": [ { "input": "hello", "expectedOutput": null, "actualOutput": "hello", "passed": true, "runtimeMs": 15 } ] },
  "error": null, "meta": { "correlationId": "c-9a6" } }
```

### 13.5 Leaderboard
**Request**
```
GET /api/v1/leaderboard?page=1&limit=3
```
**Response `200`**
```json
{ "success": true,
  "data": [
    { "rank": 1, "userId": "u1", "username": "ada", "problemsSolved": 312, "acceptanceRate": 71.2 },
    { "rank": 2, "userId": "u2", "username": "linus", "problemsSolved": 298, "acceptanceRate": 66.0 },
    { "rank": 3, "userId": "u3", "username": "grace", "problemsSolved": 290, "acceptanceRate": 69.4 }
  ],
  "error": null, "meta": { "correlationId": "c-9a7", "pagination": { "page": 1, "limit": 3, "total": 5000, "totalPages": 1667 } } }
```

---

## 14. Interview Questions

### "Backend interview questions about this API design"

1. **Why REST over GraphQL here?**
   The domain is a small set of well-defined resources with predictable access patterns; REST is simpler to cache (CDN/Redis), rate-limit, secure, and reason about, with no resolver/N+1 complexity. GraphQL's flexibility isn't needed and adds surface area — explicitly avoided.

2. **Why `202 Accepted` for Create Submission instead of `200/201`?**
   Judging is asynchronous (persist-before-enqueue). `202` communicates "accepted for processing, not yet complete"; the client polls status. It accurately models the queue-based lifecycle.

3. **Why is Run Code separate from Submit, and why doesn't it create a resource?**
   Run is fast feedback against public cases only and is intentionally not persisted (`ARCHITECTURE.md` §2.3). Submit is scored, durable, and produces a `submissions` resource. Separating them keeps semantics and rate limits distinct.

4. **How does the API stay stateless and why does it matter?**
   Every request carries a JWT; no server session. Any instance serves any request, so the API scales horizontally behind a load balancer — the core enabler of the scaling story in `ARCHITECTURE.md` §11.

5. **Why a single response envelope for success and error?**
   Predictability: clients parse one shape, switch on `error.code`, and always get a `correlationId`. It removes per-endpoint special-casing and makes error handling uniform.

6. **Why machine-readable `error.code` in addition to HTTP status?**
   HTTP status is coarse (many 400s differ). Stable codes let clients branch precisely (`EMAIL_ALREADY_EXISTS` vs `VALIDATION_ERROR`) while human messages remain free to change/localize.

7. **How do you prevent hidden test cases from leaking through the API?**
   No user endpoint returns hidden I/O; problem detail exposes only examples + public cases; submission detail returns per-case **status/index/metrics only**. Hidden data is admin/worker-only by contract and service-layer enforcement.

8. **How is IDOR prevented?**
   Non-enumerable UUID v7 IDs plus server-side ownership checks (submission status/detail are owner-only → `403 FORBIDDEN`), and RBAC on `/admin/*`. IDs alone never grant access.

9. **What's your versioning strategy and when do you bump the version?**
   URI versioning (`/api/v1`). Additive changes stay in v1 (clients ignore unknown fields); breaking changes (removed/renamed fields, changed types/auth) go to v2 with a deprecation window and `Sunset` headers.

10. **How do you keep the API backward compatible as features grow?**
    Only additive changes within a version, feature-flag not-yet-GA endpoints (advanced AI, contests), and require clients to tolerate unknown fields. New error codes are additive.

11. **How do you handle a dependency outage (Redis/AI) at the API layer?**
    Graceful, explicit degradation: Submit returns `503 JUDGING_UNAVAILABLE` if it can't enqueue; AI returns `503 AI_UNAVAILABLE` (non-critical path). Reads still work from Postgres/cache. No false success.

12. **Why is the AI explanation gated to compile-error submissions?**
    Product + safety: MVP AI only explains compiler errors, and only for the user's own CE submission. Requesting it otherwise returns `409 NOT_A_COMPILE_ERROR`. Guardrails ensure no solution leakage (`AI_OUTPUT_BLOCKED`).

13. **How do pagination/sorting/filtering avoid becoming a performance or injection risk?**
    Whitelisted sortable/filterable fields mapped to real indexes (`DATABASE_DESIGN.md` §6), capped `limit`, and validated enums. No arbitrary field sorting; no raw client input reaches queries unchecked.

14. **Why page-based pagination now, keyset later?**
    Page-based is simple and adequate for current catalog/history sizes and gives total counts for UIs. For very deep submission history, keyset over the time-ordered index is the documented future optimization.

15. **How does rate limiting protect the system, and how is it tiered?**
    Redis counters per user/IP: strictest on auth (brute force), and specific caps on submit/run/AI to protect judge throughput and AI cost. Returns `429` with `Retry-After`.

16. **How is RBAC enforced and why server-side only?**
    `authenticate` (JWT) then `authorize('admin')` on `/admin/*`, plus ownership checks. The client is never trusted; roles come from the verified token, checked on every protected action.

17. **How does a client trace a failing request end-to-end?**
    Every response includes `meta.correlationId`, generated at the boundary and propagated into the judge job (`BACKEND_STRUCTURE.md` §8.3), so one ID links API logs and worker logs for a submission.

18. **Why return the failing test index but not the failing input?**
    It gives actionable diagnostics without compromising hidden data — a deliberate balance of usefulness vs. `NFR` hidden-test protection.

19. **How do you avoid user enumeration in auth?**
    Login returns the same `INVALID_CREDENTIALS` for unknown user and wrong password (and similar timing); `forgot-password` always returns `200`. Registration conflicts are unavoidable but rate-limited.

20. **What happens if the client submits an unsupported language?**
    `400 UNSUPPORTED_LANGUAGE`. MVP accepts only `python` and `cpp`; adding Java/JS later is additive (enum value + sandbox image) with no contract break.

21. **Why `PATCH` for problem updates and `PUT` for the test-case set?**
    Problem edits are partial (`PATCH` a subset). The test-case **set** must be replaced atomically for judging correctness, so `PUT` (full replace, transactional) models that all-or-nothing semantics (`DATABASE_DESIGN.md` §7.3).

22. **How are large test-case payloads handled without bloating responses/DB?**
    Admins can supply large cases that the backend stores in object storage with metadata in Postgres (`DATABASE_DESIGN.md` §3.6). The API contract stays the same; payloads stream server-side, not through the DB row.

23. **Is Submit idempotent, and how do you handle retries safely?**
    Submit itself creates a new submission per call (not idempotent by design), but the *judging* of a submission is idempotent server-side (unique `(submission_id, test_index)`, status guards). Optional client idempotency keys could be added additively.

24. **Why optional auth on problem browsing/leaderboard?**
    Guests can evaluate the platform (`PRD` US-1). Auth, when present, enriches responses (`solvedByMe`, personalized filters) — progressive enhancement without gating public reads.

25. **How would you add contest APIs without breaking this contract?**
    Add `/api/v1/contests/*` endpoints and optional `contestId` on submission (additive), reuse the leaderboard shape for standings, and feature-flag them — no changes to existing endpoints (`BACKEND_STRUCTURE.md` §15, `DATABASE_DESIGN.md` §9.1).

---

## 15. Endpoint Summary Table (Quick Reference)

OpenAPI-style summary of **every** endpoint: method, path, authentication requirement, scope, and purpose.

| # | Method | Path | Auth | Scope | Purpose |
|---|--------|------|------|-------|---------|
| **Auth** |
| 1 | POST | `/api/v1/auth/register` | None | MVP | Create an account, return JWT. |
| 2 | POST | `/api/v1/auth/login` | None | MVP | Authenticate, return JWT. |
| 3 | GET | `/api/v1/auth/me` | User | MVP | Current authenticated user. |
| 4 | POST | `/api/v1/auth/logout` | User | V1 | Invalidate session/refresh token. |
| 5 | POST | `/api/v1/auth/refresh` | Refresh token | Future/V1 | Exchange refresh for new access token. |
| 6 | POST | `/api/v1/auth/forgot-password` | None | Future | Start email password reset. |
| 7 | POST | `/api/v1/auth/reset-password` | Reset token | Future | Complete password reset. |
| 8 | GET | `/api/v1/auth/google` | None | Future | Begin Google OAuth. |
| 9 | GET | `/api/v1/auth/google/callback` | None | Future | OAuth callback → JWT. |
| **Problems** |
| 10 | GET | `/api/v1/problems` | Optional | MVP | List/search/filter problems (paginated). |
| 11 | GET | `/api/v1/problems/{slug}` | Optional | MVP | Problem detail (examples + public cases). |
| 12 | GET | `/api/v1/tags` | None | MVP | Tag vocabulary for filters. |
| 13 | GET | `/api/v1/problems/{slug}/submissions` | User | MVP | Current user's submissions for a problem. |
| **Submissions & Run** |
| 14 | POST | `/api/v1/submissions` | User | MVP | Create submission (async judge) → `202`. |
| 15 | GET | `/api/v1/submissions` | User | MVP | Current user's submission history. |
| 16 | GET | `/api/v1/submissions/{id}` | User (owner) | MVP | Full submission detail + per-case results. |
| 17 | GET | `/api/v1/submissions/{id}/status` | User (owner) | MVP | Lightweight status/verdict polling. |
| 18 | POST | `/api/v1/code/run` | User | MVP | Run vs public/sample cases (not scored) → `202`. |
| 19 | GET | `/api/v1/code/run/{runId}` | User | MVP | Fetch transient run results. |
| **Leaderboard & Stats** |
| 20 | GET | `/api/v1/leaderboard` | Optional | MVP | Global rankings (paginated). |
| 21 | GET | `/api/v1/users/{username}/statistics` | Optional | MVP | Public user statistics. |
| 22 | GET | `/api/v1/problems/{slug}/leaderboard` | Optional | Future | Per-problem fastest/efficient ranking. |
| **Admin (RBAC: Admin)** |
| 23 | POST | `/api/v1/admin/problems` | Admin | MVP | Create problem. |
| 24 | PATCH | `/api/v1/admin/problems/{id}` | Admin | MVP | Update problem. |
| 25 | DELETE | `/api/v1/admin/problems/{id}` | Admin | MVP | Soft-delete problem. |
| 26 | GET | `/api/v1/admin/problems/{id}/test-cases` | Admin | MVP | List all test cases (incl. hidden). |
| 27 | POST | `/api/v1/admin/problems/{id}/test-cases` | Admin | MVP | Add a test case. |
| 28 | PUT | `/api/v1/admin/problems/{id}/test-cases` | Admin | MVP | Replace full test-case set (transactional). |
| 29 | PATCH | `/api/v1/admin/problems/{id}/test-cases/{testCaseId}` | Admin | MVP | Update a test case. |
| 30 | DELETE | `/api/v1/admin/problems/{id}/test-cases/{testCaseId}` | Admin | MVP | Delete a test case. |
| 31 | POST | `/api/v1/admin/problems/{id}/examples` | Admin | MVP | Add an example. |
| 32 | PATCH | `/api/v1/admin/problems/{id}/examples/{exampleId}` | Admin | MVP | Update an example. |
| 33 | DELETE | `/api/v1/admin/problems/{id}/examples/{exampleId}` | Admin | MVP | Delete an example. |
| 34 | POST | `/api/v1/admin/tags` | Admin | MVP | Create a tag. |
| 35 | DELETE | `/api/v1/admin/tags/{id}` | Admin | MVP | Delete a tag (cascades associations). |
| 36 | GET | `/api/v1/admin/stats` | Admin | Future | Platform stats & verdict distribution. |
| **AI** |
| 37 | POST | `/api/v1/ai/explain-compile-error` | User | MVP | Explain compiler error (guarded, no solution). |
| 38 | POST | `/api/v1/ai/detect-bugs` | User | Future | Identify likely bug region (own code). |
| 39 | POST | `/api/v1/ai/analyze-complexity` | User | Future | Analyze time/space complexity. |
| 40 | POST | `/api/v1/ai/suggest-optimizations` | User | Future | Suggest optimization directions. |
| 41 | POST | `/api/v1/ai/generate-hint` | User | Future | Progressive hint (never the solution). |
| **System** |
| 42 | GET | `/api/v1/health` | None | MVP | Liveness/health of API + dependencies. |

*Auth legend:* **None** = public; **Optional** = works unauthenticated, enriched if authenticated; **User** = valid JWT; **User (owner)** = JWT + resource ownership; **Admin** = JWT + admin role.

---

*This API specification derives entirely from `docs/PRD.md`, `docs/ARCHITECTURE.md`, `docs/DATABASE_DESIGN.md`, and `docs/BACKEND_STRUCTURE.md`. It defines a production-grade, versioned, stateless REST contract — no GraphQL, no unnecessary complexity — consistent with the MVP scope and future-extensibility seams of the existing documents.*
