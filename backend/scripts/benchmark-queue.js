#!/usr/bin/env node
/**
 * Sprint 35 — Queue / enqueue latency probe (no Docker judge execution).
 *
 * Measures how quickly the API accepts submission creates under concurrency.
 * Requires AUTH_TOKEN (Bearer) and PROBLEM_ID (or PROBLEM_SLUG resolved via API).
 * Does not wait for judge completion — use metrics judgex_queue_wait_seconds /
 * judgex_judge_duration_seconds for end-to-end worker timing.
 *
 * Usage:
 *   AUTH_TOKEN=... PROBLEM_ID=... node scripts/benchmark-queue.js
 *   AUTH_TOKEN=... PROBLEM_SLUG=two-sum CONCURRENCY=5 REQUESTS=20 node scripts/benchmark-queue.js
 */

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:4000';
const AUTH_TOKEN = process.env.AUTH_TOKEN || '';
const PROBLEM_ID = process.env.PROBLEM_ID || '';
const PROBLEM_SLUG = process.env.PROBLEM_SLUG || '';
const CONCURRENCY = Math.max(1, Number(process.env.CONCURRENCY || 5));
const REQUESTS = Math.max(1, Number(process.env.REQUESTS || 20));
const LANGUAGE = process.env.LANGUAGE || 'python';

const SAMPLE_CODE = {
  python: 'print(1)\n',
  javascript: 'console.log(1)\n',
  cpp: '#include <iostream>\nint main(){std::cout<<1;}\n',
};

async function resolveProblemId() {
  if (PROBLEM_ID) return PROBLEM_ID;
  if (!PROBLEM_SLUG) {
    throw new Error('Set PROBLEM_ID or PROBLEM_SLUG');
  }
  const res = await fetch(`${BASE_URL}/api/v1/problems/${PROBLEM_SLUG}`);
  if (!res.ok) throw new Error(`problem lookup ${res.status}`);
  const body = await res.json();
  const id = body?.data?.id;
  if (!id) throw new Error('problem id missing in response');
  return id;
}

function percentile(sorted, p) {
  if (sorted.length === 0) return 0;
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))];
}

async function main() {
  if (!AUTH_TOKEN) {
    throw new Error('AUTH_TOKEN is required (Bearer access token)');
  }

  const problemId = await resolveProblemId();
  const code = SAMPLE_CODE[LANGUAGE] || SAMPLE_CODE.python;
  const latencies = [];
  let ok = 0;
  let fail = 0;
  let next = 0;
  const started = performance.now();

  async function worker() {
    while (next < REQUESTS) {
      next += 1;
      const t0 = performance.now();
      try {
        const res = await fetch(`${BASE_URL}/api/v1/submissions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${AUTH_TOKEN}`,
          },
          body: JSON.stringify({ problemId, language: LANGUAGE, code }),
        });
        latencies.push(performance.now() - t0);
        if (res.status === 201 || res.status === 202) ok += 1;
        else fail += 1;
      } catch {
        latencies.push(performance.now() - t0);
        fail += 1;
      }
    }
  }

  console.log(
    `Queue enqueue probe: ${BASE_URL} concurrency=${CONCURRENCY} requests=${REQUESTS} problem=${problemId}`,
  );

  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, REQUESTS) }, () => worker()));
  const elapsedSec = (performance.now() - started) / 1000;
  latencies.sort((a, b) => a - b);

  console.log(
    `submissions_enqueue: ok=${ok} fail=${fail} submissions_per_sec=${(ok / elapsedSec).toFixed(2)} ` +
      `avg=${(latencies.reduce((a, b) => a + b, 0) / latencies.length || 0).toFixed(1)}ms ` +
      `p50=${percentile(latencies, 0.5).toFixed(1)}ms p95=${percentile(latencies, 0.95).toFixed(1)}ms`,
  );
  console.log(
    'Queue wait / judge duration: scrape GET /metrics for judgex_queue_wait_seconds and judgex_judge_duration_seconds after workers drain.',
  );
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
