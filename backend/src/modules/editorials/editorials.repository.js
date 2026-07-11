// Data access for problem editorials.

const { BaseRepository } = require('../../infrastructure/database/base.repository');

const COLUMNS = `
  id, problem_id, title, markdown, difficulty, created_by,
  published, created_at, updated_at
`;

class EditorialRepository extends BaseRepository {
  findById(id, client) {
    return this.queryOne(
      `SELECT ${COLUMNS} FROM editorials
        WHERE id = $1 AND COALESCE(is_deleted, false) = false`,
      [id],
      client,
    );
  }

  findByProblemId(problemId, client) {
    return this.queryOne(
      `SELECT ${COLUMNS} FROM editorials
        WHERE problem_id = $1 AND COALESCE(is_deleted, false) = false`,
      [problemId],
      client,
    );
  }

  findPublishedByProblemSlug(slug, client) {
    return this.queryOne(
      `SELECT e.id, e.problem_id, e.title, e.markdown, e.difficulty,
              e.created_by, e.published, e.created_at, e.updated_at,
              p.slug AS problem_slug
         FROM editorials e
         INNER JOIN problems p ON p.id = e.problem_id
        WHERE p.slug = $1
          AND p.is_deleted = false
          AND e.published = true
          AND COALESCE(e.is_deleted, false) = false`,
      [slug],
      client,
    );
  }

  async create(data, client) {
    const id = this.newId();
    return this.queryOne(
      `INSERT INTO editorials (
         id, problem_id, title, markdown, difficulty, created_by, published
       ) VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING ${COLUMNS}`,
      [
        id,
        data.problemId,
        data.title,
        data.markdown,
        data.difficulty || 'medium',
        data.createdBy || null,
        data.published === true,
      ],
      client,
    );
  }

  async update(id, patch, client) {
    const sets = [];
    const params = [];
    let i = 1;

    if (patch.title !== undefined) {
      sets.push(`title = $${i++}`);
      params.push(patch.title);
    }
    if (patch.markdown !== undefined) {
      sets.push(`markdown = $${i++}`);
      params.push(patch.markdown);
    }
    if (patch.difficulty !== undefined) {
      sets.push(`difficulty = $${i++}`);
      params.push(patch.difficulty);
    }
    if (patch.published !== undefined) {
      sets.push(`published = $${i++}`);
      params.push(patch.published === true);
    }

    if (sets.length === 0) {
      return this.findById(id, client);
    }

    sets.push('updated_at = now()');
    params.push(id);

    return this.queryOne(
      `UPDATE editorials SET ${sets.join(', ')} WHERE id = $${i}
       RETURNING ${COLUMNS}`,
      params,
      client,
    );
  }

  async softDelete(id, client) {
    const result = await this.query(
      `UPDATE editorials
          SET is_deleted = true, deleted_at = now(), published = false, updated_at = now()
        WHERE id = $1 AND COALESCE(is_deleted, false) = false
        RETURNING id`,
      [id],
      client,
    );
    return result.rowCount > 0;
  }
}

module.exports = {
  EditorialRepository,
  editorialRepository: new EditorialRepository(),
};
