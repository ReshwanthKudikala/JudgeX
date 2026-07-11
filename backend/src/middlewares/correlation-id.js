// Assigns/propagates request + correlation IDs and attaches a child logger.

const { v7: uuidv7 } = require('uuid');
const { logger } = require('../shared/logger/logger');

const CORRELATION_HEADER = 'x-correlation-id';
const REQUEST_HEADER = 'x-request-id';

/**
 * Prefer inbound X-Request-ID, then X-Correlation-Id, else mint a UUIDv7.
 * Both response headers are set to the same value for tracing compatibility.
 */
function correlationId(req, res, next) {
  const fromRequest = req.headers[REQUEST_HEADER];
  const fromCorrelation = req.headers[CORRELATION_HEADER];
  const incoming =
    (typeof fromRequest === 'string' && fromRequest.trim()) ||
    (typeof fromCorrelation === 'string' && fromCorrelation.trim()) ||
    '';
  const id = incoming || uuidv7();

  req.requestId = id;
  req.correlationId = id;
  res.setHeader(REQUEST_HEADER, id);
  res.setHeader(CORRELATION_HEADER, id);

  req.log = logger.child({ requestId: id, correlationId: id });

  next();
}

module.exports = {
  correlationId,
  REQUEST_HEADER,
  CORRELATION_HEADER,
};
