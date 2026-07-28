#!/usr/bin/env node
/**
 * Upsert portfolio demo problems with full statements, constraints,
 * public samples, and hidden judge test cases.
 *
 * - Does not change schema / API / frontend / judge pipeline.
 * - Updates statement + constraints_text for known demo slugs.
 * - Replaces public (is_hidden = false) sample test cases from catalog.samples.
 * - Replaces hidden (is_hidden = true) judge cases from catalog.hiddenTests.
 *
 * Usage (from backend/):
 *   node scripts/seed-demo-problems.js
 *   # or with compose env:
 *   docker compose -f ../docker-compose.prod.yml --env-file ../.env.production exec api node scripts/seed-demo-problems.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const { randomUUID } = require('crypto');
const { config } = require('../src/config');
const { configure: configureLogger, logger } = require('../src/shared/logger/logger');
const {
  connectPostgres,
  closePostgres,
  getPool,
} = require('../src/infrastructure/database/pool');
const {
  connectRedis,
  closeRedis,
} = require('../src/infrastructure/cache/redis.cache');
const {
  invalidateProblemDetail,
  invalidateAllProblemLists,
} = require('../src/modules/problems/problems.cache');
const { DEMO_PROBLEMS } = require('./demo-problems-data');

function byteLength(text) {
  return Buffer.byteLength(String(text ?? ''), 'utf8');
}

async function upsertProblem(client, demo) {
  const existing = await client.query(
    `SELECT id, slug FROM problems WHERE slug = $1 AND is_deleted = false`,
    [demo.slug],
  );

  if (existing.rowCount > 0) {
    const id = existing.rows[0].id;
    await client.query(
      `UPDATE problems SET
         title = $2,
         statement = $3,
         constraints_text = $4,
         difficulty = $5::difficulty,
         time_limit_ms = $6,
         memory_limit_mb = $7,
         is_published = true,
         updated_at = now()
       WHERE id = $1`,
      [
        id,
        demo.title,
        demo.statement,
        demo.constraintsText,
        demo.difficulty,
        demo.timeLimitMs,
        demo.memoryLimitMb,
      ],
    );
    return { id, created: false };
  }

  const id = randomUUID();
  await client.query(
    `INSERT INTO problems (
       id, slug, title, statement, constraints_text, difficulty,
       time_limit_ms, memory_limit_mb, is_published
     ) VALUES (
       $1, $2, $3, $4, $5, $6::difficulty, $7, $8, true
     )`,
    [
      id,
      demo.slug,
      demo.title,
      demo.statement,
      demo.constraintsText,
      demo.difficulty,
      demo.timeLimitMs,
      demo.memoryLimitMb,
    ],
  );
  return { id, created: true };
}

/**
 * Replace public samples (is_hidden = false) from catalog.samples.
 */
async function replacePublicSamples(client, problemId, samples) {
  await client.query(
    `DELETE FROM test_cases WHERE problem_id = $1 AND is_hidden = false`,
    [problemId],
  );

  for (let i = 0; i < samples.length; i += 1) {
    const sample = samples[i];
    const input = sample.input;
    const expected = sample.expectedOutput;
    await client.query(
      `INSERT INTO test_cases (
         id, problem_id, is_hidden, input_ref, expected_output_ref,
         is_inline, size_bytes, display_order, explanation
       ) VALUES (
         $1, $2, false, $3, $4, true, $5, $6, $7
       )`,
      [
        randomUUID(),
        problemId,
        input,
        expected,
        byteLength(input) + byteLength(expected),
        i,
        sample.explanation ?? null,
      ],
    );
  }
}

/**
 * Replace hidden judge cases (is_hidden = true) from catalog.hiddenTests.
 * Display order continues after public samples so judge order is samples then hidden.
 */
async function replaceHiddenTests(client, problemId, hiddenTests, displayOrderStart) {
  await client.query(
    `DELETE FROM test_cases WHERE problem_id = $1 AND is_hidden = true`,
    [problemId],
  );

  const cases = Array.isArray(hiddenTests) ? hiddenTests : [];
  for (let i = 0; i < cases.length; i += 1) {
    const test = cases[i];
    const input = test.input;
    const expected = test.expectedOutput;
    await client.query(
      `INSERT INTO test_cases (
         id, problem_id, is_hidden, input_ref, expected_output_ref,
         is_inline, size_bytes, display_order, explanation
       ) VALUES (
         $1, $2, true, $3, $4, true, $5, $6, $7
       )`,
      [
        randomUUID(),
        problemId,
        input,
        expected,
        byteLength(input) + byteLength(expected),
        displayOrderStart + i,
        test.explanation ?? null,
      ],
    );
  }
}

async function seedOne(pool, demo) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { id, created } = await upsertProblem(client, demo);
    const samples = demo.samples || [];
    const hiddenTests = demo.hiddenTests || [];
    await replacePublicSamples(client, id, samples);
    await replaceHiddenTests(client, id, hiddenTests, samples.length);
    await client.query('COMMIT');
    return {
      slug: demo.slug,
      id,
      created,
      samples: samples.length,
      hidden: hiddenTests.length,
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function main() {
  configureLogger({ level: config.logging.level, format: config.logging.format });
  logger.info('Demo problem seed starting', { count: DEMO_PROBLEMS.length });

  try {
    await connectPostgres({
      retries: config.infra.startupRetries,
      delayMs: config.infra.startupRetryDelayMs,
    });

    try {
      await connectRedis({
        retries: Math.min(3, config.infra.startupRetries),
        delayMs: config.infra.startupRetryDelayMs,
      });
    } catch (err) {
      logger.warn('Redis unavailable; seed will continue without cache invalidation', {
        error: err.message,
      });
    }

    const pool = getPool();
    const results = [];
    for (const demo of DEMO_PROBLEMS) {
      const result = await seedOne(pool, demo);
      results.push(result);
      try {
        await invalidateProblemDetail(demo.slug);
      } catch {
        /* ignore */
      }
      logger.info('Demo problem upserted', result);
    }

    try {
      await invalidateAllProblemLists();
    } catch {
      /* ignore */
    }

    logger.info('Demo problem seed finished', {
      problems: results.map((r) => ({
        slug: r.slug,
        public: r.samples,
        hidden: r.hidden,
        total: r.samples + r.hidden,
      })),
    });
  } catch (err) {
    logger.error('Demo problem seed failed', {
      error: err.message,
      stack: err.stack,
    });
    process.exitCode = 1;
  } finally {
    await closeRedis().catch(() => {});
    await closePostgres();
  }
}

main();
