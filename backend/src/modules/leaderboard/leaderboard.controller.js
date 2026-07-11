// Translates leaderboard HTTP requests to LeaderboardService calls.
//
// Thin controllers: read the request, call one service method, emit the
// standard response envelope, and forward errors to next().

const { leaderboardService } = require('./leaderboard.service');
const { sendSuccess } = require('../../shared/http/response');

// GET /leaderboard → 200 [ ...entries ] with meta.pagination
async function getGlobalLeaderboard(req, res, next) {
  try {
    const { entries, pagination } = await leaderboardService.getGlobalLeaderboard(req.query);
    sendSuccess(req, res, 200, entries, { pagination });
  } catch (err) {
    next(err);
  }
}

// GET /leaderboard/users/:userId/rank → 200 { rank, userId, ... }
async function getUserRank(req, res, next) {
  try {
    const entry = await leaderboardService.getUserRank(req.params.userId);
    sendSuccess(req, res, 200, entry);
  } catch (err) {
    next(err);
  }
}

module.exports = { getGlobalLeaderboard, getUserRank };
