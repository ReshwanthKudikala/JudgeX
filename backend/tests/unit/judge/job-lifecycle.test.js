/**
 * Submit-job retry / terminal-state helpers.
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-unit-secret-change-me-32chars!!!';

const { UnrecoverableError } = require('bullmq');
const {
  isLastAttempt,
  isUnrecoverableJudgeError,
  isConflictSkip,
  TERMINAL_STATUSES,
} = require('../../../src/modules/judge/job-lifecycle');
const { NotFoundError, ValidationError, ConflictError } = require('../../../src/shared/errors/http-errors');
const { JudgeError, DockerError } = require('../../../src/shared/errors/domain-errors');

describe('job-lifecycle helpers', () => {
  it('treats the first of three attempts as not last', () => {
    assert.equal(isLastAttempt({ attemptsMade: 0, opts: { attempts: 3 } }), false);
    assert.equal(isLastAttempt({ attemptsMade: 1, opts: { attempts: 3 } }), false);
    assert.equal(isLastAttempt({ attemptsMade: 2, opts: { attempts: 3 } }), true);
  });

  it('treats a missing attempts option as a single attempt', () => {
    assert.equal(isLastAttempt({ attemptsMade: 0, opts: {} }), true);
    assert.equal(isLastAttempt({}), true);
  });

  it('classifies deterministic errors as unrecoverable and Docker blips as retryable', () => {
    assert.equal(isUnrecoverableJudgeError(new JudgeError('No test cases available for judging.')), true);
    assert.equal(isUnrecoverableJudgeError(new NotFoundError('Submission not found.')), true);
    assert.equal(isUnrecoverableJudgeError(new ValidationError('bad')), true);
    assert.equal(isUnrecoverableJudgeError(new UnrecoverableError('poison')), true);
    assert.equal(isUnrecoverableJudgeError(new DockerError('daemon down')), false);
    assert.equal(isUnrecoverableJudgeError(new Error('ECONNRESET')), false);
  });

  it('recognizes a CAS conflict as a skip, not a retry', () => {
    assert.equal(isConflictSkip(new ConflictError('already terminal')), true);
    assert.equal(isConflictSkip(new Error('nope')), false);
  });

  it('lists completed and error as the only terminal statuses', () => {
    assert.equal(TERMINAL_STATUSES.has('queued'), false);
    assert.equal(TERMINAL_STATUSES.has('running'), false);
    assert.equal(TERMINAL_STATUSES.has('completed'), true);
    assert.equal(TERMINAL_STATUSES.has('error'), true);
  });
});
