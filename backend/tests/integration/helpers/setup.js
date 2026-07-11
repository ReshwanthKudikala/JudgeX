// Integration harness: connect infrastructure, apply migrations, reset tables between tests.

require('./bootstrap');

const { initInfrastructure, shutdownInfrastructure, getPool } = require('../../../src/infrastructure');
const { migrate } = require('../../../src/infrastructure/database/migrator');
const { createApp } = require('../../../src/app');

const TRUNCATE_SQL = `
  TRUNCATE TABLE
    ai_feedback,
    submission_test_results,
    submissions,
    test_cases,
    problem_examples,
    problem_tags,
    tags,
    user_statistics,
    problems,
    users
  RESTART IDENTITY CASCADE
`;

let app = null;
let ready = false;
let unavailableReason = null;

/**
 * Initialize Postgres (+ Redis), run SQL migrations, and build the app.
 * Safe to call once per process. If Postgres is unreachable, records the reason
 * so suites can skip instead of failing noisily.
 */
async function setupIntegration() {
  if (ready) return { app, available: true };
  if (unavailableReason) return { app: null, available: false, reason: unavailableReason };

  try {
    await initInfrastructure();
    const pool = getPool();
    await migrate(pool);
    app = createApp();
    ready = true;
    return { app, available: true };
  } catch (err) {
    unavailableReason = err.message;
    try {
      await shutdownInfrastructure();
    } catch {
      /* ignore */
    }
    return { app: null, available: false, reason: unavailableReason };
  }
}

async function resetDatabase() {
  if (!ready) return;
  await getPool().query(TRUNCATE_SQL);
}

async function teardownIntegration() {
  if (!ready && !unavailableReason) return;
  ready = false;
  app = null;
  await shutdownInfrastructure();
}

function getApp() {
  if (!app) throw new Error('Integration harness not ready. Call setupIntegration() first.');
  return app;
}

function query(text, params) {
  return getPool().query(text, params);
}

module.exports = {
  setupIntegration,
  resetDatabase,
  teardownIntegration,
  getApp,
  query,
};
