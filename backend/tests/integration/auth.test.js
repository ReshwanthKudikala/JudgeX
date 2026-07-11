const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

require('./helpers/bootstrap');
const { registerSuiteHooks } = require('./helpers/hooks');
const { api, registerUser, loginUser, unique } = require('./helpers/fixtures');

const { requireInfra } = registerSuiteHooks();

describe('Authentication', () => {
  it('registers a new user and returns user + accessToken', async (t) => {
    if (!requireInfra(t)) return;

    const username = unique('reg');
    const res = await api()
      .post('/api/v1/auth/register')
      .send({ username, email: `${username}@example.com`, password: 'password123' });

    assert.equal(res.status, 201);
    assert.equal(res.body.success, true);
    assert.ok(res.body.data.accessToken);
    assert.equal(res.body.data.user.username, username);
    assert.equal(res.body.data.user.email, `${username}@example.com`);
    assert.equal(res.body.data.user.role, 'user');
    assert.equal(res.body.data.user.email_verified, false);
    assert.equal(res.body.data.user.password_hash, undefined);
  });

  it('logs in with valid credentials', async (t) => {
    if (!requireInfra(t)) return;

    const username = unique('login');
    const email = `${username}@example.com`;
    const password = 'password123';
    await registerUser({ username, email, password });

    const res = await loginUser({ email, password });
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(res.body.data.accessToken);
    assert.equal(res.body.data.user.email, email);
  });

  it('rejects invalid credentials', async (t) => {
    if (!requireInfra(t)) return;

    const username = unique('badcred');
    const email = `${username}@example.com`;
    await registerUser({ username, email, password: 'password123' });

    const res = await loginUser({ email, password: 'wrong-password' });
    assert.equal(res.status, 401);
    assert.equal(res.body.success, false);
    assert.equal(res.body.error.code, 'INVALID_CREDENTIALS');
  });

  it('rejects duplicate email', async (t) => {
    if (!requireInfra(t)) return;

    const email = `${unique('dupmail')}@example.com`;
    await registerUser({ username: unique('a'), email, password: 'password123' });

    const { res } = await registerUser({
      username: unique('b'),
      email,
      password: 'password123',
    });
    assert.equal(res.status, 409);
    assert.equal(res.body.error.code, 'EMAIL_ALREADY_EXISTS');
  });

  it('rejects duplicate username', async (t) => {
    if (!requireInfra(t)) return;

    const username = unique('dupname');
    await registerUser({ username, email: `${username}@example.com`, password: 'password123' });

    const { res } = await registerUser({
      username,
      email: `${unique('other')}@example.com`,
      password: 'password123',
    });
    assert.equal(res.status, 409);
    assert.equal(res.body.error.code, 'USERNAME_ALREADY_EXISTS');
  });
});
