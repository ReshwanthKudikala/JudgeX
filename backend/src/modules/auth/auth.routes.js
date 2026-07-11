// Declares authentication HTTP endpoints and attaches middleware.
// Mounted under /api/v1/auth by the module registry.

const { Router } = require('express');

const { validate } = require('../../middlewares/validate');
const { authenticate } = require('../../middlewares/authenticate');
const {
  authRateLimit,
  forgotPasswordRateLimit,
  resendVerificationRateLimit,
} = require('../../middlewares/rate-limit');
const {
  registerSchema,
  loginSchema,
  emailOnlySchema,
  verifyEmailQuerySchema,
  resetPasswordSchema,
  changePasswordSchema,
} = require('./auth.validators');
const controller = require('./auth.controller');

const router = Router();

router.post('/register', authRateLimit, validate(registerSchema), controller.register);
router.post('/login', authRateLimit, validate(loginSchema), controller.login);
router.get('/me', authenticate, controller.currentUser);

router.get(
  '/verify-email',
  authRateLimit,
  validate(verifyEmailQuerySchema, 'query'),
  controller.verifyEmail,
);
router.post(
  '/resend-verification',
  resendVerificationRateLimit,
  validate(emailOnlySchema),
  controller.resendVerification,
);
router.post(
  '/resend-verification/me',
  resendVerificationRateLimit,
  authenticate,
  controller.resendVerification,
);

router.post(
  '/forgot-password',
  forgotPasswordRateLimit,
  validate(emailOnlySchema),
  controller.forgotPassword,
);
router.post(
  '/reset-password',
  authRateLimit,
  validate(resetPasswordSchema),
  controller.resetPassword,
);
router.post(
  '/change-password',
  authRateLimit,
  authenticate,
  validate(changePasswordSchema),
  controller.changePassword,
);

module.exports = { authRoutes: router };
