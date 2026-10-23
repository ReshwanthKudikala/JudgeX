# JudgeX — Judge Pipeline Design

> **Status:** Implemented. This document is the behavioral contract. Where code and this file disagree, **code plus tests are authoritative** — update this file in the same change.
> **Sources of truth:** `docs/PRD.md`, `docs/ARCHITECTURE.md` (§3 lifecycle, §4 judge engine, §5 Docker, §6 Redis/BullMQ), `docs/DATABASE_DESIGN.md` (§3.7 `submissions`, §3.8 `submission_test_results`), `docs/BACKEND_STRUCTURE.md`, `docs/API_SPECIFICATION.md` (§4 submissions).
> **Scope:** how a submission travels from the API to a stored verdict, and how the system behaves under failure and load. This document does not introduce new schema or endpoints; it specifies the behavior the judge sprints must implement.

This document deliberately restates and refines the invariants already committed in `ARCHITECTURE.md` so the judge sprints have a single, detailed reference. Where a value is described as "configurable," it is a tunable, not a hard-coded constant.

---

## Table of Contents

1. [Complete Submission Lifecycle](#1-complete-submission-lifecycle)
2. [BullMQ Job Payload](#2-bullmq-job-payload)
3. [Worker State Machine](#3-worker-state-machine)
4. [Docker Lifecycle](#4-docker-lifecycle)
5. [Verdict Precedence](#5-verdict-precedence)
6. [Retry Strategy](#6-retry-strategy)
7. [Idempotency](#7-idempotency)
8. [Failure Recovery](#8-failure-recovery)
9. [Security Considerations](#9-security-considerations)
10. [Future Scalability](#10-future-scalability)

---

## 1. Complete Submission Lifecycle

The pipeline has two independent runtimes: the **API server** (never touches Docker, never blocks on judging) and the **judge worker fleet** (the only components that touch Docker). Redis/BullMQ decouples them. PostgreSQL is authoritative at every step.

```
          ┌──────────────────────── API SERVER (synchronous, fast) ────────────────────────┐
          │                                                                                 │
  Client ─┤ 1. Submission API  →  2. Persist to PostgreSQL (status = queued)                │
          │                                     │                                           │
          │                                     ▼                                           │
          │                          3. BullMQ enqueue { submissionId }                     │
          │                                     │  (only after commit succeeds)             │
          └─────────────────────────────────────┼───────────────────────────────────────────┘
                                                 ▼
                                        Redis (judge queue)
                                                 │
          ┌──────────────────────── JUDGE WORKER (asynchronous, isolated) ──────────────────┐
          │                                     ▼                                           │
          │  4. Worker pickup (job → active, lock acquired)                                 │
          │  ── re-read authoritative submission + problem + ALL test cases from Postgres ──│
          │  ── status → running ──                                                         │
          │                                     ▼                                           │
          │  5. Docker container creation (per compile / per run, locked-down)              │
          │                                     ▼                                           │
          │  6. Compilation        → (fail) ─────────────► Compilation Error                │
          │                                     ▼                                           │
          │  7. Execution (per test case, stdin → stdout, limits enforced)                  │
          │                                     ▼                                           │
          │  8. Output comparison  (normalized exact-match)                                 │
          │                                     ▼                                           │
          │  9. Verdict generation (precedence rules, aggregate runtime/memory)             │
          │                                     ▼                                           │
          │ 10. Persist result (verdict + metrics + judged_at, status → completed;          │
          │      per-case rows into submission_test_results; side effects: counters,        │
          │      leaderboard cache) — then container/workspace cleanup (always)             │
          └─────────────────────────────────────┼───────────────────────────────────────────┘
                                                 ▼
                                   11. Client polling reads terminal
                                       verdict from Postgres via API
```

### Stage-by-stage responsibilities

| # | Stage | Owner | Reads/Writes | Notes |
|---|-------|-------|--------------|-------|
| 1 | Submission API | API | — | Validated request; identity from `req.user`. |
| 2 | Persist | API | Write `submissions` (`status=queued`) | **Persist-before-enqueue.** The row exists before any job references it. |
| 3 | Enqueue | API | Redis | Only after the DB commit. If enqueue fails, the row still exists and a reaper can re-enqueue (see §8). |
| 4 | Pickup | Worker | Read `submissions`+`problems`+`test_cases`; write `status=running` | Job carries only the ID; the worker re-reads the truth. Loads **public + hidden** test cases. |
| 5 | Container create | Worker | Docker | Prebuilt language image, locked-down flags, per-job workspace. |
| 6 | Compilation | Worker | Docker | Compiled languages (C++) only; interpreted (Python) may do a syntax/import check or skip. Failure short-circuits to CE. |
| 7 | Execution | Worker | Docker | One run per test case; stdin fed, stdout/stderr/exit/time/memory captured. |
| 8 | Comparison | Worker | — | Normalize (trim trailing whitespace/newlines per PRD `FR-JUDGE-11`), exact-match. |
| 9 | Verdict | Worker | — | Apply precedence (§5); aggregate max runtime/memory; record first failing index. |
| 10 | Persist result | Worker | Write `submissions` (terminal), `submission_test_results`; counters; cache | Single transaction for the submission + counters (DATABASE_DESIGN §7.3). Cleanup always runs. |
| 11 | Poll | Client via API | Read `submissions` | `queued → running → <verdict>`; CE exposes AI-explanation affordance. |

### Invariants (carried from `ARCHITECTURE.md` §3.4)

- **Persist-before-enqueue** — no lost work if Redis or a worker dies between steps 2 and 4.
- **Postgres is authoritative** — the job payload is a reference, never the source of truth.
- **Terminal verdicts are immutable** — a re-judge creates a *new* submission (or explicit re-run record), never mutates history.
- **The API never executes untrusted code and never blocks** on judging.

---

## 2. BullMQ Job Payload

The payload is intentionally **minimal**: an identifier plus small routing/version metadata. The worker re-reads all authoritative data (code, limits, test cases) from PostgreSQL. This keeps the queue small, avoids stale/inconsistent snapshots in Redis, and prevents untrusted code from living in the queue.

### Required fields

| Field | Type | Purpose |
|-------|------|---------|
| `submissionId` | UUID (v7) | The one authoritative reference. Worker loads everything from it. |
| `schemaVersion` | int | Payload/contract version, so a rolling deploy of workers can reject/adapt to unknown shapes. |
| `enqueuedAt` | ISO-8601 | Observability: queue-wait latency = `startedAt − enqueuedAt`. |

### BullMQ job options (not payload, but part of the contract)

| Option | Value (initial, configurable) | Rationale |
|--------|-------------------------------|-----------|
| `jobId` | `submissionId` | **De-duplication key** — BullMQ ignores a second add with the same `jobId`, giving enqueue-side idempotency (§7). |
| `attempts` | `3` | Cap on transient-failure retries (§6). |
| `backoff` | exponential, base ~`2000 ms` | `2s, 4s, 8s…` spacing (§6). |
| `removeOnComplete` | bounded (e.g. keep last N / age) | Prevent unbounded Redis growth; keep a short window for debugging. |
| `removeOnFail` | keep (bounded) | Retain failed jobs for inspection / dead-letter analysis. |

### Explicitly NOT in the payload

- **Source code** — untrusted, potentially large; belongs only in Postgres.
- **Test cases / expected outputs** — especially **hidden** cases must never transit or persist in Redis.
- **Time/memory limits** — read from `problems` at judge time so a limit change can't be defeated by a stale job.
- **User PII** — the worker needs only `user_id` (obtained via the submission row) for attribution.

---

## 3. Worker State Machine

Two related but distinct state spaces exist and must not be conflated:

- **Submission status** (persisted enum in `submissions.status`): `queued`, `running`, `completed`, `error`.
- **Job state** (BullMQ-internal): `waiting`, `active`, `completed`, `failed`, `delayed` (retry backoff).

The worker maps job progress onto submission status. A **verdict is not a job failure** — a Wrong Answer is a *successful job* that produced a WA result.

```
                 enqueue                worker pulls (lock)             judged & persisted
   [waiting] ───────────────► [active] ───────────────► (pipeline) ──────────────► [completed]
   status=queued              status=running                                        status=completed
       ▲                          │                                                 verdict ∈ {AC,WA,TLE,RE,CE}
       │                          │ transient error thrown
       │                          ▼
       │                      [failed] ── attempts left? ──► [delayed] ──(backoff)──► [active] (retry)
       │                          │
       │                          │ attempts exhausted / non-retryable
       │                          ▼
       │                 dead-letter (failed, retained)
       │                 status=error  (surfaced as retryable "judging failed", NOT a verdict)
       │
       └──── lock/visibility timeout expires (worker crashed) ⇒ job returns to waiting for another worker
```

### State definitions

| State | Meaning | Submission status | Terminal? |
|-------|---------|-------------------|-----------|
| **Queued** | Persisted, waiting in Redis for a free worker slot. | `queued` | No |
| **Running** | A worker holds the lock and is executing the pipeline. | `running` | No |
| **Completed** | Pipeline finished; a real verdict was written. | `completed` | **Yes** (immutable) |
| **Failed** | The job threw (transient or fatal). Eligible for retry if attempts remain. | `running` until resolved | No (until exhausted) |
| **Retry (delayed)** | Failed with attempts remaining; waiting out backoff before re-activation. | stays `running`/`queued` | No |
| **Error (dead-letter)** | Retries exhausted or non-retryable failure. | `error` | **Yes** (operationally; user may resubmit) |

**Key rule:** the worker may set `running` on every pickup (CAS from `queued|running`). It writes a **legitimate verdict** (`completed` + AC/WA/TLE/RE/CE/MLE) as soon as the pipeline finishes. It writes `error`/`internal_error` **only** on the last BullMQ attempt or for unrecoverable (deterministic) failures. Re-entry via retry re-reads status and refuses to re-finalize an already-terminal submission (§7). Delivery is **at-least-once**; finalization is **effectively-once** via the status CAS. Do not claim exactly-once execution.

---

## 4. Docker Lifecycle

Docker is the security cornerstone (`ARCHITECTURE.md` §5). Containers are **cattle, not pets**: created for one purpose, torn down unconditionally in a `finally`-style guarantee. Containers are **never reused across submissions**.

```
per submission (actual implementation — execution.service.withExecution):
  ── prepare isolated workspace (throwaway dir for this job) ──
  ── create ONE locked-down sandbox container ──
  ── copy source into the bind-mounted workspace ──
  ── compile via docker exec (C++; Python syntax/no-op per compiler) ──
  ── for each test case: docker exec with stdin + wall-clock SIGKILL ──
  ── finally: remove container AND delete workspace ──
```

One sandbox per submission (not one container per test case). Exec isolation is process-level inside that sandbox; the HostConfig limits still apply to the whole container.

### Container creation

- Built **from prebuilt, minimal per-language images** (small Python image; small C++ toolchain image), built ahead of time so **no network fetch or package install happens at judge time**.
- Created with all security flags applied **at creation** (see §9): no network, non-root, drop-all capabilities, no-new-privileges, read-only root FS, PID limit, memory/CPU limits.

### Mounting files

- Each job gets an **isolated workspace directory** on the worker host, mounted into the container.
- Compile phase: workspace is writable only where the artifact must land.
- Run phase: the compiled artifact/script is mounted **read-only**; any program-writable area is a small, size-capped scratch (tmpfs-style), never the host FS.
- Hidden test inputs are streamed via **stdin**, not written to a shared mount, minimizing exposure.

### Compilation

- Only for compiled languages (MVP: C++). Interpreted languages (Python) skip compilation (an optional lightweight syntax check may map syntax failures to CE for parity).
- Enforced by a **compile timeout** (a stuck/adversarial compile is force-killed → treated as CE, or TLE if the policy distinguishes compile-timeouts; MVP: CE with a "compilation timed out" message).
- Compiler stderr is captured into `submissions.compile_output` for CE verdicts and AI explanation.

### Execution

- One container **per test case** (clean, non-interfering runs). Test input on stdin; stdout captured for comparison.
- The worker enforces the **wall-clock timeout** from the outside (untrusted code cannot be trusted to self-limit).
- Per-case `runtime_ms`/`memory_kb` captured; submission-level metrics are the **max** across cases.

### Cleanup

- Container removal and workspace deletion happen **unconditionally** (success, WA, crash, timeout, or exception) via a guaranteed `finally`-style path (PRD `NFR-REL-2`).
- A crashed or hostile container must never pin resources or block the worker; cleanup is defensive (force-remove).

### Timeout handling

- **Compile timeout** and **wall-clock run timeout** are separate budgets.
- The worker also enforces an **overall per-submission time budget** (sum of per-case limits + overhead) so a problem with many cases can't run unbounded.
- Timeout ⇒ force-kill container ⇒ `Time Limit Exceeded` (run) per precedence.

### Memory limits

- Hard container memory cap (from `problems.memory_limit_mb`). Exceeding it triggers an **OOM kill** → `memory_limit_exceeded` (`verdict-engine.js`).

---

## 5. Verdict Precedence

The pipeline emits multiple independent signals (compiler result, per-case exit codes, timings, output diffs). The **Verdict Generator** collapses them into exactly one verdict using a fixed precedence — **evaluated in order, first match wins** — identical to `ARCHITECTURE.md` §4.2 and the `verdict` enum in `DATABASE_DESIGN.md` §3.7.

| Order | Verdict | `verdict` enum | Trigger |
|-------|---------|----------------|---------|
| 1 | **Compilation Error** | `compile_error` | Compile stage failed (or compile timed out). |
| 2 | **Runtime Error** | `runtime_error` | Abnormal exit / crash / non-zero exit code / OOM kill (MVP). |
| 3 | **Time Limit Exceeded** | `tle` | Wall-clock (or CPU) cap hit. |
| 4 | **Wrong Answer** | `wrong_answer` | Normalized output mismatch on at least one case. |
| 5 | **Accepted** | `accepted` | Every test case passes within all limits. |

### How conflicts are resolved

The precedence is a **priority ladder over the whole submission**, resolving two kinds of conflict:

1. **Phase-level conflict (compile vs run).** If compilation fails, no execution happens at all — CE (1) wins unconditionally over anything the run phase could have produced. This is why CE is the highest priority: without a binary/valid program, later signals are undefined.

2. **Case-level conflict (different cases give different outcomes).** Execution is a loop over test cases, and different cases can independently yield RE, TLE, WA, or pass. The submission's verdict is the **most severe** outcome observed, where severity = the ladder order (RE > TLE > WA > AC):
   - If **any** case crashes → **Runtime Error** (2), regardless of other cases passing or being WA.
   - Else if **any** case times out → **Time Limit Exceeded** (3).
   - Else if **any** case mismatches → **Wrong Answer** (4).
   - Else (all cases pass within limits) → **Accepted** (5).

   Rationale: a solution that crashes or hangs on *some* input is more fundamentally broken than one that merely produces a wrong string, so the harsher signal dominates. Accepted is the **weakest** claim — it requires the *absence* of every higher-priority failure across *all* cases.

3. **Short-circuit optimization.** Because RE and TLE outrank WA/AC, the worker **may stop at the first case** that produces RE or TLE (nothing later can override it) and record `failed_test_index`. WA also records the first failing index. This is an optimization, not a semantic change — the precedence result is identical whether or not remaining cases run. (A future "run all cases for full diagnostics" mode can disable short-circuiting without changing the verdict.)

4. **Metrics under a failing verdict.** `runtime_ms`/`memory_kb` reflect the max across executed cases; `failed_test_index` is the first case that produced the winning failure (null for AC and CE).

---

## 6. Retry Strategy

Retries exist to mask **transient infrastructure failures**, never to re-roll a legitimate verdict.

### What SHOULD retry (transient / environmental)

- Worker died mid-job (lock/visibility timeout expiry re-queues it).
- Container **failed to start** or the Docker daemon returned a transient error.
- Brief **PostgreSQL** hiccup while reading inputs or persisting (connection blip, serialization failure).
- Transient **Redis** connectivity blip during job bookkeeping.
- Unexpected worker-side exception that is not a determinstic property of the submission.

### What should NEVER retry (deterministic / real outcomes)

- **Any real verdict** — AC, WA, TLE, RE, CE are *successful* jobs. They complete, they don't fail.
- **Deterministic bad input** — a submission that references a missing/soft-deleted problem, an unsupported language, or otherwise fails validation would fail identically every time; retrying wastes capacity. These go straight to `error`/dead-letter (or are rejected before enqueue).
- **Poison jobs** — a payload that repeatedly crashes the worker in the same way is dead-lettered after the cap rather than retried forever.

### Maximum retries

- **`attempts = 3`** (1 initial + up to 2 retries), configurable. Chosen to ride out brief blips without amplifying load during an outage.

### Backoff strategy

- **Exponential backoff**, base ~`2000 ms`: retries spaced roughly `2s → 4s → 8s`. Exponential (vs fixed) spacing avoids hammering a recovering dependency (Docker daemon, Postgres) and naturally spreads a thundering herd after a Redis restart.
- On exhaustion → **dead-letter** (job retained as `failed`), submission set to `error` **at that point only**, surfaced as `internal_error` (never a false AC/WA). Intermediate retries leave the row `running` so the next attempt is not skipped.
- Worker lock duration (`JUDGE_LOCK_DURATION_MS`, default 5 minutes) must exceed worst-case compile + N × time-limit. Without this, BullMQ marks the job stalled and may deliver it again while the first attempt is still inside the pipeline. A Postgres advisory lock, held for that attempt on its own connection, is what stops the second delivery from starting a sandbox. The duplicate is delayed and does not consume a retry or write a verdict. The status CAS still prevents a second terminal write. `running` → `running` stays allowed so a retry after a crash can continue once the lock is released.

---

## 7. Idempotency

Because a job can be delivered more than once (retry after a crash, at-least-once queue semantics, a duplicate enqueue), the pipeline must be safe to run repeatedly for the same submission without producing duplicate verdicts or duplicate side effects.

### Layered defenses

1. **Enqueue de-duplication (Redis).** The BullMQ `jobId` is set to `submissionId`. A second `add` with the same id is a no-op while a job for that submission is present, so a double-submit or a retrying producer can't create two queue entries.

2. **Status guard (Postgres, authoritative).** On pickup the worker re-reads the submission and **refuses to re-finalize a terminal submission**: if `status = completed` (or `error` under an intentional policy), the worker treats the job as already done and acknowledges it without re-judging. This is the ultimate guard because Postgres — not Redis — is the source of truth.

3. **Single-writer terminal transition.** The terminal write (verdict + metrics + `judged_at` + `status`) plus counter updates happen in **one transaction**, guarded by the status check, so concurrent/duplicate workers cannot both commit a verdict. A conditional update (`... WHERE status <> 'completed'`) makes the finalization atomic and once-only.

4. **Per-case rows.** `submission_test_results` are (re)written for the run that wins finalization; a losing duplicate never reaches the write because of guard (3).

5. **Side-effect idempotency.** Counter increments (`problems.total_*`) and `user_statistics` updates ride inside the same finalizing transaction, so they apply exactly once with the verdict. Cache invalidation/refresh is naturally idempotent (recompute-on-read).

**Net effect:** at-least-once delivery is converted to **effectively-once** finalization. Re-processing is harmless — it either short-circuits on the status guard or loses the conditional update race.

---

## 8. Failure Recovery

The design assumes every dependency can fail. Recovery leans on two pillars: **persist-before-enqueue** (Postgres always knows about the work) and **cattle-not-pets** containers (nothing to recover in the sandbox — just re-run).

### Redis restart

- **In-flight queue state** (waiting/delayed jobs) is backed by Redis; a restart with persistence (AOF/RDB) recovers them. Without persistence, waiting jobs could be lost — but the **submission rows still exist in Postgres**, so a **reconciliation/reaper** (scheduled scan for `status ∈ {queued, running}` older than a threshold) can **re-enqueue** them. No submission is silently lost.
- Producers/consumers reconnect automatically (ioredis retry). Enqueues attempted during the outage are retried by the reaper.

### Worker crash

- The BullMQ **lock / visibility timeout** on the active job expires; the job becomes eligible for another worker and is retried (counts against `attempts`).
- Because containers are torn down out-of-band and the submission is re-read fresh, a half-finished job leaves no partial verdict (the status guard prevents double finalization).
- Exited sandbox containers labeled for an explicit `JUDGE_SANDBOX_OWNER` can be removed by the cleanup worker. A **running** sandbox is never removed by that sweep: age past the BullMQ lock is not proof the job is finished. A crashed worker can therefore leave a running keep-alive container until an operator removes that container id.

### Docker crash

- Container-start failures or daemon errors are **transient failures** → retried with backoff (§6).
- If the daemon is down host-wide, that worker's jobs fail and are redistributed to healthy workers; if the whole fleet is affected, jobs accumulate in `waiting` (backpressure) and drain when Docker recovers — nothing is lost.
- A container that hangs is force-killed by the worker's timeout; a container that dies is simply recreated (cattle).

### PostgreSQL outage

- **On read (pickup):** the worker cannot load authoritative inputs → treat as transient, **retry with backoff**; the job stays in the queue.
- **On write (finalize):** the verdict was computed but can't be persisted → **retry the persist** (the computed result may be recomputed on retry; judging is deterministic, so recomputation yields the same verdict). The submission remains `running` until a persist succeeds; the status guard ensures only one persist wins.
- The API's **persist-before-enqueue** means a Postgres outage at submit time fails the request cleanly (no orphan job), rather than enqueuing work with no backing row.
- Prolonged outage → jobs back up in Redis (backpressure) and drain on recovery. The reaper reconciles any `running` rows stranded by crashes during the outage.
- If Redis still has the job as `completed` while the row is `queued` or `running`, the reaper removes that completed job and enqueues it once. A second observation writes `internal_error` through the status CAS, which does not replace a real verdict. An in-flight job is not removed.

---

## 9. Security Considerations

Untrusted code is the central threat. Every run is **ephemeral, powerless, and disposable** (`ARCHITECTURE.md` §5.3). The **sandbox container** is a trust boundary for user code: **nothing it produces is trusted except captured stdout / exit code / metrics.**

### Docker socket trust boundary (not the sandbox)

The judge worker process bind-mounts the **host Docker socket** (`/var/run/docker.sock` in Compose) so dockerode can create sandboxes. That is a **separate, weaker boundary**:

- A compromised worker is equivalent to local Docker root on the host.
- Sandbox `HostConfig` (no network, cap-drop, PID/memory, read-only rootfs) constrains **user programs**, not the worker.
- This architecture is accepted for the current Compose deployment. Stronger isolation (rootless Docker, gVisor, Firecracker, a tightly wrapped docker-proxy) is a future hardening step — do **not** unmount the socket while `docker.adapter.js` still needs it.

Workspace directories start at `0770`. When the host allows `chown`, they are owned by uid/gid 1000 with mode `0750`. When it does not, the directory is mode `0707` so sandbox uid 1000 can read and write the bind mount. Cleanup refuses paths outside `JUDGE_WORKSPACE_DIR` or without the `judgex-` prefix.

### Filesystem isolation

- **Read-only root filesystem**; only a small, **size-capped** writable scratch (tmpfs-style) where a program must write.
- **Per-job isolated workspace** mounted in and **deleted on completion**; one submission can never see another's files.
- Compiled artifact mounted **read-only** during execution.
- **Non-root, unprivileged user** inside the container; **no-new-privileges** so setuid escalation fails; **drop-all Linux capabilities**.

### No networking

- Networking is **disabled entirely** — user code cannot phone home, exfiltrate data/test cases, or attack internal services (Postgres, Redis, other workers). This also forces all language images to be self-contained (no runtime package fetches).

### Resource limits

- **Wall-clock timeout** (worker-enforced, external) → TLE; force-kill on breach.
- **CPU quota/shares** so one submission can't starve co-tenant jobs.
- **Hard memory cap** → OOM kill (surfaced as RE in MVP).
- **PID limit** to defeat fork bombs.
- **Overall per-submission budget** bounds many-case problems.
- **Output size caps** (defensive) so a program spewing unbounded stdout can't exhaust worker memory/disk.

### Temporary file cleanup

- Container removal + workspace deletion are **unconditional** (`finally`-guaranteed), even on crash/timeout/exception.
- Sandboxes are labeled `judgex.sandbox=true` and `judgex.sandbox.owner`. The cleanup worker removes **exited** containers for that owner only when `JUDGE_SANDBOX_OWNER` is set. It does not sweep the daemon when the owner is the default, and it does not stop running containers. Stuck `running` rows are still recovered by the reaper. Do not claim host-wide container GC.
- Hidden test data is streamed via stdin and never persisted to a shared location, minimizing its on-host footprint.

---

## 10. Future Scalability

The pipeline is designed to scale **horizontally by adding processes/hosts**, never by making a single worker unsafe or oversubscribed. None of the following require schema or API changes.

### Multiple workers (available now by design)

- Workers are **independent, stateless processes** connected to the same Redis; adding capacity = starting more workers. They **self-balance** by pulling from the shared queue.
- Per-worker **concurrency** is tuned to CPU cores/memory (judging is CPU-bound), not to thousands of async tasks.
- **Scaling signal:** sustained growth in queue `waiting` depth → add workers (PRD `NFR-OBS-2`).

### Multiple Docker hosts

- Because a worker only needs a local Docker daemon, workers can be spread across **many hosts**, each with its own daemon — multiplying sandbox capacity and isolating blast radius per host.
- Prebuilt images are distributed to each host ahead of time (registry pull at deploy, never at judge time).

### Distributed queue

- Redis/BullMQ already decouples producers from consumers across machines. Scaling the queue tier (Redis replication/HA, or partitioning by queue) lets the fleet grow without touching API or worker logic.
- **Priority/lane separation** is a natural extension: e.g., a fast lane for `Run` (custom-input) vs `Submit`, or per-language queues, without changing the payload contract (add routing metadata, §2).

### Horizontal scaling (system-wide)

- The **API server is stateless** (JWT auth, no session affinity) → scale behind a load balancer independently of workers.
- **Postgres** scales reads via replicas (leaderboard/history reads) with the primary authoritative for writes; `submissions` is the documented **partitioning/retention** candidate (DATABASE_DESIGN §10) as volume grows.
- **Backpressure is a feature:** under load, work queues in Redis rather than overwhelming workers or the DB; latency degrades gracefully and recovers as capacity is added.
- Everything stays within the **modular-monolith + separate-workers** model — no microservices, no Kubernetes, no Kafka required (per `ARCHITECTURE.md` trade-offs).

---

## Appendix — Terminology Cross-Reference

| This document | `submissions` column | Enum value |
|---------------|----------------------|------------|
| Queued | `status` | `queued` |
| Running | `status` | `running` |
| Completed (has verdict) | `status` | `completed` |
| Error (judging failed) | `status` | `error` |
| Accepted | `verdict` | `accepted` |
| Wrong Answer | `verdict` | `wrong_answer` |
| Time Limit Exceeded | `verdict` | `tle` |
| Runtime Error | `verdict` | `runtime_error` |
| Compilation Error | `verdict` | `compile_error` |

These names and values are authoritative in `DATABASE_DESIGN.md` §3.7 and must not drift when the judge sprints are implemented.
