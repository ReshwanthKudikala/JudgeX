/**
 * Destructive tests may use only the dedicated Postgres database and Redis DB.
 * Errors name the database or Redis DB index, never the connection string.
 */

class UnsafeTestTargetError extends Error {
  constructor(message) {
    super(message);
    this.name = 'UnsafeTestTargetError';
  }
}

function databaseNameFromUrl(databaseUrl) {
  let parsed;
  try {
    parsed = new URL(databaseUrl);
  } catch {
    throw new UnsafeTestTargetError('Refusing tests: DATABASE_URL is missing or not a URL.');
  }
  return decodeURIComponent(parsed.pathname.replace(/^\//, ''));
}

function assertDatabaseUrlIsTest(databaseUrl = process.env.DATABASE_URL) {
  const name = databaseNameFromUrl(databaseUrl);
  if (name !== 'judgex_test') {
    throw new UnsafeTestTargetError(
      `Refusing tests against database "${name || '(empty)'}"; expected judgex_test.`,
    );
  }
  return name;
}

function assertConnectedDatabaseIsTest(name) {
  if (name !== 'judgex_test') {
    throw new UnsafeTestTargetError(
      `Refusing tests: connected database is "${name}", expected judgex_test.`,
    );
  }
}

function redisDbFromUrl(redisUrl) {
  let parsed;
  try {
    parsed = new URL(redisUrl);
  } catch {
    return '';
  }
  const db = parsed.pathname.replace(/^\//, '');
  return db || '0';
}

function assertRedisUrlIsDb15(redisUrl = process.env.REDIS_URL) {
  const db = redisDbFromUrl(redisUrl);
  if (db !== '15') {
    throw new UnsafeTestTargetError(
      `Refusing tests against Redis DB "${db || '(unset)'}"; expected 15.`,
    );
  }
  return db;
}

module.exports = {
  UnsafeTestTargetError,
  databaseNameFromUrl,
  assertDatabaseUrlIsTest,
  assertConnectedDatabaseIsTest,
  redisDbFromUrl,
  assertRedisUrlIsDb15,
};
