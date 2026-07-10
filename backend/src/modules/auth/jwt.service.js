// JWT utilities: issue and verify short-lived access tokens.
//
// Framework-agnostic: no Express req/res, no cookies, no middleware, no routes.
// Secret and expiration come from the config module; errors use the existing
// application error hierarchy. Only minimal claims are embedded (sub, role).

const jwt = require('jsonwebtoken');

const { config } = require('../../config');
const { AppError } = require('../../shared/errors/base.error');
const { UnauthorizedError } = require('../../shared/errors/http-errors');

// Pin the algorithm on both sign and verify to prevent algorithm-confusion
// attacks (e.g. a forged token claiming "alg": "none").
const ALGORITHM = 'HS256';

/**
 * Build the minimal custom claims for an access token.
 * Only non-sensitive authorization data — never email/username/PII/hashes.
 *
 * @param {{ id: string, role: string }} user
 * @returns {{ sub: string, role: string }}
 */
function buildAccessTokenPayload(user) {
  if (!user || !user.id || !user.role) {
    throw new AppError('Cannot issue a token without user id and role.', {
      statusCode: 500,
      code: 'INTERNAL_ERROR',
    });
  }
  // `sub` is the standard subject claim (the user id); `iat`/`exp` are added by
  // jsonwebtoken from `expiresIn`.
  return { sub: user.id, role: user.role };
}

/**
 * Issue a signed access token for a user.
 *
 * @param {{ id: string, role: string }} user
 * @returns {string} the signed JWT.
 */
function generateAccessToken(user) {
  const payload = buildAccessTokenPayload(user);
  return jwt.sign(payload, config.jwt.secret, {
    algorithm: ALGORITHM,
    expiresIn: config.jwt.expiresIn,
  });
}

/**
 * Verify and decode an access token.
 *
 * @param {string} token - the raw JWT (no "Bearer " prefix).
 * @returns {{ sub: string, role: string, iat: number, exp: number }} decoded claims.
 * @throws {AppError} TOKEN_EXPIRED (401) if expired; UNAUTHENTICATED (401) otherwise.
 */
function verifyAccessToken(token) {
  if (!token || typeof token !== 'string') {
    throw new UnauthorizedError('Access token is missing.');
  }

  try {
    return jwt.verify(token, config.jwt.secret, { algorithms: [ALGORITHM] });
  } catch (err) {
    if (err && err.name === 'TokenExpiredError') {
      throw new AppError('Access token has expired.', {
        statusCode: 401,
        code: 'TOKEN_EXPIRED',
      });
    }
    // JsonWebTokenError, NotBeforeError, malformed tokens, bad signature, etc.
    throw new UnauthorizedError('Access token is invalid.');
  }
}

module.exports = { generateAccessToken, verifyAccessToken, buildAccessTokenPayload };
