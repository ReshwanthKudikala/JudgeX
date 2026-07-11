// API entry point: connects infrastructure, starts the HTTP server, and wires
// graceful shutdown.

const { config } = require('./config');
const { assertProductionReady, getStartupDiagnostics } = require('./config/production');
const { logger, configure: configureLogger } = require('./shared/logger/logger');
const { createApp } = require('./app');
const { registerGracefulShutdown } = require('./bootstrap/graceful-shutdown');
const { initInfrastructure, shutdownInfrastructure } = require('./infrastructure');

async function start() {
  // Apply the configured log level before anything logs.
  configureLogger({ level: config.logging.level });

  try {
    assertProductionReady();
  } catch (err) {
    logger.error('Production configuration validation failed; shutting down', {
      error: err.message,
    });
    process.exit(1);
  }

  logger.info('JudgeX API boot starting', getStartupDiagnostics());

  // Connect backing services first. Required services that stay unreachable
  // (after capped retries) abort startup — fail fast before accepting traffic.
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
      probes: { liveness: '/health', readiness: '/ready', apiHealth: '/api/v1/health' },
    });
  });

  // On shutdown, stop accepting connections, then close DB/Redis cleanly.
  registerGracefulShutdown(server, { onShutdown: [shutdownInfrastructure] });

  return server;
}

start();
