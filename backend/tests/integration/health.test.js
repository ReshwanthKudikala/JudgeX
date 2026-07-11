const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

require('./helpers/bootstrap');
const { registerSuiteHooks } = require('./helpers/hooks');
const { api } = require('./helpers/fixtures');
const { query } = require('./helpers/setup');

const { requireInfra } = registerSuiteHooks();

describe('Health / readiness', () => {
  it('liveness /health does not depend on infrastructure checks', async (t) => {
    if (!requireInfra(t)) return;

    const res = await api().get('/health');
    assert.equal(res.status, 200);
    assert.equal(res.body.status, 'ok');
    assert.ok(res.body.version);
    assert.equal(typeof res.body.uptime, 'number');
    assert.equal(res.body.checks, undefined);
  });

  it('readiness /ready reports postgres, redis, and bullmq', async (t) => {
    if (!requireInfra(t)) return;

    const res = await api().get('/ready');
    assert.equal(res.status, 200);
    assert.equal(res.body.ready, true);
    assert.equal(res.body.status, 'ready');
    assert.equal(res.body.checks.postgres.ok, true);
    assert.equal(res.body.checks.redis.ok, true);
    assert.equal(res.body.checks.bullmq.ok, true);
    assert.ok(res.body.checks.bullmq.counts);
    assert.equal(res.body.diagnostics.queue.name, 'judge');
    assert.ok('reaper' in res.body.diagnostics);
  });

  it('GET /api/v1/health mirrors readiness diagnostics', async (t) => {
    if (!requireInfra(t)) return;

    const res = await api().get('/api/v1/health');
    assert.equal(res.status, 200);
    assert.equal(res.body.ready, true);
    assert.ok(res.body.checks.postgres);
    assert.ok(res.body.diagnostics.queue.counts);
  });

  it('liveness /health/live mirrors /health', async (t) => {
    if (!requireInfra(t)) return;

    const res = await api().get('/health/live');
    assert.equal(res.status, 200);
    assert.equal(res.body.status, 'ok');
    assert.ok(res.headers['x-request-id']);
  });

  it('readiness /health/ready includes worker and docker checks', async (t) => {
    if (!requireInfra(t)) return;

    const res = await api().get('/health/ready');
    assert.ok([200, 503].includes(res.status));
    assert.ok(res.body.checks.postgres);
    assert.ok(res.body.checks.redis);
    assert.ok(res.body.checks.bullmq);
    assert.ok(res.body.checks.worker);
    assert.ok(res.body.checks.docker);
    assert.equal(typeof res.body.uptime, 'number');
    assert.ok(res.body.version);
  });

  it('GET /metrics exposes Prometheus text', async (t) => {
    if (!requireInfra(t)) return;

    const res = await api().get('/metrics');
    assert.equal(res.status, 200);
    assert.match(String(res.headers['content-type'] || ''), /text\/plain|openmetrics/i);
    assert.match(res.text, /judgex_/);
  });

  it('schema_migrations tracks the initial migration', async (t) => {
    if (!requireInfra(t)) return;

    const { rows } = await query(
      `SELECT id FROM schema_migrations WHERE id = '001_init_schema'`,
    );
    assert.equal(rows.length, 1);
  });
});
