// Leaderboard business logic: global rankings and per-user rank lookup.
//
// Read-only: no caching, no contest/weekly/rating logic. Persistence is
// delegated to LeaderboardRepository; this layer maps rows to domain objects
// and computes pagination meta.

const { NotFoundError } = require('../../shared/errors/http-errors');
const { leaderboardRepository } = require('./leaderboard.repository');

function toNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function toLeaderboardEntry(row) {
  return {
    rank: row.rank,
    userId: row.user_id,
    username: row.username,
    problemsSolved: row.problems_solved,
    acceptanceRate: toNumber(row.acceptance_rate),
    lastSolvedAt: row.last_solved_at,
  };
}

class LeaderboardService {
  constructor({ leaderboardRepository: repo } = {}) {
    this.leaderboardRepository = repo || leaderboardRepository;
  }

  /**
   * Paginated global leaderboard (DATABASE_DESIGN.md §3.9 / API_SPEC §5.1).
   *
   * @param {Object} [filters] - { page, limit }.
   * @returns {Promise<{ entries: Object[], pagination: { page, limit, total, totalPages } }>}
   */
  async getGlobalLeaderboard(filters = {}) {
    const { rows, total, page, limit } = await this.leaderboardRepository.getGlobalLeaderboard(filters);
    return {
      entries: rows.map(toLeaderboardEntry),
      pagination: {
        page,
        limit,
        total,
        totalPages: limit > 0 ? Math.ceil(total / limit) : 0,
      },
    };
  }

  /**
   * A single user's global rank and stats.
   *
   * @param {string} userId - UUID.
   * @returns {Promise<Object>} the user's leaderboard entry (includes rank).
   * @throws {NotFoundError} when the user has no stats row or is not ranked.
   */
  async getUserRank(userId) {
    const row = await this.leaderboardRepository.getUserRank(userId);
    if (!row) {
      throw new NotFoundError('User rank not found.');
    }
    return toLeaderboardEntry(row);
  }
}

module.exports = { LeaderboardService, leaderboardService: new LeaderboardService() };
