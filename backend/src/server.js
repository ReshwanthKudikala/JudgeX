// API entry point: connects infrastructure, starts the HTTP server, and wires
// graceful shutdown.

const { config } = require('./config');
const { logger, configure: configureLogger } = require('./shared/logger/logger');
const { createApp } = require('./app');
const { registerGracefulShutdown } = require('./bootstrap/graceful-shutdown');
const { initInfrastructure, shutdownInfrastructure } = require('./infrastructure');

async function start() {
  // Apply the configured log level before anything logs.
  configureLogger({ level: config.logging.level });

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
      port: config.server.port,
      env: config.env,
      aiProvider: config.ai.provider,
    });
  });

  // On shutdown, stop accepting connections, then close DB/Redis cleanly.
  registerGracefulShutdown(server, { onShutdown: [shutdownInfrastructure] });

  return server;
}

start();
