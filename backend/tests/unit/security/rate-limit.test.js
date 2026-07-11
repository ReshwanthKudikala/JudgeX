/**
 * Sprint 32 — rate-limit middleware unit tests (in-memory Redis stub).
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-unit-secret-change-me-32chars!!!';

describe('Rate limit middleware', () => {
  it('returns 429 with Retry-After when the window is exceeded', async () => {
    let count = 0;
    const storePath = require.resolve('../../../src/infrastructure/cache/rate-limit.store');
    const rateLimitPath = require.resolve('../../../src/middlewares/rate-limit');

    require.cache[storePath] = {
      id: storePath,
      filename: storePath,
      loaded: true,
      exports: {
        isRateLimitStoreReady: () => true,
        incrementWindow: async () => {
          count += 1;
          return { count, ttlMs: 30_000, resetAt: Date.now() + 30_000 };
        },
      },
    };
    delete require.cache[rateLimitPath];

    const { rateLimit } = require('../../../src/middlewares/rate-limit');
    const mw = rateLimit({
      tier: 'auth',
      max: 2,
      windowMs: 60_000,
      keyBy: 'ip',
      failClosed: true,
      force: true,
    });

    const headers = {};
    const req = { ip: '203.0.113.10', originalUrl: '/api/v1/auth/login', method: 'POST' };
    const res = {
      setHeader(k, v) {
        headers[k] = v;
      },
    };

    await new Promise((resolve, reject) => {
      mw(req, res, (err) => (err ? reject(err) : resolve()));
    });
    await new Promise((resolve, reject) => {
      mw(req, res, (err) => (err ? reject(err) : resolve()));
    });

    let limited;
    await new Promise((resolve) => {
      mw(req, res, (err) => {
        limited = err;
        resolve();
      });
    });

    assert.ok(limited);
    assert.equal(limited.code, 'RATE_LIMITED');
    assert.equal(limited.statusCode, 429);
    assert.equal(headers['Retry-After'], '30');
    assert.equal(headers['X-RateLimit-Limit'], '2');
  });

  it('resolvePreset merges config tier overrides', () => {
    const rateLimitPath = require.resolve('../../../src/middlewares/rate-limit');
    delete require.cache[rateLimitPath];
    const { resolvePreset } = require('../../../src/middlewares/rate-limit');
    const auth = resolvePreset('auth');
    assert.equal(typeof auth.max, 'number');
    assert.equal(auth.tier, 'auth');
    assert.equal(auth.keyBy, 'ip');
  });
});
