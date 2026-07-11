// API entry point: connects infrastructure, starts the HTTP server, and wires
// graceful shutdown.

const { config } = require('./config');
const { assertProductionReady, getStartupDiagnostics } = require('./config/production');
const { logger, configure: configureLogger } = require('./shared/logger/logger');
const { createApp } = require('./app');
const { registerGracefulShutdown } = require('./bootstrap/graceful-shutdown');
const { initInfrastructure, shutdownInfrastructure } = require('./infrastructure');

async function start() {
  // Apply the configured log level/format before anything logs.
  configureLogger({ level: config.logging.level, format: config.logging.format });

  try {
    assertProductionReady();
  } catch (err) {
    logger.error('Production configuration validation failed; shutting down', {
      error: err.message,
    });
    process.exit(1);
  }

  logger.info('JudgeX API boot starting', getStartupDiagnostics());

  try {
    await initInfrastructure();
  } catch (err) {
    logger.error('Infrastructure initialization failed; shutting down', {
      error: err.message,
    });
    await shutdownInfrastructure();
    process.exit(1);
  }

  const app = createApp();

  const server = app.listen(config.server.port, () => {
    logger.info('JudgeX API started', {
      ...getStartupDiagnostics(),
      listen: `:${config.server.port}`,
      probes: {
        liveness: '/health',
        live: '/health/live',
        ready: '/health/ready',
        readiness: '/ready',
        apiHealth: '/api/v1/health',
        metrics: '/metrics',
      },
    });
  });

  registerGracefulShutdown(server, { onShutdown: [shutdownInfrastructure] });

  return server;
}

start();
