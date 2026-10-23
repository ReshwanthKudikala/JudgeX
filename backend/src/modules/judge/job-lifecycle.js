// Pure helpers for Submit-job retry / terminal-state decisions.
//
// Delivery semantics: BullMQ is at-least-once. These helpers convert that into
// effectively-once finalization when combined with the Postgres CAS on
// submissions.status (see SubmissionRepository.updateSubmissionResult).
// They do not touch Docker, Redis, or HTTP.

const { UnrecoverableError } = require('bullmq');

const { NotFoundError, ValidationError, ConflictError } = require('../../shared/errors/http-errors');
const { JudgeError } = require('../../shared/errors/domain-errors');
const { NotImplementedError } = require('../../infrastructure/storage/storage.adapter');

const TERMINAL_STATUSES = Object.freeze(new Set(['completed', 'error']));
const NON_TERMINAL_STATUSES = Object.freeze(['queued', 'running']);

/**
 * True when this process invocation is the last BullMQ attempt.
 * `attemptsMade` counts prior failures, so the first run is 0.
 *
 * @param {{ attemptsMade?: number, opts?: { attempts?: number } }} job
 * @returns {boolean}
 */
function isLastAttempt(job) {
  const maxAttempts = Math.max(1, Number(job && job.opts && job.opts.attempts) || 1);
  const made = Number(job && job.attemptsMade) || 0;
  return made + 1 >= maxAttempts;
}

/**
 * Infrastructure blips (Docker daemon, Postgres, unexpected exceptions) are
 * retryable. Deterministic judging problems are not — retrying them wastes
 * sandbox capacity and cannot change the outcome.
 *
 * @param {unknown} err
 * @returns {boolean}
 */
function isUnrecoverableJudgeError(err) {
  if (!err) return false;
  if (err instanceof UnrecoverableError) return true;
  if (err instanceof NotFoundError) return true;
  if (err instanceof ValidationError) return true;
  if (err instanceof JudgeError) return true;
  if (err instanceof NotImplementedError) return true;
  if (err.code === 'NOT_IMPLEMENTED') return true;
  return false;
}

function isConflictSkip(err) {
  return err instanceof ConflictError;
}

module.exports = {
  TERMINAL_STATUSES,
  NON_TERMINAL_STATUSES,
  isLastAttempt,
  isUnrecoverableJudgeError,
  isConflictSkip,
};
