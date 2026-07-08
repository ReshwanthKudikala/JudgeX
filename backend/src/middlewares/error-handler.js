// Global error handler (last middleware): maps errors to the standard envelope.

const { config } = require('../config');
const { logger } = require('../shared/logger/logger');
const { AppError } = require('../shared/errors/base.error');
const { sendError } = require('../shared/http/response');

// eslint-disable-next-line no-unused-vars -- Express requires 4 args to detect this as an error handler.
function errorHandler(err, req, res, next) {
  const log = req.log || logger;

  const isAppError = err instanceof AppError;
  const statusCode = isAppError ? err.statusCode : 500;
  const code = isAppError ? err.code : 'INTERNAL_ERROR';

  // Operational errors are expected; unexpected ones are logged at error level
  // with the stack for debugging (never leaked to the client).
  if (isAppError && err.isOperational) {
    log.warn(err.message, { code, statusCode });
  } else {
    log.error(err.message || 'Unhandled error', {
      code,
      statusCode,
      stack: err.stack,
    });
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

  sendError(req, res, statusCode, code, clientMessage, meta);
}

module.exports = { errorHandler };
