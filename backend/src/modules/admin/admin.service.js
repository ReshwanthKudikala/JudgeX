// Admin business logic: problem CRUD and test-case management.
//
// This is a thin COORDINATION layer over existing domain services — it owns no
// duplicated problem/test-case rules of its own. Problem persistence lives in
// ProblemService; test-case persistence lives in TestCaseService.
// The only admin-specific concern here is translating the admin API's payload
// (inline input/expected text, isSample) into repository-shaped records.

const { problemService } = require('../problems/problems.service');
const { testCaseService } = require('../problems/testcase.service');

/**
 * Resolve isHidden from either isHidden or isSample (isSample wins when both set).
 * @param {{ isHidden?: boolean, isSample?: boolean }} testCase
 * @param {boolean} [defaultHidden=true]
 */
function resolveIsHidden(testCase, defaultHidden = true) {
  if (typeof testCase.isSample === 'boolean') {
    return !testCase.isSample;
  }
  if (typeof testCase.isHidden === 'boolean') {
    return testCase.isHidden;
  }
  return defaultHidden;
}

/**
 * Map an admin-supplied inline case to the repository/test-case shape.
 * (Small inline payloads only; external object storage is a later sprint.)
 */
function toTestCaseRecord(testCase, index) {
  const input = testCase.input;
  const expectedOutput = testCase.expectedOutput;
  return {
    inputRef: input,
    expectedOutputRef: expectedOutput,
    isHidden: resolveIsHidden(testCase, true),
    isInline: true,
    sizeBytes: Buffer.byteLength(input, 'utf8') + Buffer.byteLength(expectedOutput, 'utf8'),
    checksum: null,
    displayOrder: testCase.order ?? testCase.displayOrder ?? index,
    explanation: testCase.explanation ?? null,
  };
}

/**
 * Map a DB admin row into the public admin API shape.
 * Hidden expected outputs ARE included — admin-only endpoints.
 */
function toAdminTestCaseDto(row) {
  const isHidden = Boolean(row.is_hidden);
  return {
    id: row.id,
    problemId: row.problem_id,
    input: row.input_ref,
    expectedOutput: row.expected_output_ref,
    explanation: row.explanation ?? null,
    isHidden,
    isSample: !isHidden,
    order: row.display_order,
    displayOrder: row.display_order,
    isInline: row.is_inline,
    sizeBytes: row.size_bytes != null ? Number(row.size_bytes) : 0,
    createdAt: row.created_at,
  };
}

class AdminService {
  constructor({ problemService: probSvc, testCaseService: tcSvc } = {}) {
    this.problemService = probSvc || problemService;
    this.testCaseService = tcSvc || testCaseService;
  }

  createProblem(data) {
    return this.problemService.createProblem(data);
  }

  updateProblem(id, data) {
    return this.problemService.updateProblem(id, data);
  }

  deleteProblem(id) {
    return this.problemService.deleteProblem(id);
  }

  // Atomically replace a problem's entire test-case set (existing contract).
  replaceTestCases(problemId, testCases = []) {
    const records = testCases.map(toTestCaseRecord);
    return this.testCaseService.replaceAllTestCases(problemId, records);
  }

  async createTestCase(problemId, body) {
    const record = toTestCaseRecord(body, body.order ?? body.displayOrder ?? 0);
    const row = await this.testCaseService.createTestCase(problemId, record);
    return toAdminTestCaseDto(row);
  }

  async listTestCases(problemId) {
    const rows = await this.testCaseService.listTestCases(problemId);
    return rows.map(toAdminTestCaseDto);
  }

  async updateTestCase(id, body) {
    const existing = await this.testCaseService.getTestCaseById(id);
    const patch = {};

    if (body.input !== undefined) patch.inputRef = body.input;
    if (body.expectedOutput !== undefined) patch.expectedOutputRef = body.expectedOutput;
    if (body.explanation !== undefined) patch.explanation = body.explanation;
    if (body.order !== undefined) patch.displayOrder = body.order;
    if (body.displayOrder !== undefined) patch.displayOrder = body.displayOrder;

    if (body.isSample !== undefined || body.isHidden !== undefined) {
      patch.isHidden = resolveIsHidden(body, true);
    }

    if (patch.inputRef !== undefined || patch.expectedOutputRef !== undefined) {
      const input = patch.inputRef !== undefined ? patch.inputRef : existing.input_ref;
      const expected =
        patch.expectedOutputRef !== undefined
          ? patch.expectedOutputRef
          : existing.expected_output_ref;
      patch.sizeBytes =
        Buffer.byteLength(String(input), 'utf8') + Buffer.byteLength(String(expected), 'utf8');
      patch.isInline = true;
    }

    const row = await this.testCaseService.updateTestCase(id, patch);
    return toAdminTestCaseDto(row);
  }

  deleteTestCase(id) {
    return this.testCaseService.deleteTestCase(id);
  }
}

module.exports = {
  AdminService,
  adminService: new AdminService(),
  toTestCaseRecord,
  toAdminTestCaseDto,
};
