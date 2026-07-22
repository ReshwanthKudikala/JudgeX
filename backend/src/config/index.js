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
    jsonBodyLimit: env.JSON_BODY_LIMIT,
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
    allowLocalhostCorsInProduction: env.ALLOW_LOCALHOST_CORS_IN_PRODUCTION,
    rateLimit: Object.freeze({
      enabled: env.RATE_LIMIT_ENABLED,
      forceInTest: env.RATE_LIMIT_FORCE_IN_TEST,
      windowMs: env.RATE_LIMIT_WINDOW_MS,
      max: env.RATE_LIMIT_MAX,
      tiers: Object.freeze({
        global: Object.freeze({
          windowMs: env.RATE_LIMIT_WINDOW_MS,
          max: env.RATE_LIMIT_MAX,
        }),
        auth: Object.freeze({
          windowMs: env.RATE_LIMIT_AUTH_WINDOW_MS,
          max: env.RATE_LIMIT_AUTH_MAX,
        }),
        submission: Object.freeze({
          windowMs: env.RATE_LIMIT_SUBMISSION_WINDOW_MS,
          max: env.RATE_LIMIT_SUBMISSION_MAX,
        }),
        ai: Object.freeze({
          windowMs: env.RATE_LIMIT_AI_WINDOW_MS,
          max: env.RATE_LIMIT_AI_MAX,
        }),
        admin: Object.freeze({
          windowMs: env.RATE_LIMIT_ADMIN_WINDOW_MS,
          max: env.RATE_LIMIT_ADMIN_MAX,
        }),
        contestJoin: Object.freeze({
          windowMs: env.RATE_LIMIT_CONTEST_JOIN_WINDOW_MS,
          max: env.RATE_LIMIT_CONTEST_JOIN_MAX,
        }),
        problems: Object.freeze({
          windowMs: env.RATE_LIMIT_PROBLEMS_WINDOW_MS,
          max: env.RATE_LIMIT_PROBLEMS_MAX,
        }),
        forgotPassword: Object.freeze({
          windowMs: env.RATE_LIMIT_FORGOT_PASSWORD_WINDOW_MS,
          max: env.RATE_LIMIT_FORGOT_PASSWORD_MAX,
        }),
        resendVerification: Object.freeze({
          windowMs: env.RATE_LIMIT_RESEND_VERIFICATION_WINDOW_MS,
          max: env.RATE_LIMIT_RESEND_VERIFICATION_MAX,
        }),
      }),
    }),
  }),

  email: Object.freeze({
    provider: env.EMAIL_PROVIDER,
    from: env.EMAIL_FROM,
    // Prefer FRONTEND_URL; accept deprecated APP_PUBLIC_URL; default matches local Vite.
    frontendUrl: (env.FRONTEND_URL || env.APP_PUBLIC_URL || 'http://localhost:5173').replace(
      /\/$/,
      '',
    ),
    smtp: Object.freeze({
      host: env.SMTP_HOST || null,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE,
      user: env.SMTP_USER || null,
      pass: env.SMTP_PASS || null,
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
    failFast: env.JUDGE_FAIL_FAST,
    // Where the worker writes per-job dirs (must be visible to the Docker daemon).
    workspaceDir: env.JUDGE_WORKSPACE_DIR || null,
    // Path used in sandbox Binds (same as workspaceDir when host↔container paths match).
    workspaceHostDir: env.JUDGE_WORKSPACE_HOST_DIR || env.JUDGE_WORKSPACE_DIR || null,
  }),

  reaper: Object.freeze({
    intervalMs: env.REAPER_INTERVAL_MS,
    stuckThresholdMs: env.REAPER_STUCK_THRESHOLD_MS,
    batchSize: env.REAPER_BATCH_SIZE,
  }),

  storage: Object.freeze({
    bucket: env.STORAGE_BUCKET,
    endpoint: env.STORAGE_ENDPOINT,
    accessKey: env.STORAGE_ACCESS_KEY,
    secretKey: env.STORAGE_SECRET_KEY,
  }),

  logging: Object.freeze({
    level: env.LOG_LEVEL,
    format:
      env.LOG_FORMAT === 'auto'
        ? env.NODE_ENV === 'development'
          ? 'pretty'
          : 'json'
        : env.LOG_FORMAT,
  }),

  featureFlags: resolveFeatureFlags(env),
});

module.exports = { config };
