// API app assembly: mounts cross-cutting middleware and module routers (no server listen).

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');

const { config } = require('./config');
const { logger } = require('./shared/logger/logger');
const { buildHelmetOptions } = require('./shared/security/helmet');
const { buildCorsOptions } = require('./shared/security/cors');
const { correlationId } = require('./middlewares/correlation-id');
const { requestLogger } = require('./middlewares/request-logger');
const { notFound } = require('./middlewares/not-found');
const { errorHandler } = require('./middlewares/error-handler');
const { registerModules } = require('./bootstrap/module-registry');
const { getLiveness, getReadiness } = require('./modules/health/health.service');
const { metrics } = require('./shared/observability/metrics');
const { trackError } = require('./shared/observability/error-tracking');

function createApp() {
  const app = express();

  // Trust the reverse proxy (correct client IPs for rate limiting / logging).
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  // --- Global middleware (order matters) ---
  app.use(helmet(buildHelmetOptions({ isProduction: config.isProduction })));
  app.use(cors(buildCorsOptions(config.server.corsOrigins)));
  app.use(express.json({ limit: config.server.jsonBodyLimit }));
  app.use(express.urlencoded({ extended: false, limit: config.server.jsonBodyLimit }));

  // Request ID must run before access logging so logs carry the ID.
  app.use(correlationId);
  app.use(requestLogger());

  // --- Probes (flat JSON for orchestrators; not the standard API envelope) ---
  async function sendReadiness(_req, res) {
    try {
      const body = await getReadiness();
      res.status(body.ready ? 200 : 503).json(body);
    } catch (err) {
      trackError('health.readiness', err);
      res.status(503).json({
        ready: false,
        status: 'not_ready',
        error: err.message,
        timestamp: new Date().toISOString(),
      });
    }
  }

  // Liveness: process is up. Does not check dependencies.
  app.get('/health', (_req, res) => {
    res.status(200).json(getLiveness());
  });
  app.get('/health/live', (_req, res) => {
    res.status(200).json(getLiveness());
  });

  // Readiness: Postgres + Redis + BullMQ required; worker/Docker reported.
  app.get('/ready', sendReadiness);
  app.get('/health/ready', sendReadiness);
  // API_SPECIFICATION.md § summary: GET /api/v1/health → dependency readiness.
  app.get('/api/v1/health', sendReadiness);

  // Prometheus scrape endpoint (text exposition format).
  app.get('/metrics', async (_req, res) => {
    try {
      res.setHeader('Content-Type', metrics.contentType);
      res.end(await metrics.render());
    } catch (err) {
      trackError('metrics.render', err);
      res.status(500).end(err.message);
    }
  });

  // --- Feature module routers (mounted under /api/v1) ---
  registerModules(app);

  // --- Terminal middleware ---
  app.use(notFound);
  app.use(errorHandler);

  return app;
}

module.exports = { createApp };
