// Loads .env, validates it once, and exports an immutable, typed config object.
// This is the ONLY module in the app that reads process.env.

require('dotenv').config();

const { envSchema } = require('./env.schema');
const { resolveFeatureFlags } = require('./feature-flags');

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  // Fail fast: never boot half-configured. Print a clear, actionable message.
  const issues = parsed.error.issues
    .map((i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`)
    .join('\n');
  // eslint-disable-next-line no-console -- config layer has no logger yet.
  console.error(`\nInvalid environment configuration:\n${issues}\n`);
  process.exit(1);
}

const env = parsed.data;

// Grouped, immutable configuration. Everything else imports this object
// instead of reading process.env directly.
const config = Object.freeze({
  env: env.NODE_ENV,
  isProduction: env.NODE_ENV === 'production',
  isDev: env.NODE_ENV === 'development',

  server: Object.freeze({
    port: env.PORT,
    corsOrigins: env.CORS_ORIGIN.split(',')
      .map((o) => o.trim())
      .filter(Boolean),
    jsonBodyLimit: '1mb',
  }),

  database: Object.freeze({
    url: env.DATABASE_URL,
    poolMax: env.DB_POOL_MAX,
    connectionTimeoutMs: env.DB_CONNECTION_TIMEOUT_MS,
    idleTimeoutMs: env.DB_IDLE_TIMEOUT_MS,
    required: env.DB_REQUIRED,
  }),

  redis: Object.freeze({
    url: env.REDIS_URL,
    required: env.REDIS_REQUIRED,
  }),

  infra: Object.freeze({
    startupRetries: env.INFRA_STARTUP_RETRIES,
    startupRetryDelayMs: env.INFRA_STARTUP_RETRY_DELAY_MS,
  }),

  jwt: Object.freeze({
    secret: env.JWT_SECRET,
    expiresIn: env.JWT_EXPIRES_IN,
  }),

  security: Object.freeze({
    bcryptSaltRounds: env.BCRYPT_SALT_ROUNDS,
    rateLimit: Object.freeze({
      windowMs: env.RATE_LIMIT_WINDOW_MS,
      max: env.RATE_LIMIT_MAX,
    }),
  }),

  ai: Object.freeze({
    provider: env.AI_PROVIDER,
    ollama: Object.freeze({ baseUrl: env.OLLAMA_BASE_URL, model: env.OLLAMA_MODEL }),
    openai: Object.freeze({ apiKey: env.OPENAI_API_KEY, model: env.OPENAI_MODEL }),
  }),

  judge: Object.freeze({
    timeLimitMs: env.JUDGE_TIME_LIMIT_MS,
    memoryLimitMb: env.JUDGE_MEMORY_LIMIT_MB,
    pidLimit: env.JUDGE_PID_LIMIT,
    workerConcurrency: env.JUDGE_WORKER_CONCURRENCY,
  }),

  storage: Object.freeze({
    bucket: env.STORAGE_BUCKET,
    endpoint: env.STORAGE_ENDPOINT,
    accessKey: env.STORAGE_ACCESS_KEY,
    secretKey: env.STORAGE_SECRET_KEY,
  }),

  logging: Object.freeze({
    level: env.LOG_LEVEL,
  }),

  featureFlags: resolveFeatureFlags(env),
});

module.exports = { config };
