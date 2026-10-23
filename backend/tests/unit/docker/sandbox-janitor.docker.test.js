const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const Docker = require('dockerode');

process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-unit-secret-change-me-32chars!!!';
process.env.LOG_LEVEL = process.env.LOG_LEVEL || 'error';

const { sweepOrphanSandboxes } = require('../../../src/modules/judge/sandbox-janitor');
const {
  SANDBOX_LABEL,
  SANDBOX_OWNER_LABEL,
  SANDBOX_STARTED_LABEL,
} = require('../../../src/modules/judge/sandbox-labels');

const IMAGE = 'judgex-python';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function dockerReady() {
  try {
    const docker = new Docker();
    await docker.ping();
    return docker;
  } catch {
    return null;
  }
}

function isMissingImage(error) {
  const status = error && (error.statusCode || error.status);
  const message = String((error && error.message) || error || '');
  return status === 404 || /no such image/i.test(message);
}

async function requiredImagePresent(docker, name) {
  try {
    await docker.getImage(name).inspect();
    return true;
  } catch (error) {
    if (isMissingImage(error)) return false;
    throw error;
  }
}

async function createProbe(docker, { name, owner, cmd, startedAt }) {
  const container = await docker.createContainer({
    name,
    Image: IMAGE,
    User: '1000:1000',
    Cmd: cmd,
    NetworkDisabled: true,
    Labels: {
      [SANDBOX_LABEL]: 'true',
      [SANDBOX_OWNER_LABEL]: owner,
      [SANDBOX_STARTED_LABEL]: String(startedAt),
    },
    HostConfig: {
      NetworkMode: 'none',
      AutoRemove: false,
    },
  });
  await container.start();
  return container;
}

describe('sandbox janitor against disposable containers', () => {
  it('removes an exited owned probe and leaves a long-running probe and another owner', async (t) => {
    const docker = await dockerReady();
    if (!docker) {
      t.skip('Docker daemon unreachable');
      return;
    }
    if (!(await requiredImagePresent(docker, IMAGE))) {
      t.skip(`Sandbox image ${IMAGE} is not present`);
      return;
    }

    const stamp = `${Date.now()}`;
    const owner = `judgex-janitor-probe-${stamp}`;
    const otherOwner = `judgex-janitor-other-${stamp}`;
    const names = {
      exited: `judgex-janitor-probe-exited-${stamp}`,
      running: `judgex-janitor-probe-running-${stamp}`,
      other: `judgex-janitor-probe-other-${stamp}`,
    };
    const created = [];

    try {
      const exited = await createProbe(docker, {
        name: names.exited,
        owner,
        cmd: ['python', '-c', 'print(1)'],
        startedAt: Date.now() - 60_000,
      });
      created.push(exited);
      await exited.wait();

      const running = await createProbe(docker, {
        name: names.running,
        owner,
        cmd: ['python', '-c', 'import time; time.sleep(120)'],
        startedAt: Date.now() - 600_000,
      });
      created.push(running);

      const other = await createProbe(docker, {
        name: names.other,
        owner: otherOwner,
        cmd: ['python', '-c', 'print(2)'],
        startedAt: Date.now() - 60_000,
      });
      created.push(other);
      await other.wait();

      const summary = await sweepOrphanSandboxes({
        docker,
        owner,
        graceMs: 0,
        now: Date.now(),
      });

      assert.ok(summary.removed >= 1);
      await assert.rejects(() => exited.inspect(), /no such container|404/i);

      const runningState = await running.inspect();
      assert.equal(runningState.State.Running, true);
      const otherState = await other.inspect();
      assert.equal(otherState.State.Status, 'exited');
    } finally {
      for (const container of created) {
        await container.remove({ force: true }).catch(() => {});
      }
      await sleep(50);
    }
  });
});
