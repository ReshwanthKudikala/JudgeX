#!/usr/bin/env node
// Apply pending SQL migrations: `node scripts/migrate.js` (or npm run db:migrate).

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const { config } = require('../src/config');
const { configure: configureLogger, logger } = require('../src/shared/logger/logger');
const {
  connectPostgres,
  closePostgres,
  getPool,
} = require('../src/infrastructure/database/pool');
const { migrate, listAppliedMigrations } = require('../src/infrastructure/database/migrator');

async function main() {
  configureLogger({ level: config.logging.level });
  logger.info('Database migrate starting', { env: config.env });

  let failed = false;
  try {
    await connectPostgres({
      retries: config.infra.startupRetries,
      delayMs: config.infra.startupRetryDelayMs,
    });
    const pool = getPool();
    const result = await migrate(pool);
    const applied = await listAppliedMigrations(pool);

    logger.info('Database migrate finished', {
      newlyApplied: result.applied,
      skipped: result.skipped.length,
      tracked: applied,
    });
  } catch (err) {
    failed = true;
    logger.error('Database migrate failed', {
      error: err.message,
      stack: err.stack,
    });
  } finally {
    await closePostgres();
  }

  // Exit after the pool is closed so Compose sees a definite non-zero status
  // and does not start the API. A lingering handle must not turn this into 0.
  if (failed) process.exit(1);
}

main();
