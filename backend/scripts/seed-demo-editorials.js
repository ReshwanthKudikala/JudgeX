#!/usr/bin/env node
/**
 * Idempotent demo editorial seed (Sprint 40).
 *
 * Upserts published editorials for demo problem slugs.
 * Requires demo problems to exist (run seed-demo-problems.js first).
 *
 * Usage (from backend/):
 *   node scripts/seed-demo-editorials.js
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
  invalidateEditorialCache,
} = require('../src/modules/editorials/editorials.cache');
const { DEMO_EDITORIALS } = require('./demo-editorials-data');

async function upsertEditorial(client, demo) {
  const problemRes = await client.query(
    `SELECT id, slug FROM problems
      WHERE slug = $1 AND is_deleted = false`,
    [demo.problemSlug],
  );
  if (problemRes.rowCount === 0) {
    throw new Error(
      `Missing problem "${demo.problemSlug}". Run seed-demo-problems.js first.`,
    );
  }
  const problemId = problemRes.rows[0].id;

  const existing = await client.query(
    `SELECT id FROM editorials WHERE problem_id = $1`,
    [problemId],
  );

  if (existing.rowCount > 0) {
    const id = existing.rows[0].id;
    await client.query(
      `UPDATE editorials SET
         title = $2,
         markdown = $3,
         difficulty = $4::difficulty,
         published = true,
         is_deleted = false,
         deleted_at = NULL,
         updated_at = now()
       WHERE id = $1`,
      [id, demo.title, demo.markdown, demo.difficulty],
    );
    return { problemSlug: demo.problemSlug, id, created: false };
  }

  const id = randomUUID();
  await client.query(
    `INSERT INTO editorials (
       id, problem_id, title, markdown, difficulty, published, is_deleted
     ) VALUES ($1, $2, $3, $4, $5::difficulty, true, false)`,
    [id, problemId, demo.title, demo.markdown, demo.difficulty],
  );
  return { problemSlug: demo.problemSlug, id, created: true };
}

async function main() {
  configureLogger(config.logging);
  logger.info('Demo editorial seed starting', { count: DEMO_EDITORIALS.length });

  await connectPostgres();
  try {
    await connectRedis();
  } catch {
    logger.warn('Redis unavailable — continuing without cache invalidation');
  }

  const pool = getPool();
  const client = await pool.connect();
  const results = [];

  try {
    await client.query('BEGIN');
    for (const demo of DEMO_EDITORIALS) {
      const row = await upsertEditorial(client, demo);
      results.push(row);
      logger.info('Demo editorial upserted', row);
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  for (const row of results) {
    try {
      await invalidateEditorialCache(row.problemSlug);
    } catch {
      /* ignore */
    }
  }

  logger.info('Demo editorial seed finished', { editorials: results });
  await closeRedis().catch(() => {});
  await closePostgres();
}

main().catch(async (err) => {
  logger.error('Demo editorial seed failed', {
    error: err.message,
    stack: err.stack,
  });
  await closeRedis().catch(() => {});
  await closePostgres().catch(() => {});
  process.exit(1);
});
