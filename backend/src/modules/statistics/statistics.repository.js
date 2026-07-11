// Efficient SQL aggregates for leaderboard rankings (Sprint 27).
//
// Pure data access: one CTE aggregates submissions per user (no N+1), then
// ROW_NUMBER() assigns global ranks. Timeframe is applied as a bound on
// submissions.submitted_at. Soft-deleted users are excluded.

const { BaseRepository } = require('../../infrastructure/database/base.repository');
const { timeframeInterval } = require('./statistics.constants');

// Ranking keys (trusted SQL — never from user input):
// 1. problems solved DESC
// 2. acceptance rate DESC
// 3. total accepted DESC
// 4. earliest last-accepted timestamp ASC (achievement tie-break)
// 5. account age ASC (stable)
const RANKING_ORDER = `
  problems_solved DESC,
  acceptance_rate DESC,
  total_accepted DESC,
  last_solved_at ASC NULLS LAST,
  user_created_at ASC
`;

class StatisticsRepository extends BaseRepository {
  /**
   * Build the shared stats + ranked CTEs for a timeframe.
   * @param {'all'|'monthly'|'weekly'} timeframe
   * @returns {{ sql: string, params: unknown[] }}
   */
  #rankedCte(timeframe) {
    const interval = timeframeInterval(timeframe);
    const params = [];
    let timePredicate = '';

    if (interval) {
      params.push(interval);
      timePredicate = `AND s.submitted_at >= (now() - $1::interval)`;
    }

    const sql = `
      WITH stats AS (
        SELECT
          u.id AS user_id,
          u.username,
          u.created_at AS user_created_at,
          COUNT(DISTINCT s.problem_id) FILTER (WHERE s.verdict = 'accepted')::int AS problems_solved,
          COUNT(*) FILTER (WHERE s.verdict = 'accepted')::int AS total_accepted,
          COUNT(*)::int AS total_submissions,
          CASE
            WHEN COUNT(*) > 0 THEN
              ROUND(
                (COUNT(*) FILTER (WHERE s.verdict = 'accepted')::numeric
                  / COUNT(*)::numeric) * 100,
                2
              )
            ELSE 0
          END AS acceptance_rate,
          MAX(s.submitted_at) FILTER (WHERE s.verdict = 'accepted') AS last_solved_at
        FROM users u
        INNER JOIN submissions s ON s.user_id = u.id
        WHERE u.is_deleted = false
          ${timePredicate}
        GROUP BY u.id, u.username, u.created_at
      ),
      ranked AS (
        SELECT
          ROW_NUMBER() OVER (ORDER BY ${RANKING_ORDER})::int AS rank,
          user_id,
          username,
          problems_solved,
          total_accepted,
          total_submissions,
          acceptance_rate,
          last_solved_at
        FROM stats
      )
    `;

    return { sql, params };
  }

  /**
   * Paginated leaderboard for a timeframe.
   *
   * @param {Object} [filters] - { page, limit, timeframe }.
   * @param {import('pg').PoolClient} [client]
   */
  async getLeaderboard(filters = {}, client) {
    const { page, limit, offset } = this.buildPagination(filters);
    const timeframe = filters.timeframe || 'all';
    const { sql: cte, params: cteParams } = this.#rankedCte(timeframe);

    const countRow = await this.queryOne(
      `${cte}
       SELECT COUNT(*)::int AS total FROM ranked`,
      cteParams,
      client,
    );
    const total = countRow ? countRow.total : 0;

    const limitIdx = cteParams.length + 1;
    const offsetIdx = cteParams.length + 2;
    const rows = await this.queryMany(
      `${cte}
       SELECT rank, user_id, username, problems_solved, total_accepted,
              total_submissions, acceptance_rate, last_solved_at
         FROM ranked
        ORDER BY rank ASC
        LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
      [...cteParams, limit, offset],
      client,
    );

    return { rows, total, page, limit, timeframe };
  }

  /**
   * One user's rank within a timeframe.
   *
   * @param {string} userId
   * @param {{ timeframe?: string }} [opts]
   * @param {import('pg').PoolClient} [client]
   */
  async getUserRank(userId, { timeframe = 'all' } = {}, client) {
    const { sql: cte, params: cteParams } = this.#rankedCte(timeframe);
    const userIdx = cteParams.length + 1;
    return this.queryOne(
      `${cte}
       SELECT rank, user_id, username, problems_solved, total_accepted,
              total_submissions, acceptance_rate, last_solved_at
         FROM ranked
        WHERE user_id = $${userIdx}`,
      [...cteParams, userId],
      client,
    );
  }
}

module.exports = {
  StatisticsRepository,
  statisticsRepository: new StatisticsRepository(),
};
