// Verifies the JWT on protected requests and attaches the identity to context.
//
// Authentication ONLY — it proves who the caller is and that the account still
// exists. It performs NO authorization / role checks (that is `authorize`).
// This is the one place Express-specific code is allowed for auth.

const { verifyAccessToken } = require('../modules/auth/jwt.service');
const { userRepository } = require('../modules/auth/auth.repository');
const { UnauthorizedError } = require('../shared/errors/http-errors');

const BEARER_PREFIX = 'Bearer ';

/**
 * Express middleware: authenticate the request via a Bearer access token.
 * On success attaches the current DB user to `req.user` and the raw token
 * claims to `req.auth`, then calls next(). On failure forwards an
 * UnauthorizedError/TOKEN_EXPIRED to the global error handler.
 */
async function authenticate(req, _res, next) {
  try {
    const header = req.headers.authorization;
    if (!header || !header.startsWith(BEARER_PREFIX)) {
      throw new UnauthorizedError('A Bearer access token is required.');
    }

    const token = header.slice(BEARER_PREFIX.length).trim();
    if (!token) {
      throw new UnauthorizedError('A Bearer access token is required.');
    }

    // Verify signature + expiry (throws TOKEN_EXPIRED / UNAUTHENTICATED).
    const claims = verifyAccessToken(token);

    // Never trust the token alone: confirm the user still exists and is active.
    // findById already filters out soft-deleted users (returns null).
    const user = await userRepository.findById(claims.sub);
    if (!user) {
      throw new UnauthorizedError('User account no longer exists.');
    }

    req.user = user;
    req.auth = claims;
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = { authenticate };
