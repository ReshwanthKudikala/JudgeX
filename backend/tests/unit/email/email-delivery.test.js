const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-unit-secret-change-me-32chars!!!';
process.env.LOG_LEVEL = 'error';

const email = require('../../../src/infrastructure/email/email.service');
const { configure } = require('../../../src/shared/logger/logger');
const { AppError } = require('../../../src/shared/errors/base.error');
const { redactRequestUrl } = require('../../../src/middlewares/request-logger');

const TOKEN = 'unit-token-value-0123456789abcdef0123456789';
const PASSWORD = 'mailbox-password-should-not-be-logged';

const smtpEmail = {
  provider: 'smtp',
  from: 'JudgeX <noreply@example.com>',
  smtp: {
    host: 'smtp.example.com',
    user: 'mailer@example.com',
    pass: PASSWORD,
  },
};

function message() {
  return {
    to: 'ada@example.com',
    subject: 'Verify your JudgeX email',
    text: `Open http://localhost:5173/verify-email#token=${TOKEN}`,
  };
}

describe('email delivery', () => {
  beforeEach(() => {
    email.clearSentEmails();
  });

  it('logs console mail locally without the token or verification URL', async () => {
    const chunks = [];
    const original = process.stdout.write;
    process.stdout.write = (chunk) => {
      chunks.push(String(chunk));
      return true;
    };
    configure({ level: 'info', format: 'json' });
    try {
      const result = await email.sendEmail(message());
      assert.equal(result.provider, 'console');
      assert.equal(result.delivery, 'logged');
      assert.equal(email.getSentEmails().length, 1);
      assert.match(email.getSentEmails()[0].text, new RegExp(TOKEN));
      const logged = chunks.join('');
      assert.equal(logged.includes(TOKEN), false);
      assert.equal(logged.includes('verify-email#token'), false);
      assert.equal(logged.includes(PASSWORD), false);
      assert.match(logged, /email_console_logged/);
    } finally {
      process.stdout.write = original;
      configure({ level: 'error', format: 'json' });
    }
  });

  it('reports SMTP submission from a mocked transport', async () => {
    const result = await email.sendEmail(message(), {
      provider: 'smtp',
      email: smtpEmail,
      transport: {
        sendMail: async (payload) => {
          assert.equal(payload.to, 'ada@example.com');
          assert.equal(payload.text.includes(TOKEN), true);
          return { messageId: 'mid-1' };
        },
      },
    });
    assert.equal(result.provider, 'smtp');
    assert.equal(result.delivery, 'submitted');
    assert.equal(result.messageId, 'mid-1');
    assert.equal(email.getSentEmails().length, 0);
  });

  it('fails when SMTP is selected without required settings', async () => {
    await assert.rejects(
      () =>
        email.sendEmail(message(), {
          provider: 'smtp',
          email: { provider: 'smtp', from: 'JudgeX <noreply@example.com>', smtp: {} },
        }),
      (err) => {
        assert.equal(err instanceof AppError, true);
        assert.equal(err.code, 'EMAIL_NOT_CONFIGURED');
        assert.match(err.message, /SMTP_HOST/);
        assert.equal(err.message.includes(PASSWORD), false);
        return true;
      },
    );
  });

  it('hides SMTP authentication and recipient failures from the caller', async () => {
    const stderr = [];
    const original = process.stderr.write;
    process.stderr.write = (chunk) => {
      stderr.push(String(chunk));
      return true;
    };
    configure({ level: 'error', format: 'json' });
    try {
      await assert.rejects(
        () =>
          email.sendEmail(message(), {
            provider: 'smtp',
            email: smtpEmail,
            transport: {
              sendMail: async () => {
                throw new Error(`Invalid login: 535 ${PASSWORD}`);
              },
            },
          }),
        (err) => {
          assert.equal(err.code, 'EMAIL_DELIVERY_FAILED');
          assert.equal(err.message.includes(PASSWORD), false);
          assert.equal(err.message.includes('535'), false);
          return true;
        },
      );
      await assert.rejects(
        () =>
          email.sendEmail(message(), {
            provider: 'smtp',
            email: smtpEmail,
            transport: {
              sendMail: async () => {
                throw new Error('No recipients defined');
              },
            },
          }),
        (err) => {
          assert.equal(err.code, 'EMAIL_DELIVERY_FAILED');
          assert.equal(/recipients/i.test(err.message), false);
          return true;
        },
      );
      const logged = stderr.join('');
      assert.equal(logged.includes(PASSWORD), false);
      assert.equal(logged.includes(TOKEN), false);
    } finally {
      process.stderr.write = original;
    }
  });

  it('times out a hanging SMTP transport', async () => {
    await assert.rejects(
      () =>
        email.sendEmail(message(), {
          provider: 'smtp',
          timeoutMs: 20,
          email: smtpEmail,
          transport: { sendMail: () => new Promise(() => {}) },
        }),
      (err) => {
        assert.equal(err.code, 'EMAIL_DELIVERY_FAILED');
        assert.match(err.message, /did not respond in time/);
        return true;
      },
    );
  });

  it('names missing SMTP settings and redacts request URLs', () => {
    assert.deepEqual(
      email.missingSmtpSettings({ provider: 'smtp', from: '', smtp: { host: 'h' } }).sort(),
      ['EMAIL_FROM', 'SMTP_PASS', 'SMTP_USER'],
    );
    assert.deepEqual(email.missingSmtpSettings({ provider: 'console' }), []);
    const redacted = redactRequestUrl('/api/v1/auth/verify-email?token=abc123&x=1');
    assert.equal(redacted.includes('abc123'), false);
    assert.match(redacted, /token=\[REDACTED\]/);
    assert.doesNotThrow(() => email.warnEmailConfigAtStartup());
  });
});
