/**
 * Learning Coach routes — mounted under /api/v1/ai
 */

const { Router } = require('express');

const { validate } = require('../../middlewares/validate');
const { authenticate } = require('../../middlewares/authenticate');
const { aiRateLimit } = require('../../middlewares/rate-limit');
const { coachRequestSchema } = require('./coach.validators');
const controller = require('./coach.controller');

const router = Router();

router.post(
  '/coach',
  authenticate,
  aiRateLimit,
  validate(coachRequestSchema),
  controller.coach,
);

module.exports = { coachRoutes: router };
