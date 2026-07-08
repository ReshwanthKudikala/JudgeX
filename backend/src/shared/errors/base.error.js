// AppError base class (HTTP status, machine code, isOperational flag).
// All expected/handled errors extend this so the error handler can format them.

class AppError extends Error {
  constructor(message, { statusCode = 500, code = 'INTERNAL_ERROR', details = null } = {}) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    // Operational = a known, anticipated condition (vs. a programmer bug).
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = { AppError };
