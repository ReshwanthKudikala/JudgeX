// Admin platform data access: aggregates, users, moderation listings.

const { BaseRepository } = require('../../infrastructure/database/base.repository');

class AdminPlatformRepository extends BaseRepository {
  async getOverviewCounts(client) {
    const row = await this.queryOne(
      `SELECT
         (SELECT COUNT(*)::int FROM users WHERE is_deleted = false) AS total_users,
         (SELECT COUNT(*)::int FROM users
           WHERE is_deleted = false
             AND last_login_at >= now() - interval '7 days') AS active_users_7d,
         (SELECT COUNT(*)::int FROM users
           WHERE is_deleted = false
             AND last_login_at >= now() - interval '30 days') AS active_users_30d,
         (SELECT COUNT(*)::int FROM problems WHERE is_deleted = false) AS total_problems,
         (SELECT COUNT(*)::int FROM problems
           WHERE is_deleted = false AND is_published = true) AS published_problems,
         (SELECT COUNT(*)::int FROM editorials
           WHERE COALESCE(is_deleted, false) = false) AS total_editorials,
         (SELECT COUNT(*)::int FROM editorials
           WHERE COALESCE(is_deleted, false) = false AND published = true) AS published_editorials,
         (SELECT COUNT(*)::int FROM discussions WHERE is_deleted = false) AS total_discussions,
         (SELECT COUNT(*)::int FROM contests WHERE is_deleted = false) AS total_contests,
         (SELECT COUNT(*)::int FROM submissions) AS total_submissions,
         (SELECT COUNT(*)::int FROM submissions WHERE verdict = 'accepted') AS accepted_submissions`,
      [],
      client,
    );
    return row;
  }

  async listUsers({ page = 1, limit = 20, username, email, role, status }, client) {
    const { offset } = this.buildPagination({ page, limit });
    const where = ['u.is_deleted = false'];
    const params = [];
    let i = 1;

    if (username) {
      where.push(`u.username ILIKE $${i++}`);
      params.push(`%${username}%`);
    }
    if (email) {
      where.push(`u.email ILIKE $${i++}`);
      params.push(`%${email}%`);
    }
    if (role) {
      where.push(`u.role = $${i++}`);
      params.push(role);
    }
    if (status === 'suspended') {
      where.push('u.is_suspended = true');
    } else if (status === 'active') {
      where.push('u.is_suspended = false');
    }

    const whereSql = where.join(' AND ');
    const countRow = await this.queryOne(
      `SELECT COUNT(*)::int AS total FROM users u WHERE ${whereSql}`,
      params,
      client,
    );

    const rows = await this.queryMany(
      `SELECT u.id, u.username, u.email, u.role, u.is_suspended, u.suspended_at,
              u.last_login_at, u.created_at, u.updated_at,
              COALESCE(s.total_submissions, 0)::int AS submission_count
         FROM users u
         LEFT JOIN user_statistics s ON s.user_id = u.id
        WHERE ${whereSql}
        ORDER BY u.created_at DESC
        LIMIT $${i} OFFSET $${i + 1}`,
      [...params, limit, offset],
      client,
    );

    return {
      rows,
      pagination: this.paginationMeta({
        page,
        limit,
        total: countRow?.total ?? 0,
      }),
    };
  }

  findUserById(id, client) {
    return this.queryOne(
      `SELECT id, username, email, role, is_suspended, suspended_at, suspended_by,
              last_login_at, is_deleted, created_at, updated_at
         FROM users
        WHERE id = $1 AND is_deleted = false`,
      [id],
      client,
    );
  }

  async setSuspended(id, { suspended, suspendedBy }, client) {
    if (suspended) {
      return this.queryOne(
        `UPDATE users
            SET is_suspended = true,
                suspended_at = now(),
                suspended_by = $2,
                updated_at = now()
          WHERE id = $1 AND is_deleted = false
          RETURNING id, username, email, role, is_suspended, suspended_at, last_login_at, created_at`,
        [id, suspendedBy || null],
        client,
      );
    }

    return this.queryOne(
      `UPDATE users
          SET is_suspended = false,
              suspended_at = NULL,
              suspended_by = NULL,
              updated_at = now()
        WHERE id = $1 AND is_deleted = false
        RETURNING id, username, email, role, is_suspended, suspended_at, last_login_at, created_at`,
      [id],
      client,
    );
  }

  async setRole(id, role, client) {
    return this.queryOne(
      `UPDATE users
          SET role = $2, updated_at = now()
        WHERE id = $1 AND is_deleted = false
        RETURNING id, username, email, role, is_suspended, last_login_at, created_at`,
      [id, role],
      client,
    );
  }

  async touchLastLogin(id, client) {
    return this.query(
      `UPDATE users SET last_login_at = now(), updated_at = now()
        WHERE id = $1 AND is_deleted = false`,
      [id],
      client,
    );
  }

  async listModerationProblems({ page = 1, limit = 20, q, status }, client) {
    const { offset } = this.buildPagination({ page, limit });
    const where = ['1=1'];
    const params = [];
    let i = 1;
    if (q) {
      where.push(`(p.title ILIKE $${i} OR p.slug ILIKE $${i})`);
      params.push(`%${q}%`);
      i += 1;
    }
    if (status === 'published') where.push('p.is_published = true AND p.is_deleted = false');
    else if (status === 'unpublished') where.push('p.is_published = false AND p.is_deleted = false');
    else if (status === 'deleted') where.push('p.is_deleted = true');
    else where.push('p.is_deleted = false');

    const whereSql = where.join(' AND ');
    const countRow = await this.queryOne(
      `SELECT COUNT(*)::int AS total FROM problems p WHERE ${whereSql}`,
      params,
      client,
    );
    const rows = await this.queryMany(
      `SELECT p.id, p.slug, p.title, p.difficulty, p.is_published, p.is_deleted,
              p.created_at, p.updated_at, 'problem'::text AS entity_type
         FROM problems p
        WHERE ${whereSql}
        ORDER BY p.updated_at DESC
        LIMIT $${i} OFFSET $${i + 1}`,
      [...params, limit, offset],
      client,
    );
    return {
      rows,
      pagination: this.paginationMeta({ page, limit, total: countRow?.total ?? 0 }),
    };
  }

  async listModerationEditorials({ page = 1, limit = 20, q, status }, client) {
    const { offset } = this.buildPagination({ page, limit });
    const where = ['1=1'];
    const params = [];
    let i = 1;
    if (q) {
      where.push(`(e.title ILIKE $${i} OR p.slug ILIKE $${i})`);
      params.push(`%${q}%`);
      i += 1;
    }
    if (status === 'published') {
      where.push('e.published = true AND COALESCE(e.is_deleted, false) = false');
    } else if (status === 'unpublished') {
      where.push('e.published = false AND COALESCE(e.is_deleted, false) = false');
    } else if (status === 'deleted') {
      where.push('COALESCE(e.is_deleted, false) = true');
    } else {
      where.push('COALESCE(e.is_deleted, false) = false');
    }

    const whereSql = where.join(' AND ');
    const countRow = await this.queryOne(
      `SELECT COUNT(*)::int AS total
         FROM editorials e
         INNER JOIN problems p ON p.id = e.problem_id
        WHERE ${whereSql}`,
      params,
      client,
    );
    const rows = await this.queryMany(
      `SELECT e.id, e.title, e.published, COALESCE(e.is_deleted, false) AS is_deleted,
              e.created_at, e.updated_at, p.slug AS problem_slug, 'editorial'::text AS entity_type
         FROM editorials e
         INNER JOIN problems p ON p.id = e.problem_id
        WHERE ${whereSql}
        ORDER BY e.updated_at DESC
        LIMIT $${i} OFFSET $${i + 1}`,
      [...params, limit, offset],
      client,
    );
    return {
      rows,
      pagination: this.paginationMeta({ page, limit, total: countRow?.total ?? 0 }),
    };
  }

  async listModerationDiscussions({ page = 1, limit = 20, q, status }, client) {
    const { offset } = this.buildPagination({ page, limit });
    const where = ['1=1'];
    const params = [];
    let i = 1;
    if (q) {
      where.push(`(d.title ILIKE $${i} OR d.body ILIKE $${i})`);
      params.push(`%${q}%`);
      i += 1;
    }
    if (status === 'deleted') where.push('d.is_deleted = true');
    else where.push('d.is_deleted = false');

    const whereSql = where.join(' AND ');
    const countRow = await this.queryOne(
      `SELECT COUNT(*)::int AS total FROM discussions d WHERE ${whereSql}`,
      params,
      client,
    );
    const rows = await this.queryMany(
      `SELECT d.id, d.title, d.is_deleted, d.created_at, d.updated_at,
              u.username AS author_username, 'discussion'::text AS entity_type
         FROM discussions d
         INNER JOIN users u ON u.id = d.author_id
        WHERE ${whereSql}
        ORDER BY d.updated_at DESC
        LIMIT $${i} OFFSET $${i + 1}`,
      [...params, limit, offset],
      client,
    );
    return {
      rows,
      pagination: this.paginationMeta({ page, limit, total: countRow?.total ?? 0 }),
    };
  }

  async listModerationComments({ page = 1, limit = 20, q, status }, client) {
    const { offset } = this.buildPagination({ page, limit });
    const where = ['1=1'];
    const params = [];
    let i = 1;
    if (q) {
      where.push(`c.body ILIKE $${i}`);
      params.push(`%${q}%`);
      i += 1;
    }
    if (status === 'deleted') where.push('c.is_deleted = true');
    else where.push('c.is_deleted = false');

    const whereSql = where.join(' AND ');
    const countRow = await this.queryOne(
      `SELECT COUNT(*)::int AS total FROM discussion_comments c WHERE ${whereSql}`,
      params,
      client,
    );
    const rows = await this.queryMany(
      `SELECT c.id, LEFT(c.body, 160) AS body_preview, c.is_deleted, c.created_at,
              c.updated_at, c.discussion_id, u.username AS author_username,
              'comment'::text AS entity_type
         FROM discussion_comments c
         INNER JOIN users u ON u.id = c.author_id
        WHERE ${whereSql}
        ORDER BY c.updated_at DESC
        LIMIT $${i} OFFSET $${i + 1}`,
      [...params, limit, offset],
      client,
    );
    return {
      rows,
      pagination: this.paginationMeta({ page, limit, total: countRow?.total ?? 0 }),
    };
  }

  async bulkProblems(action, ids, client) {
    if (!ids.length) return 0;
    if (action === 'publish') {
      const r = await this.query(
        `UPDATE problems SET is_published = true, updated_at = now()
          WHERE id = ANY($1::uuid[]) AND is_deleted = false`,
        [ids],
        client,
      );
      return r.rowCount;
    }
    if (action === 'unpublish') {
      const r = await this.query(
        `UPDATE problems SET is_published = false, updated_at = now()
          WHERE id = ANY($1::uuid[]) AND is_deleted = false`,
        [ids],
        client,
      );
      return r.rowCount;
    }
    if (action === 'delete') {
      const r = await this.query(
        `UPDATE problems
            SET is_deleted = true, deleted_at = now(), is_published = false, updated_at = now()
          WHERE id = ANY($1::uuid[]) AND is_deleted = false`,
        [ids],
        client,
      );
      return r.rowCount;
    }
    if (action === 'restore') {
      const r = await this.query(
        `UPDATE problems
            SET is_deleted = false, deleted_at = NULL, updated_at = now()
          WHERE id = ANY($1::uuid[]) AND is_deleted = true`,
        [ids],
        client,
      );
      return r.rowCount;
    }
    return 0;
  }

  async bulkEditorials(action, ids, client) {
    if (!ids.length) return 0;
    if (action === 'publish') {
      const r = await this.query(
        `UPDATE editorials SET published = true, updated_at = now()
          WHERE id = ANY($1::uuid[]) AND COALESCE(is_deleted, false) = false`,
        [ids],
        client,
      );
      return r.rowCount;
    }
    if (action === 'unpublish') {
      const r = await this.query(
        `UPDATE editorials SET published = false, updated_at = now()
          WHERE id = ANY($1::uuid[]) AND COALESCE(is_deleted, false) = false`,
        [ids],
        client,
      );
      return r.rowCount;
    }
    if (action === 'delete') {
      const r = await this.query(
        `UPDATE editorials
            SET is_deleted = true, deleted_at = now(), published = false, updated_at = now()
          WHERE id = ANY($1::uuid[]) AND COALESCE(is_deleted, false) = false`,
        [ids],
        client,
      );
      return r.rowCount;
    }
    if (action === 'restore') {
      const r = await this.query(
        `UPDATE editorials
            SET is_deleted = false, deleted_at = NULL, updated_at = now()
          WHERE id = ANY($1::uuid[]) AND is_deleted = true`,
        [ids],
        client,
      );
      return r.rowCount;
    }
    return 0;
  }

  async bulkDiscussions(action, ids, client) {
    if (!ids.length) return 0;
    if (action === 'delete') {
      const r = await this.query(
        `UPDATE discussions
            SET is_deleted = true, deleted_at = now(), updated_at = now()
          WHERE id = ANY($1::uuid[]) AND is_deleted = false`,
        [ids],
        client,
      );
      return r.rowCount;
    }
    if (action === 'restore') {
      const r = await this.query(
        `UPDATE discussions
            SET is_deleted = false, deleted_at = NULL, updated_at = now()
          WHERE id = ANY($1::uuid[]) AND is_deleted = true`,
        [ids],
        client,
      );
      return r.rowCount;
    }
    return 0;
  }

  async bulkComments(action, ids, client) {
    if (!ids.length) return 0;
    if (action === 'delete') {
      const r = await this.query(
        `UPDATE discussion_comments
            SET is_deleted = true, deleted_at = now(), updated_at = now()
          WHERE id = ANY($1::uuid[]) AND is_deleted = false`,
        [ids],
        client,
      );
      return r.rowCount;
    }
    if (action === 'restore') {
      const r = await this.query(
        `UPDATE discussion_comments
            SET is_deleted = false, deleted_at = NULL, updated_at = now()
          WHERE id = ANY($1::uuid[]) AND is_deleted = true`,
        [ids],
        client,
      );
      return r.rowCount;
    }
    return 0;
  }

  async analyticsDailySubmissions(days = 14, client) {
    return this.queryMany(
      `SELECT to_char(day, 'YYYY-MM-DD') AS date,
              submissions::int AS submissions,
              accepted::int AS accepted
         FROM (
           SELECT date_trunc('day', submitted_at) AS day,
                  COUNT(*) AS submissions,
                  COUNT(*) FILTER (WHERE verdict = 'accepted') AS accepted
             FROM submissions
            WHERE submitted_at >= now() - ($1 || ' days')::interval
            GROUP BY 1
            ORDER BY 1 ASC
         ) t`,
      [String(days)],
      client,
    );
  }

  async analyticsMostSolved(limit = 10, client) {
    return this.queryMany(
      `SELECT p.id, p.slug, p.title, p.difficulty,
              COUNT(*) FILTER (WHERE s.verdict = 'accepted')::int AS solved_count
         FROM problems p
         LEFT JOIN submissions s ON s.problem_id = p.id
        WHERE p.is_deleted = false
        GROUP BY p.id
        ORDER BY solved_count DESC, p.title ASC
        LIMIT $1`,
      [limit],
      client,
    );
  }

  async analyticsMostActiveUsers(limit = 10, client) {
    return this.queryMany(
      `SELECT u.id, u.username,
              COALESCE(us.total_submissions, 0)::int AS submission_count,
              COALESCE(us.problems_solved, 0)::int AS problems_solved
         FROM users u
         LEFT JOIN user_statistics us ON us.user_id = u.id
        WHERE u.is_deleted = false
        ORDER BY COALESCE(us.total_submissions, 0) DESC, u.username ASC
        LIMIT $1`,
      [limit],
      client,
    );
  }

  async analyticsLanguageUsage(client) {
    return this.queryMany(
      `SELECT language, COUNT(*)::int AS count
         FROM submissions
        GROUP BY language
        ORDER BY count DESC`,
      [],
      client,
    );
  }

  async analyticsContestParticipation(client) {
    return this.queryMany(
      `SELECT c.id, c.title, c.status,
              COUNT(cp.user_id)::int AS participants
         FROM contests c
         LEFT JOIN contest_participants cp ON cp.contest_id = c.id
        WHERE c.is_deleted = false
        GROUP BY c.id
        ORDER BY participants DESC, c.start_time DESC
        LIMIT 20`,
      [],
      client,
    );
  }
}

module.exports = {
  AdminPlatformRepository,
  adminPlatformRepository: new AdminPlatformRepository(),
};
