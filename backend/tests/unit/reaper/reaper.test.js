/**
 * Sprint 16 — Stuck queued-submission reaper unit tests.
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-unit-secret-change-me-32chars!!!';
process.env.FEATURE_AI_COMPILE_EXPLANATION = process.env.FEATURE_AI_COMPILE_EXPLANATION || 'true';

const { ReaperService, isDuplicateJobError } = require('../../../src/modules/reaper/reaper.service');
const { QueueError } = require('../../../src/shared/errors/domain-errors');

const ID_A = '00000000-0000-7000-8000-00000000000a';
const ID_B = '00000000-0000-7000-8000-00000000000b';

function stuckRow(id) {
  return {
    id,
    status: 'queued',
    submitted_at: new Date(Date.now() - 120_000),
  };
}

describe('Queued-submission reaper', () => {
  it('successfully re-enqueues stuck queued submissions', async () => {
    const enqueued = [];
    const svc = new ReaperService({
      stuckThresholdMs: 60_000,
      batchSize: 50,
      submissionRepository: {
        findStuckQueued: async () => [stuckRow(ID_A), stuckRow(ID_B)],
      },
      getJob: async () => null,
      enqueueSubmission: async (id) => {
        enqueued.push(id);
        return { id };
      },
    });

    const summary = await svc.sweep();

    assert.equal(summary.scanned, 2);
    assert.equal(summary.requeued, 2);
    assert.equal(summary.alreadyEnqueued, 0);
    assert.equal(summary.failed, 0);
    assert.equal(summary.redisUnavailable, false);
    assert.deepEqual(enqueued, [ID_A, ID_B]);
  });

  it('treats Redis/queue failures as redisUnavailable and stops the pass', async () => {
    const enqueued = [];
    const svc = new ReaperService({
      stuckThresholdMs: 60_000,
      batchSize: 50,
      submissionRepository: {
        findStuckQueued: async () => [stuckRow(ID_A), stuckRow(ID_B)],
      },
      getJob: async () => null,
      enqueueSubmission: async (id) => {
        enqueued.push(id);
        throw new QueueError('Failed to enqueue submission for judging.', {
          submissionId: id,
          cause: 'Connection is closed.',
        });
      },
    });

    const summary = await svc.sweep();

    assert.equal(summary.scanned, 2);
    assert.equal(summary.requeued, 0);
    assert.equal(summary.failed, 1);
    assert.equal(summary.redisUnavailable, true);
    // Stopped after the first Redis failure — second id never attempted.
    assert.deepEqual(enqueued, [ID_A]);
  });

  it('skips submissions that already have a BullMQ job (already-enqueued)', async () => {
    const enqueued = [];
    const svc = new ReaperService({
      stuckThresholdMs: 60_000,
      batchSize: 50,
      submissionRepository: {
        findStuckQueued: async () => [stuckRow(ID_A)],
      },
      getJob: async () => ({
        id: ID_A,
        getState: async () => 'waiting',
      }),
      enqueueSubmission: async (id) => {
        enqueued.push(id);
        return { id };
      },
    });

    const summary = await svc.sweep();

    assert.equal(summary.scanned, 1);
    assert.equal(summary.alreadyEnqueued, 1);
    assert.equal(summary.requeued, 0);
    assert.equal(enqueued.length, 0);
  });

  it('does not create duplicate jobs when BullMQ reports jobId already exists', async () => {
    let enqueueCalls = 0;
    const svc = new ReaperService({
      stuckThresholdMs: 60_000,
      batchSize: 50,
      submissionRepository: {
        findStuckQueued: async () => [stuckRow(ID_A)],
      },
      // Race: job appears between getJob and add.
      getJob: async () => null,
      enqueueSubmission: async () => {
        enqueueCalls += 1;
        throw new QueueError('Failed to enqueue submission for judging.', {
          submissionId: ID_A,
          cause: `Job ${ID_A} already exists`,
        });
      },
    });

    const summary = await svc.sweep();

    assert.equal(enqueueCalls, 1);
    assert.equal(summary.alreadyEnqueued, 1);
    assert.equal(summary.requeued, 0);
    assert.equal(summary.failed, 0);
    assert.equal(isDuplicateJobError(
      new QueueError('Failed to enqueue submission for judging.', {
        cause: `Job ${ID_A} already exists`,
      }),
    ), true);
  });

  it('never enqueues the same stuck id twice in one sweep when a job appears', async () => {
    const enqueued = [];
    const jobs = new Map();

    const svc = new ReaperService({
      stuckThresholdMs: 60_000,
      batchSize: 50,
      submissionRepository: {
        // Same id returned twice would be a repo bug; still guard via job map.
        findStuckQueued: async () => [stuckRow(ID_A), stuckRow(ID_A)],
      },
      getJob: async (id) => {
        const state = jobs.get(id);
        if (!state) return null;
        return { id, getState: async () => state };
      },
      enqueueSubmission: async (id) => {
        if (jobs.has(id)) {
          throw new QueueError('Failed to enqueue submission for judging.', {
            cause: `Job ${id} already exists`,
          });
        }
        jobs.set(id, 'waiting');
        enqueued.push(id);
        return { id };
      },
    });

    const summary = await svc.sweep();

    assert.equal(enqueued.length, 1);
    assert.equal(summary.requeued, 1);
    assert.equal(summary.alreadyEnqueued, 1);
  });
});
