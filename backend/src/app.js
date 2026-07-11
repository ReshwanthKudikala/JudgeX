// API app assembly: mounts cross-cutting middleware and module routers (no server listen).

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');

const { config } = require('./config');
const { logger } = require('./shared/logger/logger');
const { buildHelmetOptions } = require('./shared/security/helmet');
const { buildCorsOptions } = require('./shared/security/cors');
const { correlationId } = require('./middlewares/correlation-id');
const { notFound } = require('./middlewares/not-found');
const { errorHandler } = require('./middlewares/error-handler');
const { registerModules } = require('./bootstrap/module-registry');
const { getLiveness, getReadiness } = require('./modules/health/health.service');

function createApp() {
  const app = express();

  // Trust the reverse proxy (correct client IPs for rate limiting).
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  // --- Global middleware (order matters) ---
  app.use(helmet(buildHelmetOptions({ isProduction: config.isProduction })));
  app.use(cors(buildCorsOptions(config.server.corsOrigins)));
  app.use(express.json({ limit: config.server.jsonBodyLimit }));
  app.use(express.urlencoded({ extended: false, limit: config.server.jsonBodyLimit }));

  // Correlation ID must run before request logging so logs carry the ID.
  app.use(correlationId);

  // HTTP access logs routed through the structured logger (no console).
  const morganFormat = config.isDev ? 'dev' : 'combined';
  app.use(
    morgan(morganFormat, {
      stream: { write: (line) => logger.info(line.trim(), { source: 'http' }) },
    }),
  );

  // --- Probes (flat JSON for orchestrators; not the standard API envelope) ---
  // Liveness: process is up. Does not check dependencies.
  app.get('/health', (_req, res) => {
    res.status(200).json(getLiveness());
  });

  // Readiness: Postgres + Redis + BullMQ must be reachable before taking traffic.
  async function sendReadiness(_req, res) {
    try {
      const body = await getReadiness();
      res.status(body.ready ? 200 : 503).json(body);
    } catch (err) {
      logger.warn('Readiness check failed', { error: err.message });
      res.status(503).json({
        ready: false,
        status: 'not_ready',
        error: err.message,
        timestamp: new Date().toISOString(),
      });
    }
  }

  app.get('/ready', sendReadiness);
  // API_SPECIFICATION.md § summary: GET /api/v1/health → dependency readiness.
  app.get('/api/v1/health', sendReadiness);

  // --- Feature module routers (mounted under /api/v1) ---
  registerModules(app);

  // --- Terminal middleware ---
  app.use(notFound);
  app.use(errorHandler);

  return app;
}

module.exports = { createApp };
