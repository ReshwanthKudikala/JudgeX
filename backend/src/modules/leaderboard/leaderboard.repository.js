// Legacy repository kept for reference / direct user_statistics reads.
// Sprint 27 rankings are computed via modules/statistics (submissions aggregates).
// Prefer StatisticsRepository for all new ranking work.

const {
  StatisticsRepository,
  statisticsRepository,
} = require('../statistics/statistics.repository');

module.exports = {
  LeaderboardRepository: StatisticsRepository,
  leaderboardRepository: statisticsRepository,
};
