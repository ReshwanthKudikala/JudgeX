const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const Docker = require('dockerode');

const { sweepOrphanSandboxes } = require('../../src/modules/judge/sandbox-janitor');
const {
  SANDBOX_LABEL,
  SANDBOX_OWNER_LABEL,
  SANDBOX_STARTED_LABEL,
} = require('../../src/modules/judge/sandbox-labels');

const PROBE_OWNER = 'judgex-janitor-probe';
const OTHER_OWNER = 'judgex-janitor-other';
const IMAGE = 'judgex-python';

function labels(owner, startedAt) {
  return {
    [SANDBOX_LABEL]: 'true',
    [SANDBOX_OWNER_LABEL]: owner,
    [SANDBOX_STARTED_LABEL]: String(startedAt),
  };
}

async function imageExists(docker, name) {
  try {
    await docker.getImage(name).inspect();
    return true;
  } catch {
    return false;
  }
}

describe('Sandbox janitor against disposable containers', () => {
  it('removes only an exited probe container and leaves a long-running one', { timeout: 60000 }, async (t) => {
    const configuredOwner = process.env.JUDGE_SANDBOX_OWNER || '';
    assert.notEqual(PROBE_OWNER, 'judgex-production');
    assert.notEqual(PROBE_OWNER, configuredOwner);
    assert.notEqual(configuredOwner, 'judgex-production');

    const docker = new Docker();
    try {
      await docker.ping();
    } catch {
      t.skip('Docker daemon unreachable');
      return;
    }
    if (!(await imageExists(docker, IMAGE))) {
      t.skip(`Sandbox image ${IMAGE} is not present`);
      return;
    }

    const created = new Set();
    const removed = [];
    const guarded = {
      listContainers(options) {
        const expected = [`${SANDBOX_LABEL}=true`, `${SANDBOX_OWNER_LABEL}=${PROBE_OWNER}`];
        assert.deepEqual(options.filters.label, expected);
        return docker.listContainers(options);
      },
      getContainer(id) {
        if (!created.has(id)) {
          throw new Error(`Refusing to remove container ${id}; it was not created by this probe.`);
        }
        const container = docker.getContainer(id);
        return {
          async remove(opts) {
            removed.push(id);
            return container.remove(opts);
          },
        };
      },
    };

    const oldStart = Date.now() - 10 * 60 * 1000;
    let running;
    let exited;
    let other;
    try {
      running = await docker.createContainer({
        Image: IMAGE,
        Cmd: ['python', '-c', 'import time; time.sleep(120)'],
        User: '1000:1000',
        Labels: labels(PROBE_OWNER, oldStart),
        HostConfig: { NetworkMode: 'none' },
      });
      created.add(running.id);
      await running.start();

      exited = await docker.createContainer({
        Image: IMAGE,
        Cmd: ['python', '-c', 'print(1)'],
        User: '1000:1000',
        Labels: labels(PROBE_OWNER, oldStart),
        HostConfig: { NetworkMode: 'none' },
      });
      created.add(exited.id);
      await exited.start();
      await exited.wait();

      other = await docker.createContainer({
        Image: IMAGE,
        Cmd: ['python', '-c', 'print(1)'],
        User: '1000:1000',
        Labels: labels(OTHER_OWNER, oldStart),
        HostConfig: { NetworkMode: 'none' },
      });
      created.add(other.id);
      await other.start();
      await other.wait();

      const summary = await sweepOrphanSandboxes({
        docker: guarded,
        owner: PROBE_OWNER,
        ownerExplicit: true,
        now: Date.now(),
        graceMs: 1000,
      });

      const runningState = await running.inspect();
      assert.equal(runningState.State.Running, true);
      assert.equal(removed.includes(running.id), false);
      await assert.rejects(() => exited.inspect());
      assert.deepEqual(removed, [exited.id]);
      const otherState = await other.inspect();
      assert.equal(otherState.State.Status, 'exited');
      assert.equal(summary.removed, 1);
      assert.equal(summary.active >= 1, true);
    } finally {
      for (const id of created) {
        try {
          await docker.getContainer(id).remove({ force: true });
        } catch {
          /* already removed or never started */
        }
      }
    }
  });
});
