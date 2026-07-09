// Domain error classes: Database (+ subclasses), Judge, Queue, Docker, Storage, AI.
// These extend AppError so the global error handler can format them uniformly.

const { AppError } = require('./base.error');

// --- Database ---------------------------------------------------------------

class DatabaseError extends AppError {
  constructor(
    message = 'A database error occurred.',
    { statusCode = 500, code = 'INTERNAL_ERROR', details = null, retryable = false, isOperational = true, cause = null } = {},
  ) {
    super(message, { statusCode, code, details });
    // Whether retrying the operation may succeed (transient failures).
    this.retryable = retryable;
    // Internal-only: original driver/SQLSTATE code. Never serialized to clients.
    this.cause = cause;
    this.isOperational = isOperational;
  }
}

// Transaction conflict (serialization failure / deadlock) — safe to retry.
class SerializationFailureError extends DatabaseError {
  constructor(message = 'Transaction conflict; please retry the operation.', { cause = null } = {}) {
    super(message, { statusCode: 503, code: 'SERVICE_UNAVAILABLE', retryable: true, isOperational: true, cause });
  }
}

// Database is unreachable/connection-class failure — transient.
class DatabaseUnavailableError extends DatabaseError {
  constructor(message = 'The database is currently unavailable.', { cause = null } = {}) {
    super(message, { statusCode: 503, code: 'SERVICE_UNAVAILABLE', retryable: true, isOperational: true, cause });
  }
}

// --- Other infrastructure/domain errors (used by later sprints) -------------

class JudgeError extends AppError {
  constructor(message = 'Judging failed.', details = null) {
    super(message, { statusCode: 500, code: 'JUDGING_FAILED', details });
  }
}

class QueueError extends AppError {
  constructor(message = 'The job queue is unavailable.', details = null) {
    super(message, { statusCode: 503, code: 'SERVICE_UNAVAILABLE', details });
  }
}

class DockerError extends AppError {
  constructor(message = 'Sandbox execution failed.', details = null) {
    super(message, { statusCode: 500, code: 'INTERNAL_ERROR', details });
  }
}

class StorageError extends AppError {
  constructor(message = 'Object storage operation failed.', details = null) {
    super(message, { statusCode: 500, code: 'INTERNAL_ERROR', details });
  }
}

class AIError extends AppError {
  constructor(message = 'The AI provider is unavailable.', details = null) {
    super(message, { statusCode: 503, code: 'AI_UNAVAILABLE', details });
  }
}

module.exports = {
  DatabaseError,
  SerializationFailureError,
  DatabaseUnavailableError,
  JudgeError,
  QueueError,
  DockerError,
  StorageError,
  AIError,
};
