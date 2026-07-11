/**
 * Sprint 32 — security headers + validation hardening integration checks.
 */

const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');

const {
  setupIntegration,
  teardownIntegration,
  resetDatabase,
  getApp,
} = require('./helpers/setup');

describe('Sprint 32 security hardening', () => {
  let available = false;

  before(async () => {
    const result = await setupIntegration();
    available = result.available;
    if (!available) {
      console.warn(`Skipping security integration tests: ${result.reason}`);
    }
  });

  after(async () => {
    await teardownIntegration();
  });

  beforeEach(async () => {
    if (available) await resetDatabase();
  });

  it('sets Helmet security headers on API responses', async (t) => {
    if (!available) return t.skip('infrastructure unavailable');
    const res = await request(getApp()).get('/api/v1/health');
    assert.ok(res.headers['x-content-type-options'] === 'nosniff' || res.headers['x-content-type-options']);
    assert.equal(res.headers['x-frame-options'], 'DENY');
    assert.equal(res.headers['referrer-policy'], 'no-referrer');
    assert.ok(res.headers['content-security-policy']);
    assert.match(res.headers['content-security-policy'], /default-src 'none'/);
  });

  it('rejects non-UUID submission ids with VALIDATION_ERROR', async (t) => {
    if (!available) return t.skip('infrastructure unavailable');

    const register = await request(getApp())
      .post('/api/v1/auth/register')
      .send({
        username: 'secuser1',
        email: 'secuser1@example.com',
        password: 'SecurePass1!',
      });
    assert.equal(register.status, 201);
    const token = register.body.data.accessToken;

    const res = await request(getApp())
      .get('/api/v1/submissions/not-a-uuid')
      .set('Authorization', `Bearer ${token}`);

    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, 'VALIDATION_ERROR');
  });

  it('rejects invalid problem id UUID with VALIDATION_ERROR', async (t) => {
    if (!available) return t.skip('infrastructure unavailable');
    const res = await request(getApp()).get('/api/v1/problems/id/bad-id');
    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, 'VALIDATION_ERROR');
  });
});
