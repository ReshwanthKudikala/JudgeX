// Production env hardening beyond the base schema (config/env.schema.js).
// Called at API/worker boot so misconfiguration fails before accepting traffic.

const { config } = require('./index');

/**
 * Extra production checks that complement Zod validation.
 * Safe to call in every environment — no-ops outside production.
 *
 * @param {typeof config} [cfg]
 * @throws {Error} when production requirements are not met.
 */
function assertProductionReady(cfg = config) {
  if (!cfg.isProduction) return;

  const problems = [];

  if (!cfg.database.required) {
    problems.push('DB_REQUIRED must be true in production');
  }
  if (!cfg.redis.required) {
    problems.push('REDIS_REQUIRED must be true in production');
  }
  if (!cfg.database.url || cfg.database.url.includes('judgex:judgex@localhost')) {
    problems.push('DATABASE_URL must not use the local development default in production');
  }
  if (!cfg.redis.url || cfg.redis.url === 'redis://localhost:6379') {
    problems.push('REDIS_URL must not use the local development default in production');
  }
  if (cfg.jwt.secret.length < 32) {
    problems.push('JWT_SECRET must be at least 32 characters in production');
  }
  if (cfg.ai.provider === 'openai' && !cfg.ai.openai.apiKey) {
    problems.push('OPENAI_API_KEY is required when AI_PROVIDER=openai');
  }
  if (cfg.security?.rateLimit && cfg.security.rateLimit.enabled === false) {
    problems.push('RATE_LIMIT_ENABLED must be true in production');
  }
  const origins = cfg.server?.corsOrigins || [];
  if (origins.length === 0) {
    problems.push('CORS_ORIGIN must list at least one production frontend origin');
  }
  if (origins.some((o) => o.includes('localhost') || o.includes('127.0.0.1'))) {
    problems.push('CORS_ORIGIN must not include localhost in production');
  }

  if (problems.length > 0) {
    const message = `Production configuration invalid:\n${problems.map((p) => `  - ${p}`).join('\n')}`;
    throw new Error(message);
  }
}

/**
 * Sanitized startup snapshot for structured logs (no secrets).
 */
function getStartupDiagnostics(cfg = config) {
  return {
    env: cfg.env,
    port: cfg.server.port,
    databaseRequired: cfg.database.required,
    redisRequired: cfg.redis.required,
    aiProvider: cfg.ai.provider,
    featureFlags: cfg.featureFlags,
    reaper: {
      intervalMs: cfg.reaper.intervalMs,
      stuckThresholdMs: cfg.reaper.stuckThresholdMs,
      batchSize: cfg.reaper.batchSize,
    },
    judge: {
      timeLimitMs: cfg.judge.timeLimitMs,
      memoryLimitMb: cfg.judge.memoryLimitMb,
      workerConcurrency: cfg.judge.workerConcurrency,
    },
    security: {
      rateLimitEnabled: cfg.security?.rateLimit?.enabled ?? true,
      corsOriginCount: cfg.server?.corsOrigins?.length ?? 0,
      jsonBodyLimit: cfg.server?.jsonBodyLimit,
    },
  };
}

module.exports = {
  assertProductionReady,
  getStartupDiagnostics,
};
