#!/usr/bin/env node
/**
 * Sprint 35 — Print EXPLAIN (ANALYZE optional) templates for hot paths.
 * Requires DATABASE_URL. Set ANALYZE=1 to run EXPLAIN ANALYZE (writes; use on staging).
 *
 * Usage:
 *   node scripts/explain-hot-queries.js
 *   ANALYZE=1 node scripts/explain-hot-queries.js
 */

require('dotenv').config();
const { Client } = require('pg');

const ANALYZE = process.env.ANALYZE === '1' || process.env.ANALYZE === 'true';
const prefix = ANALYZE ? 'EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)' : 'EXPLAIN (FORMAT TEXT)';

const QUERIES = [
  {
    name: 'submissions_user_page',
    sql: `
      SELECT id, verdict, status, submitted_at
        FROM submissions
       WHERE user_id = $1
       ORDER BY submitted_at DESC
       LIMIT 20`,
    // Placeholder UUID — plan still shows index choice.
    params: ['00000000-0000-4000-8000-000000000001'],
  },
  {
    name: 'leaderboard_window',
    sql: `
      WITH stats AS (
        SELECT
          u.id AS user_id,
          COUNT(DISTINCT s.problem_id) FILTER (WHERE s.verdict = 'accepted')::int AS problems_solved,
          COUNT(*) FILTER (WHERE s.verdict = 'accepted')::int AS total_accepted,
          COUNT(*)::int AS total_submissions,
          CASE WHEN COUNT(*) > 0 THEN
            ROUND((COUNT(*) FILTER (WHERE s.verdict = 'accepted')::numeric / COUNT(*)::numeric) * 100, 2)
          ELSE 0 END AS acceptance_rate,
          MAX(s.submitted_at) FILTER (WHERE s.verdict = 'accepted') AS last_solved_at,
          u.created_at AS user_created_at
        FROM users u
        INNER JOIN submissions s ON s.user_id = u.id
        WHERE u.is_deleted = false
        GROUP BY u.id, u.username, u.created_at
      ),
      ranked AS (
        SELECT ROW_NUMBER() OVER (
          ORDER BY problems_solved DESC, acceptance_rate DESC, total_accepted DESC,
                   last_solved_at ASC NULLS LAST, user_created_at ASC
        )::int AS rank, *
        FROM stats
      )
      SELECT rank, user_id, problems_solved, COUNT(*) OVER()::int AS total
        FROM ranked
       ORDER BY rank ASC
       LIMIT 20 OFFSET 0`,
    params: [],
  },
  {
    name: 'contests_public_list',
    sql: `
      SELECT id, title, status, start_time
        FROM contests
       WHERE is_deleted = false AND visibility = 'public'
       ORDER BY start_time DESC
       LIMIT 20`,
    params: [],
  },
  {
    name: 'discussions_search',
    sql: `
      SELECT id, title
        FROM discussions
       WHERE is_deleted = false
         AND title ILIKE $1
       ORDER BY created_at DESC
       LIMIT 20`,
    params: ['%two%'],
  },
  {
    name: 'editorial_by_problem',
    sql: `
      SELECT e.id, e.is_published
        FROM editorials e
        INNER JOIN problems p ON p.id = e.problem_id
       WHERE p.slug = $1 AND p.is_deleted = false
       LIMIT 1`,
    params: ['two-sum'],
  },
];

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is required');
  }

  const client = new Client({ connectionString });
  await client.connect();
  console.log(`Hot-query plans (${ANALYZE ? 'ANALYZE' : 'EXPLAIN only'})\n`);

  for (const q of QUERIES) {
    console.log(`=== ${q.name} ===`);
    try {
      // eslint-disable-next-line no-await-in-loop
      const res = await client.query(`${prefix} ${q.sql}`, q.params);
      for (const row of res.rows) {
        console.log(Object.values(row)[0]);
      }
    } catch (err) {
      console.log(`(skipped) ${err.message}`);
    }
    console.log('');
  }

  await client.end();
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
