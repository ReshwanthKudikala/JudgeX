// Catch-all for unmatched routes: forwards a NotFoundError to the error handler.

const { NotFoundError } = require('../shared/errors/http-errors');

function notFound(req, _res, next) {
  next(new NotFoundError(`Route not found: ${req.method} ${req.originalUrl}`));
}

module.exports = { notFound };
