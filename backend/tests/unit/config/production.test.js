/**
 * Sprint 17 — production config validation unit tests.
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-unit-secret-change-me-32chars!!!';

const {
  assertProductionReady,
  getStartupDiagnostics,
} = require('../../../src/config/production');

function baseCfg(overrides = {}) {
  return {
    isProduction: true,
    env: 'production',
    server: { port: 4000 },
    database: {
      required: true,
      url: 'postgres://app:secret@db.internal:5432/judgex',
    },
    redis: {
      required: true,
      url: 'redis://redis.internal:6379',
    },
    jwt: { secret: 'x'.repeat(32) },
    ai: { provider: 'ollama', openai: { apiKey: undefined } },
    featureFlags: { aiCompileExplanation: true },
    reaper: { intervalMs: 60000, stuckThresholdMs: 60000, batchSize: 100 },
    judge: { timeLimitMs: 2000, memoryLimitMb: 256, workerConcurrency: 2 },
    ...overrides,
  };
}

describe('Production configuration validation', () => {
  it('passes for a fully configured production profile', () => {
    assert.doesNotThrow(() => assertProductionReady(baseCfg()));
  });

  it('is a no-op outside production', () => {
    assert.doesNotThrow(() =>
      assertProductionReady(baseCfg({ isProduction: false, env: 'development' })),
    );
  });

  it('rejects weak JWT, local DB/Redis defaults, and optional deps in production', () => {
    assert.throws(
      () =>
        assertProductionReady(
          baseCfg({
            database: { required: false, url: 'postgres://judgex:judgex@localhost:5432/judgex' },
            redis: { required: false, url: 'redis://localhost:6379' },
            jwt: { secret: 'short' },
          }),
        ),
      /Production configuration invalid/,
    );
  });

  it('getStartupDiagnostics never includes secrets', () => {
    const snap = getStartupDiagnostics(baseCfg());
    const json = JSON.stringify(snap);
    assert.equal(json.includes('secret'), false);
    assert.equal(snap.aiProvider, 'ollama');
    assert.equal(snap.port, 4000);
  });
});
