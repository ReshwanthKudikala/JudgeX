// Concrete storage resolution of test-case payloads (metadata → bytes).
//
// This sprint only creates the ABSTRACTION. Test-case rows separate metadata
// (kept in Postgres) from payload location (DATABASE_DESIGN.md §3.6):
//   - is_inline === true  → the payload IS the text in input_ref / expected_output_ref.
//   - is_inline === false → *_ref is an object-storage KEY; the bytes live externally.
// Inline payloads resolve here directly. External payloads are NOT implemented
// yet (no S3/MinIO/filesystem) — those calls throw NotImplementedError so the
// seam is explicit and callers never silently receive a storage key as content.

const { AppError } = require('../../shared/errors/base.error');

// 501-style "recognized but not yet implemented" error (external object storage).
class NotImplementedError extends AppError {
  constructor(message = 'This capability is not implemented yet.', details = null) {
    super(message, { statusCode: 501, code: 'NOT_IMPLEMENTED', details });
  }
}

// Resolve one payload ref given the row's inline flag.
function resolveRef({ isInline, ref, field }) {
  if (isInline) {
    return ref;
  }
  throw new NotImplementedError(
    `External object storage is not implemented yet (cannot resolve ${field}).`,
    { field, storageKey: ref },
  );
}

/**
 * Resolve a test case's input payload to text.
 * @param {{ is_inline: boolean, input_ref: string }} testCase
 * @returns {string} inline input text.
 * @throws {NotImplementedError} when the payload is external (is_inline === false).
 */
function resolveInput(testCase) {
  return resolveRef({
    isInline: testCase.is_inline,
    ref: testCase.input_ref,
    field: 'input',
  });
}

/**
 * Resolve a test case's expected-output payload to text.
 * @param {{ is_inline: boolean, expected_output_ref: string }} testCase
 * @returns {string} inline expected-output text.
 * @throws {NotImplementedError} when the payload is external (is_inline === false).
 */
function resolveExpectedOutput(testCase) {
  return resolveRef({
    isInline: testCase.is_inline,
    ref: testCase.expected_output_ref,
    field: 'expectedOutput',
  });
}

/**
 * Resolve both payloads of a test case, returning the row's identity/order
 * alongside the hydrated text so the judge pipeline can consume it directly.
 * @param {object} testCase - a test_cases row.
 * @returns {{ id: string, displayOrder: number, input: string, expectedOutput: string }}
 * @throws {NotImplementedError} when either payload is external.
 */
function resolveTestCase(testCase) {
  return {
    id: testCase.id,
    displayOrder: testCase.display_order,
    input: resolveInput(testCase),
    expectedOutput: resolveExpectedOutput(testCase),
  };
}

module.exports = {
  NotImplementedError,
  resolveInput,
  resolveExpectedOutput,
  resolveTestCase,
};
