// HTTP error classes: NotFound, Unauthorized, Forbidden, Conflict, Validation.
// Codes/statuses mirror API_SPECIFICATION.md §9.

const { AppError } = require('./base.error');

class NotFoundError extends AppError {
  constructor(message = 'The requested resource does not exist.', details = null) {
    super(message, { statusCode: 404, code: 'NOT_FOUND', details });
  }
}

class UnauthorizedError extends AppError {
  constructor(message = 'Authentication is required.', details = null) {
    super(message, { statusCode: 401, code: 'UNAUTHENTICATED', details });
  }
}

class ForbiddenError extends AppError {
  constructor(message = 'You do not have permission to perform this action.', details = null) {
    super(message, { statusCode: 403, code: 'FORBIDDEN', details });
  }
}

class ConflictError extends AppError {
  constructor(message = 'The request conflicts with the current state.', details = null) {
    super(message, { statusCode: 409, code: 'CONFLICT', details });
  }
}

class ValidationError extends AppError {
  constructor(message = 'Request failed validation.', details = null) {
    super(message, { statusCode: 400, code: 'VALIDATION_ERROR', details });
  }
}

class RateLimitError extends AppError {
  /**
   * @param {string} [message]
   * @param {{ retryAfterSec?: number, details?: unknown }} [opts]
   */
  constructor(message = 'Too many requests. Please try again later.', opts = {}) {
    super(message, {
      statusCode: 429,
      code: 'RATE_LIMITED',
      details: opts.details ?? null,
    });
    this.retryAfterSec = Math.max(1, Number(opts.retryAfterSec) || 60);
  }
}

class PayloadTooLargeError extends AppError {
  constructor(message = 'Request payload is too large.', details = null) {
    super(message, { statusCode: 413, code: 'PAYLOAD_TOO_LARGE', details });
  }
}

module.exports = {
  NotFoundError,
  UnauthorizedError,
  ForbiddenError,
  ConflictError,
  ValidationError,
  RateLimitError,
  PayloadTooLargeError,
};
