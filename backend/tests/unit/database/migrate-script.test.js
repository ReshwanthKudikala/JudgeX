const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('child_process');
const path = require('path');

const script = path.join(__dirname, '..', '..', '..', 'scripts', 'migrate.js');

describe('migrate.js failure exit', () => {
  it('exits non-zero when Postgres cannot be reached', () => {
    const databaseUrl = 'postgres://migrate-test:migrate-test@127.0.0.1:1/migrate_test_unused';
    assert.match(databaseUrl, /migrate_test_unused/);
    assert.doesNotMatch(databaseUrl, /\/judgex$/);

    const result = spawnSync(process.execPath, [script], {
      cwd: path.join(__dirname, '..', '..', '..'),
      encoding: 'utf8',
      timeout: 15000,
      env: {
        ...process.env,
        NODE_ENV: 'test',
        LOG_LEVEL: 'error',
        DATABASE_URL: databaseUrl,
        REDIS_URL: 'redis://127.0.0.1:1/15',
        DB_REQUIRED: 'true',
        REDIS_REQUIRED: 'false',
        INFRA_STARTUP_RETRIES: '0',
        INFRA_STARTUP_RETRY_DELAY_MS: '50',
        DB_CONNECTION_TIMEOUT_MS: '500',
        JWT_SECRET: 'test-migrate-script-secret-32chars!!',
      },
    });

    assert.equal(result.status, 1);
    const output = `${result.stdout || ''}\n${result.stderr || ''}`;
    assert.match(output, /Database migrate failed/);
    assert.doesNotMatch(output, /Applied database migration/);
    assert.doesNotMatch(output, /Database migrate finished/);
  });
});
