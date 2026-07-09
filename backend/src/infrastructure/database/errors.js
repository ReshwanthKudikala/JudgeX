// Translates raw PostgreSQL/driver errors into the application's error hierarchy.
// Every query and transaction runs through this so callers only ever see AppErrors.

const { AppError } = require('../../shared/errors/base.error');
const { ConflictError, ValidationError } = require('../../shared/errors/http-errors');
const {
  DatabaseError,
  SerializationFailureError,
  DatabaseUnavailableError,
} = require('../../shared/errors/domain-errors');

// PostgreSQL SQLSTATE codes (https://www.postgresql.org/docs/current/errcodes-appendix.html).
const SQLSTATE = {
  UNIQUE_VIOLATION: '23505',
  FOREIGN_KEY_VIOLATION: '23503',
  NOT_NULL_VIOLATION: '23502',
  CHECK_VIOLATION: '23514',
  EXCLUSION_VIOLATION: '23P01',
  INVALID_TEXT_REPRESENTATION: '22P02', // bad enum/uuid/number cast
  SERIALIZATION_FAILURE: '40001',
  DEADLOCK_DETECTED: '40P01',
  ADMIN_SHUTDOWN: '57P01',
  CANNOT_CONNECT_NOW: '57P03',
};

// Node/driver socket-level error codes that indicate the DB is unreachable.
const SOCKET_ERRORS = new Set(['ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND', 'ECONNRESET', 'EPIPE']);

/**
 * Map a thrown error to an AppError subclass. Already-mapped AppErrors (and
 * errors intentionally thrown by a service/repository) pass through unchanged.
 */
function mapDatabaseError(err) {
  if (err instanceof AppError) return err;

  const code = err && err.code;

  switch (code) {
    case SQLSTATE.UNIQUE_VIOLATION:
      return new ConflictError('A record with these values already exists.', {
        constraint: err.constraint,
      });

    case SQLSTATE.FOREIGN_KEY_VIOLATION:
      return new ConflictError('Operation violates a reference (foreign key) constraint.', {
        constraint: err.constraint,
      });

    case SQLSTATE.NOT_NULL_VIOLATION:
    case SQLSTATE.CHECK_VIOLATION:
    case SQLSTATE.EXCLUSION_VIOLATION:
    case SQLSTATE.INVALID_TEXT_REPRESENTATION:
      return new ValidationError('The request violates a database data constraint.', {
        column: err.column,
        constraint: err.constraint,
      });

    case SQLSTATE.SERIALIZATION_FAILURE:
    case SQLSTATE.DEADLOCK_DETECTED:
      return new SerializationFailureError(undefined, { cause: code });

    default:
      break;
  }

  // Connection-class failures: SQLSTATE class 08, specific 57Pxx, or socket errors.
  const isConnectionFailure =
    (typeof code === 'string' && code.startsWith('08')) ||
    code === SQLSTATE.ADMIN_SHUTDOWN ||
    code === SQLSTATE.CANNOT_CONNECT_NOW ||
    SOCKET_ERRORS.has(code);

  if (isConnectionFailure) {
    return new DatabaseUnavailableError(undefined, { cause: code });
  }

  // Unknown/unexpected: non-operational so the error handler logs the stack.
  return new DatabaseError('An unexpected database error occurred.', {
    isOperational: false,
    cause: code || (err && err.message),
  });
}

module.exports = { mapDatabaseError, SQLSTATE };
