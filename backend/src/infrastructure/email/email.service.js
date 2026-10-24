// Outbound email port.
// console: local development mailbox only. Never an inbox.
// smtp: submit to the configured server. Acceptance is not inbox delivery.
// Incomplete SMTP does not fall back to console.

const fs = require('fs');
const path = require('path');

const { config } = require('../../config');
const { AppError } = require('../../shared/errors/base.error');
const { logger } = require('../../shared/logger/logger');

const SMTP_TIMEOUT_MS = 10_000;

/** @type {{ to: string, subject: string, text: string, html?: string, messageId: string, at: string }[]} */
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
 * @param {{ provider?: string, from?: string, smtp?: { host?: string, user?: string, pass?: string } }} [email]
 * @returns {string[]} setting names only
 */
function missingSmtpSettings(email = config.email || {}) {
  if (email.provider !== 'smtp') return [];
  const missing = [];
  if (!email.from) missing.push('EMAIL_FROM');
  if (!email.smtp?.host) missing.push('SMTP_HOST');
  if (!email.smtp?.user) missing.push('SMTP_USER');
  if (!email.smtp?.pass) missing.push('SMTP_PASS');
  return missing;
}

function isSmtpReady() {
  return missingSmtpSettings().length === 0 && config.email?.provider === 'smtp';
}

/**
 * Remove verification secrets from a string before it is logged.
 * @param {string} value
 */
function redactMessageText(value) {
  return String(value || '')
    .replace(/([?#&]token=)[^\s&#]+/gi, '$1[REDACTED]')
    .replace(/(#token=)[^\s&]+/gi, '$1[REDACTED]')
    .replace(/\b[A-Za-z0-9_-]{32,}\b/g, '[REDACTED]');
}

/**
 * @param {Promise<unknown>} work
 * @param {number} ms
 */
function withTimeout(work, ms) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      reject(
        new AppError('The mail server did not respond in time.', {
          statusCode: 503,
          code: 'EMAIL_DELIVERY_FAILED',
        }),
      );
    }, ms);
  });
  return Promise.race([work, timeout]).finally(() => clearTimeout(timer));
}

/**
 * @param {unknown} err
 * @returns {AppError}
 */
function toDeliveryError(err) {
  if (err instanceof AppError) return err;
  const raw = err instanceof Error ? err.message : String(err);
  logger.error('email_smtp_send_failed', { error: redactMessageText(raw) });
  return new AppError(
    'The verification message could not be submitted to the mail server. Try again shortly.',
    { statusCode: 503, code: 'EMAIL_DELIVERY_FAILED' },
  );
}

function rememberConsoleMessage(message, messageId) {
  sentMailbox.push({
    to: message.to,
    subject: message.subject,
    text: message.text,
    html: message.html || undefined,
    messageId,
    at: new Date().toISOString(),
  });
  if (sentMailbox.length > 200) sentMailbox.shift();
}

function writeDevMailbox(message, messageId) {
  if (process.env.NODE_ENV !== 'development') return null;
  const dir = path.join(process.cwd(), '.local-mailbox');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, 'latest.txt');
  fs.writeFileSync(
    file,
    [`messageId: ${messageId}`, `to: ${message.to}`, `subject: ${message.subject}`, '', message.text, ''].join(
      '\n',
    ),
    'utf8',
  );
  return file;
}

function getSmtpTransport() {
  if (smtpTransport) return smtpTransport;
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
    connectionTimeout: SMTP_TIMEOUT_MS,
    greetingTimeout: SMTP_TIMEOUT_MS,
    socketTimeout: SMTP_TIMEOUT_MS,
  });
  return smtpTransport;
}

/**
 * Fail startup when SMTP is selected without the settings required to send.
 * Console mode stays available when it is the selected provider.
 */
function warnEmailConfigAtStartup() {
  const provider = config.email?.provider || 'console';
  if (provider !== 'smtp') {
    logger.info('email_provider', {
      provider: 'console',
      delivery: 'logged',
      note: 'Messages are written locally and are not emailed.',
    });
    return;
  }

  const missing = missingSmtpSettings();
  if (missing.length > 0) {
    throw new Error(
      `EMAIL_PROVIDER=smtp but required settings are missing: ${missing.join(', ')}. ` +
        'The process will not start and will not fall back to console logging.',
    );
  }

  const smtp = config.email.smtp;
  logger.info('email_provider', {
    provider: 'smtp',
    host: smtp.host,
    port: smtp.port,
    secure: smtp.secure,
    userConfigured: true,
    delivery: 'submitted',
  });
}

/**
 * @param {{ to: string, subject: string, text: string, html?: string }} message
 * @param {{ provider?: string, timeoutMs?: number, email?: object, transport?: { sendMail: Function } }} [deps]
 * @returns {Promise<{ provider: 'console'|'smtp', delivery: 'logged'|'submitted', messageId: string }>}
 */
async function sendEmail(message, deps = {}) {
  const provider = deps.provider || config.email?.provider || 'console';
  const timeoutMs = deps.timeoutMs || SMTP_TIMEOUT_MS;

  if (provider === 'smtp') {
    const emailCfg = deps.email || config.email || { provider: 'smtp' };
    const missing = missingSmtpSettings({ ...emailCfg, provider: 'smtp' });
    if (missing.length > 0 && !deps.transport) {
      throw new AppError(
        `EMAIL_PROVIDER=smtp but required settings are missing: ${missing.join(', ')}.`,
        { statusCode: 503, code: 'EMAIL_NOT_CONFIGURED' },
      );
    }
    const transport = deps.transport || getSmtpTransport();
    try {
      const info = await withTimeout(
        transport.sendMail({
          from: emailCfg.from || config.email?.from,
          to: message.to,
          subject: message.subject,
          text: message.text,
          html: message.html || undefined,
        }),
        timeoutMs,
      );
      const messageId = info?.messageId || `smtp-${Date.now()}`;
      logger.info('email_smtp_submitted', {
        to: message.to,
        subject: message.subject,
        messageId,
        delivery: 'submitted',
      });
      return { provider: 'smtp', delivery: 'submitted', messageId };
    } catch (err) {
      throw toDeliveryError(err);
    }
  }

  const messageId = `console-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  rememberConsoleMessage(message, messageId);
  const mailboxFile = writeDevMailbox(message, messageId);
  logger.info('email_console_logged', {
    to: message.to,
    subject: message.subject,
    messageId,
    delivery: 'logged',
    mailboxFile,
    note: 'Not sent to an inbox.',
  });
  return { provider: 'console', delivery: 'logged', messageId };
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
  missingSmtpSettings,
  redactMessageText,
  SMTP_TIMEOUT_MS,
};
