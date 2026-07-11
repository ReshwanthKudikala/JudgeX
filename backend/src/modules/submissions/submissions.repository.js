// Data access for submissions and submission_test_results.
//
// Pure data access only: parameterized SQL via BaseRepository helpers, optional
// transaction client on every method. No business logic, judging, queue, or HTTP
// knowledge (see infrastructure/database/README.md). `submissions` is the
// append-only authoritative record; only status/verdict/metric fields are
// written after insert, and this repository only persists them — it never
// decides them.

const { BaseRepository } = require('../../infrastructure/database/base.repository');

// Full row for detail reads and inserts (includes heavy TEXT source_code).
const DETAIL_COLUMNS = `
  id, user_id, problem_id, language, source_code, status, verdict,
  compile_output, runtime_ms, memory_kb, failed_test_index,
  submitted_at, judged_at, created_at, updated_at
`;

// Lightweight projection for user history listings — omits the heavy TEXT
// columns (source_code, compile_output) not needed in a feed.
const LIST_COLUMNS = `
  id, user_id, problem_id, language, status, verdict,
  runtime_ms, memory_kb, failed_test_index, submitted_at, judged_at,
  created_at, updated_at
`;

// Allow-list: public filter field -> real column (injection-proof; see sql-builders).
const FILTER_COLUMNS = Object.freeze({
  problemId: 'problem_id',
  verdict: 'verdict',
  language: 'language',
  status: 'status',
});

// Allow-list: public sort field -> real column.
const SORT_COLUMNS = Object.freeze({
  submittedAt: 'submitted_at',
  runtimeMs: 'runtime_ms',
  memoryKb: 'memory_kb',
});

const DEFAULT_SORT = 'submitted_at DESC';

// Optional result columns -> the field that supplies them (updateSubmissionResult).
const RESULT_METRIC_COLUMNS = Object.freeze({
  compile_output: 'compileOutput',
  runtime_ms: 'runtimeMs',
  memory_kb: 'memoryKb',
  failed_test_index: 'failedTestIndex',
});

class SubmissionRepository extends BaseRepository {
  /**
   * Insert a new submission. Status defaults to 'queued' (DB default); verdict
   * and all metrics stay NULL until a terminal result is written later.
   *
   * @param {{ userId: string, problemId: string, language: string, sourceCode: string }} data
   * @param {import('pg').PoolClient} [client]
   * @returns {Promise<Object>} the inserted submissions row.
   */
  createSubmission({ userId, problemId, language, sourceCode }, client) {
    const id = this.newId();
    return this.queryOne(
      `INSERT INTO submissions (id, user_id, problem_id, language, source_code)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING ${DETAIL_COLUMNS}`,
      [id, userId, problemId, language, sourceCode],
      client,
    );
  }

  /**
   * Fetch a single submission by primary key (submissions are never deleted).
   *
   * @param {string} id - UUID.
   * @param {import('pg').PoolClient} [client]
   * @returns {Promise<Object|null>} the submissions row, or null if none.
   */
  findById(id, client) {
    return this.queryOne(
      `SELECT ${DETAIL_COLUMNS}
         FROM submissions
        WHERE id = $1`,
      [id],
      client,
    );
  }

  /**
   * Paginated, filtered, sorted history of one user's submissions.
   * user_id is always constrained; other filters/sort use the allow-list
   * builders, so untrusted input can only appear as a bound parameter.
   *
   * @param {string} userId - UUID.
   * @param {Object} [filters] - { page, limit, sort, problemId, verdict, language, status }.
   * @param {import('pg').PoolClient} [client]
   * @returns {Promise<{ rows: Object[], total: number, page: number, limit: number }>}
   */
  async findByUser(userId, filters = {}, client) {
    const { page, limit, offset } = this.buildPagination(filters);

    // user_id is $1; allow-listed filters begin at $2.
    const filterFragment = this.buildWhere(filters, FILTER_COLUMNS, { startIndex: 2 });
    const conditions = ['user_id = $1'];
    if (filterFragment.clause) {
      conditions.push(filterFragment.clause.slice('WHERE '.length));
    }
    const whereSql = `WHERE ${conditions.join(' AND ')}`;
    const whereParams = [userId, ...filterFragment.params];

    const orderBySql = this.buildOrderBy(filters.sort, SORT_COLUMNS, { default: DEFAULT_SORT });

    const countRow = await this.queryOne(
      `SELECT COUNT(*)::int AS total
         FROM submissions
        ${whereSql}`,
      whereParams,
      client,
    );
    const total = countRow ? countRow.total : 0;

    const limitIdx = whereParams.length + 1;
    const offsetIdx = whereParams.length + 2;
    const rows = await this.queryMany(
      `SELECT ${LIST_COLUMNS}
         FROM submissions
        ${whereSql}
        ${orderBySql}
        LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
      [...whereParams, limit, offset],
      client,
    );

    return { rows, total, page, limit };
  }

  /**
   * Move a submission to a new lifecycle status (e.g. queued -> running).
   * Persists status only; verdict/metrics are written by updateSubmissionResult.
   *
   * @param {string} id - UUID.
   * @param {string} status - one of queued|running|completed|error.
   * @param {import('pg').PoolClient} [client]
   * @returns {Promise<Object|null>} the updated row, or null if id not found.
   */
  updateSubmissionStatus(id, status, client) {
    return this.queryOne(
      `UPDATE submissions
          SET status = $1,
              updated_at = now()
        WHERE id = $2
       RETURNING ${DETAIL_COLUMNS}`,
      [status, id],
      client,
    );
  }

  /**
   * Write the terminal result of a judged submission: status + verdict + any
   * provided metrics, and stamp judged_at. Supports every MVP verdict —
   * accepted, wrong_answer, tle (Time Limit Exceeded), runtime_error,
   * compile_error (Compilation Error). Metric fields not supplied are left
   * untouched; pass null explicitly to clear one.
   *
   * @param {string} id - UUID.
   * @param {{ status: string, verdict: string, compileOutput?: string|null,
   *           runtimeMs?: number|null, memoryKb?: number|null,
   *           failedTestIndex?: number|null }} result
   * @param {import('pg').PoolClient} [client]
   * @returns {Promise<Object|null>} the updated row, or null if id not found.
   */
  updateSubmissionResult(id, result, client) {
    const assignments = ['status = $1', 'verdict = $2', 'judged_at = now()', 'updated_at = now()'];
    const params = [result.status, result.verdict];
    let index = 3;

    for (const [column, field] of Object.entries(RESULT_METRIC_COLUMNS)) {
      if (result[field] !== undefined) {
        assignments.push(`${column} = $${index}`);
        params.push(result[field]);
        index += 1;
      }
    }

    params.push(id);

    return this.queryOne(
      `UPDATE submissions
          SET ${assignments.join(', ')}
        WHERE id = $${index}
       RETURNING ${DETAIL_COLUMNS}`,
      params,
      client,
    );
  }

  /**
   * Find submissions stuck in `queued` longer than a cutoff (reaper / sweeper).
   * Ordered oldest-first so the longest-waiting work is recovered first.
   *
   * @param {{ olderThan: Date|string, limit?: number }} opts
   * @param {import('pg').PoolClient} [client]
   * @returns {Promise<Object[]>} lightweight rows (id + timestamps).
   */
  findStuckQueued({ olderThan, limit = 100 }, client) {
    const batchLimit = Math.max(1, Math.min(Number(limit) || 100, 1000));
    return this.queryMany(
      `SELECT id, status, submitted_at, created_at, updated_at
         FROM submissions
        WHERE status = 'queued'
          AND submitted_at < $1
        ORDER BY submitted_at ASC
        LIMIT $2`,
      [olderThan, batchLimit],
      client,
    );
  }
}

module.exports = { SubmissionRepository, submissionRepository: new SubmissionRepository() };
