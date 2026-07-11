// Structured security-event logging. Never log secrets, tokens, or passwords.

const { logger } = require('../logger/logger');

/**
 * @typedef {'failed_login'|'permission_denied'|'rate_limited'|'security_violation'|'admin_action'|'payload_rejected'} SecurityEventType
 */

/**
 * Emit a security audit log line (warn level). Safe fields only.
 *
 * @param {SecurityEventType} type
 * @param {Object} [fields]
 * @param {import('express').Request} [req]
 */
function logSecurityEvent(type, fields = {}, req = null) {
  const log = (req && req.log) || logger;
  const meta = {
    securityEvent: type,
    ip: req ? clientIp(req) : fields.ip,
    method: req?.method,
    path: req ? req.originalUrl || req.url : fields.path,
    userId: req?.user?.id || fields.userId || null,
    role: req?.user?.role || fields.role || null,
    correlationId: req?.correlationId || fields.correlationId || null,
    ...sanitize(fields),
  };

  // Drop request object if somehow passed through fields.
  delete meta.req;
  delete meta.password;
  delete meta.token;
  delete meta.accessToken;
  delete meta.authorization;

  log.warn(`security:${type}`, meta);
}

function clientIp(req) {
  if (!req) return null;
  return req.ip || req.socket?.remoteAddress || null;
}

function sanitize(fields) {
  const out = {};
  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined) continue;
    const lower = key.toLowerCase();
    if (
      lower.includes('password') ||
      lower.includes('token') ||
      lower.includes('secret') ||
      lower.includes('authorization') ||
      lower.includes('apikey')
    ) {
      continue;
    }
    out[key] = value;
  }
  return out;
}

module.exports = { logSecurityEvent, clientIp };
