// Environment variable schema + validation (fail-fast). Only config/ reads env.

const { z } = require('zod');

// Coerce helpers keep string env values typed while allowing sane defaults so
// the app can boot for local development even without a populated .env.
const booleanish = z
  .enum(['true', 'false', '1', '0'])
  .transform((v) => v === 'true' || v === '1');

const envSchema = z
  .object({
    // --- Server ---
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(4000),
    // Comma-separated list of allowed CORS origins.
    CORS_ORIGIN: z.string().default('http://localhost:5173'),

    // --- PostgreSQL ---
    DATABASE_URL: z
      .string()
      .default('postgres://judgex:judgex@localhost:5432/judgex'),
    DB_POOL_MAX: z.coerce.number().int().positive().default(10),
    DB_CONNECTION_TIMEOUT_MS: z.coerce.number().int().positive().default(5000),
    DB_IDLE_TIMEOUT_MS: z.coerce.number().int().nonnegative().default(30000),
    // When true, the app aborts startup if PostgreSQL cannot be reached.
    DB_REQUIRED: booleanish.default('true'),

    // --- Redis ---
    REDIS_URL: z.string().default('redis://localhost:6379'),
    // When true, the app aborts startup if Redis cannot be reached.
    REDIS_REQUIRED: booleanish.default('true'),

    // --- Infrastructure startup retry policy ---
    INFRA_STARTUP_RETRIES: z.coerce.number().int().nonnegative().default(5),
    INFRA_STARTUP_RETRY_DELAY_MS: z.coerce.number().int().positive().default(1000),

    // --- JWT ---
    JWT_SECRET: z.string().min(1).default('dev-insecure-secret-change-me'),
    JWT_EXPIRES_IN: z.string().default('15m'),

    // --- Password hashing ---
    BCRYPT_SALT_ROUNDS: z.coerce.number().int().min(4).max(15).default(12),

    // --- Rate limiting ---
    RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60000),
    RATE_LIMIT_MAX: z.coerce.number().int().positive().default(100),

    // --- AI provider (default is free local Ollama) ---
    AI_PROVIDER: z.enum(['ollama', 'openai']).default('ollama'),
    OLLAMA_BASE_URL: z.string().default('http://localhost:11434'),
    OLLAMA_MODEL: z.string().default('llama3'),
    OPENAI_API_KEY: z.string().optional(),
    OPENAI_MODEL: z.string().default('gpt-4o-mini'),

    // --- Docker sandbox limits ---
    JUDGE_TIME_LIMIT_MS: z.coerce.number().int().positive().default(2000),
    JUDGE_MEMORY_LIMIT_MB: z.coerce.number().int().positive().default(256),
    JUDGE_PID_LIMIT: z.coerce.number().int().positive().default(64),
    JUDGE_WORKER_CONCURRENCY: z.coerce.number().int().positive().default(2),
    // When true, stop after the first non-accepted test case (default).
    JUDGE_FAIL_FAST: booleanish.default('true'),

    // --- Object storage (optional in dev) ---
    STORAGE_BUCKET: z.string().optional(),
    STORAGE_ENDPOINT: z.string().optional(),
    STORAGE_ACCESS_KEY: z.string().optional(),
    STORAGE_SECRET_KEY: z.string().optional(),

    // --- Logging ---
    LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),

    // --- Feature flags ---
    FEATURE_AI_COMPILE_EXPLANATION: booleanish.default('true'),

    // --- Stuck-submission reaper (persist-before-enqueue safety net) ---
    // How often the cleanup worker scans for orphaned queued rows.
    REAPER_INTERVAL_MS: z.coerce.number().int().positive().default(60000),
    // A queued submission older than this is eligible for re-enqueue.
    REAPER_STUCK_THRESHOLD_MS: z.coerce.number().int().positive().default(60000),
    // Max rows processed per sweep (bounded work per tick).
    REAPER_BATCH_SIZE: z.coerce.number().int().positive().default(100),
  })
  .superRefine((env, ctx) => {
    // OpenAI key is required ONLY when OpenAI is the selected provider.
    if (env.AI_PROVIDER === 'openai' && !env.OPENAI_API_KEY) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['OPENAI_API_KEY'],
        message: 'OPENAI_API_KEY is required when AI_PROVIDER=openai',
      });
    }
    // Never allow the insecure default secret in production.
    if (
      env.NODE_ENV === 'production' &&
      (env.JWT_SECRET === 'dev-insecure-secret-change-me' ||
        env.JWT_SECRET.length < 32)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['JWT_SECRET'],
        message:
          'JWT_SECRET must be set to a strong value (>=32 chars) in production',
      });
    }
    if (env.NODE_ENV === 'production' && env.DB_REQUIRED === false) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['DB_REQUIRED'],
        message: 'DB_REQUIRED must be true in production',
      });
    }
    if (env.NODE_ENV === 'production' && env.REDIS_REQUIRED === false) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['REDIS_REQUIRED'],
        message: 'REDIS_REQUIRED must be true in production',
      });
    }
  });

module.exports = { envSchema };
