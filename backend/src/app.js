// API app assembly: mounts cross-cutting middleware and module routers (no server listen).

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');

const { config } = require('./config');
const { logger } = require('./shared/logger/logger');
const { correlationId } = require('./middlewares/correlation-id');
const { notFound } = require('./middlewares/not-found');
const { errorHandler } = require('./middlewares/error-handler');

const pkg = require('../package.json');

function createApp() {
  const app = express();

  // Trust the reverse proxy (correct client IPs for future rate limiting).
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  // --- Global middleware (order matters) ---
  app.use(helmet());
  app.use(cors({ origin: config.server.corsOrigins, credentials: true }));
  app.use(express.json({ limit: config.server.jsonBodyLimit }));
  app.use(express.urlencoded({ extended: false }));

  // Correlation ID must run before request logging so logs carry the ID.
  app.use(correlationId);

  // HTTP access logs routed through the structured logger (no console).
  const morganFormat = config.isDev ? 'dev' : 'combined';
  app.use(
    morgan(morganFormat, {
      stream: { write: (line) => logger.info(line.trim(), { source: 'http' }) },
    }),
  );

  // --- Routes ---
  // Health check: intentionally NOT wrapped in the standard envelope so
  // external probes (Docker/orchestrators) can read a flat status object.
  app.get('/health', (_req, res) => {
    res.status(200).json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: pkg.version,
    });
  });

  // No other routes are mounted yet (auth/problems/submissions/etc. come later).

  // --- Terminal middleware ---
  app.use(notFound);
  app.use(errorHandler);

  return app;
}

module.exports = { createApp };
