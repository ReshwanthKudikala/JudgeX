// Public contest routes. Mounted under /api/v1/contests.
// Auth is optional for list/detail/problems/scoreboard; join requires auth.

const { Router } = require('express');

const { validate } = require('../../middlewares/validate');
const { authenticate } = require('../../middlewares/authenticate');
const { contestJoinRateLimit } = require('../../middlewares/rate-limit');
const controller = require('./contests.controller');
const {
  listContestsQuerySchema,
  scoreboardQuerySchema,
  contestIdParamsSchema,
} = require('./contests.validators');

/** Attach req.user when a Bearer token is present; otherwise continue anonymously. */
async function optionalAuthenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return next();
  }
  return authenticate(req, res, next);
}

const router = Router();

router.get('/', optionalAuthenticate, validate(listContestsQuerySchema, 'query'), controller.listContests);
router.get(
  '/:id',
  optionalAuthenticate,
  validate(contestIdParamsSchema, 'params'),
  controller.getContest,
);
router.post(
  '/:id/join',
  authenticate,
  contestJoinRateLimit,
  validate(contestIdParamsSchema, 'params'),
  controller.joinContest,
);
router.get(
  '/:id/problems',
  optionalAuthenticate,
  validate(contestIdParamsSchema, 'params'),
  controller.getContestProblems,
);
router.get(
  '/:id/scoreboard',
  optionalAuthenticate,
  validate(contestIdParamsSchema, 'params'),
  validate(scoreboardQuerySchema, 'query'),
  controller.getScoreboard,
);

module.exports = { contestRoutes: router };
