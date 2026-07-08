// Assigns/propagates a correlation ID per request and attaches a child logger.

const { v7: uuidv7 } = require('uuid');
const { logger } = require('../shared/logger/logger');

const HEADER = 'x-correlation-id';

function correlationId(req, res, next) {
  // Accept an inbound ID (trusted upstream) or mint a new time-ordered one.
  const incoming = req.headers[HEADER];
  const id = typeof incoming === 'string' && incoming.trim() ? incoming.trim() : uuidv7();

  req.correlationId = id;
  res.setHeader(HEADER, id);

  // Request-scoped child logger carries the correlation ID on every line.
  req.log = logger.child({ correlationId: id });

  next();
}

module.exports = { correlationId };
