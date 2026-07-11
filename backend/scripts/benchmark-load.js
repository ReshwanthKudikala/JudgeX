#!/usr/bin/env node
/**
 * Sprint 35 — API throughput / concurrent-read load harness.
 * Does NOT submit code to the judge pipeline.
 *
 * Usage:
 *   node scripts/benchmark-load.js
 *   BASE_URL=http://127.0.0.1:4000 CONCURRENCY=20 REQUESTS=200 node scripts/benchmark-load.js
 */

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:4000';
const CONCURRENCY = Math.max(1, Number(process.env.CONCURRENCY || 20));
const REQUESTS = Math.max(1, Number(process.env.REQUESTS || 200));

const ENDPOINTS = [
  { name: 'health', path: '/health' },
  { name: 'problems', path: '/api/v1/problems?page=1&limit=20' },
  { name: 'leaderboard', path: '/api/v1/leaderboard?page=1&limit=20&timeframe=all' },
  { name: 'contests', path: '/api/v1/contests?page=1&limit=20' },
];

function percentile(sorted, p) {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.floor(sorted.length * p));
  return sorted[idx];
}

async function runPool(label, path) {
  const latencies = [];
  let ok = 0;
  let fail = 0;
  let next = 0;
  const started = performance.now();

  async function worker() {
    while (next < REQUESTS) {
      const i = next;
      next += 1;
      const t0 = performance.now();
      try {
        const res = await fetch(`${BASE_URL}${path}`);
        latencies.push(performance.now() - t0);
        if (res.ok) ok += 1;
        else fail += 1;
      } catch {
        latencies.push(performance.now() - t0);
        fail += 1;
      }
      void i;
    }
  }

  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, REQUESTS) }, () => worker()));
  const elapsedSec = (performance.now() - started) / 1000;
  latencies.sort((a, b) => a - b);
  const rps = ok / elapsedSec;

  console.log(
    `${label}: concurrency=${CONCURRENCY} requests=${REQUESTS} ok=${ok} fail=${fail} ` +
      `rps=${rps.toFixed(1)} avg=${(latencies.reduce((a, b) => a + b, 0) / latencies.length || 0).toFixed(1)}ms ` +
      `p50=${percentile(latencies, 0.5).toFixed(1)}ms p95=${percentile(latencies, 0.95).toFixed(1)}ms ` +
      `p99=${percentile(latencies, 0.99).toFixed(1)}ms`,
  );

  return { label, rps, ok, fail, p50: percentile(latencies, 0.5), p95: percentile(latencies, 0.95) };
}

async function main() {
  console.log(
    `Load benchmark against ${BASE_URL} (concurrency=${CONCURRENCY}, requests/endpoint=${REQUESTS})`,
  );
  console.log('Note: submission throughput depends on worker count × JUDGE_WORKER_CONCURRENCY; this script measures read APIs.');

  const results = [];
  for (const ep of ENDPOINTS) {
    // eslint-disable-next-line no-await-in-loop
    results.push(await runPool(ep.name, ep.path));
  }

  const totalOk = results.reduce((s, r) => s + r.ok, 0);
  console.log(`Done. Aggregate successful reads: ${totalOk}`);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
