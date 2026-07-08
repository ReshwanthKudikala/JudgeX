// API entry point: starts the HTTP server and wires graceful shutdown.

const { config } = require('./config');
const { logger, configure: configureLogger } = require('./shared/logger/logger');
const { createApp } = require('./app');
const { registerGracefulShutdown } = require('./bootstrap/graceful-shutdown');

// Apply the configured log level before anything logs.
configureLogger({ level: config.logging.level });

const app = createApp();

// The server starts successfully regardless of PostgreSQL/Redis/Ollama status;
// no external connections are opened during bootstrap.
const server = app.listen(config.server.port, () => {
  logger.info('JudgeX API started', {
    port: config.server.port,
    env: config.env,
    aiProvider: config.ai.provider,
  });
});

registerGracefulShutdown(server);

module.exports = { server };
