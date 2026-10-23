/**
 * processSubmissionJob retry vs terminal-persist regression tests.
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-unit-secret-change-me-32chars!!!';
process.env.LOG_LEVEL = process.env.LOG_LEVEL || 'error';

const { UnrecoverableError, DelayedError } = require('bullmq');
const { processSubmissionJob } = require('../../../src/workers/judge.worker');
const { ConflictError } = require('../../../src/shared/errors/http-errors');
const { DockerError, JudgeError } = require('../../../src/shared/errors/domain-errors');

const SUB_ID = '00000000-0000-7000-8000-0000000000aa';

function makeJob({ attemptsMade = 0, attempts = 3 } = {}) {
  return {
    id: SUB_ID,
    name: 'judge-submission',
    data: {
      submissionId: SUB_ID,
      schemaVersion: 1,
      enqueuedAt: new Date().toISOString(),
    },
    attemptsMade,
    opts: { attempts },
  };
}

function makeDeps({ status = 'queued', runPipeline, extra = {} } = {}) {
  const failCalls = [];
  const deps = {
    failCalls,
    submissions: {
      getSubmissionById: async () => ({
        id: SUB_ID,
        status,
        verdict: null,
      }),
      markSubmissionRunning: async () => ({ id: SUB_ID, status: 'running' }),
      failSubmissionInternal: async (id, opts) => {
        failCalls.push({ id, opts });
        return { id, status: 'error', verdict: 'internal_error' };
      },
      ...extra,
    },
    runPipeline:
      runPipeline ||
      (async () => {
        throw new DockerError('sandbox create failed');
      }),
    invalidateLeaderboardCache: async () => {
      deps.cacheCalls += 1;
    },
    cacheCalls: 0,
    acquireExecutionLock: async () => ({ acquired: true, release: async () => {} }),
  };
  return deps;
}

describe('processSubmissionJob retry policy', () => {
  it('does not persist internal_error on a retryable failure before the last attempt', async () => {
    const deps = makeDeps();
    await assert.rejects(
      () => processSubmissionJob(makeJob({ attemptsMade: 0, attempts: 3 }), deps),
      DockerError,
    );
    assert.equal(deps.failCalls.length, 0);
  });

  it('persists internal_error on the last retryable attempt then rethrows', async () => {
    const deps = makeDeps();
    await assert.rejects(
      () => processSubmissionJob(makeJob({ attemptsMade: 2, attempts: 3 }), deps),
      DockerError,
    );
    assert.equal(deps.failCalls.length, 1);
    assert.equal(deps.failCalls[0].id, SUB_ID);
  });

  it('persists internal_error immediately for unrecoverable errors and throws UnrecoverableError', async () => {
    const deps = makeDeps({
      runPipeline: async () => {
        throw new JudgeError('No test cases available for judging.');
      },
    });
    await assert.rejects(
      () => processSubmissionJob(makeJob({ attemptsMade: 0, attempts: 3 }), deps),
      UnrecoverableError,
    );
    assert.equal(deps.failCalls.length, 1);
  });

  it('skips already-terminal submissions without re-running the pipeline', async () => {
    let pipelineCalls = 0;
    const deps = makeDeps({
      status: 'completed',
      runPipeline: async () => {
        pipelineCalls += 1;
        return { verdict: 'accepted' };
      },
    });
    const result = await processSubmissionJob(makeJob(), deps);
    assert.equal(result.skipped, true);
    assert.equal(pipelineCalls, 0);
    assert.equal(deps.failCalls.length, 0);
  });

  it('skips when mark-running CAS loses to a terminal row', async () => {
    let pipelineCalls = 0;
    const deps = makeDeps({
      extra: {
        markSubmissionRunning: async () => {
          throw new ConflictError('Submission is already in a terminal state.');
        },
      },
      runPipeline: async () => {
        pipelineCalls += 1;
        return { verdict: 'accepted' };
      },
    });
    const result = await processSubmissionJob(makeJob(), deps);
    assert.equal(result.skipped, true);
    assert.equal(pipelineCalls, 0);
  });

  it('does not overwrite a successful verdict when cache invalidation fails', async () => {
    const deps = makeDeps({
      runPipeline: async () => ({ verdict: 'accepted' }),
    });
    deps.invalidateLeaderboardCache = async () => {
      throw new Error('redis down');
    };
    const result = await processSubmissionJob(makeJob(), deps);
    assert.equal(result.verdict, 'accepted');
    assert.equal(deps.failCalls.length, 0);
  });

  it('runs one pipeline when two deliveries overlap, then allows the next attempt', async () => {
    let held = false;
    let inFlight = 0;
    let maxInFlight = 0;
    let releases = 0;
    let pipelineCalls = 0;
    let unblockPipeline;
    const duplicateArrived = new Promise((resolve) => {
      unblockPipeline = resolve;
    });
    const deps = makeDeps({
      runPipeline: async () => {
        pipelineCalls += 1;
        inFlight += 1;
        maxInFlight = Math.max(maxInFlight, inFlight);
        await duplicateArrived;
        inFlight -= 1;
        return { verdict: 'accepted' };
      },
    });
    deps.acquireExecutionLock = async () => {
      if (held) {
        unblockPipeline();
        return { acquired: false, release: async () => {} };
      }
      held = true;
      return {
        acquired: true,
        release: async () => {
          held = false;
          releases += 1;
        },
      };
    };

    const duplicate = makeJob();
    let delayed = 0;
    duplicate.moveToDelayed = async () => {
      delayed += 1;
    };

    const results = await Promise.allSettled([
      processSubmissionJob(makeJob(), deps),
      processSubmissionJob(duplicate, deps),
    ]);
    const fulfilled = results.filter((result) => result.status === 'fulfilled');
    const rejected = results.filter((result) => result.status === 'rejected');
    assert.equal(fulfilled.length, 1);
    assert.equal(fulfilled[0].value.verdict, 'accepted');
    assert.equal(rejected.length, 1);
    assert.ok(rejected[0].reason instanceof DelayedError);
    assert.equal(maxInFlight, 1);
    assert.equal(delayed, 1);
    assert.equal(releases, 1);
    assert.equal(deps.failCalls.length, 0);

    const retry = await processSubmissionJob(makeJob({ attemptsMade: 1 }), deps);
    assert.equal(retry.verdict, 'accepted');
    assert.equal(pipelineCalls, 2);
    assert.equal(deps.failCalls.length, 0);
  });

  it('does not persist internal_error when the last attempt loses the execution lock', async () => {
    let pipelineCalls = 0;
    const deps = makeDeps({
      runPipeline: async () => {
        pipelineCalls += 1;
        return { verdict: 'accepted' };
      },
    });
    deps.acquireExecutionLock = async () => ({ acquired: false, release: async () => {} });
    const job = makeJob({ attemptsMade: 2, attempts: 3 });
    let delayed = 0;
    job.moveToDelayed = async () => {
      delayed += 1;
    };

    await assert.rejects(
      () => processSubmissionJob(job, deps),
      (err) => err instanceof DelayedError,
    );
    assert.equal(pipelineCalls, 0);
    assert.equal(delayed, 1);
    assert.equal(deps.failCalls.length, 0);
  });
});
