// Structured HTTP access logging (replaces Morgan string formats).
// One log line per request with method/path/status/duration/IP/UA/userId.

const { config } = require('../config');
const { metrics } = require('../shared/observability/metrics');

/** Paths that are noisy under probes — sample in production. */
const SAMPLED_PATHS = new Set([
  '/health',
  '/health/live',
  '/health/ready',
  '/ready',
  '/metrics',
  '/api/v1/health',
]);

/**
 * @returns {import('express').RequestHandler}
 */
function requestLogger() {
  return (req, res, next) => {
    const start = process.hrtime.bigint();

    res.on('finish', () => {
      const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
      const path = req.route?.path
        ? `${req.baseUrl || ''}${req.route.path}`
        : req.path || req.url || '';
      const routeLabel = path || 'unknown';

      metrics.observeHttpRequest({
        method: req.method,
        route: routeLabel,
        statusCode: res.statusCode,
        durationSeconds: durationMs / 1000,
      });

      const noisy = SAMPLED_PATHS.has(req.path);
      if (noisy && config.isProduction && Math.random() > 0.1) {
        return;
      }

      const log = req.log || require('../shared/logger/logger').logger;
      log.info('http_request', {
        source: 'http',
        method: req.method,
        path: req.originalUrl || req.url,
        statusCode: res.statusCode,
        durationMs: Math.round(durationMs * 100) / 100,
        ip: req.ip || req.socket?.remoteAddress || null,
        userAgent: req.get('user-agent') || null,
        userId: req.user?.id || null,
        requestId: req.requestId || req.correlationId || null,
      });
    });

    next();
  };
}

module.exports = { requestLogger, SAMPLED_PATHS };
