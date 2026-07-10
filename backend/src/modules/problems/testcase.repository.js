// Data access for test_cases (DATABASE_DESIGN.md §3.6).
//
// Pure data access only: parameterized SQL via BaseRepository helpers, optional
// transaction client on every method. No business logic, HTTP, judging, or
// payload resolution. Hybrid storage per §3.6: metadata (linkage, hidden flag,
// size, checksum, is_inline) always lives in Postgres; the actual payload is
// either inline text or an object-storage key held in *_ref. This repository
// returns those refs + is_inline and leaves payload fetching to a future storage
// resolver — it never dereferences external storage itself.
//
// Visibility contract: hidden expected outputs are returned ONLY by
// getTestCasesForJudge(). getPublicExamples() is hard-filtered to non-hidden
// rows (samples whose I/O is intentionally visible to users).

const { BaseRepository } = require('../../infrastructure/database/base.repository');

// Full row incl. both refs — judge-only (public + hidden grading data).
const JUDGE_COLUMNS = `
  id, problem_id, is_hidden, input_ref, expected_output_ref,
  is_inline, size_bytes, checksum, display_order, created_at
`;

// Public sample projection: non-hidden rows only; their expected output is a
// visible sample, so both refs are safe to expose here.
const PUBLIC_COLUMNS = `
  id, problem_id, input_ref, expected_output_ref, is_inline, display_order
`;

// Write-return projection: metadata only — never echoes input/expected refs.
const METADATA_COLUMNS = `
  id, problem_id, is_hidden, is_inline, size_bytes, checksum, display_order, created_at
`;

// Fixed column order for (bulk) inserts.
const INSERT_COLUMNS = [
  'id',
  'problem_id',
  'is_hidden',
  'input_ref',
  'expected_output_ref',
  'is_inline',
  'size_bytes',
  'checksum',
  'display_order',
];

// Normalize a caller-supplied case into the fixed INSERT_COLUMNS value order,
// applying DB-equivalent defaults so every row binds the same number of params.
function toInsertValues(repo, problemId, testCase, index) {
  return [
    repo.newId(),
    problemId,
    testCase.isHidden ?? true,
    testCase.inputRef,
    testCase.expectedOutputRef,
    testCase.isInline ?? true,
    testCase.sizeBytes ?? 0,
    testCase.checksum ?? null,
    testCase.displayOrder ?? index,
  ];
}

class TestCaseRepository extends BaseRepository {
  /**
   * Insert a single test case. Returns metadata only (no refs echoed back).
   *
   * @param {{ problemId:string, inputRef:string, expectedOutputRef:string,
   *   isHidden?:boolean, isInline?:boolean, sizeBytes?:number, checksum?:string,
   *   displayOrder?:number }} data
   * @param {import('pg').PoolClient} [client]
   * @returns {Promise<Object>} the inserted row (metadata columns).
   */
  createTestCase(data, client) {
    const values = toInsertValues(this, data.problemId, data, 0);
    const placeholders = values.map((_v, i) => `$${i + 1}`).join(', ');
    return this.queryOne(
      `INSERT INTO test_cases (${INSERT_COLUMNS.join(', ')})
       VALUES (${placeholders})
       RETURNING ${METADATA_COLUMNS}`,
      values,
      client,
    );
  }

  /**
   * Bulk-insert test cases for a problem in one statement, preserving order
   * (explicit displayOrder, else array index). Returns metadata rows.
   *
   * @param {string} problemId
   * @param {Array<Object>} testCases - same shape as createTestCase data.
   * @param {import('pg').PoolClient} [client]
   * @returns {Promise<Object[]>} inserted rows (metadata columns), or [] if none.
   */
  createManyTestCases(problemId, testCases = [], client) {
    if (!Array.isArray(testCases) || testCases.length === 0) {
      return Promise.resolve([]);
    }

    const params = [];
    const rowsSql = testCases.map((testCase, rowIndex) => {
      const values = toInsertValues(this, problemId, testCase, rowIndex);
      const base = rowIndex * INSERT_COLUMNS.length;
      const placeholders = values.map((_v, i) => `$${base + i + 1}`).join(', ');
      params.push(...values);
      return `(${placeholders})`;
    });

    return this.queryMany(
      `INSERT INTO test_cases (${INSERT_COLUMNS.join(', ')})
       VALUES ${rowsSql.join(', ')}
       RETURNING ${METADATA_COLUMNS}`,
      params,
      client,
    );
  }

  /**
   * Load ALL test cases (public + hidden) for judging, in evaluation order.
   * The ONLY method that returns hidden expected outputs — consumed by the
   * judge worker/pipeline (and Admin), never by public endpoints.
   *
   * @param {string} problemId
   * @param {import('pg').PoolClient} [client]
   * @returns {Promise<Object[]>} full rows ordered by display_order.
   */
  getTestCasesForJudge(problemId, client) {
    return this.queryMany(
      `SELECT ${JUDGE_COLUMNS}
         FROM test_cases
        WHERE problem_id = $1
        ORDER BY display_order ASC, id ASC`,
      [problemId],
      client,
    );
  }

  /**
   * Load ONLY public (non-hidden) sample examples for a problem, in order.
   * Hard-filtered to is_hidden = false so hidden data can never leak here.
   *
   * @param {string} problemId
   * @param {import('pg').PoolClient} [client]
   * @returns {Promise<Object[]>} public rows ordered by display_order.
   */
  getPublicExamples(problemId, client) {
    return this.queryMany(
      `SELECT ${PUBLIC_COLUMNS}
         FROM test_cases
        WHERE problem_id = $1
          AND is_hidden = false
        ORDER BY display_order ASC, id ASC`,
      [problemId],
      client,
    );
  }

  /**
   * Delete every test case for a problem. Enables a transactional replace
   * (delete-all + createMany within one caller transaction).
   *
   * @param {string} problemId
   * @param {import('pg').PoolClient} [client]
   * @returns {Promise<number>} number of rows deleted.
   */
  async deleteAllTestCases(problemId, client) {
    const result = await this.query(
      `DELETE FROM test_cases
        WHERE problem_id = $1`,
      [problemId],
      client,
    );
    return result.rowCount;
  }
}

module.exports = { TestCaseRepository, testCaseRepository: new TestCaseRepository() };
