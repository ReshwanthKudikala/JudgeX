/**
 * Sprint 32 — security helpers unit tests.
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const { buildHelmetOptions } = require('../../../src/shared/security/helmet');
const { buildCorsOptions } = require('../../../src/shared/security/cors');
const { RateLimitError, PayloadTooLargeError } = require('../../../src/shared/errors/http-errors');

describe('Security helpers', () => {
  it('buildHelmetOptions enables HSTS only in production', () => {
    const prod = buildHelmetOptions({ isProduction: true });
    const dev = buildHelmetOptions({ isProduction: false });
    assert.equal(prod.hsts.maxAge, 31536000);
    assert.equal(dev.hsts, false);
    assert.deepEqual(prod.contentSecurityPolicy.directives.defaultSrc, ["'none'"]);
    assert.equal(prod.frameguard.action, 'deny');
    assert.equal(prod.referrerPolicy.policy, 'no-referrer');
  });

  it('buildCorsOptions allows listed origins and rejects others', async () => {
    const opts = buildCorsOptions(['https://judgex.app']);
    const allowed = await new Promise((resolve, reject) => {
      opts.origin('https://judgex.app', (err, ok) => (err ? reject(err) : resolve(ok)));
    });
    assert.equal(allowed, true);

    await assert.rejects(
      () =>
        new Promise((resolve, reject) => {
          opts.origin('https://evil.example', (err, ok) => (err ? reject(err) : resolve(ok)));
        }),
      /CORS origin not allowed/,
    );
  });

  it('RateLimitError and PayloadTooLargeError use stable codes', () => {
    const rl = new RateLimitError('slow down', { retryAfterSec: 12 });
    assert.equal(rl.code, 'RATE_LIMITED');
    assert.equal(rl.statusCode, 429);
    assert.equal(rl.retryAfterSec, 12);

    const big = new PayloadTooLargeError();
    assert.equal(big.code, 'PAYLOAD_TOO_LARGE');
    assert.equal(big.statusCode, 413);
  });
});
