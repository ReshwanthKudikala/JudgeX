// Outbound email port. Console provider is default (dev/test); SMTP optional.

const { config } = require('../../config');
const { logger } = require('../../shared/logger/logger');

/** @type {{ to: string, subject: string, text: string, html?: string, at: string }[]} */
const sentMailbox = [];

function getSentEmails() {
  return sentMailbox.slice();
}

function clearSentEmails() {
  sentMailbox.length = 0;
}

/**
 * @param {{ to: string, subject: string, text: string, html?: string }} message
 */
async function sendEmail(message) {
  const payload = {
    to: message.to,
    subject: message.subject,
    text: message.text,
    html: message.html || undefined,
    at: new Date().toISOString(),
  };

  sentMailbox.push(payload);
  if (sentMailbox.length > 200) sentMailbox.shift();

  const provider = config.email?.provider || 'console';

  if (provider === 'console' || !config.email?.smtp?.host) {
    logger.info('email_outbound', {
      provider: 'console',
      to: payload.to,
      subject: payload.subject,
      text: payload.text,
    });
    return { messageId: `console-${Date.now()}`, provider: 'console' };
  }

  // Lazy-load nodemailer only when SMTP is configured.
  // eslint-disable-next-line global-require, import/no-extraneous-dependencies
  const nodemailer = require('nodemailer');
  const transport = nodemailer.createTransport({
    host: config.email.smtp.host,
    port: config.email.smtp.port,
    secure: config.email.smtp.secure,
    auth:
      config.email.smtp.user
        ? { user: config.email.smtp.user, pass: config.email.smtp.pass }
        : undefined,
  });

  const info = await transport.sendMail({
    from: config.email.from,
    to: payload.to,
    subject: payload.subject,
    text: payload.text,
    html: payload.html,
  });

  return { messageId: info.messageId, provider: 'smtp' };
}

function buildVerifyEmailMessage({ to, username, verifyUrl }) {
  const subject = 'Verify your JudgeX email';
  const text = [
    `Hi ${username},`,
    '',
    'Please verify your JudgeX email address by opening this link:',
    verifyUrl,
    '',
    'This link expires in 24 hours and can only be used once.',
    '',
    'If you did not create a JudgeX account, you can ignore this email.',
  ].join('\n');
  return { to, subject, text };
}

function buildPasswordResetMessage({ to, username, resetUrl }) {
  const subject = 'Reset your JudgeX password';
  const text = [
    `Hi ${username},`,
    '',
    'We received a request to reset your JudgeX password. Open this link:',
    resetUrl,
    '',
    'This link expires in 30 minutes and can only be used once.',
    '',
    'If you did not request a reset, you can ignore this email.',
  ].join('\n');
  return { to, subject, text };
}

module.exports = {
  sendEmail,
  getSentEmails,
  clearSentEmails,
  buildVerifyEmailMessage,
  buildPasswordResetMessage,
};
