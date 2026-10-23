const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-unit-secret-change-me-32chars!!!';
process.env.LOG_LEVEL = process.env.LOG_LEVEL || 'error';

const {
  classifySandboxContainer,
  sweepOrphanSandboxes,
  startSandboxJanitor,
} = require('../../../src/modules/judge/sandbox-janitor');
const {
  SANDBOX_LABEL,
  SANDBOX_OWNER_LABEL,
  SANDBOX_STARTED_LABEL,
} = require('../../../src/modules/judge/sandbox-labels');

const OWNER = 'judgex-test';
const NOW = 1_000_000;
const STALE_AFTER_MS = 300_000;
const GRACE_MS = 5_000;

function labels(startedAt, owner = OWNER) {
  return {
    [SANDBOX_LABEL]: 'true',
    [SANDBOX_OWNER_LABEL]: owner,
    [SANDBOX_STARTED_LABEL]: String(startedAt),
  };
}

function info({ id, state, startedAt, owner, extraLabels }) {
  return {
    Id: id,
    State: state,
    Labels: extraLabels || labels(startedAt, owner),
  };
}

describe('sandbox janitor classification', () => {
  const base = { owner: OWNER, now: NOW, staleAfterMs: STALE_AFTER_MS, graceMs: GRACE_MS };

  it('keeps a young running sandbox and a container listed as active', () => {
    assert.equal(
      classifySandboxContainer(info({ id: 'live', state: 'running', startedAt: NOW - 1000 }), base),
      'active',
    );
    const stale = info({ id: 'held', state: 'running', startedAt: NOW - 400_000 });
    assert.equal(
      classifySandboxContainer(stale, { ...base, activeIds: new Set(['held']) }),
      'active',
    );
  });

  it('keeps a long-running sandbox and marks an old exited sandbox as stale', () => {
    assert.equal(
      classifySandboxContainer(info({ id: 'old', state: 'running', startedAt: NOW - 400_000 }), base),
      'active',
    );
    assert.equal(
      classifySandboxContainer(info({ id: 'dead', state: 'exited', startedAt: NOW - 10_000 }), base),
      'stale',
    );
  });

  it('keeps an exited sandbox inside the grace window', () => {
    assert.equal(
      classifySandboxContainer(info({ id: 'fresh', state: 'exited', startedAt: NOW - 1000 }), base),
      'active',
    );
  });

  it('skips missing labels, other owners, and unknown states', () => {
    assert.equal(
      classifySandboxContainer(info({ id: 'plain', state: 'running', extraLabels: {} }), base),
      'skip',
    );
    assert.equal(
      classifySandboxContainer(
        info({ id: 'other', state: 'exited', startedAt: NOW - 999_999, owner: 'judgex-production' }),
        base,
      ),
      'skip',
    );
    assert.equal(
      classifySandboxContainer(
        info({
          id: 'partial',
          state: 'running',
          extraLabels: { [SANDBOX_LABEL]: 'true' },
        }),
        base,
      ),
      'skip',
    );
    assert.equal(
      classifySandboxContainer(info({ id: 'odd', state: 'restarting', startedAt: NOW - 999_999 }), base),
      'skip',
    );
  });
});

describe('sweepOrphanSandboxes', () => {
  it('removes only stale owned sandboxes and continues after a removal failure', async () => {
    const removed = [];
    const listed = [
      info({ id: 'live', state: 'running', startedAt: NOW - 1000 }),
      info({ id: 'old', state: 'running', startedAt: NOW - 400_000 }),
      info({ id: 'broken', state: 'exited', startedAt: NOW - 20_000 }),
      info({ id: 'plain', state: 'exited', extraLabels: { app: 'nginx' } }),
      info({ id: 'other', state: 'running', startedAt: NOW - 999_999, owner: 'judgex-production' }),
    ];
    let filters;
    const docker = {
      async listContainers(options) {
        filters = options.filters;
        return listed;
      },
      getContainer(id) {
        return {
          async remove() {
            if (id === 'broken') throw new Error('daemon busy');
            removed.push(id);
          },
        };
      },
    };

    const summary = await sweepOrphanSandboxes({
      docker,
      owner: OWNER,
      now: NOW,
      staleAfterMs: STALE_AFTER_MS,
      graceMs: GRACE_MS,
    });

    assert.deepEqual(filters.label, ['judgex.sandbox=true', 'judgex.sandbox.owner=judgex-test']);
    assert.deepEqual(removed, []);
    assert.equal(summary.removed, 0);
    assert.equal(summary.failed, 1);
    assert.equal(summary.active, 2);
    assert.equal(summary.skipped, 2);
    assert.equal(removed.includes('live'), false);
    assert.equal(removed.includes('plain'), false);
    assert.equal(removed.includes('other'), false);
  });

  it('does not contact Docker unless the owner was configured explicitly', async () => {
    let listed = false;
    const summary = await sweepOrphanSandboxes({
      ownerExplicit: false,
      docker: {
        async listContainers() {
          listed = true;
          return [];
        },
        getContainer() {
          throw new Error('Docker should not be used');
        },
      },
    });
    assert.equal(listed, false);
    assert.equal(summary.removed, 0);
    assert.equal(summary.skippedReason, 'owner_not_configured');
  });

  it('does not sweep when the scheduler is only constructed', async () => {
    let calls = 0;
    const handle = startSandboxJanitor({
      intervalMs: 60_000,
      sweep: async () => {
        calls += 1;
      },
    });
    await new Promise((resolve) => setTimeout(resolve, 30));
    handle.stop();
    assert.equal(calls, 0);
  });
});
