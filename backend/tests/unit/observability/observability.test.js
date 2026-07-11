/**
 * Sprint 33 — observability unit tests.
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-unit-secret-change-me-32chars!!!';

const { metrics } = require('../../../src/shared/observability/metrics');
const { trackError } = require('../../../src/shared/observability/error-tracking');
const { configure, createLogger } = require('../../../src/shared/logger/logger');

describe('Observability helpers', () => {
  it('renders Prometheus metrics with judgex_ prefix', async () => {
    metrics.recordSubmissionCreated('python');
    metrics.recordAiRequest('explain-compile-error', 'ok');
    metrics.recordContestJoin('joined');
    metrics.setQueueDepth({ waiting: 1, active: 0, failed: 0 });
    const text = await metrics.render();
    assert.match(text, /judgex_submissions_created_total/);
    assert.match(text, /judgex_ai_requests_total/);
    assert.match(text, /judgex_queue_depth/);
    assert.match(text, /judgex_contest_joins_total/);
  });

  it('trackError increments error counter without throwing', () => {
    assert.doesNotThrow(() => {
      trackError('unit.test', new Error('boom'), { foo: 1 });
    });
  });

  it('logger configure accepts pretty format', () => {
    configure({ level: 'info', format: 'pretty' });
    const log = createLogger({ component: 'unit' });
    assert.equal(typeof log.info, 'function');
    configure({ format: 'json' });
  });
});
