// Translates auth HTTP requests to AuthService calls and formats responses.

const { authService } = require('./auth.service');
const { generateAccessToken } = require('./jwt.service');
const { sendSuccess } = require('../../shared/http/response');
const { logSecurityEvent } = require('../../shared/security/security-log');

async function register(req, res, next) {
  try {
    const user = await authService.register(req.body);
    const accessToken = generateAccessToken(user);
    sendSuccess(req, res, 201, { user, accessToken });
  } catch (err) {
    next(err);
  }
}

async function login(req, res, next) {
  try {
    const user = await authService.login(req.body);
    const accessToken = generateAccessToken(user);
    sendSuccess(req, res, 200, { user, accessToken });
  } catch (err) {
    if (err && (err.code === 'INVALID_CREDENTIALS' || err.code === 'ACCOUNT_SUSPENDED')) {
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

function currentUser(req, res) {
  sendSuccess(req, res, 200, { user: req.user });
}

async function verifyEmail(req, res, next) {
  try {
    const result = await authService.verifyEmail(req.query.token);
    sendSuccess(req, res, 200, result);
  } catch (err) {
    next(err);
  }
}

async function resendVerification(req, res, next) {
  try {
    const result = await authService.resendVerification({
      email: req.body?.email,
      userId: req.user?.id,
    });
    sendSuccess(req, res, 200, result);
  } catch (err) {
    next(err);
  }
}

async function forgotPassword(req, res, next) {
  try {
    const result = await authService.forgotPassword(req.body);
    sendSuccess(req, res, 200, result);
  } catch (err) {
    next(err);
  }
}

async function resetPassword(req, res, next) {
  try {
    const result = await authService.resetPassword(req.body);
    sendSuccess(req, res, 200, result);
  } catch (err) {
    next(err);
  }
}

async function changePassword(req, res, next) {
  try {
    const result = await authService.changePassword({
      userId: req.user.id,
      currentPassword: req.body.currentPassword,
      newPassword: req.body.newPassword,
    });
    // Issue a fresh token so the current session stays valid after token_version bump.
    const accessToken = generateAccessToken(result.user);
    sendSuccess(req, res, 200, { ...result, accessToken });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  register,
  login,
  currentUser,
  verifyEmail,
  resendVerification,
  forgotPassword,
  resetPassword,
  changePassword,
};
