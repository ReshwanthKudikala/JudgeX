const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

require('./helpers/bootstrap');
const { registerSuiteHooks } = require('./helpers/hooks');
const { api, registerUser, unique } = require('./helpers/fixtures');
const {
  clearSentEmails,
  getSentEmails,
} = require('../../src/infrastructure/email/email.service');

const { requireInfra } = registerSuiteHooks();

function extractTokenFromMailbox(pathFragment) {
  const emails = getSentEmails();
  const latest = emails[emails.length - 1];
  assert.ok(latest, 'expected an outbound email');
  const match = latest.text.match(new RegExp(`${pathFragment}\\?token=([^\\s]+)`));
  assert.ok(match, `expected token link containing ${pathFragment}`);
  return decodeURIComponent(match[1]);
}

describe('Email verification & password recovery', () => {
  beforeEach(() => {
    clearSentEmails();
  });

  it('registers with email_verified=false and sends a verification email', async (t) => {
    if (!requireInfra(t)) return;

    const username = unique('ev');
    const email = `${username}@example.com`;
    const res = await api()
      .post('/api/v1/auth/register')
      .send({ username, email, password: 'password123' });

    assert.equal(res.status, 201);
    assert.equal(res.body.data.user.email_verified, false);
    assert.equal(getSentEmails().length, 1);
    assert.match(getSentEmails()[0].subject, /verify/i);
  });

  it('verifies email with a single-use token', async (t) => {
    if (!requireInfra(t)) return;

    const username = unique('verify');
    const email = `${username}@example.com`;
    await api()
      .post('/api/v1/auth/register')
      .send({ username, email, password: 'password123' });

    const token = extractTokenFromMailbox('/verify-email');
    const ok = await api().get('/api/v1/auth/verify-email').query({ token });
    assert.equal(ok.status, 200);
    assert.equal(ok.body.data.user.email_verified, true);

    const reuse = await api().get('/api/v1/auth/verify-email').query({ token });
    assert.equal(reuse.status, 400);
    assert.equal(reuse.body.error.code, 'INVALID_VERIFICATION_TOKEN');
  });

  it('forgot-password always returns a generic message', async (t) => {
    if (!requireInfra(t)) return;

    const missing = await api()
      .post('/api/v1/auth/forgot-password')
      .send({ email: `${unique('missing')}@example.com` });
    assert.equal(missing.status, 200);
    assert.ok(missing.body.data.message);

    const { email } = await registerUser({ username: unique('fp') });
    clearSentEmails();
    const existing = await api().post('/api/v1/auth/forgot-password').send({ email });
    assert.equal(existing.status, 200);
    assert.equal(existing.body.data.message, missing.body.data.message);
    assert.equal(getSentEmails().length, 1);
  });

  it('resets password and revokes prior access tokens', async (t) => {
    if (!requireInfra(t)) return;

    const username = unique('rp');
    const email = `${username}@example.com`;
    const password = 'password123';
    const reg = await api()
      .post('/api/v1/auth/register')
      .send({ username, email, password });
    const oldToken = reg.body.data.accessToken;

    clearSentEmails();
    await api().post('/api/v1/auth/forgot-password').send({ email });
    const resetToken = extractTokenFromMailbox('/reset-password');

    const reset = await api()
      .post('/api/v1/auth/reset-password')
      .send({ token: resetToken, newPassword: 'newpassword99' });
    assert.equal(reset.status, 200);

    const meOld = await api()
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${oldToken}`);
    assert.equal(meOld.status, 401);

    const loginOld = await api().post('/api/v1/auth/login').send({ email, password });
    assert.equal(loginOld.status, 401);

    const loginNew = await api()
      .post('/api/v1/auth/login')
      .send({ email, password: 'newpassword99' });
    assert.equal(loginNew.status, 200);
  });

  it('change-password requires current password and issues a fresh token', async (t) => {
    if (!requireInfra(t)) return;

    const username = unique('cp');
    const email = `${username}@example.com`;
    const password = 'password123';
    const reg = await api()
      .post('/api/v1/auth/register')
      .send({ username, email, password });
    const accessToken = reg.body.data.accessToken;

    const bad = await api()
      .post('/api/v1/auth/change-password')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ currentPassword: 'wrong-password', newPassword: 'newpassword99' });
    assert.equal(bad.status, 400);

    const ok = await api()
      .post('/api/v1/auth/change-password')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ currentPassword: password, newPassword: 'newpassword99' });
    assert.equal(ok.status, 200);
    assert.ok(ok.body.data.accessToken);

    const meOld = await api()
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${accessToken}`);
    assert.equal(meOld.status, 401);

    const meNew = await api()
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${ok.body.data.accessToken}`);
    assert.equal(meNew.status, 200);
  });
});
