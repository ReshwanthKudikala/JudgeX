# JudgeX — Product Requirements Document (PRD)

> **Tagline:** AI-Powered Competitive Programming Platform
>
> **Document Type:** Product Requirements Document (Source of Truth)
> **Status:** Draft v1.0
> **Owner:** Engineering / Product
> **Last Updated:** 2026-07-08

---

## Table of Contents

1. [Vision](#1-vision)
2. [Goals](#2-goals)
3. [Functional Requirements](#3-functional-requirements)
4. [Non-Functional Requirements](#4-non-functional-requirements)
5. [User Stories](#5-user-stories)
6. [Use Cases](#6-use-cases)
7. [Success Metrics](#7-success-metrics)
8. [MVP Scope](#8-mvp-scope)
9. [Future Scope](#9-future-scope)
10. [Risks](#10-risks)
11. [Assumptions](#11-assumptions)
12. [Product Roadmap](#12-product-roadmap)
13. [Appendix: Glossary](#13-appendix-glossary)

---

## 1. Vision

**JudgeX** is a modern, production-grade competitive programming platform where users solve programming problems, execute code securely inside isolated Docker containers, receive automated verdicts, analyze their submissions, participate in timed contests, and get **AI-powered debugging guidance that never reveals complete solutions**.

Unlike a learning clone, JudgeX is engineered and presented as a **real SaaS product**. It is intended to demonstrate the depth of skills expected from a Software Engineer: backend architecture, distributed systems, queue-based asynchronous processing, secure sandboxed code execution, relational data modeling, caching strategies, and responsible AI integration.

### The Problem

Existing platforms (LeetCode, Codeforces, HackerRank) either:
- Give away full solutions in editorials/AI hints, short-circuiting real learning, **or**
- Provide opaque verdicts with poor feedback loops, leaving learners stuck without direction.

Learners preparing for interviews and competitions need a platform that **guides without spoiling** — pointing toward bugs, edge cases, and complexity trade-offs while preserving the intellectual struggle that builds skill.

### The Solution

JudgeX combines a secure, scalable judge engine with an **AI Assistant constrained by design** to coach — not solve. The result is a platform that feels like a real product, teaches effectively, and showcases serious engineering.

### Why It Matters (Portfolio Intent)

This project is a **portfolio centerpiece**. Every architectural decision is made to be defensible in a Software Engineering interview: why BullMQ over raw Redis pub/sub, why a modular monolith over microservices at this stage, how sandboxing enforces security, how the AI is prevented from leaking solutions, and how the system scales horizontally via judge workers.

---

## 2. Goals

### 2.1 Product Goals

| # | Goal | Description |
|---|------|-------------|
| G1 | Secure execution | Run untrusted user code without compromising the host or other users. |
| G2 | Fast, reliable verdicts | Return accurate verdicts (AC/WA/TLE/RE/CE) with low latency under concurrent load. |
| G3 | Guided AI learning | Provide AI help that explains errors, finds bugs, and suggests edge cases **without revealing solutions**. |
| G4 | SaaS-grade UX | Deliver a polished, modern UI that feels like a commercial product. |
| G5 | Engagement | Drive practice via problems, contests, leaderboards, and discussions. |

### 2.2 Engineering Goals (Skills Demonstrated)

The project must demonstrate practical, defensible knowledge of:

- **Frontend:** React, TailwindCSS, Monaco Editor
- **Backend:** Node.js, Express, layered architecture (Controller → Service → Repository)
- **Database:** PostgreSQL schema design, indexing, relations, transactions
- **Caching:** Redis for caching, sessions, rate limiting, leaderboards
- **Queue / Async:** BullMQ job queues with multiple asynchronous judge workers
- **Execution:** Docker sandboxing with CPU/memory/time/network limits
- **Security:** JWT authentication, bcrypt password hashing, rate limiting, input validation
- **AI Integration:** provider-pattern abstraction with guardrails — **Ollama (local, free) as the default provider**; OpenAI as an optional, config-enabled provider
- **System Design:** Modular monolith, horizontal worker scaling, clear separation of concerns

### 2.3 Non-Goals (Explicitly Out of Scope)

- Not building a full microservices mesh (chosen: modular monolith).
- Not supporting every programming language at launch (start with a small, high-value set).
- Not a social network — discussion forums are lightweight, problem-scoped.
- Not a mobile-native app in the MVP (responsive web only).

---

## 3. Functional Requirements

Functional requirements are grouped by domain. Each is tagged with a priority: **[MVP]**, **[V1]**, or **[Future]**.

### 3.1 Authentication & Accounts

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-AUTH-1 | Users can register with username, email, and password. | [MVP] |
| FR-AUTH-2 | Passwords are hashed using bcrypt before storage. | [MVP] |
| FR-AUTH-3 | Users can log in and receive a JWT (access token). | [MVP] |
| FR-AUTH-4 | Protected routes require a valid JWT. | [MVP] |
| FR-AUTH-5 | Refresh token / token rotation for session continuity. | [V1] |
| FR-AUTH-6 | Role-based access control (User, Admin). | [MVP] |
| FR-AUTH-7 | Forgot password / reset via email. | [Future] |
| FR-AUTH-8 | Google OAuth sign-in. | [Future] |
| FR-AUTH-9 | Logout / token invalidation. | [V1] |

### 3.2 Problems

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-PROB-1 | Browse a paginated list of problems. | [MVP] |
| FR-PROB-2 | View a problem detail page (statement, constraints, examples). | [MVP] |
| FR-PROB-3 | Search problems by title/keyword. | [MVP] |
| FR-PROB-4 | Filter by difficulty (Easy/Medium/Hard) and tags. | [MVP] |
| FR-PROB-5 | Each problem has metadata: time limit, memory limit, tags, difficulty. | [MVP] |
| FR-PROB-6 | Show acceptance rate and solved status per problem for the user. | [V1] |
| FR-PROB-7 | Public (sample) test cases visible; hidden test cases used for judging. | [MVP] |

### 3.3 Problem Solving / Editor

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-EDIT-1 | Monaco-based code editor with syntax highlighting. | [MVP] |
| FR-EDIT-2 | Language selector (MVP: Python, C++). | [MVP] |
| FR-EDIT-2a | Add support for Java and JavaScript. | [Future] |
| FR-EDIT-3 | **Run Code** against sample/public test cases (fast feedback, not scored). | [MVP] |
| FR-EDIT-4 | **Submit Code** against full hidden test suite (scored, produces verdict). | [MVP] |
| FR-EDIT-5 | Editor preserves last code per problem/language (local + server draft). | [V1] |
| FR-EDIT-6 | Custom stdin input box for ad-hoc runs. | [V1] |

### 3.4 Judge Engine

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-JUDGE-1 | Compile submitted code (where applicable) and report compilation errors. | [MVP] |
| FR-JUDGE-2 | Execute code inside an isolated Docker container. | [MVP] |
| FR-JUDGE-3 | Enforce per-submission CPU time, wall-clock time, and memory limits. | [MVP] |
| FR-JUDGE-4 | Disable network access inside execution containers. | [MVP] |
| FR-JUDGE-5 | Run against all hidden + public test cases and compare outputs. | [MVP] |
| FR-JUDGE-6 | Produce verdicts: **Accepted, Wrong Answer, Time Limit Exceeded, Runtime Error, Compilation Error**. | [MVP] |
| FR-JUDGE-7 | Support Memory Limit Exceeded (MLE) verdict. | [V1] |
| FR-JUDGE-8 | Judging is asynchronous via a BullMQ queue processed by workers. | [MVP] |
| FR-JUDGE-9 | Submission status transitions: `Queued → Running → <Verdict>`. | [MVP] |
| FR-JUDGE-10 | Multiple judge workers can process submissions concurrently. | [MVP] |
| FR-JUDGE-11 | Output comparison supports exact match and trailing-whitespace tolerance. | [MVP] |

### 3.5 Submissions

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-SUB-1 | Persist every submission with code, language, verdict, timestamp. | [MVP] |
| FR-SUB-2 | Record runtime (ms) and memory usage (MB) per submission. | [MVP] |
| FR-SUB-3 | Users can view their submission history per problem and globally. | [MVP] |
| FR-SUB-4 | Users can view the code and result of their past submissions. | [MVP] |
| FR-SUB-5 | Show which test case failed (index only, not hidden data) for WA/RE. | [V1] |

### 3.6 Leaderboard

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-LEAD-1 | Global leaderboard with user rankings by problems solved. | [MVP] |
| FR-LEAD-2 | Show acceptance rate per user. | [MVP] |
| FR-LEAD-3 | Leaderboard reads are cached in Redis for performance. | [MVP] |
| FR-LEAD-4 | Contest-specific leaderboards. | [Future] |

### 3.7 Admin Panel

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-ADMIN-1 | Admins can create problems (statement, constraints, examples, limits, tags). | [MVP] |
| FR-ADMIN-2 | Admins can edit problems. | [MVP] |
| FR-ADMIN-3 | Admins can delete problems. | [MVP] |
| FR-ADMIN-4 | Admins can add/edit public test cases. | [MVP] |
| FR-ADMIN-5 | Admins can add/edit hidden test cases. | [MVP] |
| FR-ADMIN-6 | Admin routes are protected by role-based access control. | [MVP] |
| FR-ADMIN-7 | Admins can view platform stats (users, submissions, verdict distribution). | [Future] |

### 3.8 AI Assistant

> **Guardrail (Hard Constraint):** The AI Assistant must **NEVER reveal a complete or near-complete solution**, nor produce copy-pasteable correct code for the problem.

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-AI-1 | **AI-powered Compilation Error Explanation** — explain compiler errors in natural language without revealing solutions. | [MVP] |
| FR-AI-2 | Enforce guardrails via system prompt + output filtering + rate limits. | [MVP] |
| FR-AI-3 | Provider-pattern abstraction behind a single `AIService`: **Ollama (local, free) is the default provider**; OpenAI is optional and enabled via configuration. No part of the app depends on a specific provider. | [MVP] |
| FR-AI-4 | AI Bug Detection — identify likely bugs in the user's own submitted code. | [Future / Advanced] |
| FR-AI-5 | AI Edge Case Suggestions — suggest edge cases the user may have missed. | [Future / Advanced] |
| FR-AI-6 | AI Complexity Analysis — analyze time/space complexity of the user's approach. | [Future / Advanced] |
| FR-AI-7 | AI Optimization Guidance — suggest optimization *directions* (not implementations). | [Future / Advanced] |

### 3.9 Contests

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-CON-1 | Admins create timed contests with a problem set and start/end window. | [Future] |
| FR-CON-2 | Users register and participate within the contest window. | [Future] |
| FR-CON-3 | Contest leaderboard with scoring and tie-breaking (penalty/time). | [Future] |

### 3.10 Discussion Forums

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-DISC-1 | Each problem has a discussion page with threaded comments. | [Future] |
| FR-DISC-2 | Users can post, reply, and upvote comments. | [Future] |
| FR-DISC-3 | Moderation controls for admins. | [Future] |

---

## 4. Non-Functional Requirements

### 4.1 Security

| ID | Requirement |
|----|-------------|
| NFR-SEC-1 | All untrusted code runs inside Docker containers isolated from the host. |
| NFR-SEC-2 | Execution containers have **no network access**, a read-only/ephemeral filesystem, dropped Linux capabilities, and a non-root user. |
| NFR-SEC-3 | Enforce resource limits: CPU, memory, PIDs (process count), and wall-clock timeout per execution. |
| NFR-SEC-4 | Authentication via JWT with signed, expiring tokens. |
| NFR-SEC-5 | Passwords stored only as bcrypt hashes (never plaintext, never reversible). |
| NFR-SEC-6 | Rate limiting on auth, run, submit, and AI endpoints (Redis-backed). |
| NFR-SEC-7 | Input validation and sanitization on all API boundaries. |
| NFR-SEC-8 | Secrets (JWT secret, DB creds, AI keys) provided via environment variables, never committed. |
| NFR-SEC-9 | Principle of least privilege for DB roles and container permissions. |

### 4.2 Performance

| ID | Requirement |
|----|-------------|
| NFR-PERF-1 | "Run Code" feedback target: < 3s for typical sample cases. |
| NFR-PERF-2 | Submission enqueue is non-blocking; API responds immediately with a submission ID. |
| NFR-PERF-3 | Redis caching for hot reads (problem lists, leaderboards). |
| NFR-PERF-4 | BullMQ decouples request handling from heavy judging work. |
| NFR-PERF-5 | Database queries use appropriate indexes; avoid N+1 patterns. |

### 4.3 Scalability

| ID | Requirement |
|----|-------------|
| NFR-SCALE-1 | Judge workers scale horizontally — add workers to increase throughput. |
| NFR-SCALE-2 | Queue backpressure handled gracefully (jobs wait, users see "Queued"). |
| NFR-SCALE-3 | Stateless API servers behind a load balancer (state in Postgres/Redis). |
| NFR-SCALE-4 | Modular monolith allows future extraction of services if needed. |

### 4.4 Reliability & Availability

| ID | Requirement |
|----|-------------|
| NFR-REL-1 | Failed judge jobs retry with capped attempts and exponential backoff. |
| NFR-REL-2 | A crashed/killed container never blocks the worker permanently (timeout kill). |
| NFR-REL-3 | Submissions are durable — persisted before/at enqueue, survive worker restarts. |
| NFR-REL-4 | Graceful degradation: if AI provider is down, core judging is unaffected. |

### 4.5 Maintainability

| ID | Requirement |
|----|-------------|
| NFR-MAINT-1 | Clean, documented folder structure. |
| NFR-MAINT-2 | Layered architecture: **Controller → Service → Repository**. |
| NFR-MAINT-3 | Configuration centralized and environment-driven. |
| NFR-MAINT-4 | Consistent error handling and structured logging. |
| NFR-MAINT-5 | Code is linted/formatted; conventions documented. |

### 4.6 Usability & Accessibility

| ID | Requirement |
|----|-------------|
| NFR-UX-1 | Responsive design (desktop-first, works on tablet/mobile web). |
| NFR-UX-2 | Clear verdict feedback with color-coded status and timing/memory info. |
| NFR-UX-3 | Reasonable keyboard support and readable contrast in the editor. |

### 4.7 Observability

| ID | Requirement |
|----|-------------|
| NFR-OBS-1 | Structured logs across API and workers. |
| NFR-OBS-2 | Queue metrics (waiting, active, completed, failed) observable. |
| NFR-OBS-3 | Health-check endpoints for API, DB, Redis, and worker liveness. |

---

## 5. User Stories

Format: *As a **[role]**, I want **[capability]**, so that **[benefit]**.*

### 5.1 Guest / Visitor
- **US-1:** As a **visitor**, I want to browse problems without logging in, so that I can evaluate the platform before signing up.
- **US-2:** As a **visitor**, I want to register an account, so that I can start solving and tracking progress.

### 5.2 Registered User (Learner)
- **US-3:** As a **user**, I want to log in securely, so that my submissions and progress are tied to my account.
- **US-4:** As a **user**, I want to search and filter problems by difficulty and tags, so that I can practice targeted topics.
- **US-5:** As a **user**, I want to write code in a rich editor and pick my language, so that I can solve comfortably.
- **US-6:** As a **user**, I want to run my code against sample cases, so that I get fast feedback before submitting.
- **US-7:** As a **user**, I want to submit my code and receive a verdict, so that I know whether my solution is correct.
- **US-8:** As a **user**, I want to see runtime and memory of my submission, so that I can gauge efficiency.
- **US-9:** As a **user**, I want to view my submission history, so that I can review and revisit past attempts.
- **US-10:** As a **user**, I want AI help that points out bugs and edge cases **without giving me the answer**, so that I learn while staying unblocked.
- **US-11:** As a **user**, I want to see my rank and acceptance rate on the leaderboard, so that I stay motivated.

### 5.3 Competitive Programmer
- **US-12:** As a **competitive programmer**, I want to join timed contests, so that I can simulate real competition pressure.
- **US-13:** As a **competitive programmer**, I want a contest leaderboard with time/penalty scoring, so that rankings are fair.

### 5.4 Instructor
- **US-14:** As an **instructor**, I want to discuss problems with students in a forum, so that I can guide their learning.

### 5.5 Administrator
- **US-15:** As an **admin**, I want to create, edit, and delete problems, so that I can curate the catalog.
- **US-16:** As an **admin**, I want to add public and hidden test cases, so that judging is rigorous and fair.
- **US-17:** As an **admin**, I want admin-only access to management tools, so that unauthorized users cannot modify content.

---

## 6. Use Cases

### UC-1: Submit a Solution (Core Flow)
- **Actor:** Registered User
- **Preconditions:** User is authenticated; problem exists with hidden test cases.
- **Main Flow:**
  1. User opens a problem and writes code in the Monaco editor.
  2. User selects a language and clicks **Submit**.
  3. API validates the request (auth, payload, rate limit) and creates a submission record with status `Queued`.
  4. API enqueues a judge job in BullMQ and returns the submission ID immediately.
  5. A judge worker picks up the job, sets status `Running`, and spins up an isolated Docker container.
  6. Worker compiles (if needed), then runs the code against all test cases with enforced limits.
  7. Worker compares outputs and computes a verdict, runtime, and memory.
  8. Worker persists the result and updates submission status to the final verdict.
  9. Frontend reflects the updated verdict (via polling or push).
- **Alternate Flows:**
  - **CE:** Compilation fails → verdict `Compilation Error`; error message stored.
  - **TLE:** Execution exceeds time limit → container killed → verdict `Time Limit Exceeded`.
  - **RE:** Non-zero exit / crash → verdict `Runtime Error`.
  - **WA:** Output mismatch on any case → verdict `Wrong Answer` (failing case index recorded).
- **Postconditions:** Submission is stored with a final verdict and metrics.

### UC-2: Run Code (Fast Feedback)
- **Actor:** Registered User
- **Flow:** User clicks **Run** → code executes only against public/sample cases (and optional custom stdin) → results returned quickly. **Not scored, not stored as a graded submission.**

### UC-3: Admin Creates a Problem
- **Actor:** Admin
- **Flow:** Admin fills problem form (statement, constraints, examples, limits, tags) → adds public and hidden test cases → saves. Problem becomes available in the catalog.

### UC-4: AI-Assisted Debugging (Guarded)
- **Actor:** Registered User
- **Preconditions:** User has code (and optionally a failing submission).
- **Flow:**
  1. User requests AI help on their current code / error.
  2. System sends code + problem context to the AI provider **with a strict system prompt forbidding full solutions**.
  3. AI returns guidance: error explanation, likely bug location, suggested edge cases, complexity notes, optimization direction.
  4. Output passes a guardrail filter; anything resembling a full solution is blocked/redacted.
- **Postconditions:** User receives hints; no complete solution is exposed.

### UC-5: Authentication
- **Actor:** Visitor → User
- **Flow:** Register (bcrypt-hashed password stored) → Login (credentials verified, JWT issued) → Access protected resources with JWT.

### UC-6: Participate in a Contest *(Future)*
- **Actor:** Registered User
- **Flow:** Register for contest → solve problems within the time window → submissions scored → ranked on contest leaderboard.

---

## 7. Success Metrics

Metrics are grouped by intent. Since this is a portfolio project, both **product** and **engineering-quality** metrics matter.

### 7.1 Product / Engagement
| Metric | Target (Indicative) |
|--------|---------------------|
| Successful submissions processed | System handles concurrent submissions without loss |
| Problems solved per active user | Trending upward over a session |
| Contest participation | Users can complete a full contest end-to-end |

### 7.2 Engineering / Reliability
| Metric | Target (Indicative) |
|--------|---------------------|
| Judge correctness | 100% correct verdict on a known test battery |
| Sandbox escape incidents | **Zero** |
| Run Code latency | < 3s typical |
| Submission enqueue latency | < 200ms (API returns immediately) |
| Worker throughput | Scales ~linearly with added workers |
| Failed-job recovery | Retried jobs eventually complete or fail cleanly |

### 7.3 AI Guardrail Effectiveness
| Metric | Target |
|--------|--------|
| Full-solution leakage rate | **0%** on a red-team prompt set |
| Helpfulness (self/rubric review) | Hints identify real bugs/edge cases |

### 7.4 Portfolio Impact
| Metric | Target |
|--------|--------|
| Architecture defensibility | Every major decision documented and justifiable in interview |
| Demo readiness | End-to-end happy path demoable without manual patching |

---

## 8. MVP Scope

The MVP proves the **hardest, most impressive** parts first: **secure sandboxed execution + async judging + core auth/problem/submission flow.**

### In Scope (MVP)
- **Auth:** Register, Login, JWT, bcrypt, role-based access (User/Admin).
- **Problems:** Browse, search, filter (difficulty/tags), problem detail with examples/constraints/limits.
- **Editor:** Monaco editor, language selector (Python, C++), Run and Submit.
- **Judge Engine:** Docker-isolated execution, resource + time limits, no network, compile+run, output comparison, verdicts (AC/WA/TLE/RE/CE), async via BullMQ, multiple workers, status transitions.
- **Submissions:** Persisted history with verdict, runtime, memory, language, timestamp.
- **Leaderboard:** User rankings, problems solved, acceptance rate (Redis-cached).
- **AI Assistant (initial):** AI-powered Compilation Error Explanation — explains compiler errors in natural language without revealing solutions, with guardrails.
- **Admin Panel:** Create/edit/delete problems; add public and hidden test cases.
- **Infra:** PostgreSQL, Redis, BullMQ, Dockerized execution, layered backend architecture.

### Out of Scope (MVP)
- Advanced AI features (Bug Detection, Complexity Analysis, Edge Case Suggestions, Optimization Guidance).
- Contests and discussion forums.
- Additional languages (Java, JavaScript).
- Forgot password, Google OAuth.
- MLE verdict (target V1).

### MVP Definition of Done
- A user can register, log in, pick a problem, write code (Python or C++), run against samples, submit, and receive an accurate verdict with runtime/memory.
- On a Compilation Error, the user can request an AI explanation of the compiler error in natural language (no solution revealed).
- Users can view a leaderboard with rankings, problems solved, and acceptance rate.
- An admin can create a problem with public + hidden test cases.
- Judging runs asynchronously in Docker with enforced limits and no host compromise.
- Multiple workers can process submissions concurrently.

---

## 9. Future Scope

Ordered roughly by expected sequence after MVP:

1. **Advanced AI Assistant** — beyond the MVP's compile-error explanation: AI Bug Detection, AI Complexity Analysis, AI Edge Case Suggestions, and AI Optimization Guidance (all guarded, never revealing solutions).
2. **Submission diagnostics** — failing test index, MLE verdict.
3. **More languages** — Java and JavaScript, then expand further.
4. **Contests** — timed contests, registration, contest leaderboards with penalty scoring.
5. **Discussion Forums** — per-problem threaded discussions, upvotes, moderation.
6. **Auth enhancements** — forgot password (email reset), Google OAuth, refresh tokens.
7. **Additional AI providers** — the OpenAI provider (optional, already supported via config) plus any further providers behind the same `AIService` abstraction. (Ollama local AI ships in the MVP as the default.)
8. **Analytics dashboards** — admin platform stats and verdict distributions.
9. **Editor drafts** — server-side per-problem/language code persistence.

---

## 10. Risks

| ID | Risk | Impact | Likelihood | Mitigation |
|----|------|--------|-----------|------------|
| R1 | **Sandbox escape** — untrusted code compromises host. | Critical | Low–Med | No network, non-root user, dropped capabilities, read-only FS, CPU/mem/PID limits, hard timeouts; treat all code as hostile. |
| R2 | **Resource exhaustion** — fork bombs / infinite loops / memory hogs. | High | Med | PID limits, memory caps, wall-clock timeout with forced container kill, per-worker concurrency caps. |
| R3 | **Queue backlog** under load. | Med | Med | Horizontal worker scaling, backpressure, clear "Queued" state, priority for Run vs Submit. |
| R4 | **Non-deterministic judging** (whitespace, locale, floating point). | Med | Med | Normalized comparison (trailing whitespace tolerance), defined output-matching rules, fixed runtime environments. |
| R5 | **AI leaks full solutions** — undermines core value. | High | Med | Strict system prompt, output filtering/redaction, rate limits, red-team test set, ship AI only after guardrails validated. |
| R6 | **AI provider cost/availability**. | Low | Med | **Default provider is local Ollama (free, no API key)**, so the MVP has no paid dependency; provider-pattern abstraction, graceful degradation, optional OpenAI, caching/limits. |
| R7 | **Docker orchestration complexity** on dev/host. | Med | Med | Containerized dev environment, documented setup, health checks. |
| R8 | **Scope creep** — advanced features delaying core. | Med | High | Strict MVP gate; advanced features only after MVP DoD met. |
| R9 | **Data integrity** — lost submissions on crashes. | High | Low | Persist before enqueue, durable queue, retries, idempotent job handling. |
| R10 | **Secret leakage** — keys/creds committed. | High | Low | Env-based secrets, `.gitignore`, no secrets in repo. |

---

## 11. Assumptions

- **A1:** The Docker daemon is available in all environments where judge workers run.
- **A2:** Judge workers run on a Linux-compatible container runtime (native or via WSL2/VM on Windows dev machines).
- **A3:** A single PostgreSQL instance and a single Redis instance are sufficient for MVP scale.
- **A4:** Initial MVP language support (Python, C++) covers the majority of target users' needs; Java and JavaScript follow later.
- **A5:** A local **Ollama** instance is available (default provider) for the MVP AI Compilation Error Explanation feature — **no paid service or API key required**; OpenAI is an optional provider enabled via configuration.
- **A6:** Problems and test cases are authored by trusted admins; test data is well-formed.
- **A7:** Traffic is moderate (portfolio/demo scale), so a modular monolith is appropriate; microservices are unnecessary now.
- **A8:** Output comparison for most problems is deterministic; special judges (custom checkers) are out of MVP scope.
- **A9:** Users access via modern web browsers; no native mobile app required for MVP.
- **A10:** Email delivery infrastructure is only required once password reset is implemented (Future).

---

## 12. Product Roadmap

> Phases are milestone-based. Durations are indicative and can be compressed/expanded.

### Phase 0 — Foundations
- Repository structure, tooling, environment config.
- Database schema design (users, problems, test cases, submissions).
- Docker Compose for Postgres + Redis (and dev services).
- Skeleton layered backend (Controller → Service → Repository) and base React app.
- **Exit:** App boots; DB migrations run; health checks green.

### Phase 1 — Auth & Core Data
- Register/Login, bcrypt, JWT, role-based access.
- Problem CRUD (admin) + problem browse/detail/search/filter (user).
- Public/hidden test case management.
- **Exit:** Admin can create a full problem; users can browse and view it.

### Phase 2 — Judge Engine (The Centerpiece)
- BullMQ queue + async judge workers.
- Docker-isolated execution with resource/time/network limits.
- Compile + run + output comparison + verdicts (AC/WA/TLE/RE/CE).
- Submission persistence with runtime/memory; status transitions.
- Multiple concurrent workers.
- **Exit:** MVP Definition of Done met — full submit-to-verdict flow works securely.

### Phase 3 — Frontend Solving Experience, Leaderboard & Initial AI (Completes MVP)
- Monaco editor integration, language selector (Python, C++), Run vs Submit UX.
- Submission history UI, verdict display with metrics.
- Global leaderboard UI (user rankings, problems solved, acceptance rate), Redis-cached.
- AI provider-pattern abstraction (`AIService` → Ollama default, optional OpenAI) + guardrails (system prompt, output filtering, rate limits).
- **AI-powered Compilation Error Explanation** integrated into the CE verdict flow.
- Polished, SaaS-grade UI with TailwindCSS.
- **Exit:** MVP complete — end-to-end solving experience, leaderboard, and AI compile-error explanation are demoable and look like a product.

### Phase 4 — Diagnostics & Advanced AI (V1)
- Failing test index, MLE verdict.
- Advanced guarded AI: bug detection, edge cases, complexity analysis, optimization guidance.
- Output filtering + red-team validation.
- **Exit:** Richer failure feedback; AI helps beyond compile errors without leaking solutions (0% leakage on red-team set).

### Phase 5 — Contests & Community
- Timed contests, registration, contest leaderboards with penalty scoring.
- Per-problem discussion forums with upvotes and moderation.
- **Exit:** A full contest can be run end-to-end; discussions live.

### Phase 6 — Hardening & Extensions (Future)
- Additional languages: Java, JavaScript (and beyond).
- Forgot password (email), Google OAuth, refresh tokens.
- Additional AI providers behind `AIService` (optional OpenAI is already config-enabled; Ollama is the MVP default).
- Admin analytics dashboards; observability enhancements.
- **Exit:** Production-hardening polish; expanded feature set.

---

## 13. Appendix: Glossary

| Term | Definition |
|------|------------|
| **Verdict** | The judged outcome of a submission (AC, WA, TLE, RE, CE, MLE). |
| **AC / WA / TLE / RE / CE / MLE** | Accepted / Wrong Answer / Time Limit Exceeded / Runtime Error / Compilation Error / Memory Limit Exceeded. |
| **Public / Sample Test Case** | Test data visible to users, used by Run Code. |
| **Hidden Test Case** | Secret test data used only during Submit for grading. |
| **Judge Worker** | A background process that consumes queue jobs and executes/judges code in Docker. |
| **BullMQ** | A Redis-backed job queue used for asynchronous, retryable judging. |
| **Sandbox** | An isolated Docker container with strict resource, capability, and network limits used to run untrusted code. |
| **Modular Monolith** | A single deployable application organized into clean, decoupled modules. |
| **Guardrail** | A constraint (system prompt + output filter + limits) ensuring the AI never reveals full solutions. |

---

*This PRD is the source of truth for JudgeX. Changes to scope, priorities, or requirements should be reflected here first.*
