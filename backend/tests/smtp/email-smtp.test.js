// Standalone SMTP test. Run as its own process:
//   node --test tests/smtp/email-smtp.test.js
// The integration runner must not load this file: config freezes EMAIL_PROVIDER
// on first import, and the shared suite already imports it as console.
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startSmtpCatcher } = require('./smtp-catcher');

const FROM = 'JudgeX <noreply@judgex.local>';

describe('SMTP delivery through the email service', { timeout: 15000 }, () => {
  let catcher;
  let email;

  before(async () => {
    catcher = await startSmtpCatcher();

    process.env.NODE_ENV = 'test';
    process.env.LOG_LEVEL = 'error';
    process.env.EMAIL_PROVIDER = 'smtp';
    process.env.EMAIL_FROM = FROM;
    process.env.SMTP_HOST = '127.0.0.1';
    process.env.SMTP_PORT = String(catcher.port);
    process.env.SMTP_SECURE = 'false';
    process.env.SMTP_USER = 'smtp-test-user';
    process.env.SMTP_PASS = 'smtp-test-pass';
    process.env.DB_REQUIRED = 'false';
    process.env.REDIS_REQUIRED = 'false';
    process.env.DATABASE_URL = 'postgres://smtp-test:smtp-test@127.0.0.1:1/smtp_test_unused';
    process.env.REDIS_URL = 'redis://127.0.0.1:1/15';

    email = require('../../src/infrastructure/email/email.service');
  });

  after(async () => {
    if (catcher) await catcher.close();
  });

  it('delivers a verification message as text without an HTML part', async () => {
    const before = catcher.messages.length;
    const message = email.buildVerifyEmailMessage({
      to: 'ada@example.com',
      username: 'ada',
      verifyUrl: 'http://127.0.0.1:5173/verify-email?token=verify-token',
    });

    assert.equal(message.html, undefined);
    const result = await email.sendEmail(message);

    assert.equal(result.provider, 'smtp');
    assert.ok(result.messageId);
    const delivered = catcher.messages[before];
    assert.ok(delivered, 'expected the catcher to receive the verification message');
    assertDelivered(delivered, {
      to: 'ada@example.com',
      subject: 'Verify your JudgeX email',
      link: 'http://127.0.0.1:5173/verify-email?token=verify-token',
    });
  });

  it('delivers a password-reset message as text without an HTML part', async () => {
    const before = catcher.messages.length;
    const message = email.buildPasswordResetMessage({
      to: 'ada@example.com',
      username: 'ada',
      resetUrl: 'http://127.0.0.1:5173/reset-password?token=reset-token',
    });

    assert.equal(message.html, undefined);
    const result = await email.sendEmail(message);

    assert.equal(result.provider, 'smtp');
    const delivered = catcher.messages[before];
    assert.ok(delivered, 'expected the catcher to receive the reset message');
    assertDelivered(delivered, {
      to: 'ada@example.com',
      subject: 'Reset your JudgeX password',
      link: 'http://127.0.0.1:5173/reset-password?token=reset-token',
    });
  });

  it('rejects a recipient without an address and delivers nothing', async () => {
    const before = catcher.messages.length;
    await assert.rejects(
      () => email.sendEmail({
        to: 'not-an-email',
        subject: 'malformed',
        text: 'should not be delivered',
      }),
      /No recipients defined|recipient/i,
    );
    assert.equal(catcher.messages.length, before);
  });
});

function assertDelivered(delivered, { to, subject, link }) {
  assert.match(delivered.mailFrom, /noreply@judgex\.local/i);
  assert.match(delivered.raw, /noreply@judgex\.local/i);
  assert.ok(
    delivered.recipients.some((recipient) => recipient.toLowerCase().includes(to)),
    `expected RCPT TO for ${to}, got ${delivered.recipients.join(', ')}`,
  );
  assert.match(delivered.raw, new RegExp(escapeRegExp(subject)));
  assert.match(delivered.raw, new RegExp(escapeRegExp(link)));
  assert.match(delivered.raw, /text\/plain/i);
  assert.doesNotMatch(delivered.raw, /text\/html/i);
  assert.doesNotMatch(delivered.raw, /multipart\/alternative/i);
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
