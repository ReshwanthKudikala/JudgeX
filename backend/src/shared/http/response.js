// Standard success/error response envelope shape (API_SPECIFICATION.md §8).
// Every response uses { success, data, error, meta } with a correlationId.

function buildMeta(req, extra = {}) {
  return { correlationId: req && req.correlationId ? req.correlationId : null, ...extra };
}

function sendSuccess(req, res, status, data, metaExtra = {}) {
  return res.status(status).json({
    success: true,
    data,
    error: null,
    meta: buildMeta(req, metaExtra),
  });
}

function sendError(req, res, status, code, message, metaExtra = {}) {
  return res.status(status).json({
    success: false,
    data: null,
    error: { code, message },
    meta: buildMeta(req, metaExtra),
  });
}

module.exports = { buildMeta, sendSuccess, sendError };
