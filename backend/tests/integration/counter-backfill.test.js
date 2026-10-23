const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('child_process');
const path = require('path');
const crypto = require('crypto');

require('./helpers/bootstrap');
const { registerSuiteHooks } = require('./helpers/hooks');
const { createAdmin, createUser, createPublishedProblem, unique } = require('./helpers/fixtures');
const { query } = require('./helpers/setup');
const { assertConnectedDatabaseIsTest } = require('./helpers/safe-target');

const { requireInfra } = registerSuiteHooks();

const SCRIPT = path.join(__dirname, '../../scripts/backfill-submission-counters.js');

function runBackfill(databaseUrl, args, env = {}) {
  return spawnSync(process.execPath, [SCRIPT, ...args], {
    encoding: 'utf8',
    env: { ...process.env, ...env, DATABASE_URL: databaseUrl },
  });
}

describe('Submission counter backfill', () => {
  it('refuses production and the development database name before connecting', () => {
    const closedPort = 'postgres://judgex:judgex@127.0.0.1:1/judgex_test';
    const production = runBackfill(closedPort, ['--database', 'judgex_test'], {
      NODE_ENV: 'production',
    });
    assert.notEqual(production.status, 0);
    assert.match(production.stderr, /NODE_ENV=production/);

    const development = runBackfill('postgres://judgex:judgex@127.0.0.1:1/judgex', [
      '--database',
      'judgex',
    ]);
    assert.notEqual(development.status, 0);
    assert.match(development.stderr, /development database "judgex"/);
  });

  it('rebuilds problem counters and the documented acceptance rate, then is idempotent', async (t) => {
    if (!requireInfra(t)) return;

    const { rows: dbRows } = await query('SELECT current_database() AS db');
    const databaseName = dbRows[0].db;
    assertConnectedDatabaseIsTest(databaseName);

    const admin = await createAdmin();
    const user = await createUser();
    const { res: problemRes } = await createPublishedProblem(admin.accessToken, {
      slug: unique('backfill'),
    });
    const problemId = problemRes.body.data.id;
    const userId = user.user.id;

    async function insertSubmission(status, verdict) {
      await query(
        `INSERT INTO submissions (id, user_id, problem_id, language, source_code, status, verdict, judged_at)
         VALUES ($1, $2, $3, 'python', 'print(1)', $4::submission_status, $5::verdict,
                 CASE WHEN $4 IN ('completed', 'error') THEN now() ELSE NULL END)`,
        [crypto.randomUUID(), userId, problemId, status, verdict],
      );
    }

    await insertSubmission('completed', 'accepted');
    await insertSubmission('completed', 'wrong_answer');
    await insertSubmission('error', 'internal_error');
    await insertSubmission('queued', null);

    await query(
      `UPDATE problems SET total_submissions = 99, total_accepted = 99 WHERE id = $1`,
      [problemId],
    );
    await query('DELETE FROM user_statistics WHERE user_id = $1', [userId]);

    const args = ['--database', databaseName];
    if (databaseName === 'judgex') args.push('--allow-development-database');
    const first = runBackfill(process.env.DATABASE_URL, args);
    assert.equal(first.status, 0, first.stderr);

    const { rows: problems } = await query(
      `SELECT total_submissions, total_accepted FROM problems WHERE id = $1`,
      [problemId],
    );
    assert.equal(Number(problems[0].total_submissions), 2);
    assert.equal(Number(problems[0].total_accepted), 1);

    const { rows: stats } = await query(
      `SELECT problems_solved, total_submissions, total_accepted, acceptance_rate
         FROM user_statistics WHERE user_id = $1`,
      [userId],
    );
    assert.equal(Number(stats[0].problems_solved), 1);
    assert.equal(Number(stats[0].total_submissions), 4);
    assert.equal(Number(stats[0].total_accepted), 1);
    assert.equal(Number(stats[0].acceptance_rate), 25);

    const second = runBackfill(process.env.DATABASE_URL, args);
    assert.equal(second.status, 0, second.stderr);
    assert.match(second.stdout, /problems_updated=0/);

    const { rows: again } = await query(
      `SELECT total_submissions, total_accepted FROM problems WHERE id = $1`,
      [problemId],
    );
    assert.equal(Number(again[0].total_submissions), 2);
    assert.equal(Number(again[0].total_accepted), 1);
  });
});
