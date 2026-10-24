/**
 * Zod 4 booleanish defaults must yield real booleans when env vars are omitted.
 * `.default()` short-circuits past the transform; `.prefault()` keeps the old
 * Zod 3 semantics used by JudgeX env flags.
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const { envSchema } = require('../../../src/config/env.schema');

const BOOLEAN_FLAGS = Object.freeze([
  { key: 'ALLOW_LOCALHOST_CORS_IN_PRODUCTION', omitted: false },
  { key: 'DB_REQUIRED', omitted: true },
  { key: 'REDIS_REQUIRED', omitted: true },
  { key: 'RATE_LIMIT_ENABLED', omitted: true },
  { key: 'RATE_LIMIT_FORCE_IN_TEST', omitted: false },
  { key: 'SMTP_SECURE', omitted: false },
  { key: 'JUDGE_FAIL_FAST', omitted: true },
  { key: 'FEATURE_AI_COMPILE_EXPLANATION', omitted: true },
  { key: 'FEATURE_AI_ADVANCED', omitted: true },
]);

function baseEnv(overrides = {}) {
  return {
    NODE_ENV: 'development',
    JWT_SECRET: 'test-booleanish-secret-change-me-32chars',
    ...overrides,
  };
}

describe('booleanish env defaults (Zod 4)', () => {
  it('omitted flags resolve to boolean defaults, not strings', () => {
    const parsed = envSchema.safeParse(baseEnv());
    assert.equal(parsed.success, true);
    for (const { key, omitted } of BOOLEAN_FLAGS) {
      const value = parsed.data[key];
      assert.equal(typeof value, 'boolean', `${key} should be boolean, got ${typeof value}`);
      assert.equal(value, omitted, `${key} omitted default mismatch`);
      assert.notEqual(value, 'true');
      assert.notEqual(value, 'false');
    }
  });

  it('accepts explicit true/false/1/0 string inputs as booleans', () => {
    const cases = [
      { RATE_LIMIT_ENABLED: 'true', expected: true },
      { RATE_LIMIT_ENABLED: 'false', expected: false },
      { RATE_LIMIT_ENABLED: '1', expected: true },
      { RATE_LIMIT_ENABLED: '0', expected: false },
      { FEATURE_AI_ADVANCED: 'true', expected: true },
      { FEATURE_AI_ADVANCED: 'false', expected: false },
      { ALLOW_LOCALHOST_CORS_IN_PRODUCTION: '1', expected: true },
      { ALLOW_LOCALHOST_CORS_IN_PRODUCTION: '0', expected: false },
      { SMTP_SECURE: 'true', expected: true },
      { SMTP_SECURE: 'false', expected: false },
    ];

    for (const { expected, ...override } of cases) {
      const [key] = Object.keys(override);
      const parsed = envSchema.safeParse(baseEnv(override));
      assert.equal(parsed.success, true, `${key}=${override[key]} should parse`);
      assert.equal(typeof parsed.data[key], 'boolean');
      assert.equal(parsed.data[key], expected);
    }
  });

  it('rejects invalid booleanish values', () => {
    for (const value of ['yes', 'no', 'TRUE', 'False', '2', '']) {
      const parsed = envSchema.safeParse(baseEnv({ RATE_LIMIT_ENABLED: value }));
      assert.equal(parsed.success, false, `RATE_LIMIT_ENABLED=${JSON.stringify(value)} should fail`);
      assert.ok(
        parsed.error.issues.some((issue) => issue.path.includes('RATE_LIMIT_ENABLED')),
      );
    }
  });

  it('keeps production strict checks working with boolean false', () => {
    const parsed = envSchema.safeParse(
      baseEnv({
        NODE_ENV: 'production',
        JWT_SECRET: 'x'.repeat(32),
        CORS_ORIGIN: 'https://judgex.example',
        RATE_LIMIT_ENABLED: 'false',
        DB_REQUIRED: 'true',
        REDIS_REQUIRED: 'true',
      }),
    );
    assert.equal(parsed.success, false);
    assert.ok(
      parsed.error.issues.some(
        (issue) =>
          issue.path.includes('RATE_LIMIT_ENABLED') &&
          /must be true in production/i.test(issue.message),
      ),
    );
  });
});
