// Global error handler (last middleware): maps errors to the standard envelope.

const { config } = require('../config');
const { logger } = require('../shared/logger/logger');
const { AppError } = require('../shared/errors/base.error');
const {
  RateLimitError,
  PayloadTooLargeError,
} = require('../shared/errors/http-errors');
const { sendError } = require('../shared/http/response');
const { logSecurityEvent } = require('../shared/security/security-log');
const { trackError } = require('../shared/observability/error-tracking');

const SECURITY_CODES = new Set([
  'UNAUTHENTICATED',
  'PAYLOAD_TOO_LARGE',
]);

// eslint-disable-next-line no-unused-vars -- Express requires 4 args to detect this as an error handler.
function errorHandler(err, req, res, next) {
  const log = req.log || logger;

  // Express body-parser oversized payload.
  if (err && (err.type === 'entity.too.large' || err.status === 413)) {
    err = new PayloadTooLargeError('Request payload exceeds the configured size limit.');
  }

  // CORS rejection from the dynamic origin callback.
  if (err && typeof err.message === 'string' && err.message.startsWith('CORS origin not allowed')) {
    logSecurityEvent('security_violation', { reason: 'cors_rejected', detail: err.message }, req);
    return sendError(req, res, 403, 'FORBIDDEN', 'Origin not allowed.');
  }

  const isAppError = err instanceof AppError;
  const statusCode = isAppError ? err.statusCode : 500;
  const code = isAppError ? err.code : 'INTERNAL_ERROR';

  if (err instanceof RateLimitError && err.retryAfterSec) {
    res.setHeader('Retry-After', String(err.retryAfterSec));
  }

  if (SECURITY_CODES.has(code)) {
    logSecurityEvent('security_violation', { code, statusCode }, req);
  }

  if (isAppError && err.isOperational) {
    if (!SECURITY_CODES.has(code) && code !== 'INVALID_CREDENTIALS' && code !== 'RATE_LIMITED' && code !== 'FORBIDDEN') {
      log.warn(err.message, { code, statusCode });
    }
  } else {
    trackError('http.unhandled', err, { code, statusCode }, { log });
  }

  // Do not leak internals for non-operational/500 errors.
  const clientMessage =
    isAppError && err.isOperational
      ? err.message
      : 'Something went wrong. Please try again.';

  const meta = {};
  if (!config.isProduction && !(isAppError && err.isOperational)) {
    meta.debug = { stack: err.stack };
  }

  const errorBody = { code, message: clientMessage };
  if (isAppError && err.details && code === 'VALIDATION_ERROR') {
    errorBody.details = err.details;
  }

  return res.status(statusCode).json({
    success: false,
    data: null,
    error: errorBody,
    meta: {
      correlationId: req && req.correlationId ? req.correlationId : null,
      ...meta,
    },
  });
}

module.exports = { errorHandler };
