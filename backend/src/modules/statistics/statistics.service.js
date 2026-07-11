// Centralized ranking / leaderboard calculations (Sprint 27).
//
// Controllers must NOT compute ranks — they call LeaderboardService, which
// delegates here. Persistence/SQL lives in StatisticsRepository (single
// aggregate query; no N+1).

const { NotFoundError } = require('../../shared/errors/http-errors');
const { statisticsRepository } = require('./statistics.repository');
const { TIMEFRAMES, computeScore } = require('./statistics.constants');
const {
  getCachedLeaderboard,
  setCachedLeaderboard,
  getCachedUserRank,
  setCachedUserRank,
} = require('../leaderboard/leaderboard.cache');

function toNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Map a ranked stats row into the public leaderboard entry shape.
 * Keeps legacy `problemsSolved` while adding Sprint 27 field names.
 */
function toLeaderboardEntry(row) {
  const solved = toNumber(row.problems_solved);
  const accepted = toNumber(row.total_accepted);
  const submissions = toNumber(row.total_submissions);
  const acceptanceRate = toNumber(row.acceptance_rate);
  const score = computeScore(solved, acceptanceRate);

  return {
    rank: row.rank,
    userId: row.user_id,
    username: row.username,
    avatar: null,
    solved,
    problemsSolved: solved,
    accepted,
    submissions,
    acceptanceRate,
    score,
    lastSolvedAt: row.last_solved_at,
  };
}

class StatisticsService {
  constructor({ statisticsRepository: repo } = {}) {
    this.statisticsRepository = repo || statisticsRepository;
  }

  /**
   * Paginated ranked leaderboard for a timeframe.
   *
   * @param {Object} [filters] - { page, limit, timeframe }.
   */
  async getLeaderboard(filters = {}) {
    const timeframe = TIMEFRAMES.includes(filters.timeframe) ? filters.timeframe : 'all';
    const cacheFilters = {
      timeframe,
      page: filters.page,
      limit: filters.limit,
    };

    const cached = await getCachedLeaderboard(cacheFilters);
    if (cached) return cached;

    const { rows, total, page, limit } = await this.statisticsRepository.getLeaderboard({
      ...filters,
      timeframe,
    });

    const payload = {
      entries: rows.map(toLeaderboardEntry),
      pagination: {
        page,
        limit,
        total,
        totalPages: limit > 0 ? Math.ceil(total / limit) : 0,
      },
      timeframe,
    };
    await setCachedLeaderboard(cacheFilters, payload);
    return payload;
  }

  /**
   * A single user's rank within a timeframe.
   *
   * @param {string} userId
   * @param {{ timeframe?: string }} [opts]
   */
  async getUserRank(userId, opts = {}) {
    const timeframe = TIMEFRAMES.includes(opts.timeframe) ? opts.timeframe : 'all';
    const cached = await getCachedUserRank(userId, timeframe);
    if (cached) return cached;

    const row = await this.statisticsRepository.getUserRank(userId, { timeframe });
    if (!row) {
      throw new NotFoundError('User rank not found.');
    }
    const entry = toLeaderboardEntry(row);
    await setCachedUserRank(userId, timeframe, entry);
    return entry;
  }
}

module.exports = {
  StatisticsService,
  statisticsService: new StatisticsService(),
  toLeaderboardEntry,
  TIMEFRAMES,
};
