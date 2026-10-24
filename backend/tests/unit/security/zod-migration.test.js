/**
 * Zod 4 security migration checks.
 * Confirms the patched release, preserved validation messages, UUID v7 IDs,
 * and bounded array rejection used by the request validators.
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { z } = require('zod');
const { v7: uuidv7 } = require('uuid');

const { validate } = require('../../../src/middlewares/validate');
const { registerSchema, loginSchema } = require('../../../src/modules/auth/auth.validators');
const { coachRequestSchema } = require('../../../src/modules/ai/coach.validators');

describe('Zod 4 migration', () => {
  it('uses a patched Zod release for GHSA-mrhx-c7xc-m3w5', () => {
    const version = require('zod/package.json').version;
    const [major, minor, patch] = version.split('.').map(Number);
    assert.ok(
      major > 4 || (major === 4 && (minor > 6 || (minor === 6 && patch >= 6))),
      `expected zod >= 4.6.6, got ${version}`,
    );
  });

  it('keeps auth validation messages and accepts UUID v7 ids', async () => {
    const badEmail = loginSchema.safeParse({ email: 'not-an-email', password: 'x' });
    assert.equal(badEmail.success, false);
    assert.equal(badEmail.error.issues[0].message, 'A valid email is required.');

    const shortPassword = registerSchema.safeParse({
      username: 'valid_user',
      email: 'user@example.com',
      password: 'short',
    });
    assert.equal(shortPassword.success, false);
    assert.equal(
      shortPassword.error.issues[0].message,
      'Password must be at least 8 characters.',
    );

    const id = uuidv7();
    assert.equal(z.string().uuid().safeParse(id).success, true);
  });

  it('maps Zod issues through the validate middleware without changing the contract', async () => {
    const middleware = validate(loginSchema);
    const req = { body: { email: 'bad', password: '' } };
    const error = await new Promise((resolve, reject) => {
      middleware(req, {}, (err) => (err ? resolve(err) : reject(new Error('expected validation error'))));
    });
    assert.equal(error.code, 'VALIDATION_ERROR');
    assert.equal(error.statusCode, 400);
    assert.ok(Array.isArray(error.details));
    assert.ok(error.details.some((d) => d.path === 'email' && d.message === 'A valid email is required.'));
    assert.ok(error.details.every((d) => typeof d.path === 'string' && typeof d.message === 'string'));
  });

  it('rejects oversized arrays at the coach history bound', () => {
    const history = Array.from({ length: 7 }, (_, i) => ({
      role: i % 2 === 0 ? 'user' : 'assistant',
      content: `message-${i}`,
    }));
    const result = coachRequestSchema.safeParse({
      problemId: uuidv7(),
      language: 'python',
      action: 'HINT',
      code: 'print(1)',
      history,
    });
    assert.equal(result.success, false);
    assert.ok(result.error.issues.some((issue) => issue.path.includes('history')));
  });
});
