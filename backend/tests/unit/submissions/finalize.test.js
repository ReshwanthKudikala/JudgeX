/**
 * Terminal finalization: CAS, counters, and per-case rows.
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-unit-secret-change-me-32chars!!!';

const { SubmissionService } = require('../../../src/modules/submissions/submissions.service');
const { ConflictError } = require('../../../src/shared/errors/http-errors');

const SUB_ID = '00000000-0000-7000-8000-0000000000bb';
const USER_ID = '00000000-0000-7000-8000-0000000000cc';
const PROBLEM_ID = '00000000-0000-7000-8000-0000000000dd';

function makeService({ updateResult, existing } = {}) {
  const calls = {
    increment: 0,
    refresh: 0,
    replace: 0,
  };
  const svc = new SubmissionService({
    withTransaction: async (fn) => fn(null),
    submissionRepository: {
      updateSubmissionResult: async (...args) => {
        if (updateResult) return updateResult(...args);
        return {
          id: SUB_ID,
          user_id: USER_ID,
          problem_id: PROBLEM_ID,
          status: 'completed',
          verdict: 'accepted',
        };
      },
      replaceTestResults: async () => {
        calls.replace += 1;
      },
      refreshUserStatistics: async () => {
        calls.refresh += 1;
      },
      findById: async () =>
        existing || {
          id: SUB_ID,
          status: 'completed',
          verdict: 'accepted',
        },
    },
    problemRepository: {
      incrementSubmissionCounters: async () => {
        calls.increment += 1;
      },
    },
  });
  return { svc, calls };
}

describe('SubmissionService.completeSubmission', () => {
  it('writes test results, problem counters, and user_statistics in the CAS transaction', async () => {
    const { svc, calls } = makeService();
    const row = await svc.completeSubmission(SUB_ID, {
      verdict: 'accepted',
      testResults: [{ testIndex: 0, status: 'accepted', runtimeMs: 4, memoryKb: null }],
    });
    assert.equal(row.status, 'completed');
    assert.equal(row.verdict, 'accepted');
    assert.equal(calls.replace, 1);
    assert.equal(calls.increment, 1);
    assert.equal(calls.refresh, 1);
  });

  it('does not increment counters when the CAS misses a terminal row', async () => {
    const { svc, calls } = makeService({
      updateResult: async () => null,
      existing: { id: SUB_ID, status: 'completed', verdict: 'wrong_answer' },
    });
    await assert.rejects(
      () => svc.completeSubmission(SUB_ID, { verdict: 'accepted' }),
      ConflictError,
    );
    assert.equal(calls.replace, 0);
    assert.equal(calls.increment, 0);
    assert.equal(calls.refresh, 0);
  });
});

describe('SubmissionService.failSubmissionInternal', () => {
  it('refuses to overwrite an already-terminal submission', async () => {
    const svc = new SubmissionService({
      submissionRepository: {
        updateSubmissionResult: async () => null,
        findById: async () => ({ id: SUB_ID, status: 'completed', verdict: 'accepted' }),
      },
    });
    await assert.rejects(
      () => svc.failSubmissionInternal(SUB_ID, { message: 'late' }),
      ConflictError,
    );
  });
});
