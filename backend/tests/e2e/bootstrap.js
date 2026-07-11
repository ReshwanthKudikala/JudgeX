// Must load before any application module so config/env.schema sees test values.
// E2E suites exercise API → queue → worker → Docker → Postgres.

process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = process.env.LOG_LEVEL || 'error';
process.env.BCRYPT_SALT_ROUNDS = process.env.BCRYPT_SALT_ROUNDS || '4';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-e2e-secret-change-me-32chars!!';
process.env.DB_REQUIRED = process.env.DB_REQUIRED || 'true';
process.env.REDIS_REQUIRED = process.env.REDIS_REQUIRED || 'true';
process.env.INFRA_STARTUP_RETRIES = process.env.INFRA_STARTUP_RETRIES || '1';
process.env.INFRA_STARTUP_RETRY_DELAY_MS = process.env.INFRA_STARTUP_RETRY_DELAY_MS || '200';
process.env.DATABASE_URL =
  process.env.DATABASE_URL || 'postgres://judgex:judgex@localhost:5432/judgex';
process.env.REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
