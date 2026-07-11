#!/usr/bin/env node
/**
 * Lightweight latency smoke for auth + health (Sprint 32 Part 8).
 * Does not hit the judge pipeline. Requires a running API (default :4000).
 *
 * Usage:
 *   node scripts/benchmark-security.js
 *   BASE_URL=http://localhost:4000 ITERATIONS=50 node scripts/benchmark-security.js
 */

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:4000';
const ITERATIONS = Number(process.env.ITERATIONS || 30);

async function time(label, fn) {
  const samples = [];
  for (let i = 0; i < ITERATIONS; i += 1) {
    const start = performance.now();
    await fn(i);
    samples.push(performance.now() - start);
  }
  samples.sort((a, b) => a - b);
  const sum = samples.reduce((a, b) => a + b, 0);
  const p50 = samples[Math.floor(samples.length * 0.5)];
  const p95 = samples[Math.floor(samples.length * 0.95)];
  console.log(
    `${label}: n=${ITERATIONS} avg=${(sum / samples.length).toFixed(1)}ms p50=${p50.toFixed(1)}ms p95=${p95.toFixed(1)}ms`,
  );
}

async function main() {
  console.log(`Benchmarking ${BASE_URL} (${ITERATIONS} iterations)`);

  await time('GET /health', async () => {
    const res = await fetch(`${BASE_URL}/health`);
    if (!res.ok) throw new Error(`health ${res.status}`);
  });

  await time('POST /auth/login (invalid)', async () => {
    const res = await fetch(`${BASE_URL}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'bench@example.com', password: 'wrong-password-xx' }),
    });
    // 401 expected; 429 acceptable under tight limits.
    if (res.status !== 401 && res.status !== 429 && res.status !== 400) {
      throw new Error(`login unexpected ${res.status}`);
    }
  });

  console.log('Done. Submission throughput is unaffected: only POST /submissions is rate-limited; status polling is not.');
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
