// Data access for contests, contest_problems, and contest_participants.

const { BaseRepository } = require('../../infrastructure/database/base.repository');

const CONTEST_COLUMNS = `
  id, title, description, start_time, end_time, duration_minutes,
  visibility, status, is_deleted, deleted_at, created_by, created_at, updated_at
`;

class ContestRepository extends BaseRepository {
  createContest(data, client) {
    const id = this.newId();
    return this.queryOne(
      `INSERT INTO contests (
         id, title, description, start_time, end_time, duration_minutes,
         visibility, status, created_by
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING ${CONTEST_COLUMNS}`,
      [
        id,
        data.title,
        data.description ?? null,
        data.startTime,
        data.endTime,
        data.durationMinutes,
        data.visibility ?? 'public',
        data.status ?? 'upcoming',
        data.createdBy ?? null,
      ],
      client,
    );
  }

  findById(id, client) {
    return this.queryOne(
      `SELECT ${CONTEST_COLUMNS}
         FROM contests
        WHERE id = $1
          AND is_deleted = false`,
      [id],
      client,
    );
  }

  /** Admin detail — includes soft-deleted for GET before delete confirmation. */
  findByIdAdmin(id, client) {
    return this.queryOne(
      `SELECT ${CONTEST_COLUMNS}
         FROM contests
        WHERE id = $1`,
      [id],
      client,
    );
  }

  updateContest(id, patch, client) {
    const mapping = {
      title: 'title',
      description: 'description',
      startTime: 'start_time',
      endTime: 'end_time',
      durationMinutes: 'duration_minutes',
      visibility: 'visibility',
      status: 'status',
    };
    const assignments = [];
    const params = [];
    let index = 1;

    for (const [field, column] of Object.entries(mapping)) {
      if (patch[field] !== undefined) {
        assignments.push(`${column} = $${index}`);
        params.push(patch[field]);
        index += 1;
      }
    }

    if (assignments.length === 0) {
      return this.findById(id, client);
    }

    assignments.push('updated_at = now()');
    params.push(id);

    return this.queryOne(
      `UPDATE contests
          SET ${assignments.join(', ')}
        WHERE id = $${index}
          AND is_deleted = false
       RETURNING ${CONTEST_COLUMNS}`,
      params,
      client,
    );
  }

  softDelete(id, client) {
    return this.queryOne(
      `UPDATE contests
          SET is_deleted = true,
              deleted_at = now(),
              updated_at = now()
        WHERE id = $1
          AND is_deleted = false
       RETURNING ${CONTEST_COLUMNS}`,
      [id],
      client,
    );
  }

  /**
   * Paginated public contest list with aggregate counts.
   * @param {Object} filters - { page, limit, status?, visibility? }
   */
  async listContests(filters = {}, client) {
    const { page, limit, offset } = this.buildPagination(filters);
    const conditions = ['c.is_deleted = false'];
    const params = [];
    let idx = 1;

    if (filters.visibility) {
      conditions.push(`c.visibility = $${idx}`);
      params.push(filters.visibility);
      idx += 1;
    } else {
      conditions.push(`c.visibility = 'public'`);
    }

    // Status filter uses derived wall-clock status.
    if (filters.status === 'upcoming') {
      conditions.push(`now() < c.start_time`);
    } else if (filters.status === 'running') {
      conditions.push(`now() >= c.start_time AND now() < c.end_time`);
    } else if (filters.status === 'ended') {
      conditions.push(`now() >= c.end_time`);
    }

    const whereSql = `WHERE ${conditions.join(' AND ')}`;

    const countRow = await this.queryOne(
      `SELECT COUNT(*)::int AS total
         FROM contests c
        ${whereSql}`,
      params,
      client,
    );
    const total = countRow ? countRow.total : 0;

    const limitIdx = params.length + 1;
    const offsetIdx = params.length + 2;
    const rows = await this.queryMany(
      `SELECT c.*,
              (SELECT COUNT(*)::int FROM contest_participants cp WHERE cp.contest_id = c.id) AS participant_count,
              (SELECT COUNT(*)::int FROM contest_problems cpr WHERE cpr.contest_id = c.id) AS problem_count
         FROM contests c
        ${whereSql}
        ORDER BY c.start_time DESC, c.created_at DESC
        LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
      [...params, limit, offset],
      client,
    );

    return { rows, total, page, limit };
  }

  replaceContestProblems(contestId, problems = [], client) {
    return this.query(`DELETE FROM contest_problems WHERE contest_id = $1`, [contestId], client).then(
      async () => {
        if (!problems.length) return [];
        const params = [];
        const values = problems.map((p, i) => {
          const base = i * 4;
          params.push(contestId, p.problemId, p.displayOrder ?? i, p.points ?? 100);
          return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4})`;
        });
        return this.queryMany(
          `INSERT INTO contest_problems (contest_id, problem_id, display_order, points)
           VALUES ${values.join(', ')}
           RETURNING contest_id, problem_id, display_order, points, created_at`,
          params,
          client,
        );
      },
    );
  }

  listContestProblems(contestId, client) {
    return this.queryMany(
      `SELECT cp.contest_id, cp.problem_id, cp.display_order, cp.points,
              p.title, p.slug, p.difficulty
         FROM contest_problems cp
         INNER JOIN problems p ON p.id = cp.problem_id
        WHERE cp.contest_id = $1
          AND p.is_deleted = false
        ORDER BY cp.display_order ASC, p.title ASC`,
      [contestId],
      client,
    );
  }

  addParticipant(contestId, userId, client) {
    return this.queryOne(
      `INSERT INTO contest_participants (contest_id, user_id)
       VALUES ($1, $2)
       ON CONFLICT (contest_id, user_id) DO UPDATE SET joined_at = contest_participants.joined_at
       RETURNING contest_id, user_id, joined_at`,
      [contestId, userId],
      client,
    );
  }

  findParticipant(contestId, userId, client) {
    return this.queryOne(
      `SELECT contest_id, user_id, joined_at
         FROM contest_participants
        WHERE contest_id = $1
          AND user_id = $2`,
      [contestId, userId],
      client,
    );
  }

  countParticipants(contestId, client) {
    return this.queryOne(
      `SELECT COUNT(*)::int AS total
         FROM contest_participants
        WHERE contest_id = $1`,
      [contestId],
      client,
    ).then((row) => (row ? row.total : 0));
  }

  /**
   * ICPC-style scoreboard: one efficient aggregation (no N+1).
   * Solved = distinct problems with accepted verdict during the window.
   * Penalty = sum over solved problems of (minutes_to_AC + 20 * wrong_before_AC).
   */
  async getScoreboard(contestId, { page, limit, offset }, client) {
    const countRow = await this.queryOne(
      `SELECT COUNT(*)::int AS total
         FROM contest_participants
        WHERE contest_id = $1`,
      [contestId],
      client,
    );
    const total = countRow ? countRow.total : 0;

    const rows = await this.queryMany(
      `WITH contest AS (
         SELECT id, start_time, end_time
           FROM contests
          WHERE id = $1
            AND is_deleted = false
       ),
       problems AS (
         SELECT problem_id
           FROM contest_problems
          WHERE contest_id = $1
       ),
       participants AS (
         SELECT cp.user_id, cp.joined_at, u.username
           FROM contest_participants cp
           INNER JOIN users u ON u.id = cp.user_id
          WHERE cp.contest_id = $1
            AND u.is_deleted = false
       ),
       attempts AS (
         SELECT
           s.user_id,
           s.problem_id,
           s.verdict,
           s.submitted_at,
           EXTRACT(EPOCH FROM (s.submitted_at - c.start_time)) / 60.0 AS minutes_from_start
         FROM submissions s
         CROSS JOIN contest c
         INNER JOIN problems p ON p.problem_id = s.problem_id
         INNER JOIN participants part ON part.user_id = s.user_id
        WHERE (s.contest_id = $1 OR s.contest_id IS NULL)
          AND s.submitted_at >= c.start_time
          AND s.submitted_at <= c.end_time
          AND s.status IN ('completed', 'error')
       ),
       first_ac AS (
         SELECT user_id, problem_id,
                MIN(submitted_at) AS ac_at,
                MIN(minutes_from_start) AS ac_minutes
           FROM attempts
          WHERE verdict = 'accepted'
          GROUP BY user_id, problem_id
       ),
       wrongs AS (
         SELECT a.user_id, a.problem_id, COUNT(*)::int AS wrong_count
           FROM attempts a
           INNER JOIN first_ac f
             ON f.user_id = a.user_id
            AND f.problem_id = a.problem_id
          WHERE a.verdict IS DISTINCT FROM 'accepted'
            AND a.submitted_at < f.ac_at
          GROUP BY a.user_id, a.problem_id
       ),
       per_user AS (
         SELECT
           part.user_id,
           part.username,
           COUNT(f.problem_id)::int AS solved,
           COALESCE(
             SUM(
               CEIL(f.ac_minutes)::int + COALESCE(w.wrong_count, 0) * 20
             ),
             0
           )::int AS penalty,
           MAX(f.ac_at) AS finish_time
         FROM participants part
         LEFT JOIN first_ac f ON f.user_id = part.user_id
         LEFT JOIN wrongs w
           ON w.user_id = f.user_id
          AND w.problem_id = f.problem_id
         GROUP BY part.user_id, part.username
       ),
       ranked AS (
         SELECT
           ROW_NUMBER() OVER (
             ORDER BY solved DESC, penalty ASC, finish_time ASC NULLS LAST, username ASC
           )::int AS rank,
           user_id,
           username,
           solved,
           penalty,
           finish_time
         FROM per_user
       )
       SELECT rank, user_id, username, solved, penalty, finish_time
         FROM ranked
        ORDER BY rank ASC
        LIMIT $2 OFFSET $3`,
      [contestId, limit, offset],
      client,
    );

    return { rows, total, page, limit };
  }
}

module.exports = { ContestRepository, contestRepository: new ContestRepository() };
