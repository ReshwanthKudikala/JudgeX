#!/usr/bin/env node
/**
 * Idempotent backfill of denormalized submission counters.
 *
 * problems.total_submissions / total_accepted count completed verdicts only
 * (the same rows completeSubmission increments). internal_error is excluded.
 * user_statistics keeps the documented formula: acceptance_rate is accepted
 * divided by every submission row for that user.
 *
 * Refuses to run unless --database matches both DATABASE_URL and
 * current_database(). Refuses NODE_ENV=production. Refuses the development
 * database name "judgex" unless --allow-development-database is passed.
 * Never targets production Compose. Does not TRUNCATE or DROP.
 *
 *   DATABASE_URL=postgres://judgex:judgex@127.0.0.1:5432/judgex_test \
 *     node scripts/backfill-submission-counters.js --database judgex_test
 */

const { Client } = require('pg');

const PROBLEM_SQL = `
  UPDATE problems AS p
     SET total_submissions = agg.total_submissions,
         total_accepted = agg.total_accepted,
         updated_at = now()
    FROM (
      SELECT p2.id,
             COUNT(s.id) FILTER (WHERE s.status = 'completed')::bigint AS total_submissions,
             COUNT(s.id) FILTER (
               WHERE s.status = 'completed' AND s.verdict = 'accepted'
             )::bigint AS total_accepted
        FROM problems p2
        LEFT JOIN submissions s ON s.problem_id = p2.id
       GROUP BY p2.id
    ) AS agg
   WHERE p.id = agg.id
     AND (
       p.total_submissions IS DISTINCT FROM agg.total_submissions
       OR p.total_accepted IS DISTINCT FROM agg.total_accepted
     )
`;

const USER_STATS_SQL = `
  INSERT INTO user_statistics (
    user_id, problems_solved, total_submissions, total_accepted,
    acceptance_rate, last_solved_at, updated_at
  )
  SELECT
    user_id,
    COUNT(DISTINCT problem_id) FILTER (WHERE verdict = 'accepted')::int,
    COUNT(*)::int,
    COUNT(*) FILTER (WHERE verdict = 'accepted')::int,
    CASE
      WHEN COUNT(*) > 0 THEN
        ROUND(
          (COUNT(*) FILTER (WHERE verdict = 'accepted')::numeric / COUNT(*)::numeric) * 100,
          2
        )
      ELSE 0
    END,
    MAX(submitted_at) FILTER (WHERE verdict = 'accepted'),
    now()
    FROM submissions
   GROUP BY user_id
  ON CONFLICT (user_id) DO UPDATE SET
    problems_solved = EXCLUDED.problems_solved,
    total_submissions = EXCLUDED.total_submissions,
    total_accepted = EXCLUDED.total_accepted,
    acceptance_rate = EXCLUDED.acceptance_rate,
    last_solved_at = EXCLUDED.last_solved_at,
    updated_at = now()
`;

function flagValue(name) {
  const index = process.argv.indexOf(name);
  if (index === -1 || !process.argv[index + 1]) return null;
  return process.argv[index + 1];
}

function databaseNameFromUrl(raw) {
  const parsed = new URL(raw);
  return decodeURIComponent(parsed.pathname.replace(/^\//, ''));
}

async function main() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Refusing to backfill when NODE_ENV=production.');
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required. This script does not read .env.production.');
  }

  const requested = flagValue('--database');
  const fromUrl = databaseNameFromUrl(databaseUrl);
  if (!requested || requested !== fromUrl) {
    throw new Error(
      `Pass --database ${fromUrl} so the URL and the flag name the same database.`,
    );
  }
  if (requested === 'judgex' && !process.argv.includes('--allow-development-database')) {
    throw new Error(
      'Refusing to backfill the development database "judgex" without --allow-development-database.',
    );
  }

  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    const probe = await client.query('SELECT current_database() AS db');
    const current = probe.rows[0].db;
    if (current !== requested) {
      throw new Error(`Connected to ${current}, expected ${requested}. Aborting.`);
    }

    await client.query('BEGIN');
    const problems = await client.query(PROBLEM_SQL);
    const stats = await client.query(USER_STATS_SQL);
    await client.query('COMMIT');
    console.log(
      `backfill ${current}: problems_updated=${problems.rowCount} user_statistics_upserted=${stats.rowCount}`,
    );
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
