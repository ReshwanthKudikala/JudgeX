/**
 * The options object passed to Docker createContainer, plus the adapter's
 * own timeout and cleanup behavior. The Docker daemon is not contacted.
 */

const { describe, it, mock } = require('node:test');
const assert = require('node:assert/strict');

process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-unit-secret-change-me-32chars!!!';

const Docker = require('dockerode');
const { config } = require('../../../src/config');
const {
  SANDBOX_LABEL,
  SANDBOX_OWNER_LABEL,
  SANDBOX_STARTED_LABEL,
} = require('../../../src/modules/judge/sandbox-labels');
const {
  createSandbox,
  cleanup,
  executeCommand,
} = require('../../../src/infrastructure/docker/docker.adapter');

describe('sandbox createContainer options', () => {
  it('passes the locked-down host config, labels, and explicit cleanup', async () => {
    const seen = [];
    const removed = [];
    mock.method(Docker.prototype, 'createContainer', async (options) => {
      seen.push(options);
      return {
        id: 'container-under-test',
        async start() {},
        async remove(opts) {
          removed.push(opts);
        },
      };
    });

    let sandbox;
    try {
      sandbox = await createSandbox({ image: 'judgex-python' });
      assert.equal(seen.length, 1);
      const options = seen[0];
      const host = options.HostConfig;

      assert.equal(options.Image, 'judgex-python');
      assert.equal(options.User, '1000:1000');
      assert.equal(options.NetworkDisabled, true);
      assert.equal(options.Tty, false);
      assert.deepEqual(options.Cmd, ['tail', '-f', '/dev/null']);
      assert.equal(options.Labels[SANDBOX_LABEL], 'true');
      assert.equal(options.Labels[SANDBOX_OWNER_LABEL], config.judge.sandboxOwner);
      assert.match(options.Labels[SANDBOX_STARTED_LABEL], /^\d+$/);

      assert.equal(host.NetworkMode, 'none');
      assert.deepEqual(host.CapDrop, ['ALL']);
      assert.deepEqual(host.SecurityOpt, ['no-new-privileges']);
      assert.equal(host.ReadonlyRootfs, true);
      assert.equal(host.AutoRemove, false);
      assert.equal(typeof host.PidsLimit, 'number');
      assert.ok(host.PidsLimit > 0);
      assert.equal(host.PidsLimit, config.judge.pidLimit);
      const memoryBytes = config.judge.memoryLimitMb * 1024 * 1024;
      assert.equal(host.Memory, memoryBytes);
      assert.equal(host.MemorySwap, memoryBytes);
      assert.equal(host.Binds.length, 1);
      assert.match(host.Binds[0], /:\/workspace:rw$/);

      await cleanup(sandbox);
      sandbox = null;
      assert.deepEqual(removed, [{ force: true }]);
    } finally {
      if (sandbox) await cleanup(sandbox);
      Docker.prototype.createContainer.mock.restore();
    }
  });

  it('kills the container when a command exceeds its wall-clock timeout', async () => {
    let killSignal = null;
    const container = {
      async exec() {
        return {
          async start() {
            return { destroy() {} };
          },
          async inspect() {
            return { Running: killSignal === null, ExitCode: null };
          },
        };
      },
      async kill({ signal }) {
        killSignal = signal;
      },
      modem: {
        demuxStream() {},
      },
      async inspect() {
        return { State: { OOMKilled: false } };
      },
    };

    const result = await executeCommand(
      {
        container,
        hostDir: process.cwd(),
        workdir: '/workspace',
        user: '1000:1000',
      },
      { cmd: ['python3', '-c', 'import time; time.sleep(30)'], timeoutMs: 40 },
    );

    assert.equal(killSignal, 'SIGKILL');
    assert.equal(result.timedOut, true);
    assert.equal(result.oomKilled, false);
  });
});
