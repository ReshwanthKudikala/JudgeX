// Data access for discussions, comments, and reports.

const { BaseRepository } = require('../../infrastructure/database/base.repository');

const DISCUSSION_COLUMNS = `
  d.id, d.problem_id, d.author_id, d.title, d.body, d.tags,
  d.like_count, d.comment_count, d.is_deleted, d.deleted_at,
  d.created_at, d.updated_at,
  u.username AS author_username,
  p.slug AS problem_slug
`;

const COMMENT_COLUMNS = `
  c.id, c.discussion_id, c.author_id, c.body, c.parent_comment_id,
  c.is_deleted, c.deleted_at, c.created_at, c.updated_at,
  u.username AS author_username
`;

class DiscussionRepository extends BaseRepository {
  findDiscussionById(id, { includeDeleted = false } = {}, client) {
    const deletedClause = includeDeleted ? '' : 'AND d.is_deleted = false';
    return this.queryOne(
      `SELECT ${DISCUSSION_COLUMNS}
         FROM discussions d
         INNER JOIN users u ON u.id = d.author_id
         INNER JOIN problems p ON p.id = d.problem_id AND p.is_deleted = false
        WHERE d.id = $1
          ${deletedClause}`,
      [id],
      client,
    );
  }

  async listByProblem({
    problemId,
    page = 1,
    limit = 20,
    q,
    tag,
    sort = 'newest',
  }, client) {
    const { offset } = this.buildPagination({ page, limit });
    const where = ['d.problem_id = $1', 'd.is_deleted = false'];
    const params = [problemId];
    let i = 2;

    if (q) {
      where.push(`(d.title ILIKE $${i} OR d.body ILIKE $${i})`);
      params.push(`%${q}%`);
      i += 1;
    }
    if (tag) {
      where.push(`$${i} = ANY(d.tags)`);
      params.push(tag.toLowerCase());
      i += 1;
    }

    let orderBy = 'd.created_at DESC';
    if (sort === 'most_active') orderBy = 'd.comment_count DESC, d.updated_at DESC';
    if (sort === 'most_liked') orderBy = 'd.like_count DESC, d.created_at DESC';

    const whereSql = where.join(' AND ');

    const countRow = await this.queryOne(
      `SELECT COUNT(*)::int AS total
         FROM discussions d
        WHERE ${whereSql}`,
      params,
      client,
    );

    const rows = await this.queryMany(
      `SELECT ${DISCUSSION_COLUMNS}
         FROM discussions d
         INNER JOIN users u ON u.id = d.author_id
         INNER JOIN problems p ON p.id = d.problem_id AND p.is_deleted = false
        WHERE ${whereSql}
        ORDER BY ${orderBy}
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

  async createDiscussion(data, client) {
    const id = this.newId();
    return this.queryOne(
      `INSERT INTO discussions (
         id, problem_id, author_id, title, body, tags
       ) VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [
        id,
        data.problemId,
        data.authorId,
        data.title,
        data.body,
        data.tags || [],
      ],
      client,
    ).then(async () => this.findDiscussionById(id, {}, client));
  }

  async updateDiscussion(id, patch, client) {
    const sets = [];
    const params = [];
    let i = 1;

    if (patch.title !== undefined) {
      sets.push(`title = $${i++}`);
      params.push(patch.title);
    }
    if (patch.body !== undefined) {
      sets.push(`body = $${i++}`);
      params.push(patch.body);
    }
    if (patch.tags !== undefined) {
      sets.push(`tags = $${i++}`);
      params.push(patch.tags);
    }

    if (sets.length === 0) {
      return this.findDiscussionById(id, {}, client);
    }

    sets.push('updated_at = now()');
    params.push(id);

    await this.query(
      `UPDATE discussions SET ${sets.join(', ')}
        WHERE id = $${i} AND is_deleted = false`,
      params,
      client,
    );
    return this.findDiscussionById(id, {}, client);
  }

  async softDeleteDiscussion(id, client) {
    const row = await this.queryOne(
      `UPDATE discussions
          SET is_deleted = true, deleted_at = now(), updated_at = now()
        WHERE id = $1 AND is_deleted = false
        RETURNING id`,
      [id],
      client,
    );
    return Boolean(row);
  }

  listCommentsByDiscussion(discussionId, client) {
    return this.queryMany(
      `SELECT ${COMMENT_COLUMNS}
         FROM discussion_comments c
         INNER JOIN users u ON u.id = c.author_id
        WHERE c.discussion_id = $1
        ORDER BY c.created_at ASC`,
      [discussionId],
      client,
    );
  }

  findCommentById(id, { includeDeleted = false } = {}, client) {
    const deletedClause = includeDeleted ? '' : 'AND c.is_deleted = false';
    return this.queryOne(
      `SELECT ${COMMENT_COLUMNS}
         FROM discussion_comments c
         INNER JOIN users u ON u.id = c.author_id
        WHERE c.id = $1
          ${deletedClause}`,
      [id],
      client,
    );
  }

  async createComment(data, client) {
    const id = this.newId();
    await this.query(
      `INSERT INTO discussion_comments (
         id, discussion_id, author_id, body, parent_comment_id
       ) VALUES ($1, $2, $3, $4, $5)`,
      [
        id,
        data.discussionId,
        data.authorId,
        data.body,
        data.parentCommentId || null,
      ],
      client,
    );

    await this.query(
      `UPDATE discussions
          SET comment_count = comment_count + 1,
              updated_at = now()
        WHERE id = $1 AND is_deleted = false`,
      [data.discussionId],
      client,
    );

    return this.findCommentById(id, {}, client);
  }

  async updateComment(id, body, client) {
    await this.query(
      `UPDATE discussion_comments
          SET body = $2, updated_at = now()
        WHERE id = $1 AND is_deleted = false`,
      [id, body],
      client,
    );
    return this.findCommentById(id, {}, client);
  }

  async softDeleteComment(id, discussionId, client) {
    const row = await this.queryOne(
      `UPDATE discussion_comments
          SET is_deleted = true, deleted_at = now(), updated_at = now()
        WHERE id = $1 AND is_deleted = false
        RETURNING id`,
      [id],
      client,
    );
    if (!row) return false;

    await this.query(
      `UPDATE discussions
          SET comment_count = GREATEST(comment_count - 1, 0),
              updated_at = now()
        WHERE id = $1 AND is_deleted = false`,
      [discussionId],
      client,
    );
    return true;
  }

  async createReport(data, client) {
    const id = this.newId();
    return this.queryOne(
      `INSERT INTO discussion_reports (
         id, reporter_id, target_type, target_id, reason
       ) VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (reporter_id, target_type, target_id)
       DO UPDATE SET reason = EXCLUDED.reason, status = 'open', created_at = now()
       RETURNING id, reporter_id, target_type, target_id, reason, status, created_at`,
      [id, data.reporterId, data.targetType, data.targetId, data.reason],
      client,
    );
  }
}

module.exports = {
  DiscussionRepository,
  discussionRepository: new DiscussionRepository(),
};
