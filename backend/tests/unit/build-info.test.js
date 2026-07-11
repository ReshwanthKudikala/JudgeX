/**
 * Sprint 34 — build metadata unit tests.
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-unit-secret-change-me-32chars!!!';

describe('Build info', () => {
  it('returns version and git metadata from env', () => {
    process.env.APP_VERSION = '9.9.9-test';
    process.env.GIT_SHA = 'abcdef1234567890';
    process.env.BUILD_TIME = '2026-07-11T00:00:00.000Z';

    const modPath = require.resolve('../../src/shared/build-info');
    delete require.cache[modPath];
    const { getBuildInfo } = require('../../src/shared/build-info');
    const info = getBuildInfo();

    assert.equal(info.version, '9.9.9-test');
    assert.equal(info.gitSha, 'abcdef1234567890');
    assert.equal(info.buildTime, '2026-07-11T00:00:00.000Z');
    assert.match(info.node, /^v/);
  });
});
