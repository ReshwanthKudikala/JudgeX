#!/usr/bin/env node
/**
 * Idempotent demo contest seed (Sprint 39).
 *
 * - Requires demo problems (two-sum, a-plus-b, palindrome-number).
 * - Upserts contests by fixed UUID + slug.
 * - Replaces contest_problems for each demo contest.
 * - Recomputes start/end relative to now so Running/Upcoming/Past stay meaningful.
 *
 * Usage (from backend/):
 *   node scripts/seed-demo-contests.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

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
  invalidateContestListCache,
} = require('../src/modules/contests/contests.cache');
const {
  DEMO_CONTESTS,
  resolveContestWindow,
} = require('./demo-contests-data');
const { deriveContestStatus } = require('../src/modules/contests/contests.helpers');

async function resolveProblemIds(client, slugs) {
  const { rows } = await client.query(
    `SELECT id, slug FROM problems
      WHERE slug = ANY($1::text[])
        AND is_deleted = false`,
    [slugs],
  );
  const map = new Map(rows.map((r) => [r.slug, r.id]));
  for (const slug of slugs) {
    if (!map.has(slug)) {
      throw new Error(
        `Missing demo problem slug "${slug}". Run seed-demo-problems.js first.`,
      );
    }
  }
  return map;
}

async function upsertContest(client, demo, problemIdsBySlug) {
  const { startTime, endTime } = resolveContestWindow(
    demo.timing,
    demo.durationMinutes,
  );
  const status = deriveContestStatus({
    start_time: startTime,
    end_time: endTime,
  });

  const body = [
    demo.description.trim(),
    '',
    'Rules',
    demo.rules.trim(),
  ].join('\n');

  await client.query(
    `INSERT INTO contests (
       id, slug, title, description, start_time, end_time, duration_minutes,
       visibility, status, is_deleted, created_at, updated_at
     ) VALUES (
       $1, $2, $3, $4, $5, $6, $7,
       $8::contest_visibility, $9::contest_status, false, now(), now()
     )
     ON CONFLICT (id) DO UPDATE SET
       slug = EXCLUDED.slug,
       title = EXCLUDED.title,
       description = EXCLUDED.description,
       start_time = EXCLUDED.start_time,
       end_time = EXCLUDED.end_time,
       duration_minutes = EXCLUDED.duration_minutes,
       visibility = EXCLUDED.visibility,
       status = EXCLUDED.status,
       is_deleted = false,
       deleted_at = NULL,
       updated_at = now()`,
    [
      demo.id,
      demo.slug,
      demo.title,
      body,
      startTime.toISOString(),
      endTime.toISOString(),
      demo.durationMinutes,
      demo.visibility,
      status,
    ],
  );

  // Also handle unique slug collisions if a different id owned the slug.
  await client.query(
    `UPDATE contests
        SET is_deleted = true, deleted_at = now(), updated_at = now()
      WHERE slug = $1
        AND id <> $2
        AND is_deleted = false`,
    [demo.slug, demo.id],
  );

  await client.query(`DELETE FROM contest_problems WHERE contest_id = $1`, [
    demo.id,
  ]);

  let order = 0;
  for (const problemSlug of demo.problemSlugs) {
    const problemId = problemIdsBySlug.get(problemSlug);
    await client.query(
      `INSERT INTO contest_problems (contest_id, problem_id, display_order, points)
       VALUES ($1, $2, $3, 100)`,
      [demo.id, problemId, order],
    );
    order += 1;
  }

  return {
    slug: demo.slug,
    title: demo.title,
    status,
    problems: demo.problemSlugs.length,
    startTime: startTime.toISOString(),
    endTime: endTime.toISOString(),
  };
}

async function main() {
  configureLogger(config.logging);
  logger.info('Demo contest seed starting', { count: DEMO_CONTESTS.length });

  await connectPostgres();
  try {
    await connectRedis();
  } catch {
    logger.warn('Redis unavailable — continuing seed without cache invalidation');
  }

  const pool = getPool();
  const client = await pool.connect();
  const results = [];

  try {
    await client.query('BEGIN');

    const allSlugs = [
      ...new Set(DEMO_CONTESTS.flatMap((c) => c.problemSlugs)),
    ];
    const problemIdsBySlug = await resolveProblemIds(client, allSlugs);

    for (const demo of DEMO_CONTESTS) {
      const row = await upsertContest(client, demo, problemIdsBySlug);
      results.push(row);
      logger.info('Demo contest upserted', row);
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  try {
    await invalidateContestListCache();
  } catch {
    /* ignore */
  }

  logger.info('Demo contest seed finished', { contests: results });
  await closeRedis().catch(() => {});
  await closePostgres();
}

main().catch(async (err) => {
  logger.error('Demo contest seed failed', { error: err.message, stack: err.stack });
  await closeRedis().catch(() => {});
  await closePostgres().catch(() => {});
  process.exit(1);
});
