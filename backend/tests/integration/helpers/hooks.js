/**
 * Shared suite lifecycle for integration tests.
 * Individual tests call `requireInfra(t)` and skip when Postgres is unavailable.
 */
const { before, after, beforeEach } = require('node:test');
const {
  setupIntegration,
  resetDatabase,
  teardownIntegration,
} = require('./setup');

function registerSuiteHooks() {
  let available = false;
  let reason = 'not initialized';

  before(async () => {
    const result = await setupIntegration();
    available = result.available;
    reason = result.reason || '';
    if (!available) {
      // eslint-disable-next-line no-console
      console.warn(`[integration] Infrastructure unavailable — tests will skip: ${reason}`);
    }
  });

  beforeEach(async () => {
    if (available) {
      await resetDatabase();
    }
  });

  after(async () => {
    await teardownIntegration();
  });

  /** @returns {boolean} false when the test should return early (already skipped). */
  function requireInfra(t) {
    if (!available) {
      t.skip(`PostgreSQL unavailable: ${reason}`);
      return false;
    }
    return true;
  }

  return { requireInfra, isAvailable: () => available };
}

module.exports = { registerSuiteHooks };
