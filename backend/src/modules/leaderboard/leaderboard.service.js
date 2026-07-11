// Leaderboard HTTP orchestration — delegates calculations to StatisticsService.
//
// Read-only public rankings. No ranking math lives here or in controllers.

const { statisticsService } = require('../statistics/statistics.service');

class LeaderboardService {
  constructor({ statisticsService: statsSvc } = {}) {
    this.statisticsService = statsSvc || statisticsService;
  }

  /**
   * Paginated global leaderboard (API_SPEC §5.1 + Sprint 27 timeframes).
   *
   * @param {Object} [filters] - { page, limit, timeframe }.
   */
  getGlobalLeaderboard(filters = {}) {
    return this.statisticsService.getLeaderboard(filters);
  }

  /**
   * A single user's rank and stats.
   *
   * @param {string} userId - UUID.
   * @param {{ timeframe?: string }} [opts]
   */
  getUserRank(userId, opts = {}) {
    return this.statisticsService.getUserRank(userId, opts);
  }
}

module.exports = { LeaderboardService, leaderboardService: new LeaderboardService() };
