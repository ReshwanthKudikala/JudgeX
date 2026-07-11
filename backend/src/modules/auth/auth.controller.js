// Translates auth HTTP requests to AuthService calls and formats responses.
//
// Thin controllers: read already-validated input, call one service method,
// issue a JWT on success, and emit the standard response envelope. No business
// logic, no validation, no DB access. Async errors are forwarded to next().

const { authService } = require('./auth.service');
const { generateAccessToken } = require('./jwt.service');
const { sendSuccess } = require('../../shared/http/response');
const { logSecurityEvent } = require('../../shared/security/security-log');

// POST /auth/register → 201 { user, accessToken }
async function register(req, res, next) {
  try {
    const user = await authService.register(req.body);
    const accessToken = generateAccessToken(user);
    sendSuccess(req, res, 201, { user, accessToken });
  } catch (err) {
    next(err);
  }
}

// POST /auth/login → 200 { user, accessToken }
async function login(req, res, next) {
  try {
    const user = await authService.login(req.body);
    const accessToken = generateAccessToken(user);
    sendSuccess(req, res, 200, { user, accessToken });
  } catch (err) {
    if (err && (err.code === 'INVALID_CREDENTIALS' || err.code === 'ACCOUNT_SUSPENDED')) {
      // Email is not logged — only a stable event + IP/path via the request logger.
      logSecurityEvent(
        'failed_login',
        {
          code: err.code,
          reason: err.code === 'ACCOUNT_SUSPENDED' ? 'suspended' : 'bad_credentials',
        },
        req,
      );
    }
    next(err);
  }
}

// GET /auth/me → 200 { user } (identity attached by the authenticate middleware)
function currentUser(req, res) {
  sendSuccess(req, res, 200, { user: req.user });
}

module.exports = { register, login, currentUser };
