// Declares public leaderboard HTTP endpoints (read-only).
// Mounted under /api/v1/leaderboard by the module registry.
//
// Auth is optional per API_SPEC §5.1 — no authenticate middleware yet.

const { Router } = require('express');

const { validate } = require('../../middlewares/validate');
const controller = require('./leaderboard.controller');
const { listLeaderboardQuerySchema } = require('./leaderboard.validators');

const router = Router();

router.get('/', validate(listLeaderboardQuerySchema, 'query'), controller.getGlobalLeaderboard);
router.get('/users/:userId/rank', controller.getUserRank);

module.exports = { leaderboardRoutes: router };
