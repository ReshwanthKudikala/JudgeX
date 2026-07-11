// JWT utilities: issue and verify short-lived access tokens.
// Claims: sub, role, tv (token_version for password-reset revocation).

const jwt = require('jsonwebtoken');

const { config } = require('../../config');
const { AppError } = require('../../shared/errors/base.error');
const { UnauthorizedError } = require('../../shared/errors/http-errors');

const ALGORITHM = 'HS256';

/**
 * @param {{ id: string, role: string, token_version?: number }} user
 * @returns {{ sub: string, role: string, tv: number }}
 */
function buildAccessTokenPayload(user) {
  if (!user || !user.id || !user.role) {
    throw new AppError('Cannot issue a token without user id and role.', {
      statusCode: 500,
      code: 'INTERNAL_ERROR',
    });
  }
  const tv = Number.isFinite(Number(user.token_version))
    ? Number(user.token_version)
    : 0;
  return { sub: user.id, role: user.role, tv };
}

function generateAccessToken(user) {
  const payload = buildAccessTokenPayload(user);
  return jwt.sign(payload, config.jwt.secret, {
    algorithm: ALGORITHM,
    expiresIn: config.jwt.expiresIn,
  });
}

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
    throw new UnauthorizedError('Access token is invalid.');
  }
}

module.exports = { generateAccessToken, verifyAccessToken, buildAccessTokenPayload };
