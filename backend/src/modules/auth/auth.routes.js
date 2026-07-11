// Declares authentication HTTP endpoints and attaches middleware.
// Mounted under /api/v1/auth by the module registry.

const { Router } = require('express');

const { validate } = require('../../middlewares/validate');
const { authenticate } = require('../../middlewares/authenticate');
const { authRateLimit } = require('../../middlewares/rate-limit');
const { registerSchema, loginSchema } = require('./auth.validators');
const controller = require('./auth.controller');

const router = Router();

router.post('/register', authRateLimit, validate(registerSchema), controller.register);
router.post('/login', authRateLimit, validate(loginSchema), controller.login);
router.get('/me', authenticate, controller.currentUser);

module.exports = { authRoutes: router };
