// Must be required before any application module so config/env.schema sees test values.
// Integration tests target a real Postgres (+ optional Redis) instance.

process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = process.env.LOG_LEVEL || 'error';
process.env.BCRYPT_SALT_ROUNDS = process.env.BCRYPT_SALT_ROUNDS || '4';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-integration-secret-change-me-32chars';
process.env.DB_REQUIRED = process.env.DB_REQUIRED || 'true';
// Queue is not exercised in these suites; Redis may be absent.
process.env.REDIS_REQUIRED = process.env.REDIS_REQUIRED || 'false';
process.env.INFRA_STARTUP_RETRIES = process.env.INFRA_STARTUP_RETRIES || '1';
process.env.INFRA_STARTUP_RETRY_DELAY_MS = process.env.INFRA_STARTUP_RETRY_DELAY_MS || '200';
// Destructive suites must not inherit the development database. An explicit
// DATABASE_URL is still checked before any migrate or truncate.
process.env.DATABASE_URL =
  process.env.DATABASE_URL || 'postgres://judgex:judgex@localhost:5432/judgex_test';
process.env.REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379/15';
// dotenv does not override an existing variable. Pin console mode so a
// developer SMTP configuration in .env cannot send real mail from this suite.
process.env.EMAIL_PROVIDER = 'console';
