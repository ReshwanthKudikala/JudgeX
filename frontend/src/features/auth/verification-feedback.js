/**
 * Verification-link and resend presentation helpers.
 * The token is read once, then removed from the address bar.
 */

export function readAuthToken() {
  if (typeof window === 'undefined') return '';
  const hash = new URLSearchParams(String(window.location.hash || '').replace(/^#/, ''));
  const query = new URLSearchParams(window.location.search || '');
  const token = (hash.get('token') || query.get('token') || '').trim();
  if (token) {
    const path = window.location.pathname || '/';
    window.history.replaceState(window.history.state, '', path);
  }
  return token;
}

/**
 * @param {string | undefined} code
 * @returns {string}
 */
export function verificationFailureCopy(code) {
  switch (code) {
    case 'EXPIRED_VERIFICATION_TOKEN':
      return 'This verification link has expired. Request a new one.';
    case 'USED_VERIFICATION_TOKEN':
      return 'This verification link was already used.';
    case 'INVALID_VERIFICATION_TOKEN':
      return 'This verification link is invalid.';
    case 'NETWORK_ERROR':
      return 'Unable to reach the server. Check your connection and try again.';
    default:
      return '';
  }
}

const pendingVerifications = new Map();

/**
 * Development Strict Mode mounts the verification page twice. Share one
 * in-flight request so the second mount does not consume the token again.
 * The entry is removed when the request finishes, so a later visit can show
 * an already-used result.
 * @template T
 * @param {string} token
 * @param {(token: string) => Promise<T>} verify
 * @returns {Promise<T>}
 */
export function verifyEmailOnce(token, verify) {
  const existing = pendingVerifications.get(token);
  if (existing) return existing;
  const work = Promise.resolve()
    .then(() => verify(token))
    .finally(() => {
      if (pendingVerifications.get(token) === work) {
        pendingVerifications.delete(token);
      }
    });
  pendingVerifications.set(token, work);
  return work;
}

/**
 * @param {string | undefined} outcome
 * @returns {'success' | 'error' | 'neutral'}
 */
export function resendTone(outcome) {
  if (outcome === 'submitted') return 'success';
  if (outcome === 'failed') return 'error';
  return 'neutral';
}

/**
 * Signed-out and expired-session failures should ask the user to sign in.
 * A suspended account keeps its own message.
 * @param {string | undefined} message
 * @returns {string}
 */
export function sessionFailureCopy(message) {
  if (typeof message === 'string' && /suspended/i.test(message)) return message;
  return 'Your session has expired. Please sign in again.';
}

/**
 * Delivery and availability failures can be retried. Cooldown, rate limit,
 * and an ended session cannot.
 * @param {number | undefined} status
 * @param {string | undefined} code
 * @returns {boolean}
 */
export function resendCanRetry(status, code) {
  return (
    code === 'EMAIL_DELIVERY_FAILED' ||
    code === 'EMAIL_NOT_CONFIGURED' ||
    status === 0 ||
    Number(status) >= 500
  );
}

/**
 * Profile resend alert copy. Retry guidance is added once, and only when
 * another attempt can succeed. Rate limits and ended sessions stay unchanged.
 * @param {string | undefined} message
 * @param {number | undefined} status
 * @param {string | undefined} code
 * @returns {string}
 */
export function resendErrorCopy(message, status, code) {
  const text =
    typeof message === 'string' && message.trim()
      ? message.trim()
      : 'Unable to resend verification email.';
  if (!resendCanRetry(status, code) || /you can try again\.?$/i.test(text)) {
    return text;
  }
  return `${text} You can try again.`;
}
