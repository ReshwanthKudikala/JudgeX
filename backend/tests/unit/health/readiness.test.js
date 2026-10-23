const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-unit-secret-change-me-32chars!!!';
process.env.LOG_LEVEL = process.env.LOG_LEVEL || 'error';

const { isDegraded, sandboxDockerCheck } = require('../../../src/modules/health/health.service');
const {
  buildHeartbeatRecord,
  dockerFromHeartbeat,
} = require('../../../src/infrastructure/queue/worker-heartbeat');

describe('API readiness degradation', () => {
  it('does not degrade when the worker reports Docker is reachable', () => {
    const worker = { ok: true, docker: { ok: true } };
    assert.equal(isDegraded(true, worker), false);
    assert.deepEqual(sandboxDockerCheck(worker), { ok: true });
  });

  it('degrades when the worker reports Docker is unreachable', () => {
    const worker = { ok: true, docker: { ok: false, error: 'connect ENOENT /var/run/docker.sock' } };
    assert.equal(isDegraded(true, worker), true);
    assert.deepEqual(sandboxDockerCheck(worker), {
      ok: false,
      error: 'connect ENOENT /var/run/docker.sock',
    });
  });

  it('does not treat a missing API socket as a Docker failure when the worker did not probe', () => {
    const worker = { ok: true };
    assert.equal(isDegraded(true, worker), false);
    assert.deepEqual(sandboxDockerCheck(worker), {
      ok: false,
      reported: false,
      error: 'not_reported',
    });
  });

  it('degrades when the judge worker heartbeat is missing or stale', () => {
    assert.equal(isDegraded(true, { ok: false, error: 'no_heartbeat' }), true);
    assert.equal(isDegraded(true, null), true);
    assert.equal(
      isDegraded(true, { ok: false, error: 'stale_heartbeat', docker: { ok: true } }),
      true,
    );
  });

  it('does not mark the API degraded when the data plane itself is down', () => {
    assert.equal(isDegraded(false, { ok: false }), false);
  });
});

describe('worker heartbeat Docker probe', () => {
  it('stores an explicit Docker probe and ignores a non-boolean result', () => {
    const stored = JSON.parse(JSON.stringify(buildHeartbeatRecord({
      concurrency: 2,
      docker: { ok: false, error: 'daemon down' },
    })));
    assert.deepEqual(dockerFromHeartbeat(stored), { ok: false, error: 'daemon down' });

    const older = JSON.parse(JSON.stringify(buildHeartbeatRecord({ concurrency: 2 })));
    assert.equal(older.docker, undefined);
    assert.equal(dockerFromHeartbeat(older), undefined);
    assert.equal(dockerFromHeartbeat({ docker: { ok: 'yes' } }), undefined);
  });
});
