// Data access for user_statistics aggregates and global leaderboard reads.
//
// Pure data access only: parameterized SQL via BaseRepository helpers, optional
// transaction client on every method. Read-only — no writes, no caching, no
// business logic. Ranking order matches DATABASE_DESIGN.md §3.9
// idx_user_stats_ranking: problems_solved DESC, acceptance_rate DESC,
// last_solved_at ASC (with users.created_at ASC as a final stable tie-break).

const { BaseRepository } = require('../../infrastructure/database/base.repository');

// Fixed global ranking ORDER BY (trusted text — never from user input).
const RANKING_ORDER =
  'us.problems_solved DESC, us.acceptance_rate DESC, us.last_solved_at ASC NULLS LAST, u.created_at ASC';

// Columns returned for each leaderboard row (joined to users for display name).
const LEADERBOARD_COLUMNS = `
  us.user_id,
  u.username,
  us.problems_solved,
  us.acceptance_rate,
  us.last_solved_at
`;

class LeaderboardRepository extends BaseRepository {
  /**
   * Paginated global leaderboard from user_statistics + users.
   * Rank is computed with ROW_NUMBER() over the canonical ordering so each row
   * carries its true global position (not page-relative).
   *
   * @param {Object} [filters] - { page, limit }.
   * @param {import('pg').PoolClient} [client]
   * @returns {Promise<{ rows: Object[], total: number, page: number, limit: number }>}
   */
  async getGlobalLeaderboard(filters = {}, client) {
    const { page, limit, offset } = this.buildPagination(filters);

    const countRow = await this.queryOne(
      `SELECT COUNT(*)::int AS total
         FROM user_statistics us
         INNER JOIN users u ON u.id = us.user_id
        WHERE u.is_deleted = false`,
      [],
      client,
    );
    const total = countRow ? countRow.total : 0;

    const rows = await this.queryMany(
      `WITH ranked AS (
         SELECT ROW_NUMBER() OVER (ORDER BY ${RANKING_ORDER})::int AS rank,
                ${LEADERBOARD_COLUMNS}
           FROM user_statistics us
           INNER JOIN users u ON u.id = us.user_id
          WHERE u.is_deleted = false
       )
       SELECT rank, user_id, username, problems_solved, acceptance_rate, last_solved_at
         FROM ranked
        ORDER BY rank
        LIMIT $1 OFFSET $2`,
      [limit, offset],
      client,
    );

    return { rows, total, page, limit };
  }

  /**
   * Resolve one user's global rank and stats using the same ordering as the
   * paginated leaderboard.
   *
   * @param {string} userId - UUID.
   * @param {import('pg').PoolClient} [client]
   * @returns {Promise<Object|null>} ranked row, or null if user/stats not found.
   */
  async getUserRank(userId, client) {
    return this.queryOne(
      `WITH ranked AS (
         SELECT ROW_NUMBER() OVER (ORDER BY ${RANKING_ORDER})::int AS rank,
                ${LEADERBOARD_COLUMNS}
           FROM user_statistics us
           INNER JOIN users u ON u.id = us.user_id
          WHERE u.is_deleted = false
       )
       SELECT rank, user_id, username, problems_solved, acceptance_rate, last_solved_at
         FROM ranked
        WHERE user_id = $1`,
      [userId],
      client,
    );
  }
}

module.exports = { LeaderboardRepository, leaderboardRepository: new LeaderboardRepository() };
