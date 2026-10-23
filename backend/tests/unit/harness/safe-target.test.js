/**
 * Destructive suites must fail before connecting when aimed at the development
 * database. The child process loads the harness so this file does not freeze
 * application config for the rest of the unit run.
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('child_process');
const path = require('path');

const {
  assertDatabaseUrlIsTest,
  assertConnectedDatabaseIsTest,
  assertRedisUrlIsDb15,
  UnsafeTestTargetError,
} = require('../../integration/helpers/safe-target');

const backendRoot = path.resolve(__dirname, '../../..');

describe('destructive test targets', () => {
  it('accepts judgex_test and Redis DB 15 only', () => {
    assert.equal(
      assertDatabaseUrlIsTest('postgres://judgex:judgex@127.0.0.1:5432/judgex_test'),
      'judgex_test',
    );
    assert.doesNotThrow(() => assertConnectedDatabaseIsTest('judgex_test'));
    assert.equal(assertRedisUrlIsDb15('redis://127.0.0.1:6379/15'), '15');
  });

  it('refuses the development database and other Redis databases without echoing the URL', () => {
    assert.throws(
      () => assertDatabaseUrlIsTest('postgres://judgex:judgex@127.0.0.1:5432/judgex'),
      (err) => err instanceof UnsafeTestTargetError
        && /expected judgex_test/.test(err.message)
        && !err.message.includes('5432')
        && !err.message.includes('@'),
    );
    assert.throws(
      () => assertRedisUrlIsDb15('redis://127.0.0.1:6379'),
      /expected 15/,
    );
    assert.throws(
      () => assertConnectedDatabaseIsTest('judgex'),
      /expected judgex_test/,
    );
  });

  it('fails harness setup before opening a connection to the development database', () => {
    const result = spawnSync(process.execPath, ['-e', `
      process.env.NODE_ENV = 'test';
      process.env.JWT_SECRET = 'test-unit-secret-change-me-32chars!!!';
      process.env.LOG_LEVEL = 'error';
      process.env.DB_REQUIRED = 'true';
      process.env.DATABASE_URL = 'postgres://judgex:judgex@127.0.0.1:1/judgex';
      const { setupIntegration } = require('./tests/integration/helpers/setup');
      setupIntegration().then(() => {
        console.error('setup returned instead of refusing');
        process.exit(2);
      }).catch((err) => {
        const message = err && err.message ? err.message : '';
        if (message.includes('expected judgex_test') && !message.includes('127.0.0.1')) {
          process.exit(0);
        }
        console.error(message);
        process.exit(1);
      });
    `], {
      cwd: backendRoot,
      encoding: 'utf8',
      timeout: 20000,
    });

    assert.equal(result.status, 0, result.stderr || result.stdout || 'harness child failed');
  });
});
