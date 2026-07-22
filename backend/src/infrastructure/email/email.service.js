// Outbound email port. Console provider is default (dev/test); SMTP optional (e.g. Gmail).

const { config } = require('../../config');
const { logger } = require('../../shared/logger/logger');

/** @type {{ to: string, subject: string, text: string, html?: string, at: string }[]} */
const sentMailbox = [];

/** @type {import('nodemailer').Transporter | null} */
let smtpTransport = null;

function getSentEmails() {
  return sentMailbox.slice();
}

function clearSentEmails() {
  sentMailbox.length = 0;
}

/**
 * True when EMAIL_PROVIDER=smtp and host/user/pass are all set.
 * Does not verify that credentials work against the server.
 */
function isSmtpReady() {
  const smtp = config.email?.smtp;
  return Boolean(
    config.email?.provider === 'smtp' &&
      smtp?.host &&
      smtp?.user &&
      smtp?.pass,
  );
}

/**
 * Startup check: warn when SMTP is selected but incomplete. Never throws.
 * Does not log credentials.
 */
function warnEmailConfigAtStartup() {
  const provider = config.email?.provider || 'console';
  if (provider !== 'smtp') {
    logger.info('email_provider', { provider: 'console' });
    return;
  }

  const smtp = config.email.smtp || {};
  const missing = [];
  if (!smtp.host) missing.push('SMTP_HOST');
  if (!smtp.user) missing.push('SMTP_USER');
  if (!smtp.pass) missing.push('SMTP_PASS');

  if (missing.length > 0) {
    logger.warn(
      'EMAIL_PROVIDER=smtp but SMTP is incompletely configured; ' +
        'outbound mail will fall back to console until these are set',
      {
        missing,
        hint:
          'For Gmail: enable 2-Step Verification, create an App Password, ' +
          'set SMTP_HOST=smtp.gmail.com SMTP_PORT=587 SMTP_SECURE=false ' +
          'SMTP_USER=<gmail> SMTP_PASS=<app-password> EMAIL_FROM=<same or display name>',
      },
    );
    return;
  }

  logger.info('email_provider', {
    provider: 'smtp',
    host: smtp.host,
    port: smtp.port,
    secure: smtp.secure,
    userConfigured: true,
  });
}

function getSmtpTransport() {
  if (smtpTransport) return smtpTransport;

  // Lazy-load nodemailer only when SMTP is ready.
  // eslint-disable-next-line global-require, import/no-extraneous-dependencies
  const nodemailer = require('nodemailer');
  const smtp = config.email.smtp;
  smtpTransport = nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.secure,
    auth: {
      user: smtp.user,
      pass: smtp.pass,
    },
  });
  return smtpTransport;
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

  if (provider === 'console') {
    logger.info('email_outbound', {
      provider: 'console',
      to: payload.to,
      subject: payload.subject,
      text: payload.text,
    });
    return { messageId: `console-${Date.now()}`, provider: 'console' };
  }

  // EMAIL_PROVIDER=smtp but incomplete → warn and fall back (do not crash).
  if (!isSmtpReady()) {
    logger.warn('email_smtp_fallback_console', {
      reason: 'SMTP credentials incomplete',
      to: payload.to,
      subject: payload.subject,
    });
    logger.info('email_outbound', {
      provider: 'console',
      to: payload.to,
      subject: payload.subject,
      text: payload.text,
    });
    return { messageId: `console-${Date.now()}`, provider: 'console' };
  }

  try {
    const transport = getSmtpTransport();
    const info = await transport.sendMail({
      from: config.email.from,
      to: payload.to,
      subject: payload.subject,
      text: payload.text,
      html: payload.html,
    });

    // Do not log message body (may contain one-time tokens) or SMTP secrets.
    logger.info('email_outbound', {
      provider: 'smtp',
      to: payload.to,
      subject: payload.subject,
      messageId: info.messageId,
    });

    return { messageId: info.messageId, provider: 'smtp' };
  } catch (err) {
    logger.error('email_smtp_send_failed', {
      to: payload.to,
      subject: payload.subject,
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
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
  isSmtpReady,
  warnEmailConfigAtStartup,
};
