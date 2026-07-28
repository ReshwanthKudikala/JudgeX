// Data access for the authenticated user dashboard (Sprint 38).
// Live aggregates from submissions + problems — no denormalized rollups.

const { BaseRepository } = require('../../infrastructure/database/base.repository');

class DashboardRepository extends BaseRepository {
  /**
   * Summary counters for one user.
   * @param {string} userId
   * @param {import('pg').PoolClient} [client]
   */
  getSummary(userId, client) {
    return this.queryOne(
      `SELECT
         COUNT(*)::int AS total_submissions,
         COUNT(*) FILTER (WHERE s.verdict = 'accepted')::int AS accepted_submissions,
         COUNT(DISTINCT s.problem_id) FILTER (WHERE s.verdict = 'accepted')::int AS solved,
         COUNT(DISTINCT s.problem_id) FILTER (
           WHERE s.verdict = 'accepted' AND p.difficulty = 'easy'
         )::int AS easy_solved,
         COUNT(DISTINCT s.problem_id) FILTER (
           WHERE s.verdict = 'accepted' AND p.difficulty = 'medium'
         )::int AS medium_solved,
         COUNT(DISTINCT s.problem_id) FILTER (
           WHERE s.verdict = 'accepted' AND p.difficulty = 'hard'
         )::int AS hard_solved
       FROM submissions s
       LEFT JOIN problems p ON p.id = s.problem_id
      WHERE s.user_id = $1`,
      [userId],
      client,
    );
  }

  /**
   * Problems solved grouped by difficulty (for charts).
   * @param {string} userId
   * @param {import('pg').PoolClient} [client]
   */
  getDifficultyBreakdown(userId, client) {
    return this.queryMany(
      `SELECT p.difficulty AS difficulty,
              COUNT(DISTINCT s.problem_id)::int AS count
         FROM submissions s
         INNER JOIN problems p ON p.id = s.problem_id
        WHERE s.user_id = $1
          AND s.verdict = 'accepted'
        GROUP BY p.difficulty
        ORDER BY p.difficulty`,
      [userId],
      client,
    );
  }

  /**
   * Accepted vs non-accepted submission counts (for charts).
   * @param {string} userId
   * @param {import('pg').PoolClient} [client]
   */
  getVerdictBreakdown(userId, client) {
    return this.queryOne(
      `SELECT
         COUNT(*) FILTER (WHERE verdict = 'accepted')::int AS accepted,
         COUNT(*) FILTER (
           WHERE verdict IS NOT NULL AND verdict <> 'accepted'
         )::int AS failed
       FROM submissions
      WHERE user_id = $1`,
      [userId],
      client,
    );
  }

  /**
   * Latest N submissions with problem summary fields.
   * @param {string} userId
   * @param {{ limit?: number }} [opts]
   * @param {import('pg').PoolClient} [client]
   */
  getRecentSubmissions(userId, { limit = 10 } = {}, client) {
    const batchLimit = Math.max(1, Math.min(Number(limit) || 10, 50));
    return this.queryMany(
      `SELECT
         s.id, s.user_id, s.problem_id, s.language, s.status, s.verdict,
         s.runtime_ms, s.memory_kb, s.failed_test_index, s.passed_tests, s.total_tests,
         s.submitted_at, s.judged_at, s.created_at, s.updated_at,
         p.slug AS problem_slug, p.title AS problem_title, p.difficulty AS problem_difficulty
       FROM submissions s
       INNER JOIN problems p ON p.id = s.problem_id
      WHERE s.user_id = $1
      ORDER BY s.submitted_at DESC
      LIMIT $2`,
      [userId, batchLimit],
      client,
    );
  }
}

module.exports = {
  DashboardRepository,
  dashboardRepository: new DashboardRepository(),
};
