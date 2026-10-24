const path = require('path');
const { pathToFileURL } = require('url');
const { describe, it, afterEach } = require('node:test');
const assert = require('node:assert/strict');

const repoRoot = path.resolve(__dirname, '../../../..');

function loadFrontend(relativePath) {
  return import(pathToFileURL(path.join(repoRoot, relativePath)).href);
}

describe('verification feedback', () => {
  afterEach(() => {
    delete global.window;
  });

  it('reads a hash token, then a query token, and strips both from the address', async () => {
    const { readAuthToken, verificationFailureCopy, resendTone } = await loadFrontend(
      'frontend/src/features/auth/verification-feedback.js',
    );
    const location = {
      hash: '#token=from-hash',
      search: '?token=from-query',
      pathname: '/verify-email',
    };
    global.window = {
      location,
      history: {
        state: { kept: true },
        replaceState(state, _title, nextPath) {
          assert.deepEqual(state, { kept: true });
          location.hash = '';
          location.search = '';
          location.pathname = nextPath;
        },
      },
    };

    assert.equal(readAuthToken(), 'from-hash');
    assert.equal(location.hash, '');
    assert.equal(location.pathname, '/verify-email');

    location.search = '?token=from-query';
    assert.equal(readAuthToken(), 'from-query');
    assert.equal(location.search, '');

    assert.equal(readAuthToken(), '');
    assert.equal(verificationFailureCopy('EXPIRED_VERIFICATION_TOKEN').includes('expired'), true);
    assert.equal(verificationFailureCopy('USED_VERIFICATION_TOKEN').includes('already used'), true);
    assert.equal(verificationFailureCopy('INVALID_VERIFICATION_TOKEN').includes('invalid'), true);
    assert.equal(verificationFailureCopy('NETWORK_ERROR').includes('connection'), true);
    assert.equal(verificationFailureCopy(''), '');
    assert.equal(resendTone('submitted'), 'success');
    assert.equal(resendTone('logged'), 'neutral');
    assert.equal(resendTone('recent'), 'neutral');
    assert.equal(resendTone('failed'), 'error');

    const { verifyEmailOnce } = await loadFrontend(
      'frontend/src/features/auth/verification-feedback.js',
    );
    let calls = 0;
    const verify = async (value) => {
      calls += 1;
      await new Promise((resolve) => setTimeout(resolve, 20));
      return { value };
    };
    const [first, second] = await Promise.all([
      verifyEmailOnce('same-token', verify),
      verifyEmailOnce('same-token', verify),
    ]);
    assert.equal(calls, 1);
    assert.equal(first.value, 'same-token');
    assert.equal(second.value, 'same-token');
    await verifyEmailOnce('same-token', verify);
    assert.equal(calls, 2);
  });
});
