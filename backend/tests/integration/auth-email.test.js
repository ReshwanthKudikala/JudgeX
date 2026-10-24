const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

require('./helpers/bootstrap');
const { registerSuiteHooks } = require('./helpers/hooks');
const { api, registerUser, unique } = require('./helpers/fixtures');
const { query } = require('./helpers/setup');
const { AppError } = require('../../src/shared/errors/base.error');
const { setEmailSenderForTests } = require('../../src/modules/auth/auth.service');
const {
  clearSentEmails,
  getSentEmails,
} = require('../../src/infrastructure/email/email.service');

const { requireInfra } = registerSuiteHooks();

function extractTokenFromMailbox(pathFragment) {
  const emails = getSentEmails();
  const latest = emails[emails.length - 1];
  assert.ok(latest, 'expected an outbound email');
  const hash = latest.text.match(new RegExp(`${pathFragment}#token=([^\\s&]+)`));
  const query = latest.text.match(new RegExp(`${pathFragment}\\?token=([^\\s&]+)`));
  const match = hash || query;
  assert.ok(match, `expected token link containing ${pathFragment}`);
  return decodeURIComponent(match[1]);
}

function responseContains(body, secret) {
  return JSON.stringify(body).includes(secret);
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
    assert.equal(res.body.data.verification.outcome, 'logged');
    assert.equal(res.body.data.verification.delivery, 'console');
    assert.equal(getSentEmails().length, 1);
    assert.match(getSentEmails()[0].subject, /verify/i);
    assert.match(getSentEmails()[0].text, /\/verify-email#token=/);
    assert.doesNotMatch(getSentEmails()[0].text, /\/verify-email\?token=/);
    assert.equal(responseContains(res.body, extractTokenFromMailbox('/verify-email')), false);
  });

  it('verifies email with a single-use token', async (t) => {
    if (!requireInfra(t)) return;

    const username = unique('verify');
    const email = `${username}@example.com`;
    await api()
      .post('/api/v1/auth/register')
      .send({ username, email, password: 'password123' });

    const token = extractTokenFromMailbox('/verify-email');
    const ok = await api().post('/api/v1/auth/verify-email').send({ token });
    assert.equal(ok.status, 200);
    assert.equal(ok.body.data.user.email_verified, true);
    assert.equal(responseContains(ok.body, token), false);

    const reuse = await api().get('/api/v1/auth/verify-email').query({ token });
    assert.equal(reuse.status, 200);
    assert.equal(reuse.body.data.alreadyVerified, true);
    assert.match(reuse.body.data.message, /already verified/i);
    assert.equal(reuse.body.data.user.email_verified, true);
    assert.equal(responseContains(reuse.body, token), false);

    await query(
      `UPDATE auth_tokens
          SET expires_at = now() - interval '1 hour'
        WHERE purpose = 'email_verification'
          AND user_id = (SELECT id FROM users WHERE email = $1)`,
      [email],
    );
    const expiredAfterVerify = await api().post('/api/v1/auth/verify-email').send({ token });
    assert.equal(expiredAfterVerify.status, 200);
    assert.equal(expiredAfterVerify.body.data.alreadyVerified, true);
    assert.equal(responseContains(expiredAfterVerify.body, token), false);
  });

  it('forgot-password always returns a generic message', async (t) => {
    if (!requireInfra(t)) return;

    const missing = await api()
      .post('/api/v1/auth/forgot-password')
      .send({ email: `${unique('missing')}@example.com` });
    assert.equal(missing.status, 200);
    assert.match(missing.body.data.message, /has been requested/i);
    assert.equal(/has been sent/i.test(missing.body.data.message), false);

    const { email } = await registerUser({ username: unique('fp') });
    clearSentEmails();
    const existing = await api().post('/api/v1/auth/forgot-password').send({ email });
    assert.equal(existing.status, 200);
    assert.equal(existing.body.data.message, missing.body.data.message);
    assert.equal(getSentEmails().length, 1);
    assert.match(getSentEmails()[0].text, /reset-password#token=/);
  });

  it('rolls back a reset token when delivery fails and stays generic', async (t) => {
    if (!requireInfra(t)) return;

    const username = unique('rf');
    const email = `${username}@example.com`;
    await api()
      .post('/api/v1/auth/register')
      .send({ username, email, password: 'password123' });
    clearSentEmails();
    const issued = await api().post('/api/v1/auth/forgot-password').send({ email });
    assert.equal(issued.status, 200);
    const resetToken = extractTokenFromMailbox('/reset-password');
    const before = await query(
      `SELECT count(*)::int AS unused
         FROM auth_tokens
        WHERE purpose = 'password_reset'
          AND used_at IS NULL
          AND expires_at > now()
          AND user_id = (SELECT id FROM users WHERE email = $1)`,
      [email],
    );
    assert.equal(before.rows[0].unused, 1);

    setEmailSenderForTests(async () => {
      throw new AppError('Invalid login: 535 secret-should-not-leak', {
        statusCode: 503,
        code: 'EMAIL_DELIVERY_FAILED',
      });
    });
    try {
      const failed = await api().post('/api/v1/auth/forgot-password').send({ email });
      const unknown = await api()
        .post('/api/v1/auth/forgot-password')
        .send({ email: `${unique('ghost')}@example.com` });
      assert.equal(failed.status, 200);
      assert.equal(unknown.status, 200);
      assert.equal(failed.body.data.message, unknown.body.data.message);
      assert.equal(/has been sent/i.test(failed.body.data.message), false);
      assert.equal(/535|smtp|secret-should-not-leak/i.test(JSON.stringify(failed.body)), false);
      assert.equal(responseContains(failed.body, resetToken), false);
    } finally {
      setEmailSenderForTests(null);
    }

    const after = await query(
      `SELECT count(*)::int AS unused
         FROM auth_tokens
        WHERE purpose = 'password_reset'
          AND used_at IS NULL
          AND expires_at > now()
          AND user_id = (SELECT id FROM users WHERE email = $1)`,
      [email],
    );
    assert.equal(after.rows[0].unused, 1);
    const stillUsable = await api()
      .post('/api/v1/auth/reset-password')
      .send({ token: resetToken, newPassword: 'newpassword99' });
    assert.equal(stillUsable.status, 200);
    assert.equal(responseContains(stillUsable.body, resetToken), false);
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

  it('gives the signed-in user an explicit resend outcome and keeps a recent token', async (t) => {
    if (!requireInfra(t)) return;

    const username = unique('rs');
    const email = `${username}@example.com`;
    const reg = await api()
      .post('/api/v1/auth/register')
      .send({ username, email, password: 'password123' });
    const accessToken = reg.body.data.accessToken;
    const firstToken = extractTokenFromMailbox('/verify-email');

    const recent = await api()
      .post('/api/v1/auth/resend-verification/me')
      .set('Authorization', `Bearer ${accessToken}`);
    assert.equal(recent.status, 200);
    assert.equal(recent.body.data.outcome, 'recent');
    assert.equal(recent.body.data.delivery, null);
    assert.equal(getSentEmails().length, 1);

    await query(
      `UPDATE auth_tokens
          SET created_at = now() - interval '2 minutes'
        WHERE purpose = 'email_verification'
          AND used_at IS NULL
          AND user_id = (SELECT id FROM users WHERE email = $1)`,
      [email],
    );

    const again = await api()
      .post('/api/v1/auth/resend-verification/me')
      .set('Authorization', `Bearer ${accessToken}`);
    assert.equal(again.status, 200);
    assert.equal(again.body.data.outcome, 'logged');
    assert.equal(again.body.data.delivery, 'console');
    assert.equal(getSentEmails().length, 2);
    const secondToken = extractTokenFromMailbox('/verify-email');
    assert.notEqual(secondToken, firstToken);

    const stale = await api().post('/api/v1/auth/verify-email').send({ token: firstToken });
    assert.equal(stale.status, 400);
    assert.equal(stale.body.error.code, 'USED_VERIFICATION_TOKEN');

    const fresh = await api().post('/api/v1/auth/verify-email').send({ token: secondToken });
    assert.equal(fresh.status, 200);
    assert.equal(fresh.body.data.user.email_verified, true);

    clearSentEmails();
    const already = await api()
      .post('/api/v1/auth/resend-verification/me')
      .set('Authorization', `Bearer ${accessToken}`);
    assert.equal(already.status, 200);
    assert.equal(already.body.data.outcome, 'already_verified');
    assert.equal(getSentEmails().length, 0);
  });

  it('uses one public response for missing, verified, and suspended addresses', async (t) => {
    if (!requireInfra(t)) return;

    const missing = await api()
      .post('/api/v1/auth/resend-verification')
      .send({ email: `${unique('none')}@example.com` });
    assert.equal(missing.status, 200);
    assert.equal(missing.body.data.outcome, 'accepted');
    assert.equal(missing.body.data.delivery, null);

    const username = unique('pub');
    const email = `${username}@example.com`;
    await api().post('/api/v1/auth/register').send({ username, email, password: 'password123' });
    await query(
      `UPDATE auth_tokens
          SET created_at = now() - interval '2 minutes'
        WHERE purpose = 'email_verification'
          AND user_id = (SELECT id FROM users WHERE email = $1)`,
      [email],
    );
    const before = getSentEmails().length;
    const existing = await api().post('/api/v1/auth/resend-verification').send({ email });
    assert.equal(existing.status, 200);
    assert.equal(existing.body.data.message, missing.body.data.message);
    assert.equal(existing.body.data.outcome, 'accepted');
    assert.equal(getSentEmails().length, before + 1);

    const token = extractTokenFromMailbox('/verify-email');
    await api().post('/api/v1/auth/verify-email').send({ token });
    clearSentEmails();
    const verified = await api().post('/api/v1/auth/resend-verification').send({ email });
    assert.equal(verified.body.data.message, missing.body.data.message);
    assert.equal(getSentEmails().length, 0);

    const suspendedName = unique('sus');
    const suspendedEmail = `${suspendedName}@example.com`;
    await api()
      .post('/api/v1/auth/register')
      .send({ username: suspendedName, email: suspendedEmail, password: 'password123' });
    await query('UPDATE users SET is_suspended = true WHERE email = $1', [suspendedEmail]);
    clearSentEmails();
    const suspended = await api()
      .post('/api/v1/auth/resend-verification')
      .send({ email: suspendedEmail });
    assert.equal(suspended.status, 200);
    assert.equal(suspended.body.data.message, missing.body.data.message);
    assert.equal(getSentEmails().length, 0);
  });

  it('rejects invalid and expired links and does not mark the user verified', async (t) => {
    if (!requireInfra(t)) return;

    const invalid = await api()
      .post('/api/v1/auth/verify-email')
      .send({ token: 'not-a-real-verification-token' });
    assert.equal(invalid.status, 400);
    assert.equal(invalid.body.error.code, 'INVALID_VERIFICATION_TOKEN');

    const username = unique('exp');
    const email = `${username}@example.com`;
    const reg = await api()
      .post('/api/v1/auth/register')
      .send({ username, email, password: 'password123' });
    const token = extractTokenFromMailbox('/verify-email');
    await query(
      `UPDATE auth_tokens
          SET expires_at = now() - interval '1 hour'
        WHERE purpose = 'email_verification'
          AND user_id = (SELECT id FROM users WHERE email = $1)`,
      [email],
    );
    const expired = await api().get('/api/v1/auth/verify-email').query({ token });
    assert.equal(expired.status, 400);
    assert.equal(expired.body.error.code, 'EXPIRED_VERIFICATION_TOKEN');

    const me = await api()
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${reg.body.data.accessToken}`);
    assert.equal(me.status, 200);
    assert.equal(me.body.data.user.email_verified, false);
  });

  it('lets only one of two concurrent verifications succeed', async (t) => {
    if (!requireInfra(t)) return;

    const username = unique('race');
    const email = `${username}@example.com`;
    await api()
      .post('/api/v1/auth/register')
      .send({ username, email, password: 'password123' });
    const token = extractTokenFromMailbox('/verify-email');
    const [first, second] = await Promise.all([
      api().post('/api/v1/auth/verify-email').send({ token }),
      api().post('/api/v1/auth/verify-email').send({ token }),
    ]);
    assert.equal(first.status, 200);
    assert.equal(second.status, 200);
    const messages = [first.body.data.message, second.body.data.message];
    assert.equal(messages.some((message) => /successfully/i.test(message)), true);
    assert.equal(messages.some((message) => /already verified/i.test(message)), true);
    assert.equal(responseContains(first.body, token), false);
    assert.equal(responseContains(second.body, token), false);
  });

  it('rolls back a resend when sending fails so the previous link still works', async (t) => {
    if (!requireInfra(t)) return;

    const username = unique('rb');
    const email = `${username}@example.com`;
    const reg = await api()
      .post('/api/v1/auth/register')
      .send({ username, email, password: 'password123' });
    const token = extractTokenFromMailbox('/verify-email');
    await query(
      `UPDATE auth_tokens
          SET created_at = now() - interval '2 minutes'
        WHERE purpose = 'email_verification'
          AND user_id = (SELECT id FROM users WHERE email = $1)`,
      [email],
    );
    const before = getSentEmails().length;
    setEmailSenderForTests(async () => {
      throw new AppError('mail transport rejected the recipient', {
        statusCode: 503,
        code: 'EMAIL_DELIVERY_FAILED',
      });
    });
    try {
      const failed = await api()
        .post('/api/v1/auth/resend-verification/me')
        .set('Authorization', `Bearer ${reg.body.data.accessToken}`);
      assert.equal(failed.status, 503);
      assert.equal(failed.body.error.code, 'EMAIL_DELIVERY_FAILED');
      assert.equal(responseContains(failed.body, token), false);
      assert.equal(/smtp|535|password/i.test(failed.body.error.message), false);

      const hidden = await api().post('/api/v1/auth/resend-verification').send({ email });
      const missing = await api()
        .post('/api/v1/auth/resend-verification')
        .send({ email: `${unique('ghost')}@example.com` });
      assert.equal(hidden.status, 200);
      assert.equal(hidden.body.data.message, missing.body.data.message);
      assert.equal(getSentEmails().length, before);
    } finally {
      setEmailSenderForTests(null);
    }

    const ok = await api().post('/api/v1/auth/verify-email').send({ token });
    assert.equal(ok.status, 200);
    assert.equal(ok.body.data.user.email_verified, true);
  });

  it('reports SMTP submission when the sender accepts the message', async (t) => {
    if (!requireInfra(t)) return;

    setEmailSenderForTests(async () => ({
      provider: 'smtp',
      delivery: 'submitted',
      messageId: 'smtp-test-message',
    }));
    try {
      const username = unique('sub');
      const email = `${username}@example.com`;
      const reg = await api()
        .post('/api/v1/auth/register')
        .send({ username, email, password: 'password123' });
      assert.equal(reg.status, 201);
      assert.equal(reg.body.data.verification.outcome, 'submitted');
      assert.equal(reg.body.data.verification.delivery, 'smtp');
      assert.match(reg.body.data.verification.message, /does not guarantee inbox delivery/i);
      assert.equal(responseContains(reg.body, 'smtp-test-message'), false);

      await query(
        `UPDATE auth_tokens
            SET created_at = now() - interval '2 minutes'
          WHERE purpose = 'email_verification'
            AND user_id = (SELECT id FROM users WHERE email = $1)`,
        [email],
      );
      const again = await api()
        .post('/api/v1/auth/resend-verification/me')
        .set('Authorization', `Bearer ${reg.body.data.accessToken}`);
      assert.equal(again.status, 200);
      assert.equal(again.body.data.outcome, 'submitted');
      assert.equal(again.body.data.delivery, 'smtp');
    } finally {
      setEmailSenderForTests(null);
    }
  });
});
