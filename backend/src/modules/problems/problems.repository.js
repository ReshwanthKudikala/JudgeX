// Data access for problems, examples, test cases, and tags.
//
// Pure data access only: parameterized SQL via BaseRepository helpers, optional
// transaction client on every method. No business logic, validation, DTO
// mapping, or HTTP knowledge (see infrastructure/database/README.md).
//
// Test cases are NOT loaded here yet. Hidden test cases must never be exposed;
// because this repository never joins/selects `test_cases`, no hidden (or
// public) case data can leak. Public example/test-case loading arrives later.

const { BaseRepository } = require('../../infrastructure/database/base.repository');

// Full row for detail reads and inserts (problems carries no sensitive columns).
const DETAIL_COLUMNS = `
  id, slug, title, statement, constraints_text, difficulty,
  time_limit_ms, memory_limit_mb, total_submissions, total_accepted,
  is_published, is_deleted, deleted_at, created_by, created_at, updated_at
`;

// Lightweight projection for catalog listings — omits the heavy TEXT body
// (statement/constraints_text) and soft-delete bookkeeping columns.
const LIST_COLUMNS = `
  id, slug, title, difficulty, time_limit_ms, memory_limit_mb,
  total_submissions, total_accepted, is_published, created_at, updated_at
`;

// Allow-list: public filter field -> real column. Anything not here is ignored,
// so untrusted input can never inject an identifier (see sql-builders safety model).
const FILTER_COLUMNS = Object.freeze({
  difficulty: 'difficulty',
  isPublished: 'is_published',
  createdBy: 'created_by',
});

// Allow-list: public sort field -> real column. Same injection-proof contract.
const SORT_COLUMNS = Object.freeze({
  createdAt: 'created_at',
  difficulty: 'difficulty',
  title: 'title',
  totalSubmissions: 'total_submissions',
  totalAccepted: 'total_accepted',
});

const DEFAULT_SORT = 'created_at DESC';

// Optional insert columns -> the request field that supplies them. Columns left
// undefined fall back to their DB defaults (limits, is_published) or NULL.
const OPTIONAL_INSERT_COLUMNS = Object.freeze({
  constraints_text: 'constraintsText',
  time_limit_ms: 'timeLimitMs',
  memory_limit_mb: 'memoryLimitMb',
  is_published: 'isPublished',
  created_by: 'createdBy',
});

// Mutable columns for updates -> the request field that supplies them. Counters
// (total_*) and authorship (created_by) are intentionally not updatable here.
const UPDATABLE_COLUMNS = Object.freeze({
  slug: 'slug',
  title: 'title',
  statement: 'statement',
  constraints_text: 'constraintsText',
  difficulty: 'difficulty',
  time_limit_ms: 'timeLimitMs',
  memory_limit_mb: 'memoryLimitMb',
  is_published: 'isPublished',
});

class ProblemRepository extends BaseRepository {
  /**
   * Fetch a single active (non-soft-deleted) problem by its unique slug.
   *
   * @param {string} slug
   * @param {import('pg').PoolClient} [client]
   * @returns {Promise<Object|null>} the problems row, or null if none.
   */
  findBySlug(slug, client) {
    return this.queryOne(
      `SELECT ${DETAIL_COLUMNS}
         FROM problems
        WHERE slug = $1
          AND is_deleted = false`,
      [slug],
      client,
    );
  }

  /**
   * Fetch a single active (non-soft-deleted) problem by primary key.
   *
   * @param {string} id - UUID.
   * @param {import('pg').PoolClient} [client]
   * @returns {Promise<Object|null>} the problems row, or null if none.
   */
  findById(id, client) {
    return this.queryOne(
      `SELECT ${DETAIL_COLUMNS}
         FROM problems
        WHERE id = $1
          AND is_deleted = false`,
      [id],
      client,
    );
  }

  /**
   * Paginated, filtered, sorted catalog listing of active problems.
   *
   * Soft-deleted rows are always excluded (a hard rule, not a caller filter).
   * Filtering/sorting/pagination all use the allow-list builders, so untrusted
   * input can only ever appear as a bound parameter, never as SQL text.
   *
   * @param {Object} [filters] - untrusted query input:
   *        { page, limit, sort, difficulty, isPublished, createdBy }.
   * @param {import('pg').PoolClient} [client]
   * @returns {Promise<{ rows: Object[], total: number, page: number, limit: number }>}
   */
  async listProblems(filters = {}, client) {
    const { page, limit, offset } = this.buildPagination(filters);

    const filterFragment = this.buildWhere(filters, FILTER_COLUMNS);
    const conditions = ['is_deleted = false'];
    if (filterFragment.clause) {
      // Strip the leading "WHERE " so it can be AND-ed with the mandatory guard.
      conditions.push(filterFragment.clause.slice('WHERE '.length));
    }
    const whereSql = `WHERE ${conditions.join(' AND ')}`;
    const whereParams = filterFragment.params;

    const orderBySql = this.buildOrderBy(filters.sort, SORT_COLUMNS, { default: DEFAULT_SORT });

    const countRow = await this.queryOne(
      `SELECT COUNT(*)::int AS total
         FROM problems
        ${whereSql}`,
      whereParams,
      client,
    );
    const total = countRow ? countRow.total : 0;

    const limitIdx = whereParams.length + 1;
    const offsetIdx = whereParams.length + 2;
    const rows = await this.queryMany(
      `SELECT ${LIST_COLUMNS}
         FROM problems
        ${whereSql}
        ${orderBySql}
        LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
      [...whereParams, limit, offset],
      client,
    );

    return { rows, total, page, limit };
  }

  /**
   * Insert a new problem row and return it.
   * Required fields must be supplied by the caller; optional fields fall back to
   * their DB defaults (limits, is_published) or NULL (constraints_text, created_by).
   *
   * @param {{
   *   slug: string, title: string, statement: string, difficulty: string,
   *   constraintsText?: string, timeLimitMs?: number, memoryLimitMb?: number,
   *   isPublished?: boolean, createdBy?: string
   * }} data
   * @param {import('pg').PoolClient} [client]
   * @returns {Promise<Object>} the inserted problems row.
   */
  createProblem(data, client) {
    const columns = ['id', 'slug', 'title', 'statement', 'difficulty'];
    const params = [this.newId(), data.slug, data.title, data.statement, data.difficulty];

    for (const [column, field] of Object.entries(OPTIONAL_INSERT_COLUMNS)) {
      if (data[field] !== undefined) {
        columns.push(column);
        params.push(data[field]);
      }
    }

    const placeholders = params.map((_value, i) => `$${i + 1}`).join(', ');

    return this.queryOne(
      `INSERT INTO problems (${columns.join(', ')})
       VALUES (${placeholders})
       RETURNING ${DETAIL_COLUMNS}`,
      params,
      client,
    );
  }

  /**
   * Patch the mutable columns of an active problem and bump updated_at.
   * Only fields present in `data` (mapped via UPDATABLE_COLUMNS) are changed.
   *
   * @param {string} id - UUID.
   * @param {Object} data - camelCase partial of updatable fields.
   * @param {import('pg').PoolClient} [client]
   * @returns {Promise<Object|null>} the updated row, or null if no active
   *          problem with that id exists (not found or already soft-deleted).
   */
  updateProblem(id, data, client) {
    const assignments = [];
    const params = [];
    let index = 1;

    for (const [column, field] of Object.entries(UPDATABLE_COLUMNS)) {
      if (data[field] !== undefined) {
        assignments.push(`${column} = $${index}`);
        params.push(data[field]);
        index += 1;
      }
    }
    assignments.push('updated_at = now()');

    params.push(id);

    return this.queryOne(
      `UPDATE problems
          SET ${assignments.join(', ')}
        WHERE id = $${index}
          AND is_deleted = false
       RETURNING ${DETAIL_COLUMNS}`,
      params,
      client,
    );
  }

  /**
   * Soft-delete an active problem: flag it deleted, stamp deleted_at, and
   * unpublish it. The row is preserved so historical submissions stay valid
   * (the FK is ON DELETE RESTRICT) — never a physical delete.
   *
   * @param {string} id - UUID.
   * @param {import('pg').PoolClient} [client]
   * @returns {Promise<{id: string}|null>} the id when a row was soft-deleted,
   *          or null if none was active (not found or already deleted).
   */
  softDeleteProblem(id, client) {
    return this.queryOne(
      `UPDATE problems
          SET is_deleted = true,
              deleted_at = now(),
              is_published = false,
              updated_at = now()
        WHERE id = $1
          AND is_deleted = false
       RETURNING id`,
      [id],
      client,
    );
  }
}

module.exports = { ProblemRepository, problemRepository: new ProblemRepository() };
